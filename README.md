# VaultConvert

Free, private file converters that run **entirely in the browser**. No uploads, no server, no watermark.

## What's here

- `config/tools.json` — single source of truth: every tool, modifier, intro, FAQ.
- `build.mjs` — static generator. Reads `tools.json`, writes `dist/`.
- `static/` — client engine (`engine.js`), styles (`style.css`), `_headers`.
- `dist/` — generated site (this is what gets deployed).

## Build locally

```
node build.mjs
```

This regenerates `dist/`. Add or edit a tool by editing `config/tools.json` only — no code changes needed.

## Deploy on Cloudflare Pages (recommended)

1. Push this folder to a **new** GitHub repo.
2. Cloudflare dash → Workers & Pages → Create → Pages → Connect to Git → pick the repo.
3. Build settings:
   - **Framework preset:** None
   - **Build command:** `node build.mjs`
   - **Build output directory:** `dist`
4. Deploy. Editing `tools.json` on GitHub will auto-rebuild.

### Alternative: direct upload

If you don't want a build step, just upload the contents of `dist/` to Cloudflare Pages (Direct Upload). But then you must run `node build.mjs` yourself before each upload.

## IMPORTANT: indexing

`config/tools.json` has `"noindex": true`. While on `*.pages.dev` this:
- adds `<meta robots noindex>` to every page, and
- makes `robots.txt` disallow everything.

**Before SEO launch:** buy the real domain, attach it to this same Pages project, then set `"noindex": false` and update `"domain"` to the real one, commit, and rebuild. Only then does the domain-age / ranking clock start on the final domain.

## Tools in this build (Tier A — image)

HEIC→JPG (+ on iPhone / on Mac / on Windows / batch / without losing quality), HEIC→PNG, WebP→PNG, WebP→JPG, PNG→JPG (+ without losing quality), JPG→PNG, SVG→PNG, AVIF→JPG.

## How conversion works

- **PNG / JPG / WebP / AVIF / SVG** — decoded natively by the browser (`createImageBitmap` / `<img>`), drawn to a `<canvas>`, re-encoded with `canvas.toBlob`.
- **HEIC** — browsers can't decode HEIC natively, so `engine.js` lazy-loads `heic2any` (WASM) from jsDelivr **only on HEIC pages**. Decoding still happens locally in the browser; the file is never uploaded.

## Roadmap (next)

- Tier B (FFmpeg.wasm): video/audio converters — these need cross-origin isolation. Add a **scoped** `_headers` block (COOP/COEP) for just those routes (placeholder already in `static/_headers`).
- Flesh out remaining long-tail modifiers per the QA rule (max 10 pages without human review; each page must pass the “remove H1 + URL — still distinguishable?” test).
