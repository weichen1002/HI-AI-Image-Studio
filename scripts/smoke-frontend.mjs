import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');
const assetsDir = join(distDir, 'assets');
const indexPath = join(distDir, 'index.html');

function fail(message) {
  console.error(`[smoke:frontend] ${message}`);
  process.exit(1);
}

if (!existsSync(indexPath)) {
  fail('dist/index.html is missing. Run npm run build first.');
}

if (!existsSync(assetsDir)) {
  fail('dist/assets is missing. Run npm run build first.');
}

const indexHtml = readFileSync(indexPath, 'utf8');
if (!indexHtml.includes('<div id="app"></div>')) {
  fail('dist/index.html does not contain the Vue mount point.');
}

const assets = readdirSync(assetsDir);
const requiredChunks = [
  'AuthView',
  'CreateView',
  'HistoryView',
  'StudioView',
  'vendor-vue',
];

const missing = requiredChunks.filter(
  (chunkName) => !assets.some((fileName) => fileName.startsWith(chunkName)),
);

if (missing.length) {
  fail(`missing expected route chunks: ${missing.join(', ')}`);
}

console.log(`[smoke:frontend] ok (${assets.length} assets checked)`);
