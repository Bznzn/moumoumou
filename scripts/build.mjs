import{build as bundle}from'esbuild';
import{build as viteBuild}from'vite';
import{mkdir}from'node:fs/promises';
import path from'node:path';
await mkdir('dist',{recursive:true});
await Promise.all([
  bundle({entryPoints:['src/main/index.ts'],outfile:'dist/main/index.cjs',bundle:true,platform:'node',format:'cjs',target:'node24',external:['electron']}),
  bundle({entryPoints:['src/preload/index.ts'],outfile:'dist/preload/index.cjs',bundle:true,platform:'node',format:'cjs',target:'node24',external:['electron']}),
  viteBuild({root:path.resolve('src/renderer'),base:'./',build:{outDir:path.resolve('dist/renderer'),emptyOutDir:true}}),
]);
