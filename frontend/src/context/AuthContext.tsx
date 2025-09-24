import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

import type { AuthSession, SocialProvider, UserProfile } from '../types';
import {
  getCurrentUser,
  loginWithEmail as loginWithEmailService,
  loginWithProvider as loginWithProviderService,
  refreshSession as refreshSessionService,
  updateUserPreferences
} from '../services/auth';

interface AuthContextValue {
  session: AuthSession | null;
  user: UserProfile | null;
  isLoading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithProvider: (provider: SocialProvider, idToken: string) => Promise<void>;
  logout: () => void;
  refreshUserProfile: () => Promise<void>;
  updatePreferences: (preferences: UserProfile['preferences']) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'recipe-ai.auth';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setIsLoading(false);
      return;
    }

    try {
      const stored = JSON.parse(raw) as AuthSession;
      setSession(stored);
      setUser(stored.user);
    } catch (error) {
      console.error('Failed to parse stored session', error);
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const persistSession = useCallback((value: AuthSession | null) => {
    if (!value) {
      window.localStorage.removeItem(STORAGE_KEY);
      setSession(null);
      setUser(null);
      return;
    }

    setSession(value);
    setUser(value.user);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await loginWithEmailService({ email, password });
      persistSession(result);
    } finally {
      setIsLoading(false);
    }
  }, [persistSession]);

  const loginWithProvider = useCallback(
    async (provider: SocialProvider, idToken: string) => {
      setIsLoading(true);
      try {
        const result = await loginWithProviderService(provider, idToken);
        persistSession(result);
      } finally {
        setIsLoading(false);
      }
    },
    [persistSession]
  );

  const logout = useCallback(() => {
    persistSession(null);
  }, [persistSession]);

  const refreshUserProfile = useCallback(async () => {
    if (!session?.accessToken) {
      return;
    }
    const profile = await getCurrentUser(session.accessToken);
    const nextSession = { ...session, user: profile };
    persistSession(nextSession);
  }, [persistSession, session]);

  const updatePreferences = useCallback(
    async (preferences: UserProfile['preferences']) => {
      if (!session?.accessToken) {
        return;
      }
      const updatedUser = await updateUserPreferences(session.accessToken, preferences);
      const nextSession = { ...session, user: updatedUser };
      persistSession(nextSession);
    },
    [persistSession, session]
  );

  useEffect(() => {
    if (!session?.refreshToken) {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const refreshed = await refreshSessionService(session.refreshToken!);
        persistSession(refreshed);
      } catch (error) {
        console.warn('Failed to refresh session', error);
        persistSession(null);
      }
    }, 1000 * 60 * 14);

    return () => window.clearInterval(interval);
  }, [persistSession, session?.refreshToken]);

  const value = useMemo(
    () => ({
      session,
      user,
      isLoading,
      loginWithEmail,
      loginWithProvider,
      logout,
      refreshUserProfile,
      updatePreferences
    }),
    [
      isLoading,
      loginWithEmail,
      loginWithProvider,
      logout,
      refreshUserProfile,
      session,
      updatePreferences,
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
