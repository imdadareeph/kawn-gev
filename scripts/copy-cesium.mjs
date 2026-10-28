// Copies Cesium's runtime assets (web workers, third-party code, images) into public/cesium so the
// bundled app can load them from its own origin. Generated; safe to delete.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'cesium', 'Build', 'Cesium');
const dst = join(root, 'public', 'cesium');
rmSync(dst, { recursive: true, force: true });
mkdirSync(dst, { recursive: true });
for (const dir of ['Workers', 'ThirdParty', 'Assets']) cpSync(join(src, dir), join(dst, dir), { recursive: true });
console.log('[cesium] runtime assets copied to public/cesium');
