import { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ChatProvider, useChat, buildSessionTitle } from './ChatContext';
import { ApiError } from '../services/api';

const useAuthMock = vi.fn(() => ({ session: { access_token: 'token-123' } }));

vi.mock('./AuthContext', () => ({
  useAuth: () => useAuthMock()
}));

const fetchChatSessionsMock = vi.fn();
const fetchChatHistoryMock = vi.fn();
const sendChatMessageMock = vi.fn();

vi.mock('../services/chat', () => ({
  fetchChatHistory: (...args: unknown[]) => fetchChatHistoryMock(...args),
  fetchChatSessions: (...args: unknown[]) => fetchChatSessionsMock(...args),
  sendChatMessage: (...args: unknown[]) => sendChatMessageMock(...args)
}));

const ensureCrypto = () => {
  if (!globalThis.crypto || typeof globalThis.crypto.randomUUID !== 'function') {
    globalThis.crypto = { randomUUID: () => 'test-random-uuid' } as unknown as Crypto;
  }
};

describe('ChatContext', () => {
  beforeEach(() => {
    ensureCrypto();
    fetchChatSessionsMock.mockReset().mockResolvedValue([]);
    fetchChatHistoryMock.mockReset().mockResolvedValue([]);
    sendChatMessageMock.mockReset();
    useAuthMock.mockReturnValue({ session: { access_token: 'token-123' } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('buildSessionTitle truncates long content', () => {
    const longText = 'x'.repeat(80);
    const result = buildSessionTitle(longText);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBe(61);
  });

  it('startNewChat creates placeholder session', async () => {
    const StartChatConsumer = () => {
      const { startNewChat, sessions } = useChat();
      useEffect(() => {
        startNewChat();
      }, [startNewChat]);
      return (
        <>
          <div data-testid="session-count">{sessions.length}</div>
          <div data-testid="session-title">{sessions[0]?.title ?? ''}</div>
        </>
      );
    };

    render(
      <ChatProvider>
        <StartChatConsumer />
      </ChatProvider>
    );

    await waitFor(() => expect(screen.getByTestId('session-count').textContent).toBe('1'));
    expect(screen.getByTestId('session-title').textContent).toBe('Nova conversa');
  });

  it('sendMessage handles ApiError and clears optimistic message', async () => {
    sendChatMessageMock.mockRejectedValue(new ApiError('bad request', 400));

    const ErrorConsumer = () => {
      const { sendMessage, error, messages } = useChat();
      useEffect(() => {
        const run = async () => {
          await sendMessage('olá');
        };
        void run();
      }, [sendMessage]);
      return (
        <>
          <div data-testid="error">{error ?? ''}</div>
          <div data-testid="message-count">{messages.length}</div>
        </>
      );
    };

    render(
      <ChatProvider>
        <ErrorConsumer />
      </ChatProvider>
    );

    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('bad request'));
    expect(screen.getByTestId('message-count').textContent).toBe('0');
  });

  it('hydrates existing chat and loads history', async () => {
    const sessionId = 'chat-42';
    fetchChatSessionsMock.mockResolvedValue([
      { id: sessionId, title: 'Sessão', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', messageCount: 1 }
    ]);
    fetchChatHistoryMock.mockResolvedValue([
      { id: 'msg-1', role: 'assistant', content: 'oi', createdAt: '2024-01-01T00:00:00Z', chatId: sessionId }
    ]);

    const HistoryConsumer = () => {
      const { messages, sessions, isLoading } = useChat();
      return (
        <>
          <div data-testid="loaded">{isLoading ? 'loading' : 'done'}</div>
          <div data-testid="history-count">{messages.length}</div>
          <div data-testid="session-id">{sessions[0]?.id ?? ''}</div>
        </>
      );
    };

    render(
      <ChatProvider>
        <HistoryConsumer />
      </ChatProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('done'));
    expect(screen.getByTestId('history-count').textContent).toBe('1');
    expect(screen.getByTestId('session-id').textContent).toBe(sessionId);
  });

  it('resets state when no auth token is present', async () => {
    useAuthMock.mockReturnValue({ session: null });

    const ResetConsumer = () => {
      const { messages, sessions, isLoading } = useChat();
      return (
        <>
          <div data-testid="loaded">{isLoading ? 'loading' : 'done'}</div>
          <div data-testid="session-count">{sessions.length}</div>
          <div data-testid="message-count">{messages.length}</div>
        </>
      );
    };

    render(
      <ChatProvider>
        <ResetConsumer />
      </ChatProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('done'));
    expect(screen.getByTestId('session-count').textContent).toBe('0');
    expect(screen.getByTestId('message-count').textContent).toBe('0');
  });

  it('updates sessions and messages on successful send', async () => {
    const sessionId = 'chat-100';
    fetchChatSessionsMock.mockResolvedValue([
      { id: sessionId, title: 'Sessão', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', messageCount: 1 }
    ]);
    fetchChatHistoryMock.mockResolvedValue([]);

    sendChatMessageMock.mockResolvedValue({
      message: { id: 'assistant-1', role: 'assistant', content: 'resposta', createdAt: '2024-01-01T00:00:01Z', chatId: sessionId },
      userMessage: { id: 'user-1', role: 'user', content: 'pergunta', createdAt: '2024-01-01T00:00:00Z', chatId: sessionId }
    });

    const SuccessConsumer = () => {
      const { sendMessage, sessions, messages, activeChatId } = useChat();
      useEffect(() => {
        const run = async () => {
          await sendMessage('pergunta');
        };
        void run();
      }, [sendMessage]);
      return (
        <>
          <div data-testid="active-chat">{activeChatId ?? ''}</div>
          <div data-testid="session-count">{sessions.length}</div>
          <div data-testid="message-count">{messages.length}</div>
        </>
      );
    };

    render(
      <ChatProvider>
        <SuccessConsumer />
      </ChatProvider>
    );

    await waitFor(() => expect(screen.getByTestId('active-chat').textContent).toBe(sessionId));
    expect(screen.getByTestId('session-count').textContent).toBe('1');
    expect(screen.getByTestId('message-count').textContent).toBe('2');
  });
});
