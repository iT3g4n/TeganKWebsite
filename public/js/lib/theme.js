/** @typedef {'light' | 'dark'} Theme */

export const STORAGE_KEY = 'tk-theme';
export const DEFAULT_THEME = 'light';

const THEMES = Object.freeze(['light', 'dark']);

/** @param {unknown} stored @returns {Theme} */
export function resolveTheme(stored) {
  return THEMES.includes(stored) ? /** @type {Theme} */ (stored) : DEFAULT_THEME;
}

/** @param {Theme} theme @returns {Theme} */
export function oppositeTheme(theme) {
  return theme === 'dark' ? 'light' : 'dark';
}
