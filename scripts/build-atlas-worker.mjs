import {build} from 'esbuild';
await build({entryPoints: ['app/temporal/atlas.worker.ts'], outfile: 'public/atlas-loader.worker.js', bundle: true, format: 'esm', target: 'es2022', minify: true});
