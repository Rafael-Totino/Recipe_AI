import { apiRequest } from './api';
import type { ChatMessage } from '../types';

export interface ChatRequestPayload {
  message: string;
  recipeId?: string;
  threadId?: string;
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

export const fetchChatHistory = (token: string) =>
  apiRequest<ChatMessage[]>('/chat/history', {
    method: 'GET',
    authToken: token
  });
