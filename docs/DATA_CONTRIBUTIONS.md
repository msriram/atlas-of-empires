# Contribute historical data

The map is only as useful as its evidence. A small, well-sourced correction is more valuable than a precise-looking border with no historical basis. Begin with a [historical data issue](https://github.com/msriram/atlas-of-empires/issues/new/choose) so others can discuss the date, name, and source before you draw a large area.

## Choose the right file

| Your change | Edit |
| --- | --- |
| Add an empire or supply dated boundary coordinates | `app/data/territory-keyframes.json` |
| Remove an obsolete source label | The `hidden` array in `app/data/territory-keyframes.json` |
| Date a regional gain or loss in an existing source outline | `app/data/empire-timelines.json` |
| Add a battle, founding event, or collapse marker | `app/data/events.ts` |
| Correct a base snapshot | `public/historical/<year>.json` after checking the source data and its GPL license |

The dated snapshots were derived from [historical-basemaps](https://github.com/aourednik/historical-basemaps). They are approximate and have uneven coverage. Do not use a dated event as proof of a precise political border. For contested or uncertain geography, describe competing interpretations in the issue and pull request.

## Add a dated polygon track

`app/data/territory-keyframes.json` is ordinary JSON. A track's `frames` define the outline at known dates. Use negative years for BCE, positive years for CE, and coordinates in **[longitude, latitude]** order. Longitudes must be −180 to 180 and latitudes −90 to 90. Each `r` entry is a polygon ring; close it by repeating the first point if practical.

```json
{
  "tracks": [
    {
      "name": "Example Kingdom",
      "frames": [
        {
          "year": -500,
          "p": 2,
          "r": [[[10, 40], [12, 40], [12, 42], [10, 42], [10, 40]]]
        },
        {
          "year": -450,
          "p": 2,
          "r": [[[9, 39], [14, 39], [14, 43], [9, 43], [9, 39]]]
        }
      ]
    }
  ],
  "hidden": []
}
```

Keep all existing tracks and hidden names when editing the real file. A custom track overrides a source region with the same name during its date range. If two dated frames have the same coordinates, the map should remain still between them. The visual movement between different frames is an estimate.

## Date a campaign without inventing an outline

Use `app/data/empire-timelines.json` when the source snapshots already contain the region but an independent campaign chronology can date where and when a frontier moved. A stage needs a source URL, `start`, `end`, and a geographic selector. Use `bounds` as `[west, south, east, north]` or `region` as a polygon; selectors are clipped to source outlines.

```json
{
  "id": "example-kingdom",
  "names": ["Example Kingdom"],
  "origin": [12, 41],
  "fallback": "hold",
  "source": "https://example.org/overview",
  "stages": [
    {
      "id": "northern-campaign",
      "action": "gain",
      "start": 120,
      "end": 125,
      "bounds": [10, 40, 18, 47],
      "source": "https://example.org/campaign"
    }
  ]
}
```

Add this object to the existing `profiles` array. `fallback: "hold"` keeps the last mapped outline when annual evidence is absent. Use `estimated` only when you explicitly want a documented approximation. Campaign stages do not create surveyed annual coordinates.

## Add an event

Add a `HistoricalEvent` object to `historicalEvents` in `app/data/events.ts`. It needs a unique `id`, `year`, `title`, `empire`, `lon`, `lat`, `kind`, short `summary`, and `source` URL. `kind` is `expansion`, `turning point`, or `fragmentation`. Event coordinates mark the approximate location of the event, not the empire's boundary.

## Rebuild and review

1. Run `npm run build:atlas` after changing geographic files or campaign chronology. Include the changed `public/atlas/manifest.json` and generated `.atlas` files in your pull request.
2. Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
3. Open the optimized site with `npm run dev`. Check a year before, during, and after your proposed change in **flat and globe views**. Try a one-year step and 32× playback near a changing boundary.
4. In the pull request, link each historical source, say which coordinates are documented versus estimated, and include a screenshot or short recording. Explain alternate names or disputed borders.

The atlas uses a quarter-degree grid, so a region smaller than a cell may not appear. If the source does not support an annual shape, keep the boundary still until the next dated map.
