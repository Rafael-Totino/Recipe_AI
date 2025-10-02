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
    if (!session?.access_token) {
      setMessages([]);
      return;
    }
    setIsLoading(true);
    try {
      const history = await fetchChatHistory(session.access_token);
      setMessages(history);
      setError(undefined);
    } catch (err) {
      console.error(err);
      setError('Não foi possível carregar o histórico do chat.');
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

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
        createdAt: new Date().toISOString()
      };
      setMessages((prev) => [...prev, optimisticMessage]);
      setIsSending(true);
      try {
        const response = await sendChatMessage(session.access_token, { message, recipeId, threadId: clientMessageId });
        // Mantém a mensagem do usuário e adiciona a resposta do assistente
        setMessages((prev) => [...prev, response.message]);
        setError(undefined);
      } catch (err) {
        console.error(err);
        setError('Falha ao enviar mensagem. Tente novamente.');
        setMessages((prev) => prev.filter((msg) => msg.id !== clientMessageId));
      } finally {
        setIsSending(false);
      }
    },
    [session?.access_token]
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


