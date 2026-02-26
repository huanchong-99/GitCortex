import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeMode } from 'shared/types';

type ThemeProviderProps = Readonly<{
  children: React.ReactNode;
  initialTheme?: ThemeMode;
}>;

type ThemeProviderState = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
};

const initialState: ThemeProviderState = {
  theme: ThemeMode.SYSTEM,
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  initialTheme = ThemeMode.SYSTEM,
  ...props
}: Readonly<ThemeProviderProps>) {
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme);

  // Update theme when initialTheme changes
  useEffect(() => {
    setThemeState(initialTheme);
  }, [initialTheme]);

  useEffect(() => {
    const root = globalThis.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === ThemeMode.SYSTEM) {
      const systemTheme = globalThis.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme.toLowerCase());
  }, [theme]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
  }, []);

  const value = useMemo(() => ({
    theme,
    setTheme,
  }), [theme, setTheme]);

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
