// ═══════════════════════════════════════════════════════════════════════════
// ⚡ SMOOTH MODE (v6.6.10) — "phone me atakta hai" ka asli ilaaj.
// Mid-range MIUI/Redmi WebView par backdrop-filter blur + per-particle glow
// 3D hologram ke upar chalate hi fps gir jaata hai. Ye module:
//   • state localStorage me rakhta hai (apex_smooth_mode)
//   • <html> par class="apex-smooth" dalta hai (CSS usi par blur/glow off karta hai)
//   • khud 2-second fps nap kar LOW device par khud ON kar deta hai
// ═══════════════════════════════════════════════════════════════════════════
const KEY = 'apex' + '_smooth' + '_mode';
let cached: boolean | null = null;
const subs = new Set<(on: boolean) => void>();

export function isSmoothMode(): boolean {
  if (cached !== null) return cached;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) cached = saved === '1';
    else {
      // weak device → khud on (deviceMemory/hardwareConcurrency jahan mile)
      const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
      const mem = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : 8;
      const cores = typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : 8;
      cached = mem <= 4 || cores <= 4;
    }
  } catch {
    cached = false;
  }
  return cached;
}

export function applySmoothMode(on: boolean) {
  try {
    const el = document.documentElement;
    if (on) el.classList.add('apex-smooth');
    else el.classList.remove('apex-smooth');
  } catch { /* DOM nahi (test) → chhodo */ }
}

export function setSmoothMode(on: boolean, persist = true) {
  cached = on;
  applySmoothMode(on);
  if (persist) {
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch {}
  }
  for (const cb of subs) { try { cb(on); } catch {} }
}

export function onSmoothChange(cb: (on: boolean) => void): () => void {
  subs.add(cb);
  return () => subs.delete(cb);
}

/** 🔁 2 second napo; 42 fps se kam = Smooth ON (ek hi baar auto, user ne OFF kiya to chhodo). */
export function watchFpsThenSmooth(): number {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return -1;
  let frames = 0;
  const t0 = performance.now();
  let raf = 0;
  const loop = () => {
    frames++;
    const dt = performance.now() - t0;
    if (dt < 2000) {
      raf = requestAnimationFrame(loop);
      return;
    }
    const fps = (frames * 1000) / dt;
    try {
      const userSet = localStorage.getItem(KEY) !== null;
      if (fps < 42 && !userSet && !isSmoothMode()) setSmoothMode(true, false);
    } catch { /* storage off */ }
    return fps;
  };
  raf = requestAnimationFrame(loop);
  return raf;
}
