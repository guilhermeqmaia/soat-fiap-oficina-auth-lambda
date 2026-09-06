// Bundle da function com esbuild: um unico arquivo CommonJS em dist/index.js.
// O bundle mantem o pacote leve (cold start menor) e dispensa node_modules no
// artefato de deploy.
// BUILD_DEV=1 gera sourcemap e nao minifica (breakpoints do VS Code no .ts).
import { build } from 'esbuild';

const dev = process.env.BUILD_DEV === '1';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: dev ? 'inline' : false,
  minify: !dev,
  legalComments: 'none',
  logLevel: 'info',
});
