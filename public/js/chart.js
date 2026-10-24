import { parseOhlc, buildCandles, gridLines } from './lib/candles.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const GRID_COUNT = 4;
const HEIGHT_RANGE = Object.freeze({ min: 230, max: 290, ratio: 0.5 });
const NOTE_GAP = 8;

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
  return el;
}

function readMilestones(list) {
  return [...list.querySelectorAll('[data-ohlc]')].map((item) => {
    const year = item.querySelector('.story-year')?.textContent.trim() ?? '';
    const heading = item.querySelector('h3')?.textContent.trim() ?? '';
    return Object.freeze({
      item,
      ohlc: parseOhlc(item.dataset.ohlc),
      label: item.dataset.label ?? '',
      note: item.dataset.note ?? '',
      isNext: item.dataset.kind === 'next',
      title: year ? `${year}: ${heading}` : heading,
    });
  });
}

function layoutFor(width) {
  const height = Math.round(Math.min(HEIGHT_RANGE.max, Math.max(HEIGHT_RANGE.min, width * HEIGHT_RANGE.ratio)));
  return { width, height, padX: 6, padTop: 52, padBottom: 34, wickWidth: 2.5, minBody: 5, bodyRatio: width < 440 ? 0.6 : 0.48 };
}

function drawCandle(milestone, candle, index, layout) {
  const variant = milestone.isNext ? 'next' : candle.direction;
  const group = svgEl('a', {
    class: `candle candle--${variant}`,
    style: `--i:${index}`,
    href: `#${milestone.item.id}`,
    'aria-label': milestone.title,
  });
  const slot = (layout.width - layout.padX * 2) / layout.count;
  group.append(
    svgEl('rect', { class: 'candle-hit', x: candle.center - slot / 2, y: layout.padTop, width: slot, height: layout.height - layout.padTop - layout.padBottom }),
    svgEl('rect', { class: 'candle-wick', ...candle.wick, rx: candle.wick.width / 2 }),
    svgEl('rect', { class: 'candle-body', ...candle.body, rx: Math.min(4, candle.body.width / 4) }),
  );
  return group;
}

function drawNote(text, candle, index, count) {
  const tipY = candle.wick.y - NOTE_GAP;
  const anchor = index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle';
  const offset = { start: -candle.body.width / 2, middle: 0, end: candle.body.width / 2 }[anchor];
  const note = svgEl('g', { class: 'chart-note', style: `--i:${index}` });
  const label = svgEl('text', { x: candle.center + offset, y: tipY - 12, 'text-anchor': anchor });
  label.textContent = text;
  const pointer = `${candle.center - 4},${tipY - 7} ${candle.center + 4},${tipY - 7} ${candle.center},${tipY}`;
  note.append(label, svgEl('polygon', { points: pointer }));
  return note;
}

function render(svg, milestones, width) {
  const layout = { ...layoutFor(width), count: milestones.length };
  const candles = buildCandles(milestones.map((m) => m.ohlc), layout);

  svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute('height', String(layout.height));
  const grid = gridLines(GRID_COUNT, layout).map((y) => svgEl('rect', { class: 'chart-grid', x: 0, y: y - 0.5, width: layout.width, height: 1 }));
  const bars = candles.map((c, i) => drawCandle(milestones[i], c, i, layout));
  const labels = candles
    .map((c, i) => [c, milestones[i].label])
    .filter(([, label]) => label)
    .map(([c, label]) => Object.assign(svgEl('text', { class: 'chart-label', x: c.center, y: layout.height - 10, 'text-anchor': 'middle' }), { textContent: label }));
  const notes = candles
    .map((c, i) => (milestones[i].note ? drawNote(milestones[i].note, c, i, candles.length) : null))
    .filter(Boolean);

  svg.replaceChildren(...grid, ...bars, ...labels, ...notes);
  return candles;
}

function wireInteractions({ svg, tip, milestones, getCandles }) {
  const groups = () => [...svg.querySelectorAll('.candle')];

  const setActive = (index) => {
    groups().forEach((g, i) => g.classList.toggle('is-active', i === index));
    milestones.forEach((m, i) => m.item.classList.toggle('is-active', i === index));
  };

  const showTip = (index) => {
    const candle = getCandles()[index];
    const width = svg.viewBox.baseVal.width;
    tip.textContent = milestones[index].title;
    tip.hidden = false;
    const half = tip.offsetWidth / 2;
    tip.style.left = `${Math.min(width - half, Math.max(half, candle.center))}px`;
    tip.style.top = `${candle.wick.y}px`;
  };

  const reset = () => {
    setActive(-1);
    tip.hidden = true;
  };

  const highlightFromEvent = (event) => {
    const index = groups().indexOf(event.target.closest('.candle'));
    if (index < 0) return reset();
    setActive(index);
    showTip(index);
  };

  svg.addEventListener('pointerover', highlightFromEvent);
  svg.addEventListener('focusin', highlightFromEvent);
  svg.addEventListener('pointerleave', reset);
  svg.addEventListener('focusout', reset);

  milestones.forEach(({ item }, index) => {
    const on = () => setActive(index);
    const off = () => setActive(-1);
    item.addEventListener('pointerenter', on);
    item.addEventListener('pointerleave', off);
    item.addEventListener('focusin', on);
    item.addEventListener('focusout', off);
  });

  return { reset };
}

/** @param {HTMLElement} frame element holding the svg and tooltip @param {HTMLElement} list the story list */
export function initChart(frame, list) {
  const svg = frame.querySelector('svg');
  const tip = frame.querySelector('.chart-tip');
  if (!svg || !tip) throw new Error('Chart frame needs an <svg> and a .chart-tip element');

  const milestones = readMilestones(list);
  let candles = [];
  let drawnWidth = 0;
  const { reset } = wireInteractions({ svg, tip, milestones, getCandles: () => candles });

  const draw = () => {
    const width = Math.round(frame.clientWidth);
    if (width === drawnWidth || width === 0) return;
    if (drawnWidth) svg.classList.remove('is-entering');
    drawnWidth = width;
    reset();
    candles = render(svg, milestones, width);
  };

  svg.classList.add('is-entering');
  draw();
  svg.addEventListener('animationend', (event) => {
    const lastAnimated = [...svg.querySelectorAll('.candle, .chart-note')].at(-1);
    if (event.target === lastAnimated) svg.classList.remove('is-entering');
  });
  new ResizeObserver(draw).observe(frame);
}
