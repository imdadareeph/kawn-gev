// Fails the build if the product name, slug, Arabic name or tagline is hardcoded outside brand.json.
// Scans hand-written source only; generated files (README, manifest, package.json, .env.example) are excluded.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brand = JSON.parse(readFileSync(join(root, 'brand.json'), 'utf8'));

const needles = [brand.name, brand.slug, brand.name_ar, brand.tagline, brand.domain]
  .filter((s) => typeof s === 'string' && s.trim().length >= 3)
  .map((s) => s.toLowerCase());

const scanDirs = ['src', 'server', 'shared', 'tests'];
const scanFiles = ['index.html', 'vite.config.ts'];
const exts = new Set(['.ts', '.mjs', '.js', '.css', '.html', '.json', '.svg', '.md', '.mts']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (exts.has(extname(p))) yield p;
  }
}

const files = [...scanFiles.map((f) => join(root, f))];
for (const d of scanDirs) {
  try {
    files.push(...walk(join(root, d)));
  } catch {
    /* directory may not exist yet */
  }
}

const hits = [];
for (const f of files) {
  let text;
  try {
    text = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  const lower = text.toLowerCase();
  for (const n of needles) {
    // Whole-word match: the Arabic name is also a common word stem, so substrings inside other words are not hits.
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'gu');
    for (const m of lower.matchAll(re)) {
      const line = lower.slice(0, m.index).split('\n').length;
      hits.push(`${relative(root, f)}:${line}  contains "${n}"`);
    }
  }
}

if (hits.length) {
  console.error('[brand] hardcoded product name found. Use the brand module / {{brand.*}} placeholders instead:\n  ' + hits.join('\n  '));
  process.exit(1);
}
console.log(`[brand] ok: no hardcoded name in ${files.length} files`);
