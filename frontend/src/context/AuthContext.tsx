import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import type { Session } from '@supabase/supabase-js';

import type { SocialProvider, UserProfile } from '../types';
import {
  type EmailSignUpPayload,
  getCurrentUser,
  getSession,
  loginWithEmail as loginWithEmailService,
  loginWithProvider as loginWithProviderService,
  logout as logoutService,
  onAuthStateChange,
  signUpWithEmail as signUpWithEmailService,
  updateUserPreferences
} from '../services/auth';

interface AuthContextValue {
  session: Session | null;
  user: UserProfile | null;
  isLoading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithProvider: (provider: SocialProvider) => Promise<void>;
  signUpWithEmail: (
    payload: EmailSignUpPayload
  ) => Promise<{ needsConfirmation: boolean }>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  updatePreferences: (preferences: UserProfile['preferences']) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.access_token) {
      setUser(null);
      return;
    }
    try {
      const profile = await getCurrentUser(nextSession.access_token);
      setUser(profile);
    } catch (error) {
      console.error('Failed to fetch profile', error);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await getSession();
        const currentSession = data.session ?? null;
        setSession(currentSession);
        await loadProfile(currentSession);
      } finally {
        setIsLoading(false);
      }
    };

    void init();

    const { data } = onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      await loadProfile(nextSession);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const nextSession = await loginWithEmailService({ email, password });
      setSession(nextSession);
      await loadProfile(nextSession);
    } finally {
      setIsLoading(false);
    }
  }, [loadProfile]);

  const signUpWithEmail = useCallback(
    async (payload: EmailSignUpPayload) => {
      setIsLoading(true);
      try {
        const { needsConfirmation, session: createdSession } = await signUpWithEmailService(payload);
        if (createdSession) {
          setSession(createdSession);
          await loadProfile(createdSession);
        } else {
          setSession(null);
          setUser(null);
        }
        return { needsConfirmation };
      } finally {
        setIsLoading(false);
      }
    },
    [loadProfile]
  );

  const loginWithProvider = useCallback(
    async (provider: SocialProvider) => {
      setIsLoading(true);
      try {
        await loginWithProviderService(provider);
        // OAuth flows trigger a redirect; the auth listener will load the new session.
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    await logoutService();
    setSession(null);
    setUser(null);
  }, []);

  const refreshUserProfile = useCallback(async () => {
    await loadProfile(session);
  }, [loadProfile, session]);

  const updatePreferencesHandler = useCallback(
    async (preferences: UserProfile['preferences']) => {
      if (!session?.access_token) {
        return;
      }
      try {
        const updated = await updateUserPreferences(session.access_token, preferences);
        setUser(updated);
      } catch (error) {
        console.error('Failed to update preferences', error);
      }
    },
    [session?.access_token]
  );

  const value = useMemo(
    () => ({
      session,
      user,
      isLoading,
      loginWithEmail,
      loginWithProvider,
      signUpWithEmail,
      logout,
      refreshUserProfile,
      updatePreferences: updatePreferencesHandler
    }),
    [
      isLoading,
      loginWithEmail,
      loginWithProvider,
      logout,
      refreshUserProfile,
      session,
      signUpWithEmail,
      updatePreferencesHandler,
      user
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
