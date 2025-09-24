import { apiRequest } from './api';
import type { AuthSession, SocialProvider, UserProfile } from '../types';

export interface EmailLoginPayload {
  email: string;
  password: string;
}

export const loginWithEmail = (payload: EmailLoginPayload) =>
  apiRequest<AuthSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const loginWithProvider = (provider: SocialProvider, idToken: string) =>
  apiRequest<AuthSession>('/auth/social', {
    method: 'POST',
    body: JSON.stringify({ provider, idToken })
  });

export const refreshSession = (refreshToken: string) =>
  apiRequest<AuthSession>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken })
  });

export const getCurrentUser = (token: string) =>
  apiRequest<UserProfile>('/users/me', {
    method: 'GET',
    authToken: token
  });

export const updateUserPreferences = (token: string, preferences: UserProfile['preferences']) =>
  apiRequest<UserProfile>('/users/preferences', {
    method: 'PUT',
    authToken: token,
    body: JSON.stringify(preferences)
  });
