import type { Theme } from '@/types/quran';

export type ResolvedTheme = 'light' | 'dark';

/** Resolve the optional "follow the operating system" setting to a concrete theme. */
export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
