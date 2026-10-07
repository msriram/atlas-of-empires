import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';

export function atlasInputVersion() {
  const files = [
    'scripts/build-atlas.ts', 'scripts/lib/ownership-field.ts',
    'scripts/lib/campaign-chronology.ts', 'app/temporal/chronology.ts',
    'app/data/empire-timelines.json',
    'app/temporal/atlas.ts', 'app/geometry-field.ts', 'app/territory-transfers.ts',
    'app/data/territory-keyframes.json', 'app/data/territory-transfers.json',
    ...readdirSync('public/historical').filter(f => /^-?\d+\.json$/.test(f)).sort().map(f => `public/historical/${f}`),
  ];
  const hash = createHash('sha256');
  for (const file of files) {hash.update(file); hash.update(readFileSync(file));}
  return hash.digest('hex').slice(0, 16);
}
