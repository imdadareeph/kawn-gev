// Generates every file that carries the product name from brand.json (the only place the name lives).
// Run automatically before dev and build. Renaming the product = edit brand.json, run `npm run brand`.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brand = JSON.parse(readFileSync(join(root, 'brand.json'), 'utf8'));
const prefix = brand.slug.toUpperCase().replace(/[^A-Z0-9]+/g, '_');

// 1. package.json name + description
const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.name = brand.slug;
pkg.description = brand.tagline;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// 2. web app manifest
mkdirSync(join(root, 'public'), { recursive: true });
const manifest = {
  name: brand.name,
  short_name: brand.name,
  description: brand.tagline,
  start_url: '.',
  display: 'standalone',
  background_color: '#0b0f14',
  theme_color: '#0b0f14',
  icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
};
writeFileSync(join(root, 'public', 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');

// 3. README from template
const tplPath = join(root, 'scripts', 'readme.template.md');
if (existsSync(tplPath)) {
  const out = readFileSync(tplPath, 'utf8')
    .replaceAll('{{brand.name}}', brand.name)
    .replaceAll('{{brand.name_ar}}', brand.name_ar ?? brand.name)
    .replaceAll('{{brand.slug}}', brand.slug)
    .replaceAll('{{brand.tagline}}', brand.tagline)
    .replaceAll('{{brand.env}}', prefix);
  writeFileSync(join(root, 'README.md'), out);
}

// 4. env example (variable names are prefixed from the slug)
const env = `# Optional server settings. Nothing here is required: the app runs with zero keys.
# Never prefix a secret with VITE_: anything named VITE_* is shipped to the browser.
${prefix}_HOST=127.0.0.1
${prefix}_PORT=8787
# Extra host names the server accepts (comma separated), needed when it is exposed beyond localhost.
${prefix}_ALLOWED_HOSTS=
# Per-IP requests per minute on /api (0 disables).
${prefix}_RATE_PER_MIN=90
`;
writeFileSync(join(root, '.env.example'), env);

console.log(`[brand] generated package name, manifest, README, .env.example for "${brand.slug}"`);
await import('./copy-cesium.mjs');
