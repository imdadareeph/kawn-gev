import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import brand from './brand.json' with { type: 'json' };
import { createApiMiddleware } from './server/api.mjs';

// Fills %BRAND_*% placeholders in index.html from brand.json (single source of truth).
function brandHtml(): Plugin {
  return {
    name: 'brand-html',
    transformIndexHtml(html) {
      return html
        .replaceAll('%BRAND_NAME%', brand.name)
        .replaceAll('%BRAND_NAME_AR%', brand.name_ar ?? brand.name)
        .replaceAll('%BRAND_SLUG%', brand.slug)
        .replaceAll('%BRAND_TAGLINE%', brand.tagline);
    },
  };
}

// Serves the same /api handlers as the production server while developing.
function localApi(): Plugin {
  const mw = createApiMiddleware();
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(mw);
    },
    configurePreviewServer(server) {
      server.middlewares.use(mw);
    },
  };
}

export default defineConfig({
  plugins: [brandHtml(), localApi()],
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 6000 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
