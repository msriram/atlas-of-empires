import {readFileSync, existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {atlasInputVersion} from './atlas-inputs.mjs';

let current = false;
try {
  const manifest = JSON.parse(readFileSync('public/atlas/manifest.json', 'utf8'));
  current = manifest.inputVersion === atlasInputVersion() && manifest.intervals.every(i => existsSync(`public/atlas/${i.file}`));
} catch { /* A clean checkout can generate the atlas locally. */ }
if (!current) {
  console.log('Rebuilding dated geographic data…');
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/build-atlas.ts'], {stdio: 'inherit'});
  process.exit(result.status ?? 1);
}
