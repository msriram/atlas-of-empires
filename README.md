# Atlas of Empires

An interactive, approximate world timeline from 10,000 BCE to the present.

## Add or remove civilizations

Edit `app/data/civilizations.ts`. Each record has:

- `id`: stable unique key
- `name`, `region`, `note`: text shown in the interface
- `start`, `end`: years, using negative numbers for BCE (for example, `-500` = 500 BCE)
- `lat`, `lon`: approximate center used for the marker
- `radius`: marker size, in SVG units (a visual cue only)
- `color`: marker color

Add a record to the array or delete one to remove it. The markers represent approximate centers and spheres of influence. They are **not historical borders**. Dates and territorial extents are debated and this starter dataset is selective, not exhaustive.

## Saved views

Saved years currently live in browser storage on one device. Share produces a year-specific URL. Google account sync needs a Google OAuth client ID and secret for the deployed domain, plus a persistent backend; these are not configured in this version.
