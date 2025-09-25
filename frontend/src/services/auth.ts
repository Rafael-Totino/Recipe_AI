import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { supabase } from './supabase';
import { apiRequest } from './api';
import type { SocialProvider, UserProfile } from '../types';

export interface EmailLoginPayload {
  email: string;
  password: string;
}

export interface EmailSignUpPayload {
  email: string;
  password: string;
  name?: string;
}

export interface SignUpResult {
  session: Session | null;
  needsConfirmation: boolean;
}

export const loginWithEmail = async (payload: EmailLoginPayload): Promise<Session> => {
  const { data, error } = await supabase.auth.signInWithPassword(payload);
  if (error) {
    throw error;
  }
  if (!data.session) {
    throw new Error('No session returned by Supabase');
  }
  return data.session;
};

export const signUpWithEmail = async (payload: EmailSignUpPayload): Promise<SignUpResult> => {
  const { email, password, name } = payload;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: name ? { name } : undefined
    }
  });
  if (error) {
    throw error;
  }
  return {
    session: data.session ?? null,
    needsConfirmation: !data.session
  };
};

export const loginWithProvider = async (provider: SocialProvider) => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) {
    throw error;
  }
};

export const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
};

export const getSession = () => supabase.auth.getSession();

export const onAuthStateChange = (
  callback: (event: AuthChangeEvent, session: Session | null) => void
) => supabase.auth.onAuthStateChange(callback);

export const getCurrentUser = (token: string) =>
  apiRequest<UserProfile>('/auth/me', {
    method: 'GET',
    authToken: token
  });

export const updateUserPreferences = (token: string, preferences: UserProfile['preferences']) =>
  apiRequest<UserProfile>('/users/preferences', {
    method: 'PUT',
    authToken: token,
    body: JSON.stringify(preferences)
  });
