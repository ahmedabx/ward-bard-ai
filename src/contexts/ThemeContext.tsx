import { useEffect, ReactNode } from 'react';

/**
 * MedBard is dark-theme only. This provider now just pins <html> to dark
 * and exposes a no-op API for any legacy callers.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  }, []);
  return <>{children}</>;
}

export function useTheme() {
  return { theme: 'dark' as const, toggleTheme: () => {}, setTheme: () => {} };
}
