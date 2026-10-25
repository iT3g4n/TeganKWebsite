import { STORAGE_KEY, resolveTheme, oppositeTheme } from './lib/theme.js';

const THEME_COLORS = Object.freeze({ light: '#ffffff', dark: '#131116' });

function saveTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (error) {
    console.warn('Theme choice not saved; it will reset on the next visit.', error);
  }
}

/** @param {HTMLButtonElement} button */
export function initThemeToggle(button) {
  const root = document.documentElement;
  const themeColors = document.querySelectorAll('meta[name="theme-color"]');
  const currentTheme = () => resolveTheme(root.dataset.theme);

  const sync = () => {
    const theme = currentTheme();
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    themeColors.forEach((meta) => meta.setAttribute('content', THEME_COLORS[theme]));
  };

  button.addEventListener('click', () => {
    const next = oppositeTheme(currentTheme());
    root.dataset.theme = next;
    saveTheme(next);
    sync();
  });
  sync();
}
