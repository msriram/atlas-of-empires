# Atlas of Empires: core requirements

Read this document before changing map rendering, historical data, playback, or navigation. Every feature change must preserve these behaviors. If a source cannot support a precise annual claim, show the result as an estimate and explain the limitation in the interface and contribution notes.

## Geographic alignment

- The colored ownership layer must follow the same visible coastline as the base land map in both flat and globe modes, at every supported zoom, pan, and rotation. Territory color must not extend into a sea because the atlas and basemap have different source geometries.
- Flat-map wrapping and globe projection must use the same geographic ownership field. A longitude on either side of the dateline must resolve to the same territory. Holes and disconnected islands must survive rendering.
- Boundaries should remain smooth at normal and high zoom. The overlay must cover the entire viewport; no top or bottom cutoff.

## Historical change

- Each empire has its own geographic data and time windows. One empire's growth or retreat must not cause unrelated empires to grow or shrink. A location whose source ownership is unchanged must stay unchanged, including during playback.
- Dated campaign stages take precedence for the selected region. Where only two dated outlines are known, interpolate an **estimated, connected local front** between those outlines. Do not jump a whole source map at its endpoint, scale a polygon uniformly, or expand every empire from a round point.
- An area being transferred has exactly one owner at each instant. Conquest and succession must move a boundary through the area rather than erase one entire empire and create another in one frame. A documented abrupt one-year event may use a one-year window, but that must be an explicit, sourced data choice.
- Empty or unknown coverage is not one worldwide polity. Retreats into unknown coverage must be independent for each previous owner.
- Do not claim estimated annual coordinates are surveyed facts. Improve a region by adding sourced dated stages or coordinate keyframes. Exact source geometry and annual estimates must be distinguishable to users.
- Historical period names and spelling variants must be searchable across the timeline. A new name for an existing region must preserve its territorial identity and color; it must not create, erase, or reshape the polygon at the naming date. Where a source outline is too coarse to show the extent of a named period, explain that limitation in the region detail.

## Interaction and performance

- Scrubbing back and forth for more than five seconds must remain responsive and memory bounded. Playback at a one-year step and up to 32× must move continuously. Loading a new interval must not leave a stale boundary onscreen as if it were current.
- Scroll zoom, drag pan or rotate, search-to-year, the complete civilization list, and the adjustable focus range on the timeline must keep working in both display modes.

## Required regression checks for changes

1. Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and the production build.
2. Inspect 2 BCE → 1 BCE one year at a time. This is a known regression case: the October 2026 atlas switched 36,778 of 42,483 changed cells at once at the 1 BCE source date. A rebuilt atlas must not reproduce that cliff.
3. Inspect 530–460 BCE, Roman expansion and fragmentation, Mongol expansion and succession, and a quiet interval in which no empire moves. Check flat and globe modes at default and high zoom, including the northern and southern viewport edges and the dateline.
4. Scrub repeatedly for at least ten seconds, then play at one year and 32×. Check that memory and load counts settle instead of growing without bound.
5. If a change adds or edits historical data, cite each dated stage, explain where geometry is estimated, and add a regression check around its start, end, and a quiet year.

Record the checks and any known limitation in the pull request. A feature is incomplete if it violates these requirements even when its own interaction works.
