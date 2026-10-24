/** @typedef {{ open: number, high: number, low: number, close: number }} Ohlc */
/** @typedef {{ width: number, height: number, padX?: number, padTop?: number, padBottom?: number, bodyRatio?: number, wickWidth?: number, minBody?: number }} Layout */

/** Parses the page's data-ohlc strings, written as "open high low close". */
export function parseOhlc(raw) {
  if (typeof raw !== 'string') {
    throw new TypeError('OHLC must be a string like "open high low close"');
  }
  const parts = raw.trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new TypeError(`OHLC "${raw}" needs exactly four numbers`);
  }
  const [open, high, low, close] = parts;
  if (high < Math.max(open, close) || low > Math.min(open, close)) {
    throw new RangeError(`OHLC "${raw}" has a high below the body or a low above it`);
  }
  return Object.freeze({ open, high, low, close });
}

/** @param {Layout} layout */
function plotArea(layout) {
  const { width, height, padX = 0, padTop = 0, padBottom = 0 } = layout;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padTop - padBottom;
  if (!(plotWidth > 0) || !(plotHeight > 0)) {
    throw new RangeError('Chart layout leaves no room to draw');
  }
  return { padX, padTop, plotWidth, plotHeight };
}

/** @param {ReadonlyArray<Ohlc>} series @param {Layout} layout */
export function buildCandles(series, layout) {
  if (!Array.isArray(series) || series.length === 0) {
    throw new TypeError('buildCandles needs at least one candle');
  }
  const { bodyRatio = 0.56, wickWidth = 2, minBody = 3 } = layout;
  const { padX, padTop, plotWidth, plotHeight } = plotArea(layout);

  const low = Math.min(...series.map((c) => c.low));
  const high = Math.max(...series.map((c) => c.high));
  const span = high - low || 1;
  const toY = (value) => padTop + (1 - (value - low) / span) * plotHeight;

  const slot = plotWidth / series.length;
  const bodyWidth = slot * bodyRatio;

  return series.map((c, i) => {
    const center = padX + slot * (i + 0.5);
    const bodyTop = toY(Math.max(c.open, c.close));
    const bodyBottom = toY(Math.min(c.open, c.close));
    const wickTop = toY(c.high);
    return Object.freeze({
      center,
      body: { x: center - bodyWidth / 2, y: bodyTop, width: bodyWidth, height: Math.max(minBody, bodyBottom - bodyTop) },
      wick: { x: center - wickWidth / 2, y: wickTop, width: wickWidth, height: toY(c.low) - wickTop },
      direction: c.close >= c.open ? 'up' : 'down',
    });
  });
}

/** @param {number} count @param {Layout} layout @returns {number[]} top to bottom */
export function gridLines(count, layout) {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError('gridLines needs a whole number of lines, at least one');
  }
  const { padTop, plotHeight } = plotArea(layout);
  if (count === 1) return [padTop + plotHeight];
  return Array.from({ length: count }, (_, i) => padTop + (plotHeight * i) / (count - 1));
}
