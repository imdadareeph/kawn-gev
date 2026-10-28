import { icon } from './icons';
import { tacticalHtml } from './tactical';
import { KIND_COLOR } from '../data/parking-sample';
import { CLASS_COLOR } from '../layers/satellites';

/** Static page structure. All visible text uses data-i18n so language switches never rebuild the DOM. */
export function shellHtml(): string {
  return `
<a class="skip-link" href="#map" data-i18n="skipToMap"></a>
<div id="map" class="map" role="region" data-i18n-aria="mapLabel" tabindex="-1"></div>
<div id="scope" class="scope" aria-hidden="true"></div>
${tacticalHtml()}

<header class="topbar">
  <div class="brand" id="brand-block">
    <span class="brand-mark" aria-hidden="true"></span>
    <span class="brand-text"><span class="brand-name" id="brand-name"></span><span class="brand-tag" id="brand-tag"></span></span>
  </div>
  <div class="actions" role="toolbar" data-i18n-aria="actReset" id="actions">
    <button class="icon-btn" id="act-clear" data-i18n-title="actClear" data-i18n-aria="actClear">${icon('clear')}</button>
    <button class="icon-btn" id="act-copy" data-i18n-title="actCopy" data-i18n-aria="actCopy">${icon('link')}</button>
    <button class="icon-btn" id="act-tilt" data-i18n-title="actTilt" data-i18n-aria="actTilt">${icon('tilt')}</button>
    <button class="icon-btn" id="act-north" data-i18n-title="actNorth" data-i18n-aria="actNorth">${icon('north')}</button>
    <button class="icon-btn" id="act-reset" data-i18n-title="actReset" data-i18n-aria="actReset">${icon('reset')}</button>
    <button class="icon-btn" id="act-space" data-i18n-title="actSpace" data-i18n-aria="actSpace">${icon('globe')}</button>
  </div>
  <div class="chips" id="chips" role="status" aria-live="polite"></div>
</header>

<div class="sheet" id="sheet" data-sheet="half">
  <button class="sheet-handle" id="sheet-handle" aria-expanded="true" data-i18n-aria="layersTitle"><span></span></button>
  <div class="sheet-body">
    <aside class="rail rail-start" id="rail-start">
      <section class="panel" id="panel-layers" aria-labelledby="h-layers">
        <button class="panel-head" id="head-layers" aria-expanded="true" aria-controls="body-layers">
          ${icon('layers', 18)}<h2 id="h-layers" data-i18n="layersTitle"></h2>${icon('chevron', 16)}
        </button>
        <div class="panel-body" id="body-layers">
          <div class="layer-search">
            ${icon('search', 16)}
            <input type="search" id="layer-search" autocomplete="off" spellcheck="false" data-i18n-ph="layerSearch" data-i18n-aria="layerSearch" />
          </div>
          <div class="layer-empty" id="layer-empty" hidden data-i18n="layerSearchNone"></div>
          <div class="group-title" data-i18n="groupParking"></div>
          <div class="layer-row" data-layer="parking" data-keywords="free parking car spaces lot garage park مواقف مجانية سيارات">
            <button class="layer-toggle" role="switch" aria-checked="true" id="lt-parking">
              <span class="layer-ico" style="--c: var(--c-parking)">${icon('parking', 18)}</span>
              <span class="layer-name" data-i18n="layerParking"></span>
              <span class="layer-state" data-state="off"></span>
            </button>
            <div class="layer-meta" id="lm-parking"></div>
            <div class="layer-note" data-i18n="noteParking"></div>
          </div>
          <div class="layer-row" data-layer="paid" data-keywords="paid parking parkin zone tariff fee street garage مدفوعة باركن تعرفة">
            <button class="layer-toggle" role="switch" aria-checked="true" id="lt-paid">
              <span class="layer-ico" style="--c: var(--c-paid)">${icon('parking', 18)}</span>
              <span class="layer-name" data-i18n="layerPaid"></span>
              <span class="layer-state" data-state="off"></span>
            </button>
            <div class="layer-meta" id="lm-paid"></div>
            <div class="layer-note" data-i18n="notePaid"></div>
            <div class="park-legend" id="park-legend" aria-label="legend">
              <span class="pl-item"><i style="background:${KIND_COLOR.mall}"></i><span data-i18n="kindMall"></span></span>
              <span class="pl-item"><i style="background:${KIND_COLOR.garage}"></i><span data-i18n="kindGarage"></span></span>
              <span class="pl-item"><i style="background:${KIND_COLOR.street}"></i><span data-i18n="kindStreet"></span></span>
              <span class="pl-item"><i style="background:${KIND_COLOR.transit}"></i><span data-i18n="kindTransit"></span></span>
              <span class="pl-ring" data-i18n="legendRing"></span>
              <span class="pl-ring" data-i18n="legendPaid"></span>
            </div>
          </div>
          <div class="group-title" data-i18n="groupMobility"></div>
          <div class="layer-row" data-layer="flights" data-keywords="flights aircraft plane airport aviation طيران طائرات مطار">
            <button class="layer-toggle" role="switch" aria-checked="false" id="lt-flights">
              <span class="layer-ico" style="--c: var(--c-flights)">${icon('plane', 18)}</span>
              <span class="layer-name" data-i18n="layerFlights"></span>
              <span class="layer-state" data-state="off"></span>
            </button>
            <div class="layer-meta" id="lm-flights"></div>
            <div class="layer-note" data-i18n="policyFlights"></div>
          </div>
          <div class="layer-row" data-layer="transit" data-keywords="metro bus train tram transit rail subway مترو حافلة قطار">
            <button class="layer-toggle" role="switch" aria-checked="false" id="lt-transit">
              <span class="layer-ico" style="--c: var(--c-transit)">${icon('train', 18)}</span>
              <span class="layer-name" data-i18n="layerTransit"></span>
              <span class="layer-state" data-state="off"></span>
            </button>
            <div class="layer-meta" id="lm-transit"></div>
            <div class="layer-note" data-i18n="noteTransit"></div>
          </div>
          <div class="group-title" data-i18n="groupEstate"></div>
          <div class="layer-row" data-layer="estate" data-keywords="real estate property price building area عقارات اسعار">
            <button class="layer-toggle" role="switch" aria-checked="false" id="lt-estate">
              <span class="layer-ico" style="--c: var(--c-estate)">${icon('building', 18)}</span>
              <span class="layer-name" data-i18n="layerEstate"></span>
              <span class="layer-state" data-state="off"></span>
            </button>
            <div class="layer-meta" id="lm-estate"></div>
            <div class="layer-note" data-i18n="noteEstate"></div>
          </div>
          <div class="group-title" data-i18n="groupSpace"></div>
          <div class="layer-row" data-layer="satellites" data-keywords="satellites orbit space iss station spacecraft tracking أقمار صناعية مدار فضاء">
            <button class="layer-toggle" role="switch" aria-checked="false" id="lt-satellites">
              <span class="layer-ico" style="--c: var(--c-sat)">${icon('satellite', 18)}</span>
              <span class="layer-name" data-i18n="layerSatellites"></span>
              <span class="layer-state" data-state="off"></span>
            </button>
            <div class="layer-meta" id="lm-satellites"></div>
            <div class="layer-note" data-i18n="noteSatellites"></div>
            <div class="sat-legend" id="sat-legend" aria-label="legend">
              <span class="pl-item"><i style="background:${CLASS_COLOR.station}"></i><span data-i18n="clsStation"></span></span>
              <span class="pl-item"><i style="background:${CLASS_COLOR.visual}"></i><span data-i18n="clsVisual"></span></span>
              <span class="pl-item"><i style="background:${CLASS_COLOR.nav}"></i><span data-i18n="clsNav"></span></span>
              <span class="pl-item"><i style="background:${CLASS_COLOR.geo}"></i><span data-i18n="clsGeo"></span></span>
              <button class="chip" id="sat-dense" aria-pressed="false" data-i18n="satDense"></button>
              <span class="dim" id="sat-dense-state"></span>
            </div>
            <label class="sat-country" id="sat-country-wrap">
              <span data-i18n="satCountry"></span>
              <select id="sat-country" data-i18n-aria="satCountry"></select>
            </label>
            <div class="sat-speed" id="sat-speed" role="group" data-i18n-aria="satSpeedLabel">
              <span data-i18n="satSpeedLabel"></span>
              <button class="chip" data-sat-speed="1" aria-pressed="true" data-i18n="satSpeedLive"></button>
              <button class="chip" data-sat-speed="60" aria-pressed="false" data-i18n="satSpeed60"></button>
              <button class="chip" data-sat-speed="600" aria-pressed="false" data-i18n="satSpeed600"></button>
            </div>
          </div>
          <div class="layer-row" data-layer="daynight" data-keywords="day night sun terminator light dark shadow daylight نهار ليل شمس">
            <button class="layer-toggle" role="switch" aria-checked="false" id="lt-daynight">
              <span class="layer-ico" style="--c: var(--c-sun)">${icon('sun', 18)}</span>
              <span class="layer-name" data-i18n="layerDayNight"></span>
              <span class="layer-state" data-state="off"></span>
            </button>
            <div class="layer-meta" id="lm-daynight"></div>
            <div class="layer-note" data-i18n="noteDayNight"></div>
          </div>
        </div>
      </section>

      <section class="panel" id="panel-display" aria-labelledby="h-display">
        <button class="panel-head" id="head-display" aria-expanded="false" aria-controls="body-display">
          ${icon('sliders', 18)}<h2 id="h-display" data-i18n="displayTitle"></h2>${icon('chevron', 16)}
        </button>
        <div class="panel-body" id="body-display" hidden>
          <div class="ctl">
            <button class="switch" role="switch" id="ctl-scope" aria-checked="true">
              <span class="switch-label">${icon('scope', 18)}<span data-i18n="scopeTitle"></span></span>
              <span class="switch-knob" aria-hidden="true"></span>
            </button>
            <p class="hint" data-i18n="scopeHint"></p>
            <label class="range" for="ctl-feather">
              <span data-i18n="feather"></span>
              <output id="out-feather">100</output>
            </label>
            <input id="ctl-feather" type="range" min="0" max="100" step="1" value="100" />
          </div>
          <div class="ctl" id="ctl-3d-wrap" hidden>
            <button class="switch" role="switch" id="ctl-3d" aria-checked="false">
              <span class="switch-label">${icon('tilt', 18)}<span data-i18n="photorealTitle"></span></span>
              <span class="switch-knob" aria-hidden="true"></span>
            </button>
            <p class="hint" data-i18n="photorealHint"></p>
          </div>
          <fieldset class="seg-field">
            <legend data-i18n="mapSourceTitle"></legend>
            <div class="seg" id="seg-source" role="radiogroup">
              <button role="radio" data-source-val="esri" aria-checked="true" data-i18n="sourceEsri"></button>
              <button role="radio" data-source-val="osm" aria-checked="false" data-i18n="sourceOsm"></button>
            </div>
          </fieldset>
          <fieldset class="seg-field">
            <legend data-i18n="lookTitle"></legend>
            <div class="seg wrap" id="seg-look" role="radiogroup">
              <button role="radio" data-look-val="none" aria-checked="true" data-i18n="lookNone"></button>
              <button role="radio" data-look-val="surveillance" aria-checked="false" data-i18n="lookNvg"></button>
              <button role="radio" data-look-val="thermal" aria-checked="false" data-i18n="lookThermal"></button>
              <button role="radio" data-look-val="retro" aria-checked="false" data-i18n="lookCrt"></button>
              <button role="radio" data-look-val="noir" aria-checked="false" data-i18n="lookNoir"></button>
              <button role="radio" data-look-val="anime" aria-checked="false" data-i18n="lookAnime"></button>
              <button role="radio" data-look-val="snow" aria-checked="false" data-i18n="lookSnow"></button>
            </div>
          </fieldset>
          <div class="ctl look-params" id="look-params" hidden></div>
          <div class="ctl">
            <button class="switch" role="switch" id="ctl-hud" aria-checked="true">
              <span class="switch-label">${icon('scope', 18)}<span data-i18n="tacHudTitle"></span></span>
              <span class="switch-knob" aria-hidden="true"></span>
            </button>
          </div>
          <div class="ctl">
            <button class="switch" role="switch" id="ctl-detect" aria-checked="true">
              <span class="switch-label">${icon('parking', 18)}<span data-i18n="detectTitle"></span></span>
              <span class="switch-knob" aria-hidden="true"></span>
            </button>
            <p class="hint" data-i18n="detectHint"></p>
          </div>
          <fieldset class="seg-field">
            <legend data-i18n="theme"></legend>
            <div class="seg" id="seg-theme" role="radiogroup">
              <button role="radio" data-theme-val="dark" aria-checked="true">${icon('moon', 16)}<span data-i18n="themeDark"></span></button>
              <button role="radio" data-theme-val="light" aria-checked="false">${icon('sun', 16)}<span data-i18n="themeLight"></span></button>
              <button role="radio" data-theme-val="contrast" aria-checked="false">${icon('scope', 16)}<span data-i18n="themeContrast"></span></button>
            </div>
          </fieldset>
          <fieldset class="seg-field">
            <legend data-i18n="language"></legend>
            <div class="seg" id="seg-lang" role="radiogroup">
              <button role="radio" data-lang-val="en" aria-checked="true" lang="en">English</button>
              <button role="radio" data-lang-val="ar" aria-checked="false" lang="ar">العربية</button>
            </div>
          </fieldset>
          <fieldset class="seg-field" id="fs-numerals">
            <legend data-i18n="numerals"></legend>
            <div class="seg" id="seg-numerals" role="radiogroup">
              <button role="radio" data-num-val="latn" aria-checked="true" data-i18n="numWestern"></button>
              <button role="radio" data-num-val="arab" aria-checked="false" data-i18n="numEastern"></button>
            </div>
          </fieldset>
          <label class="field">
            <span data-i18n="role"></span>
            <select id="ctl-role">
              <option value="" data-i18n="roleNone"></option>
              <option value="investor" data-i18n="roleInvestor"></option>
              <option value="visitor" data-i18n="roleVisitor"></option>
              <option value="government" data-i18n="roleGovernment"></option>
            </select>
          </label>
          <button class="link-btn" id="btn-shortcuts">${icon('keyboard', 16)}<span data-i18n="shortcuts"></span></button>
        </div>
      </section>
    </aside>

    <aside class="rail rail-end" id="rail-end">
      <section class="hud" id="hud" aria-live="off">
        <div class="hud-row"><span class="hud-k" data-i18n="hudPlace"></span><span class="hud-v" id="hud-place"></span></div>
        <div class="hud-row"><span class="hud-k" data-i18n="hudTime"></span><span class="hud-v mono" id="hud-time" dir="ltr"></span></div>
        <div class="hud-row"><span class="hud-k" data-i18n="hudCoords"></span><span class="hud-v mono" id="hud-coords" dir="ltr"></span></div>
        <div class="hud-row"><span class="hud-k" data-i18n="hudScale"></span><span class="hud-v mono" id="hud-scale"></span></div>
      </section>
      <section class="panel info-card" id="card" hidden aria-live="polite"></section>
      <section class="panel" id="panel-text">
        <button class="panel-head" id="head-text" aria-expanded="false" aria-controls="body-text">
          ${icon('list', 18)}<h2 data-i18n="textListTitle"></h2>${icon('chevron', 16)}
        </button>
        <div class="panel-body" id="body-text" hidden><ul class="text-list" id="text-list"></ul></div>
      </section>
    </aside>
  </div>
</div>

<nav class="dock" id="dock">
  <button class="dock-btn" id="btn-location" aria-expanded="false" aria-controls="tray-location">${icon('pin', 20)}<span data-i18n="locTitle"></span></button>
  <button class="dock-btn" id="btn-locate">${icon('locate', 20)}<span data-i18n="locateBtn"></span></button>
  <button class="dock-btn dock-primary" id="btn-find">${icon('parking', 20)}<span data-i18n="findBtn"></span></button>
  <button class="dock-btn" id="btn-search" aria-expanded="false" aria-controls="search-pop">${icon('search', 20)}<span data-i18n="searchOpen"></span></button>
  <button class="dock-btn only-mobile" id="btn-sheet">${icon('layers', 20)}<span data-i18n="layersTitle"></span></button>
</nav>

<div class="tray" id="tray-location" hidden role="dialog" aria-labelledby="tray-title">
  <div class="tray-head"><h2 id="tray-title" data-i18n="locTitle"></h2><button class="icon-btn small" id="tray-close" data-i18n-aria="close">${icon('close', 18)}</button></div>
  <div class="tray-body" id="tray-body"></div>
</div>

<div class="search-pop" id="search-pop" hidden>
  <div class="search-field">
    ${icon('search', 18)}
    <input id="search-input" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search" data-i18n-placeholder="searchPlaceholder" data-i18n-aria="searchPlaceholder" role="combobox" aria-expanded="false" aria-controls="search-list" />
    <button class="icon-btn small" id="search-close" data-i18n-aria="close">${icon('close', 18)}</button>
  </div>
  <div class="search-status" id="search-status" role="status" aria-live="polite"></div>
  <ul class="search-list" id="search-list" role="listbox" data-i18n-aria="searchResults"></ul>
</div>

<button class="credits-btn" id="btn-credits"><span data-i18n="creditsBtn"></span><span class="credits-short">© Esri · OpenStreetMap · adsb.lol</span></button>

<dialog id="dlg-launcher" class="dlg" aria-labelledby="launch-title">
  <form method="dialog" class="dlg-body" id="launch-form">
    <h2 id="launch-title" data-i18n="launchTitle"></h2>
    <p class="hint" data-i18n="launchSub"></p>
    <div class="tiles">
      <button type="button" class="tile" data-role="investor">${icon('building', 24)}<strong data-i18n="roleInvestorTitle"></strong><span data-i18n="roleInvestorDesc"></span></button>
      <button type="button" class="tile" data-role="visitor">${icon('train', 24)}<strong data-i18n="roleVisitorTitle"></strong><span data-i18n="roleVisitorDesc"></span></button>
      <button type="button" class="tile" data-role="government">${icon('plane', 24)}<strong data-i18n="roleGovernmentTitle"></strong><span data-i18n="roleGovernmentDesc"></span></button>
    </div>
    <label class="check"><input type="checkbox" id="launch-never" /><span data-i18n="launchDontShow"></span></label>
    <div class="dlg-actions"><button type="button" class="btn ghost" id="launch-manual" data-i18n="launchManual"></button></div>
  </form>
</dialog>

<dialog id="dlg-credits" class="dlg" aria-labelledby="credits-title">
  <div class="dlg-body">
    <h2 id="credits-title" data-i18n="creditsTitle"></h2>
    <ul class="credits-list">
      <li data-i18n="creditsMap"></li>
      <li data-i18n="creditsFlights"></li>
      <li data-i18n="creditsSearch"></li>
      <li data-i18n="creditsSample"></li>
      <li data-i18n="creditsGev"></li>
    </ul>
    <p class="hint" data-i18n="creditsNotice"></p>
    <div class="dlg-actions"><button class="btn" id="credits-close" data-i18n="close"></button></div>
  </div>
</dialog>

<dialog id="dlg-shortcuts" class="dlg" aria-labelledby="sc-title">
  <div class="dlg-body">
    <h2 id="sc-title" data-i18n="scTitle"></h2>
    <dl class="sc-list">
      <dt><kbd>S</kbd></dt><dd data-i18n="scScope"></dd>
      <dt><kbd>1</kbd> – <kbd>7</kbd></dt><dd data-i18n="scLooks"></dd>
      <dt><kbd>H</kbd></dt><dd data-i18n="scHud"></dd>
      <dt><kbd>D</kbd></dt><dd data-i18n="scDetect"></dd>
      <dt><kbd>L</kbd></dt><dd data-i18n="scLayers"></dd>
      <dt><kbd>T</kbd></dt><dd data-i18n="scTilt"></dd>
      <dt><kbd>N</kbd></dt><dd data-i18n="scNorth"></dd>
      <dt><kbd>R</kbd></dt><dd data-i18n="scReset"></dd>
      <dt><kbd>/</kbd></dt><dd data-i18n="scSearch"></dd>
      <dt><kbd>?</kbd></dt><dd data-i18n="scHelp"></dd>
      <dt><kbd>Esc</kbd></dt><dd data-i18n="scEsc"></dd>
    </dl>
    <div class="dlg-actions"><button class="btn" id="sc-close" data-i18n="close"></button></div>
  </div>
</dialog>

<div class="toasts" id="toasts" role="status" aria-live="polite"></div>
<div class="sr-only" id="sr-summary" aria-live="polite"></div>
`;
}
