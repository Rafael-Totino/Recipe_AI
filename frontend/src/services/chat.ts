import { apiRequest } from './api';
import type { ChatMessage, ChatSession } from '../types';

export interface ChatRequestPayload {
  message: string;
  recipeId?: string;
  threadId?: string;
  chatId?: string;
}

export interface ChatResponse {
  message: ChatMessage;
  userMessage: ChatMessage;
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
  const query = chatId ? `?chatId=${encodeURIComponent(chatId)}` : '';
  return apiRequest<ChatMessage[]>(`/chat/history${query}`, {
    method: 'GET',
    authToken: token
  });
};

export const fetchChatSessions = (token: string) =>
  apiRequest<ChatSession[]>('/chat/sessions', {
    method: 'GET',
    authToken: token
  });
