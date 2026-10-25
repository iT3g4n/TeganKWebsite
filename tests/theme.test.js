import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, DEFAULT_THEME, resolveTheme, oppositeTheme } from '../public/js/lib/theme.js';

test('the site defaults to light mode', () => {
  assert.equal(DEFAULT_THEME, 'light');
});

test('a saved choice wins over the default', () => {
  assert.equal(resolveTheme('light'), 'light');
  assert.equal(resolveTheme('dark'), 'dark');
});

test('without a saved choice the default theme is used', () => {
  assert.equal(resolveTheme(null), DEFAULT_THEME);
  assert.equal(resolveTheme(undefined), DEFAULT_THEME);
});

test('unknown saved values fall back to the default', () => {
  assert.equal(resolveTheme('purple'), DEFAULT_THEME);
  assert.equal(resolveTheme(''), DEFAULT_THEME);
});

test('oppositeTheme flips between light and dark', () => {
  assert.equal(oppositeTheme('light'), 'dark');
  assert.equal(oppositeTheme('dark'), 'light');
});

test('the storage key is stable so saved choices survive redeploys', () => {
  assert.equal(STORAGE_KEY, 'tk-theme');
});
