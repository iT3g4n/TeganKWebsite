# Tegan Kierznowski

Personal site. Static HTML, CSS and vanilla JS with no build step, served as static assets on Cloudflare Workers.

## Run it locally

```bash
npm run dev        # wrangler dev, same config as production
```

ES modules don't load from `file://`, so open it through a server rather than double-clicking `public/index.html`.

## Tests

```bash
npm test           # unit tests (node:test)
npm run coverage   # same, failing below 80% coverage on public/js/lib
```

## Deploy

Pushes to `main` deploy automatically through Cloudflare Workers Builds, which runs `npx wrangler deploy` with no build command. `wrangler.jsonc` serves `public/` as static assets. Its `name` must match the Worker's name in the dashboard. To deploy by hand, run `npm run deploy`.

Only `public/` and the Worker in `src/` are uploaded. `public/_headers` sets the security headers (CSP and friends). If you add a third-party script, font or image host, add it to the CSP there or the browser will block it.

## Analytics

Umami runs first-party. The Worker (`src/analytics.js`) serves the tracker at `/pv.js` and relays its events from `/pv` to the Umami server, adding the visitor's IP. The Umami server's address is a Worker secret, never committed:

```bash
npx wrangler secret put UMAMI_ORIGIN   # e.g. https://umami.example.com
```

Or add it in the dashboard under the Worker's Settings → Variables and Secrets, as type **Secret** (plain-text variables are wiped on each deploy). Until it is set, `/pv.js` returns 503 and nothing is tracked. For local tracking, put the same line in `.dev.vars` (gitignored). Visits from your dev server will then show up in Umami.

## Editing content

Everything lives in `public/index.html`.

- **Career chart.** Each `<li>` in the story section (`#story-list`) is one candle. `data-ohlc="open high low close"` sets its shape, `data-label` its axis label, `data-note` an optional handwritten note, and `data-kind="next"` the faded "next" candle.
- **Projects.** The `.projects` list. Swap the "Private repo" badge for a `View code` link when a repo goes public.
- **Icons.** All icons are hand-drawn SVG `<symbol>`s at the top of `<body>`. Shapes are filled, never stroked. Parts with `style="fill:var(--tone)"` take the lighter second colour.
- **Logo.** The same two paths appear in `public/logo.svg`, `public/favicon.svg` and the `#i-logo` symbol, so change all three together. Every diagonal is 45° and every gap is 2 units.
- **Colours.** `public/css/tokens.css`. Each token uses `light-dark(light, dark)`, so both themes are defined in one place.
