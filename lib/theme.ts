export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "buscapreco-theme";

const sameTabListeners = new Set<() => void>();

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function getStoredThemeServerSnapshot(): Theme {
  return "system";
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
}

export function getResolvedThemeSnapshot(): ResolvedTheme {
  return resolveTheme(getStoredTheme());
}

function getResolvedThemeServerSnapshot(): ResolvedTheme {
  return "light";
}

/** Compartilhado pelos dois useSyncExternalStore (tema bruto e resolvido) — mesmos gatilhos de mudança. */
export function subscribeToThemeChanges(callback: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  window.addEventListener("storage", callback);
  sameTabListeners.add(callback);
  return () => {
    media.removeEventListener("change", callback);
    window.removeEventListener("storage", callback);
    sameTabListeners.delete(callback);
  };
}

export function applyResolvedTheme(resolved: ResolvedTheme): void {
  document.documentElement.setAttribute("data-theme", resolved);
}

export function persistTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyResolvedTheme(resolveTheme(theme));
  sameTabListeners.forEach((listener) => listener());
}

export const themeSnapshots = {
  getStoredTheme,
  getStoredThemeServerSnapshot,
  getResolvedThemeSnapshot,
  getResolvedThemeServerSnapshot,
};

/**
 * Roda de forma síncrona em <head>, antes do primeiro paint, para já aplicar o tema salvo
 * (ou o do sistema) e evitar o "flash" de tema errado. Mantido como string para ser inline —
 * não pode importar nada, roda antes do React montar.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var theme = stored === 'light' || stored === 'dark' ? stored : 'system';
    var resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    document.documentElement.setAttribute('data-theme', resolved);
  } catch (e) {}
})();
`;
