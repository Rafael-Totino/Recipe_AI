import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

import type { ChatMessage } from '../types';
import { fetchChatHistory, sendChatMessage } from '../services/chat';
import { useAuth } from './AuthContext';

interface ChatContextValue {
  messages: ChatMessage[];
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

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [activeChatId, setActiveChatId] = useState<string | undefined>(undefined);

  const hydrate = useCallback(async () => {
    if (!session?.access_token) {
      setMessages([]);
      return;
    }
    setIsLoading(true);
    try {
      const history = await fetchChatHistory(session.access_token, activeChatId);
      if (!activeChatId && history.length > 0) {
        setActiveChatId(history[history.length - 1]?.chatId);
      }
      setMessages(history);
      setError(undefined);
    } catch (err) {
      console.error(err);
      setError('Não foi possível carregar o histórico do chat.');
    } finally {
      setIsLoading(false);
    }
  }, [activeChatId, session?.access_token]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const sendMessageHandler = useCallback(
    async (message: string, recipeId?: string) => {
      if (!session?.access_token) {
        return;
      }

      const clientMessageId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => { const rand = Math.random() * 16 | 0; const value = char === "x" ? rand : (rand & 0x3) | 0x8; return value.toString(16); });
      const optimisticMessage: ChatMessage = {
        id: clientMessageId,
        role: 'user',
        content: message,
        createdAt: new Date().toISOString(),
        chatId: activeChatId ?? 'pending-chat'
      };
      setMessages((prev) => [...prev, optimisticMessage]);
      setIsSending(true);
      try {
        const response = await sendChatMessage(session.access_token, {
          message,
          recipeId,
          threadId: optimisticMessage.id,
          chatId: activeChatId
        });

        const resolvedChatId = response.message.chatId;
        setActiveChatId(resolvedChatId);

        setMessages((prev) => {
          const withoutOptimistic = prev.filter((msg) => msg.id !== optimisticMessage.id);
          const userMessage = response.userMessage ?? {
            ...optimisticMessage,
            id: `temp-confirmed-${Date.now()}`,
            chatId: resolvedChatId,
            createdAt: new Date().toISOString()
          };
          return [...withoutOptimistic, userMessage, response.message];
        });
        setError(undefined);
      } catch (err) {
        console.error(err);
        setError('Falha ao enviar mensagem. Tente novamente.');
        setMessages((prev) => prev.filter((msg) => msg.id !== clientMessageId));
      } finally {
        setIsSending(false);
      }
    },
    [activeChatId, session?.access_token]
  );

  const startNewChat = useCallback(() => {
    const newChatId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `chat-${Date.now()}`;
    setActiveChatId(newChatId);
    setMessages([]);
    setError(undefined);
  }, []);

  const selectChat = useCallback((chatId?: string) => {
    setActiveChatId(chatId);
  }, []);

  const value = useMemo(
    () => ({
      messages,
      isLoading,
      isSending,
      error,
      activeChatId,
      sendMessage: sendMessageHandler,
      hydrate,
      startNewChat,
      selectChat
    }),
    [
      activeChatId,
      error,
      hydrate,
      isLoading,
      isSending,
      messages,
      selectChat,
      sendMessageHandler,
      startNewChat
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


