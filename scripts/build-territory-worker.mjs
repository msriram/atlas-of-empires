import {build} from 'esbuild';
await build({entryPoints:['app/territory-worker.ts'],outfile:'public/territory-worker.js',bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',legalComments:'external',logLevel:'warning'});
