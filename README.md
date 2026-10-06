# Atlas of Empires

An interactive, approximate world timeline from 10,000 BCE to today. Run locally with `npm run dev` in this directory.

## Historical boundaries

The basemap is [Natural Earth 1:110m land](https://github.com/nvkelso/natural-earth-vector), public domain. Dated political and cultural polygons in `public/historical/` are simplified derivatives of [André Ourednik's historical-basemaps](https://github.com/aourednik/historical-basemaps), licensed GPL-3.0; see `public/historical/LICENSE`. The app uses the source polygons directly at their mapped snapshot years, subject to the limitations of that dataset. In particular, ancient and poorly documented boundaries are uncertain. The newest source snapshot is 2010; later years use that shape.

`app/territory-transfers.ts` partitions overlapping source polygons into shared pieces of land and moves a single ownership edge between neighboring regions. This keeps land occupied during takeovers and prevents independently grown polygons from overlapping. `app/territory-model.ts` applies dated transfer rules and custom keyframes. A region that appears in only one source snapshot still has uncertain coverage; its estimated edge is illustrative. The same longitude/latitude polygons render in both map and globe views. Very dense snapshots use a bounded local calculation; preexisting source overlaps may remain there. Calculations run in a same-origin Web Worker so the controls stay responsive.

## Add, change, or remove an empire

Edit `app/data/territory-keyframes.json`. Add a track with two or more dated longitude/latitude polygon rings:

```json
{
  "tracks": [
    {
      "name": "Example Kingdom",
      "frames": [
        { "year": -500, "p": 2, "r": [[[10, 40], [12, 40], [12, 42], [10, 42]]] },
        { "year": -450, "p": 2, "r": [[[9, 39], [14, 39], [14, 43], [9, 43]]] }
      ]
    }
  ],
  "hidden": []
}
```

Negative years are BCE. `r` is an array of polygon rings; each point is `[longitude, latitude]` in degrees. A track overrides a source region with the same name for the track's date range; it can also add an entirely new region. To remove a source region, add its exact name to `hidden`. To remove a custom region, delete its track. Yearly shapes between your frames are interpolated automatically. The file is imported at build time, so save it and let the local dev server rebuild.

`app/data/territory-transfers.json` contains dated transfer controls and source links. `app/data/territory-rules.ts` contains the approximate Mongol campaign reach controls. `public/historical/1279.json` supplies the successor polygons that constrain its outer extent. Alexander's eastward campaign controls are in `app/data/events.ts`. Add a similarly dated rule for a campaign when you have better coordinates; the general source interpolation continues to work for every other region.

## Timeline, events, and journeys

The detailed slider moves in one-year steps. Historical events and their source links are in `app/data/events.ts`. Curated journeys in `app/data/journeys.ts` refer to those event IDs. Search looks across all dated snapshots and custom tracks, jumps the timeline to a matching year, and highlights the region. The region detail panel shows years in which its name appears in source maps; those are coverage dates, not founding and ending dates.

## Navigation and saved views

Drag to pan the flat map, which repeats east to west. Drag to rotate the globe. Scroll or use the buttons to zoom either view. Saved views currently use this browser's storage. Google account sync still requires OAuth setup and a persistent backend.

## Analytics and publication

Analytics use Umami when `NEXT_PUBLIC_UMAMI_WEBSITE_ID` is set to a website ID from your Umami dashboard. Copy `.env.example` to `.env.local` for local testing, or set the variable in your hosting environment before building. The tracker honors Do Not Track and records pageviews plus save/view-switch counts. Search queries and saved views are not custom event data. Without an ID, the tracker is disabled. GitLab source publication alone does not host the application; use a compatible Next.js/Vinext host for the live site.

See [COPYRIGHT.md](COPYRIGHT.md), [LICENSE](LICENSE), and [CONTRIBUTING.md](CONTRIBUTING.md). The GitLab pipeline runs tests, lint, and build on merge requests.
