// Empacota dist/index.js em lambda.zip (artefato de deploy da Lambda).
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

if (!existsSync('dist/index.js')) {
  console.error('dist/index.js nao encontrado — rode `npm run build` antes.');
  process.exit(1);
}

rmSync('lambda.zip', { force: true });
execFileSync('zip', ['-j', '-q', '-X', 'lambda.zip', 'dist/index.js'], { stdio: 'inherit' });
console.log('lambda.zip gerado.');
