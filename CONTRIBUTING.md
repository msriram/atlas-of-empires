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
npm test
npm run lint
npm run build
```

## Add or correct a territory

Edit `app/data/territory-keyframes.json`. Each frame has a year, `r` polygon rings in `[longitude, latitude]` degrees, and an optional precision level `p`. Negative years are BCE. Add at least two dated frames when describing growth. Put the source URL and uncertainty in your merge request. Use `hidden` for obsolete source labels. See [README.md](README.md) for an example.

The dated source maps live in `public/historical/`. Preserve their GPL license and attribution. If you add a campaign transfer, edit `app/data/territory-transfers.json` with a target, dated interval, approximate origin, and source URL. Events go in `app/data/events.ts` and need a source URL. Avoid presenting estimated annual borders as surveyed fact.

## Geometry checks

The transfer model gives each mapped piece of land one owner at a time and uses one longitude/latitude geometry for flat and globe views. Add regression coverage for any new period where a border changes unexpectedly. Test at least the years immediately before and after a source snapshot or dated event. For example, `tests/territory-transfers.test.mjs` checks every year from 530 to 460 BCE.

## Code and rights

Keep changes focused and explain the historical basis and visual effect. Do not submit data without a compatible license or permission. Application contributions are under GPL-3.0-only. Respect personal privacy when adding analytics events; do not record searches, account details, or saved view contents.
