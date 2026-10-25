// ═══════════════════════════════════════════════════════════════════════════
// 📦 BUNDLED VIDEOS (v6.6.11) — APK ke ANDAR jo 8 full-HD clips daale hain
// (assets/www/motion_videos/clip_0..7.webm, 0% compress) ab app ke andar hi
// milti hain. Pehle ye sirf 41-Agent modal ke 'openvideo' stage par thi, isliye
// 📁 ALL VIDEOS (0) dikhata tha — user ko lagta tha video app me hain hi nahi.
// ═══════════════════════════════════════════════════════════════════════════

export interface BundledClip {
  id: string;
  title: string;
  /** relative-to-index URL (Vite base + file:// dono par chalta hai) */
  url: string;
  /** HEAD se mila size (bytes); 0 = abhi nahi pata */
  sizeBytes: number;
  source: 'app';
}

const TITLES = [
  'Reel Clip 1 · Cinema HD',
  'Reel Clip 2 · Neon Drive',
  'Reel Clip 3 · Robot Walk',
  'Reel Clip 4 · Skyline Pan',
  'Reel Clip 5 · Particle Storm',
  'Reel Clip 6 · Steel Macro',
  'Reel Clip 7 · Long Cinematic A',
  'Reel Clip 8 · Long Cinematic B',
];

export const CLIP_COUNT = TITLES.length;

/** Bina network HEAD ke list (turant chalti hai — UI counter ke liye). */
export function bundledClipList(): BundledClip[] {
  return TITLES.map((title, i) => ({
    id: `app-clip-${i}`,
    title,
    url: `./motion_videos/clip_${i}.webm`,
    sizeBytes: 0,
    source: 'app' as const,
  }));
}

/** HEAD check karke jo files sach me maujood hain unka size bhi bhar do.
 *  Timeout + fail-safe: net/workbench me files na milen to [] (UI crash na kare). */
export async function probeBundledClips(timeoutMs = 2600): Promise<BundledClip[]> {
  const base = bundledClipList();
  const one = async (c: BundledClip): Promise<BundledClip | null> => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const r = await fetch(c.url, { method: 'HEAD', signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(t);
      if (!r.ok) return null;
      const len = Number(r.headers.get('content-length') || 0);
      return { ...c, sizeBytes: Number.isFinite(len) ? len : 0 };
    } catch {
      return null;
    }
  };
  const out = await Promise.all(base.map(one));
  return out.filter((x): x is BundledClip => Boolean(x));
}
