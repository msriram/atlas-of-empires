# Contributing to Atlas of Empires

Contributions to historical coverage, source citations, map behavior, accessibility, and performance are welcome. Open a GitLab issue describing the change and its evidence, or submit a merge request.

## Run locally

Use Node.js 22.13 or newer:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Before a merge request, run:

```sh
npm run build:atlas # after changing coordinates or transfer logic
npm test
npm run lint
npm run build
```

## Add or correct a territory

Edit `app/data/territory-keyframes.json`. Each frame has a year, `r` polygon rings in `[longitude, latitude]` degrees, and an optional precision level `p`. Negative years are BCE. Add at least two dated frames when describing growth. Put the source URL and uncertainty in your merge request. Use `hidden` for obsolete source labels. See [README.md](README.md) for an example. Rebuild with `npm run build:atlas`, reload, and include the generated `public/atlas/` changes in your merge request. Dev/build startup checks input hashes and skips generation when the atlas is current.

The dated source maps live in `public/historical/`. Preserve their GPL license and attribution. For live campaigns, edit `app/data/empire-timelines.json` with the empire’s names, dated gains/losses, geographic selectors, and a source URL for every stage. Keep `fallback: "hold"` when annual evidence is missing. Opt into `estimated` only for a clearly approximate individual track. Do not add random timing offsets or force every year to show growth. Events go in `app/data/events.ts` and need a source URL. Avoid presenting estimated annual borders as surveyed fact.

## Geometry checks

The live temporal field assigns one owner to a geographic location and evaluates it identically in flat and globe views. `tests/temporal-atlas.test.mjs` checks all adjacent atlas endpoints, every year from 530–460 BCE, connected conquest, Mongol campaigns and quiet years, gradual succession, independent empire calendars, unchanged shapes, holes/dateline wrapping, and the fractional playback clock. Add regression coverage for new periods and test around source dates and dated events. Older polygon-model tests remain as reference for the previous engine; they do not replace the temporal-atlas tests.

For performance changes, check 1y/32× playback in both modes and a reload. The canvas's `data-year`, `data-interval`, `data-fps`, and `data-first-frame-ms` attributes provide local diagnostics without sending telemetry. Check that no old interval remains displayed after its end, and that the UI remains usable while the next interval loads. Do not increase the in-memory or persistent cache bounds without measuring the effect.

## Code and rights

Keep changes focused and explain the historical basis and visual effect. Do not submit data without a compatible license or permission. Application contributions are under GPL-3.0-only. Respect personal privacy when adding analytics events; do not record searches, account details, or saved view contents.
