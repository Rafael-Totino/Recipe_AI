import { apiRequest } from './api';
import type { ChatMessage } from '../types';

export interface ChatRequestPayload {
  message: string;
  recipeId?: string;
  threadId?: string;
  chatId?: string;
}

export interface ChatResponse {
  message: ChatMessage;
  relatedRecipes?: string[];
  followUpPrompts?: Array<{ label: string; prompt: string }>;
}

export const sendChatMessage = (token: string, payload: ChatRequestPayload) =>
  apiRequest<ChatResponse>('/chat', {
    method: 'POST',
    authToken: token,
    body: JSON.stringify(payload)
  });

export const fetchChatHistory = (token: string, chatId?: string) => {
  const query = chatId ? `?chat_id=${encodeURIComponent(chatId)}` : '';
  return apiRequest<ChatMessage[]>(`/chat/history${query}`, {
    method: 'GET',
    authToken: token
  });
};
