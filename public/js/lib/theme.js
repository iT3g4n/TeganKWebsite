/** @typedef {'light' | 'dark'} Theme */

export const STORAGE_KEY = 'tk-theme';

const THEMES = Object.freeze(['light', 'dark']);

/** @param {unknown} stored @param {boolean} prefersDark @returns {Theme} */
export function resolveTheme(stored, prefersDark) {
  if (THEMES.includes(stored)) return /** @type {Theme} */ (stored);
  return prefersDark ? 'dark' : 'light';
}

/** @param {Theme} theme @returns {Theme} */
export function oppositeTheme(theme) {
  return theme === 'dark' ? 'light' : 'dark';
}
