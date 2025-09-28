import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'recipe-ai-theme';

interface ThemeState {
  theme: Theme;
  hasStoredPreference: boolean;
}

const readInitialTheme = (): ThemeState => {
  if (typeof window === 'undefined') {
    return { theme: 'light', hasStoredPreference: false };
  }

  const storedTheme = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (storedTheme === 'light' || storedTheme === 'dark') {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = storedTheme;
    }
    return { theme: storedTheme, hasStoredPreference: true };
  }

  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const resolvedTheme: Theme = prefersDark ? 'dark' : 'light';
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolvedTheme;
  }
  return { theme: resolvedTheme, hasStoredPreference: false };
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<ThemeState>(() => readInitialTheme());

  useEffect(() => {
    if (state.hasStoredPreference) {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (event: MediaQueryListEvent) => {
      setState({ theme: event.matches ? 'dark' : 'light', hasStoredPreference: false });
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [state.hasStoredPreference]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
    if (state.hasStoredPreference) {
      window.localStorage.setItem(STORAGE_KEY, state.theme);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [state]);

  const setTheme = (nextTheme: Theme) => {
    setState({ theme: nextTheme, hasStoredPreference: true });
  };

  const toggleTheme = () => {
    setState((current) => ({
      theme: current.theme === 'dark' ? 'light' : 'dark',
      hasStoredPreference: true
    }));
  };

  const value = useMemo(
    () => ({
      theme: state.theme,
      toggleTheme,
      setTheme
    }),
    [state.theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
