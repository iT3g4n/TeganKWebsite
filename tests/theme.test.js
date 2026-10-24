import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, resolveTheme, oppositeTheme } from '../js/lib/theme.js';

test('a saved choice wins over the system preference', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});

test('without a saved choice the system preference decides', () => {
  assert.equal(resolveTheme(null, true), 'dark');
  assert.equal(resolveTheme(undefined, false), 'light');
});

test('unknown saved values are ignored', () => {
  assert.equal(resolveTheme('purple', true), 'dark');
  assert.equal(resolveTheme('', false), 'light');
});

test('oppositeTheme flips between light and dark', () => {
  assert.equal(oppositeTheme('light'), 'dark');
  assert.equal(oppositeTheme('dark'), 'light');
});

test('the storage key is stable so saved choices survive redeploys', () => {
  assert.equal(STORAGE_KEY, 'tk-theme');
});
