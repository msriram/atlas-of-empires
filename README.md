# Atlas of Empires

An interactive, approximate world timeline from 10,000 BCE to today. Run locally with `npm run dev` in this directory.

## Historical boundaries

The basemap is [Natural Earth 1:110m land](https://github.com/nvkelso/natural-earth-vector), public domain. Dated political and cultural polygons in `public/historical/` are simplified derivatives of [André Ourednik's historical-basemaps](https://github.com/aourednik/historical-basemaps), GPL-3.0; see `public/historical/LICENSE`. These maps have uncertain borders, inconsistent coverage, and some historical naming errors. The newest source snapshot is 2010; later years reuse it.

### Continuous geographic ownership

The live map uses a precomputed temporal atlas, replacing the old per-year polygon-clipping worker:

1. `scripts/build-atlas.ts` converts dated coordinates into a shared **0.125° longitude/latitude grid**. Smaller source regions take priority where polygons overlap. Holes and longitude wrapping are retained.
2. `app/data/empire-timelines.json` gives each empire its own dated regional campaigns, pauses, gains, and losses. `scripts/lib/campaign-chronology.ts` applies these calendars to the relevant geographic portions of the source outlines. There is no shared world growth schedule. Unchanged geography stays fixed. **Missing annual evidence holds the last source border until the next dated map**; a source-map update is not presented as a dated conquest.
3. `scripts/lib/ownership-field.ts` orders a campaign front through connected target geography from retained territory. Each location records previous/next ownership, arrival time, and a narrow sub-year smoothing band. Disconnected components may seed locally when the route is unknown. Polygons are never scaled into growing or shrinking circles. The geographic selectors and resistance are illustrative, not surveyed campaign fronts or measured terrain.
4. `public/atlas/manifest.json` indexes content-addressed, compressed interval files. They encode any annual **or fractional-year** sample without storing thousands of redundant annual polygons.
5. `app/temporal/territory-canvas.tsx` evaluates the same field on the GPU in flat or orthographic globe coordinates. Land has one displayed owner. Clicking and rendering use the same geographic sampling. Shared endpoints are identical across intervals.

Animated intermediate shapes are **estimates, not recovered historical annual coordinates**. The grid also limits very small states and extreme zoom detail. Add dated coordinate keyframes to improve the historical result; interpolation cannot supply missing evidence. The browser needs WebGL 2 for animated boundaries.

### Playback and performance

Choose a 1, 10, 100, or 1,000-year step and a speed from ¼× to 32× beside Play. Playback advances `step × speed` years per second using a fractional-year animation clock. With **1y and 32×**, that means 32 years per second while rendering intermediate frames. The sidebar updates at most ten times per second. Scrubbing or selecting a search result pauses playback; a hidden tab does not catch up in a burst.

The browser runs at most one fetch/decompression worker at a time. Seeking to another interval terminates obsolete work before starting its replacement; decoded buffers transfer to the renderer without copying. It retains the current and previous completed intervals (at most two, about 64 MiB total), and caches at most six compressed files on disk. Forward playback may prefetch its successor; manual scrubbing never triggers speculative loads. Two GPU interval slots are retained separately: reversing between them only binds textures, and loading another interval reuses a slot. It does not download the full atlas. The clock waits at an uncached interval boundary so the date cannot outrun the map. A new deployment refreshes a stale manifest automatically once. Reloads reuse cached geographic data.

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

Negative years are BCE. `r` is an array of polygon rings; each point is `[longitude, latitude]` in degrees. A track overrides a source region with the same name for the track's date range; it can also add an entirely new region. To remove a source region, add its exact name to `hidden`. To remove a custom region, delete its track. Authored coordinate tracks explicitly opt into estimated interpolation between their frames. Identical frames remain static. Run `npm run build:atlas` after changing geographic data, then reload the page. `npm run dev` and `npm run build` also check for changed inputs and regenerate only when needed. Source edits do not trigger a full atlas rebuild on every browser reload. Commit the updated atlas manifest and generated interval files with the source data.

### Independent campaign data

`app/data/empire-timelines.json` is the live calendar. Each profile has names, an approximate origin, a fallback policy, sources, and regional stages. For example:

```json
{
  "id": "example",
  "names": ["Example Kingdom"],
  "origin": [12, 41],
  "fallback": "hold",
  "source": "https://example.org/historical-source",
  "stages": [
    {"id": "northern-campaign", "action": "gain", "start": 120, "end": 125,
     "bounds": [10, 40, 18, 47], "source": "https://example.org/campaign-source"},
    {"id": "western-loss", "action": "loss", "start": 170, "end": 174,
     "region": [[10,40],[12,40],[12,44],[10,44]], "source": "https://example.org/loss-source"}
  ]
}
```

`bounds` means `[west, south, east, north]`; `region` is a geographic selection polygon. Both are clipped to the dated source shapes. They select where a campaign applies, rather than defining a circle around a capital. Later, more specific stages take priority where selectors overlap. A stage whose dates partly overlap a source interval is constrained by that interval's endpoints. The current source geometry cannot reconstruct a conquest and reversal wholly missing from every source map; add coordinate keyframes for that case.

The default fallback is `hold`. Use `estimated` on an **individual profile** only when an explicitly approximate transition is wanted despite missing annual evidence. There is no random growth or calendar-wide expansion curve. Existing profiles cover Rome's provinces and fragmentation, Achaemenid conquests, Alexander's campaigns/succession, Mongol campaigns/fragmentation, Yuan conquest of Song territory, Ottoman campaigns, and the Umayyad transition. Their source links support chronology; their intermediate outlines remain approximate.

The build derives Mongol anchors at 1206 and 1260 from the 1200 and 1279 source outlines. Later source maps supply successor regions. `app/data/territory-transfers.json` and the old polygon worker are retained as reference for the previous engine; the live chronology takes precedence. Keyframe dates are map evidence, not necessarily founding or ending dates.

## Timeline, events, and journeys

The detailed slider moves in one-year steps. Historical events and their source links are in `app/data/events.ts`. Curated journeys in `app/data/journeys.ts` refer to those event IDs. Search looks across all dated snapshots and custom tracks, jumps the timeline to a matching year, and highlights the region. The region detail panel shows years in which its name appears in source maps; those are coverage dates, not founding and ending dates.

## Navigation and saved views

Drag to pan the flat map, which repeats east to west. Drag to rotate the globe. Scroll or use the buttons to zoom either view. Saved views currently use this browser's storage. Google account sync still requires OAuth setup and a persistent backend.

## Analytics and publication

Analytics use Umami when `NEXT_PUBLIC_UMAMI_WEBSITE_ID` is set to a website ID from your Umami dashboard. Copy `.env.example` to `.env.local` for local testing, or set the variable in your hosting environment before building. The tracker honors Do Not Track and records pageviews plus save/view-switch counts. Search queries and saved views are not custom event data. Without an ID, the tracker is disabled. GitLab source publication alone does not host the application; use a compatible Next.js/Vinext host for the live site.

See [COPYRIGHT.md](COPYRIGHT.md), [LICENSE](LICENSE), and [CONTRIBUTING.md](CONTRIBUTING.md). The GitLab pipeline runs tests, lint, and build on merge requests.
