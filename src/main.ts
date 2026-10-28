import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-700.css';
import '@fontsource/ibm-plex-sans-arabic/latin-400.css';
import '@fontsource/ibm-plex-sans-arabic/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import 'cesium/Build/Cesium/Widgets/CesiumWidget/CesiumWidget.css';
import './styles/app.css';
import { startApp } from './app';
import { LOG_PREFIX } from './brand';

async function boot(): Promise<void> {
  // Fonts are self-hosted; wait briefly so canvas labels pick the right face on first draw.
  try {
    await Promise.race([
      Promise.all([document.fonts.load('500 12px "IBM Plex Mono"'), document.fonts.load('400 14px "IBM Plex Sans Arabic"')]),
      new Promise((r) => window.setTimeout(r, 1500)),
    ]);
  } catch {
    /* fall back to system fonts */
  }
  const root = document.getElementById('app');
  if (!root) throw new Error('missing #app');
  const started = performance.now();
  const { ready } = startApp(root);
  await ready;
  // Loading screen shows for at least one second so quick loads never flash.
  const wait = Math.max(0, 1000 - (performance.now() - started));
  window.setTimeout(() => {
    const boot = document.getElementById('boot');
    boot?.classList.add('done');
    window.setTimeout(() => boot?.remove(), 600);
  }, wait);
}

boot().catch((err) => {
  console.error(`${LOG_PREFIX} failed to start`, err);
  const boot = document.getElementById('boot');
  if (boot) boot.textContent = 'Failed to start. Reload the page.';
});
