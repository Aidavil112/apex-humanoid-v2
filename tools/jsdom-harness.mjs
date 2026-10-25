// ═══════════════════════════════════════════════════════════════════════════
// 🧪 APEX jsdom harness — poora App real DOM me mount karke buttons click karne
//    ke liye. Uddeshya: "tsc pass" se zyada — sabit karo ki button dabane par
//    kuch hota hai aur koi exception nahi aata.
//    Use:  import { mount, clickStep, errors } from './jsdom-harness.mjs'
//    ya   bash tools/ui-test.sh
// ═══════════════════════════════════════════════════════════════════════════
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..');
export const BUNDLE = path.join(HERE, '.bundle.mjs');

function requireJsdom() {
  try {
    return import('jsdom');
  } catch {
    try {
      const req = createRequire(path.join(REPO, 'package.json'));
      return import('file://' + req.resolve('jsdom'));
    } catch {
      throw new Error('jsdom nahi mila → `npm i -D jsdom` chala lo (tools/ui-test.sh khud kar deta hai)');
    }
  }
}

/** esbuild se App ka test-bundle bana do (cache: agar naya ho to rebuild). */
export function buildBundle(force = false) {
  const entry = path.join(REPO, '.harness-entry.tsx');
  const src = `import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './src/App';
export function mount(el){ ReactDOM.createRoot(el).render(React.createElement(App)); }
`;
  if (!force && existsSync(BUNDLE) && existsSync(path.join(REPO, 'src/App.tsx'))) {
    try {
      if (existsSync(entry) && readFileSync(entry, 'utf8') === src) return;
    } catch {}
  }
  writeFileSync(entry, src);
  try {
    execSync(
      `./node_modules/.bin/esbuild .harness-entry.tsx --bundle --format=esm --platform=browser --outfile=tools/.bundle.mjs --loader:.css=empty --define:process.env.NODE_ENV='"development"' --define:import.meta.env='{"DEV":true,"PROD":false,"MODE":"test"}' --jsx=automatic --log-level=error`,
      { cwd: REPO, stdio: 'pipe' },
    );
  } catch (e) {
    throw new Error('esbuild fail: ' + String(e.stdout || e.message).slice(0, 500));
  } finally {
    try { unlinkSync(entry); } catch {}
  }
}

/** jsdom duniya + Android WebView ke missing APIs ke stubs, phir App mount. */
export async function mountApp() {
  const { JSDOM } = await requireJsdom();
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://app.apexhumanoid.local/',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const g = globalThis;
  const copy = ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLAnchorElement','Element','Node','Event','CustomEvent','MouseEvent','KeyboardEvent','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','localStorage','sessionStorage','Image','Audio','Blob','File','FileReader','FormData','DOMParser','XMLHttpRequest','HTMLCanvasElement','SVGSVGElement','NodeFilter','Range','history','location','self','DeviceOrientationEvent','DeviceMotionEvent','screen'];
  for (const k of copy) if (k in window) { try { g[k] = window[k]; } catch { /* node getter-only global */ } }
  g.window = window; g.document = window.document; g.self = window;
  try { g.URL = window.URL; g.Blob = window.Blob; g.File = window.File; } catch {}

  // ── stubs (jsdom me nahi hote, device me hain) ──
  window.Element.prototype.scrollIntoView = function () {};
  window.HTMLElement.prototype.scrollTo = function () {};
  window.Element.prototype.scrollTo = function () {};
  window.HTMLElement.prototype.scrollBy = function () {};
  window.Element.prototype.animate = function () { return { finished: Promise.resolve(), cancel(){}, play(){}, pause(){} }; };
  window.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  window.HTMLMediaElement.prototype.pause = function () {};
  window.HTMLMediaElement.prototype.load = function () {};
  window.matchMedia = (q) => ({ matches: false, media: q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){}, onchange: null });
  g.matchMedia = window.matchMedia;
  class Obs { observe(){} unobserve(){} disconnect(){} takeRecords(){ return []; } }
  window.ResizeObserver = Obs; window.IntersectionObserver = Obs;
  g.MutationObserver = window.MutationObserver || Obs;
  const ctx2d = () => ({
    canvas: { width: 1280, height: 720 },
    fillRect(){}, clearRect(){}, drawImage(){}, save(){}, restore(){}, beginPath(){}, closePath(){}, moveTo(){}, lineTo(){}, arc(){}, fill(){}, stroke(){},
    translate(){}, scale(){}, rotate(){}, setTransform(){}, transform(){}, fillText(){}, strokeText(){}, measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop(){} }), createRadialGradient: () => ({ addColorStop(){} }), createPattern: () => null,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)) }),
    putImageData(){}, createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)) }),
    clip(){}, rect(){}, quadraticCurveTo(){}, bezierCurveTo(){}, ellipse(){}, setLineDash(){},
    globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '', shadowBlur: 0, shadowColor: '', lineCap: '', lineJoin: '',
  });
  window.HTMLCanvasElement.prototype.getContext = function (t) { return String(t).startsWith('2d') ? ctx2d() : null; };
  window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
  window.speechSynthesis = { speak(){}, cancel(){}, getVoices: () => [], paused: false, resume(){} };
  window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; window.MediaRecorder = undefined;
  Object.defineProperty(window.navigator, 'mediaDevices', { value: { getUserMedia: () => Promise.reject(new Error('test: no device')), enumerateDevices: () => Promise.resolve([]) }, configurable: true });
  // WebView jaisa harsh case: clipboard/share undefined — hamare helpers ko phir bhi chalna chahiye
  try { Object.defineProperty(window.navigator, 'clipboard', { value: undefined, configurable: true }); } catch {}
  try { Object.defineProperty(window.navigator, 'share', { value: undefined, configurable: true }); } catch {}
  window.HTMLTextAreaElement.prototype.select = function () {};
  document.execCommand = () => true;
  window.navigator.vibrate = () => true; window.scrollTo = () => {}; window.print = () => {};

  const errors = [];
  const warns = [];
  console.error = (...a) => { errors.push(a.map((x) => (x && x.stack) || String(x)).join(' ').replace(/\s+/g, ' ').slice(0, 200)); };
  console.warn = (...a) => { warns.push(a.map((x) => String(x)).join(' ').replace(/\s+/g, ' ').slice(0, 140)); };
  process.on('unhandledRejection', (e) => errors.push('REJECT: ' + String((e && e.stack) || e).replace(/\s+/g, ' ').slice(0, 180)));

  const { mount } = await import(BUNDLE);
  mount(document.getElementById('root'));
  await sleep(180);
  return { window, document, errors, warns };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
export const els = () => Array.from(document.querySelectorAll('button, a[href], [role="button"]'));
export const byText = (t) => els().find((e) => norm(e.textContent).includes(t)) || null;
export const bodyText = () => norm(document.body.textContent);
export function click(el) {
  if (!el) return { ok: false, why: 'element nahi mila' };
  try {
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return { ok: true };
  } catch (e) {
    return { ok: false, why: String((e && e.stack) || e).split('\n')[0] };
  }
}
/** click → thoda ruko → DOM badla? error aaya? (test ka core assertion) */
export async function clickStep(label, mustContain) {
  const el = typeof label === 'string' ? byText(label) : label;
  if (!el) return { found: false, passed: false, why: `"${label}" button DOM me nahi mila` };
  const before = document.body.innerHTML.length;
  const errBefore = (globalThis.__apexErrors || []).length;
  const r = click(el);
  await sleep(140);
  const changed = Math.abs(document.body.innerHTML.length - before) > 0;
  const shown = mustContain ? (Array.isArray(mustContain) ? mustContain : [mustContain]).every((x) => bodyText().includes(x)) : true;
  return {
    found: true,
    threw: !r.ok,
    why: r.ok ? '' : r.why,
    changed,
    shown,
    newErr: (globalThis.__apexErrors || []).length > errBefore,
    label: norm(el.textContent).slice(0, 46),
    passed: r.ok && (shown || changed),
  };
}
export function trackErrors(errors) { globalThis.__apexErrors = errors; }
