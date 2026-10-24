import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOhlc, buildCandles, gridLines } from '../public/js/lib/candles.js';

const LAYOUT = { width: 200, height: 120, padX: 10, padTop: 10, padBottom: 10 };

test('parseOhlc reads "open high low close" into numbers', () => {
  assert.deepEqual(parseOhlc(' 6 22  4 20 '), { open: 6, high: 22, low: 4, close: 20 });
});

test('parseOhlc rejects missing, extra or non-numeric values', () => {
  assert.throws(() => parseOhlc(undefined), TypeError);
  assert.throws(() => parseOhlc('1 2 3'), TypeError);
  assert.throws(() => parseOhlc('1 2 3 4 5'), TypeError);
  assert.throws(() => parseOhlc('1 two 0 1'), TypeError);
});

test('parseOhlc rejects a high below the body or a low above it', () => {
  assert.throws(() => parseOhlc('10 9 5 8'), RangeError);
  assert.throws(() => parseOhlc('10 12 11 8'), RangeError);
});

test('parseOhlc returns a frozen object', () => {
  assert.ok(Object.isFrozen(parseOhlc('1 2 0 1')));
});

test('buildCandles spaces candles evenly across the plot', () => {
  const series = [parseOhlc('0 10 0 10'), parseOhlc('10 20 10 20')];
  const [a, b] = buildCandles(series, LAYOUT);
  assert.equal(a.center, 55);
  assert.equal(b.center, 145);
  assert.equal(a.body.width, b.body.width);
  assert.equal(a.body.x, a.center - a.body.width / 2);
});

test('buildCandles maps the highest high to padTop and lowest low to the plot floor', () => {
  const series = [parseOhlc('0 10 0 10'), parseOhlc('10 20 10 20')];
  const [a, b] = buildCandles(series, LAYOUT);
  assert.equal(b.wick.y, 10);
  assert.equal(a.wick.y + a.wick.height, 110);
  assert.equal(b.body.y, 10);
  assert.equal(a.body.y + a.body.height, 110);
});

test('buildCandles marks direction from open and close', () => {
  const series = [parseOhlc('2 9 1 8'), parseOhlc('8 9 1 3')];
  const [up, down] = buildCandles(series, LAYOUT);
  assert.equal(up.direction, 'up');
  assert.equal(down.direction, 'down');
});

test('buildCandles keeps flat candles visible with a minimum body height', () => {
  const [flat] = buildCandles([parseOhlc('5 9 1 5')], { ...LAYOUT, minBody: 4 });
  assert.equal(flat.body.height, 4);
});

test('buildCandles centres the wick on the body', () => {
  const [c] = buildCandles([parseOhlc('2 9 1 8')], { ...LAYOUT, wickWidth: 3 });
  assert.equal(c.wick.width, 3);
  assert.equal(c.wick.x + c.wick.width / 2, c.center);
});

test('buildCandles handles a series with no price range', () => {
  const [c] = buildCandles([parseOhlc('5 5 5 5')], LAYOUT);
  assert.ok(Number.isFinite(c.body.y));
  assert.ok(Number.isFinite(c.wick.height));
});

test('buildCandles rejects empty input and layouts with no room', () => {
  assert.throws(() => buildCandles([], LAYOUT), TypeError);
  assert.throws(() => buildCandles(null, LAYOUT), TypeError);
  assert.throws(() => buildCandles([parseOhlc('1 2 0 1')], { ...LAYOUT, width: 20 }), RangeError);
});

test('buildCandles does not mutate its input', () => {
  const series = Object.freeze([parseOhlc('1 2 0 1')]);
  assert.doesNotThrow(() => buildCandles(series, LAYOUT));
});

test('gridLines returns evenly spaced y positions inside the plot', () => {
  assert.deepEqual(gridLines(3, LAYOUT), [10, 60, 110]);
  assert.deepEqual(gridLines(1, LAYOUT), [110]);
  assert.throws(() => gridLines(0, LAYOUT), RangeError);
});
