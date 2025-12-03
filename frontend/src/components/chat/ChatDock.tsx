
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useChat } from '../../context/ChatContext';
import type { ChatSession } from '../../types';
import Loader from '../shared/Loader';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import './chat.css';

type ChatDockProps = {
  initialPrompt?: string;
};

const ChatDock = ({ initialPrompt }: ChatDockProps) => {
  const {
    messages,
    sessions,
    isLoading,
    isSending,
    error,
    sendMessage,
    startNewChat,
    activeChatId,
    selectChat
  } = useChat();

  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (typeof initialPrompt === 'string') {
      setDraft(initialPrompt);
    }
  }, [initialPrompt]);

  const displaySessions = useMemo<ChatSession[]>(() => {
    if (sessions.length) {
      return sessions;
    }
    const fallbackId = activeChatId ?? 'nova-conversa';
    const now = new Date().toISOString();
    return [
      {
        id: fallbackId,
        title: 'Nova conversa',
        createdAt: now,
        updatedAt: now,
        messageCount: 0
      }
    ];
  }, [activeChatId, sessions]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }),
    []
  );

  const formatTabMeta = useCallback(
    (updatedAt: string, messageCount: number) => {
      try {
        const formatted = dateFormatter.format(new Date(updatedAt));
        if (messageCount <= 0) {
          return formatted;
        }
        return `${formatted} · ${messageCount} mensagens`;
      } catch (error) {
        console.error(error);
        return messageCount > 0 ? `${messageCount} mensagens` : '';
      }
    },
    [dateFormatter]
  );

  const handleSuggestion = useCallback(
    async (prompt: string) => {
      await sendMessage(prompt);
      setDraft('');
    },
    [sendMessage]
  );

  const handleSend = useCallback(
    async (content: string) => {
      await sendMessage(content);
      setDraft('');
    },
    [sendMessage]
  );

  const handleStartNewChat = useCallback(() => {
    setDraft('');
    startNewChat();
  }, [startNewChat]);

  const handleSelectChat = useCallback(
    (sessionId?: string) => {
      selectChat(sessionId);
    },
    [selectChat]
  );

  return (
    <section className="chat-dock" aria-label="Assistente de receitas">
      <div className="chat-dock__tab-strip" role="presentation">
        <div className="chat-dock__tabs" role="tablist" aria-label="Conversas salvas">
          {displaySessions.map((session, index) => {
            const isPlaceholder = sessions.length === 0 && index === 0;
            const isActive =
              session.id === activeChatId || (!activeChatId && session.id === displaySessions[0]?.id);
            return (
              <button
                key={session.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-disabled={isPlaceholder}
                className={`chat-dock__tab${isActive ? ' is-active' : ''}`}
                onClick={() => {
                  if (isPlaceholder) {
                    return;
                  }
                  handleSelectChat(session.id);
                }}
                disabled={isPlaceholder}
              >
                <span className="chat-dock__tab-shape" aria-hidden="true" />
                <span className="chat-dock__tab-labels">
                  <span className="chat-dock__tab-title" title={session.title}>
                    {session.title}
                  </span>
                  <span className="chat-dock__tab-meta">
                    {isPlaceholder
                      ? 'Comece uma nova conversa'
                      : formatTabMeta(session.updatedAt, session.messageCount)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="chat-dock__new-chat"
          onClick={handleStartNewChat}
          aria-label="Abrir uma nova conversa"
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>

      <div className="chat-dock__history">
        {isLoading ? (
          <Loader />
        ) : messages.length ? (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} onSuggestionClick={handleSuggestion} />
          ))
        ) : (
          <p className="text-muted" style={{ textAlign: 'center' }}>
            Nenhuma conversa hoje. Pergunte o que preparar com o que você tem em casa e veja a IA montar um plano completo.
          </p>
        )}
        {error ? <p style={{ color: '#d64545' }}>{error}</p> : null}
      </div>

      <div className="chat-dock__input">
        <ChatInput value={draft} onChange={setDraft} onSend={handleSend} isSending={isSending} />
      </div>
    </section>
  );
};

export default ChatDock;
