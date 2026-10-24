# Tegan Kierznowski

Personal site. Static HTML, CSS and vanilla JS with no build step, so it deploys anywhere that serves files (GitHub Pages, Netlify, Cloudflare Pages).

## Run it locally

```bash
npm run dev        # serves the folder at http://localhost:3000
```

ES modules don't load from `file://`, so open it through a server rather than double-clicking `index.html`.

## Tests

```bash
npm test           # unit tests (node:test)
npm run coverage   # same, failing below 80% coverage on js/lib
```

## Editing content

Everything lives in `index.html`.

- **Career chart.** Each `<li>` in the story section (`#story-list`) is one candle. `data-ohlc="open high low close"` sets its shape, `data-label` its axis label, `data-note` an optional handwritten note, and `data-kind="next"` the faded "next" candle.
- **Projects.** The `.projects` list. Swap the "Private repo" badge for a `View code` link when a repo goes public.
- **Icons.** All icons are hand-drawn SVG `<symbol>`s at the top of `<body>`. Shapes are filled, never stroked. Parts with `style="fill:var(--tone)"` take the lighter second colour.
- **Colours.** `css/tokens.css`. Each token uses `light-dark(light, dark)`, so both themes are defined in one place.

## Deploy to GitHub Pages

Push to `main`, then go to Settings → Pages → Deploy from branch → `main` / root.
