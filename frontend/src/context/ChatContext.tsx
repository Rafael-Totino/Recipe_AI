import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import type { ChatMessage, ChatSession } from '../types';
import { fetchChatHistory, fetchChatSessions, sendChatMessage } from '../services/chat';
import { useAuth } from './AuthContext';

interface ChatContextValue {
  messages: ChatMessage[];
  sessions: ChatSession[];
  isLoading: boolean;
  isSending: boolean;
  error?: string;
  activeChatId?: string;
  sendMessage: (message: string, recipeId?: string) => Promise<void>;
  hydrate: () => Promise<void>;
  startNewChat: () => void;
  selectChat: (chatId?: string) => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

const buildSessionTitle = (content?: string) => {
  if (!content) {
    return 'Nova conversa';
  }
  const trimmed = content.trim();
  if (!trimmed) {
    return 'Nova conversa';
  }
  const maxLength = 60;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
};

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const { session } = useAuth();
  const token = session?.access_token;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [activeChatId, setActiveChatId] = useState<string | undefined>(undefined);
  const fetchSequenceRef = useRef(0);

  const resetState = useCallback(() => {
    fetchSequenceRef.current += 1;
    setMessages([]);
    setSessions([]);
    setActiveChatId(undefined);
    setError(undefined);
  }, []);

  const loadMessagesForChat = useCallback(
    async (chatId?: string, options: { showLoader?: boolean } = {}) => {
      const { showLoader = true } = options;
      const requestId = fetchSequenceRef.current + 1;
      fetchSequenceRef.current = requestId;

      if (!token || !chatId) {
        setMessages([]);
        setError(undefined);
        if (showLoader) {
          setIsLoading(false);
        }
        return;
      }

      if (showLoader) {
        setIsLoading(true);
      }

      try {
        const history = await fetchChatHistory(token, chatId);
        if (fetchSequenceRef.current === requestId) {
          setMessages(history);
          setError(undefined);
        }
      } catch (err) {
        if (fetchSequenceRef.current === requestId) {
          console.error(err);
          setError('Não foi possível carregar o histórico do chat.');
        }
      } finally {
        if (fetchSequenceRef.current === requestId && showLoader) {
          setIsLoading(false);
        }
      }
    },
    [token]
  );

  const hydrate = useCallback(async () => {
    if (!token) {
      resetState();
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const sessionList = await fetchChatSessions(token);
      setSessions(sessionList);

      let resolvedChatId: string | undefined;
      setActiveChatId((current) => {
        if (current && sessionList.some((session) => session.id === current)) {
          resolvedChatId = current;
          return current;
        }
        resolvedChatId = sessionList[0]?.id;
        return resolvedChatId;
      });

      if (!resolvedChatId) {
        fetchSequenceRef.current += 1;
        setMessages([]);
      } else {
        await loadMessagesForChat(resolvedChatId, { showLoader: false });
      }

      setError(undefined);
    } catch (err) {
      console.error(err);
      resetState();
      setError('Não foi possível carregar o histórico do chat.');
    } finally {
      setIsLoading(false);
    }
  }, [loadMessagesForChat, resetState, token]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const sendMessageHandler = useCallback(
    async (message: string, recipeId?: string) => {
      if (!token) {
        return;
      }

      const optimisticMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: message,
        createdAt: new Date().toISOString(),
        chatId: activeChatId ?? 'pending-chat'
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      setIsSending(true);
      try {
        const response = await sendChatMessage(token, {
          message,
          recipeId,
          threadId: optimisticMessage.id,
          chatId: activeChatId
        });

        const resolvedChatId = response.message.chatId;
        setActiveChatId(resolvedChatId);

        fetchSequenceRef.current += 1;

        setMessages((prev) => {
          const withoutOptimistic = prev.filter((msg) => msg.id !== optimisticMessage.id);
          const serverUser = response.userMessage;
          const fallbackUser: ChatMessage = {
            ...optimisticMessage,
            id: serverUser?.id ?? `user-${Date.now()}`,
            chatId: resolvedChatId,
            createdAt: serverUser?.createdAt ?? new Date().toISOString(),
            content: serverUser?.content?.trim() ? serverUser.content : message,
            role: 'user',
            relatedRecipeIds: serverUser?.relatedRecipeIds,
            suggestions: serverUser?.suggestions
          };
          const normalizedUser =
            serverUser && serverUser.role === 'user' && serverUser.content?.trim()
              ? { ...serverUser, chatId: resolvedChatId }
              : fallbackUser;
          return [...withoutOptimistic, normalizedUser, response.message];
        });

        setSessions((prev) => {
          const existing = prev.find((sessionItem) => sessionItem.id === resolvedChatId);
          const createdAt = existing?.createdAt ?? response.userMessage?.createdAt ?? optimisticMessage.createdAt;
          const updatedAt = response.message?.createdAt ?? new Date().toISOString();
          const messageCount = (existing?.messageCount ?? 0) + 2;
          const titleSource = response.userMessage?.content ?? message;
          const derivedTitle = existing?.title && existing.title !== 'Nova conversa'
            ? existing.title
            : buildSessionTitle(titleSource);

          const updatedSession: ChatSession = {
            id: resolvedChatId,
            title: derivedTitle,
            createdAt,
            updatedAt,
            messageCount
          };

          const others = prev.filter(
            (sessionItem) =>
              sessionItem.id !== resolvedChatId && (activeChatId ? sessionItem.id !== activeChatId : true)
          );
          const nextSessions = [updatedSession, ...others];
          return nextSessions.sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });

        await loadMessagesForChat(resolvedChatId, { showLoader: false });

        setError(undefined);
      } catch (err) {
        console.error(err);
        setError('Falha ao enviar mensagem. Tente novamente.');
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticMessage.id));
      } finally {
        setIsSending(false);
      }
    },
    [activeChatId, loadMessagesForChat, token]
  );

  const startNewChatHandler = useCallback(() => {
    const newChatId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `chat-${Date.now()}`;
    const nowIso = new Date().toISOString();
    fetchSequenceRef.current += 1;
    setActiveChatId(newChatId);
    setMessages([]);
    setSessions((prev) => {
      const filtered = prev.filter((sessionItem) => sessionItem.id !== newChatId);
      const placeholder: ChatSession = {
        id: newChatId,
        title: 'Nova conversa',
        createdAt: nowIso,
        updatedAt: nowIso,
        messageCount: 0
      };
      return [placeholder, ...filtered];
    });
    setError(undefined);
  }, []);

  const selectChatHandler = useCallback(
    (chatId?: string) => {
      setActiveChatId(chatId);
      void loadMessagesForChat(chatId);
    },
    [loadMessagesForChat]
  );

  const value = useMemo(
    () => ({
      messages,
      sessions,
      isLoading,
      isSending,
      error,
      activeChatId,
      sendMessage: sendMessageHandler,
      hydrate,
      startNewChat: startNewChatHandler,
      selectChat: selectChatHandler
    }),
    [
      activeChatId,
      error,
      hydrate,
      isLoading,
      isSending,
      messages,
      selectChatHandler,
      sendMessageHandler,
      sessions,
      startNewChatHandler
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};


