"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import {
  applyResolvedTheme,
  persistTheme,
  subscribeToThemeChanges,
  themeSnapshots,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeToThemeChanges,
    themeSnapshots.getStoredTheme,
    themeSnapshots.getStoredThemeServerSnapshot,
  );
  const resolvedTheme = useSyncExternalStore(
    subscribeToThemeChanges,
    themeSnapshots.getResolvedThemeSnapshot,
    themeSnapshots.getResolvedThemeServerSnapshot,
  );

  // Mantém o atributo do DOM em dia quando a mudança vem do SO (tema "sistema"), não de um clique.
  useEffect(() => {
    applyResolvedTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    persistTheme(next);
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme precisa estar dentro de <ThemeProvider>");
  return ctx;
}
