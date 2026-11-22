export type ThemeMode = 'light' | 'dark' | 'system';
const KEY = 'kaytom.theme';

export const getTheme = (): ThemeMode => (localStorage.getItem(KEY) as ThemeMode) || 'system';

export function applyTheme(mode: ThemeMode) {
  localStorage.setItem(KEY, mode);
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function initTheme() {
  applyTheme(getTheme());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTheme() === 'system') applyTheme('system');
  });
}
