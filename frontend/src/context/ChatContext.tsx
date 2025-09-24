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
  sendMessage: (message: string, recipeId?: string) => Promise<void>;
  hydrate: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const hydrate = useCallback(async () => {
    if (!session?.accessToken) {
      setMessages([]);
      return;
    }
    setIsLoading(true);
    try {
      const history = await fetchChatHistory(session.accessToken);
      setMessages(history);
      setError(undefined);
    } catch (err) {
      console.error(err);
      setError('Não foi possível carregar o histórico do chat.');
    } finally {
      setIsLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const sendMessageHandler = useCallback(
    async (message: string, recipeId?: string) => {
      if (!session?.accessToken) {
        return;
      }

      const optimisticMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: message,
        createdAt: new Date().toISOString()
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      setIsSending(true);
      try {
        const response = await sendChatMessage(session.accessToken, { message, recipeId });
        setMessages((prev) => [...prev.filter((msg) => msg.id !== optimisticMessage.id), optimisticMessage, response.message]);
        setError(undefined);
      } catch (err) {
        console.error(err);
        setError('Falha ao enviar mensagem. Tente novamente.');
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticMessage.id));
      } finally {
        setIsSending(false);
      }
    },
    [session?.accessToken]
  );

  const value = useMemo(
    () => ({ messages, isLoading, isSending, error, sendMessage: sendMessageHandler, hydrate }),
    [error, hydrate, isLoading, isSending, messages, sendMessageHandler]
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
