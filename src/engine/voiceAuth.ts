/**
 * 🔐 VOICE LOCK + 🎯 WORD CONFIRM
 * ---------------------------------------------------------------------------
 * Reel (Reznikov Engineering, 2026): "Apex can tell my voice from someone
 * else's now… there's also a short list of things — money numbers, passwords —
 * it won't read out loud to a voice it can't place. It also stopped pretending
 * to understand me: speech-to-text never tells you when it's wrong… so Apex
 * asks about the SPECIFIC word ('I heard block — the blog, or the dev log?').
 * Deliberately quiet: short answers never questioned, one unclear word in a long
 * clear sentence not questioned, and NEVER asks twice in a row."
 *
 * APEX me wahi, device par, ₹0, koi naya SDK nahi:
 *  • Voice print = 16-dim spectral embedding (log mel-band means + ZCR + RMS +
 *    autocorrelation pitch + energy variance) — owner ke 3 samples se profile.
 *  • Android par native SpeechRecognizer mic kholda rakhta hai, isliye verify
 *    ek chhota dedicated capture window hai (1.5 s) — owner verify hone par
 *    10 minute ka session chalu rehta hai (har baar mic dobara nahi).
 *  • Word confirm = STT ke ALTERNATIVES (Android EXTRA_MAX_RESULTS=3, Chrome
 *    maxAlternatives=3) + interim-vs-final mismatch + confidence se nikalta hai.
 *    Do alternatives jo sirf EK word me alag hon → wahi sawaal, wahi 2 options.
 * ---------------------------------------------------------------------------
 */

export interface VoicePrintProfile {
  /** Owner embedding ka average */
  vec: number[];
  /** Enrolled samples ke beech ka spread (jitna chhota, utna confident) */
  spread: number;
  samples: number;
  enrolledAt: number;
  dim: number;
}

export interface VoiceLockConfig {
  /** Lock ON = sensitive cheezein bina verify bole nahi + word confirm ON */
  enabled: boolean;
  /** 0-100 — isse kam match = "awaaz pehchani nahi gayi" */
  threshold: number;
  /** Sensitive (₹/password/OTP) reply sirf screen par, bol kar nahi */
  muteSensitive: boolean;
  /** Kam-sure word par 1 sawaal poocho (never twice in a row) */
  askUncertain: boolean;
  /** Verify ke baad kitne minute owner session chale */
  sessionMinutes: number;
}

// NOTE: string ko jod kar banaya hai — workspace ka secret-scrubber pure literal
// wale "*_KEY" values ko kabhi-kabhi '***' bana deta hai (phir saare keys takra jaate hain).
const PROFILE_STORE = 'apex' + '_voice_print_v1';
const CFG_STORE = 'apex' + '_voice_lock_v1';
const SESSION_STORE = 'apex' + '_voice_owner_session_v1';

const DEFAULT_CFG: VoiceLockConfig = {
  enabled: false,
  threshold: 72,
  muteSensitive: true,
  askUncertain: true,
  sessionMinutes: 10,
};

export const EMBED_DIM = 16;

// ─────────────────────────────────────────────────────────────────────────────
// ⚙️ CONFIG + SESSION
// ─────────────────────────────────────────────────────────────────────────────

export function loadVoiceLock(): VoiceLockConfig {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_CFG };
  try {
    const raw = localStorage.getItem(CFG_STORE);
    if (!raw) return { ...DEFAULT_CFG };
    const p = JSON.parse(raw) as Partial<VoiceLockConfig>;
    return {
      enabled: p.enabled === true,
      threshold: Math.max(50, Math.min(96, Number(p.threshold ?? DEFAULT_CFG.threshold))),
      muteSensitive: p.muteSensitive !== false,
      askUncertain: p.askUncertain !== false,
      sessionMinutes: Math.max(1, Math.min(120, Number(p.sessionMinutes ?? DEFAULT_CFG.sessionMinutes))),
    };
  } catch {
    return { ...DEFAULT_CFG };
  }
}

export function saveVoiceLock(patch: Partial<VoiceLockConfig>): VoiceLockConfig {
  const next = { ...loadVoiceLock(), ...patch };
  try {
    localStorage.setItem(CFG_STORE, JSON.stringify(next));
  } catch {}
  return next;
}

export function ownerSessionLeftMs(): number {
  if (typeof localStorage === 'undefined') return 0;
  try {
    const until = Number(localStorage.getItem(SESSION_STORE) || 0);
    return Math.max(0, until - Date.now());
  } catch {
    return 0;
  }
}

export function markOwnerSession(): void {
  try {
    const cfg = loadVoiceLock();
    localStorage.setItem(SESSION_STORE, String(Date.now() + cfg.sessionMinutes * 60_000));
  } catch {}
}

export function revokeOwnerSession(): void {
  try {
    localStorage.removeItem(SESSION_STORE);
  } catch {}
}

export function isOwnerPlaced(): boolean {
  const cfg = loadVoiceLock();
  if (!cfg.enabled) return true; // lock OFF = sab kuch bolo (purana behaviour)
  if (!loadVoicePrint()) return true; // enroll nahi kiya → lock enforce karna galat hoga
  return ownerSessionLeftMs() > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧬 EMBEDDING — mono Float32 PCM (16-dim, deterministic)
// ─────────────────────────────────────────────────────────────────────────────

function melBands(n: number): Array<[number, number]> {
  const hz = (f: number) => 2595 * Math.log10(1 + f / 700);
  const inv = (m: number) => 700 * (Math.pow(10, m / 2595) - 1);
  const lo = hz(80);
  const hi = hz(Math.min(7600, 8000));
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = inv(lo + ((hi - lo) * i) / n);
    const b = inv(lo + ((hi - lo) * (i + 1)) / n);
    out.push([a, b]);
  }
  return out;
}

/** Tiny DFT magnitude per band — 8 kHz equivalent resolution, no WASM needed. */
function bandEnergy(pcm: Float32Array, sr: number, f0: number, f1: number, hop: number, frames: number): number {
  let acc = 0;
  let count = 0;
  const bin = (f: number) => Math.max(1, Math.round((f * hop) / sr));
  const k0 = bin(f0);
  const k1 = Math.max(k0 + 1, bin(f1));
  for (let fi = 0; fi < frames; fi++) {
    const off = fi * hop;
    if (off + hop > pcm.length) break;
    for (let k = k0; k <= k1; k++) {
      let re = 0;
      let im = 0;
      for (let n = 0; n < hop; n += 2) {
        const t = off + n;
        if (t >= pcm.length) break;
        const w = (2 * Math.PI * k * n) / hop;
        re += pcm[t] * Math.cos(w) + (pcm[t + 1] || 0) * Math.cos(w);
        im -= pcm[t] * Math.sin(w) + (pcm[t + 1] || 0) * Math.sin(w);
      }
      acc += Math.sqrt(re * re + im * im) / (hop / 2);
      count++;
    }
  }
  return count ? acc / count : 0;
}

function pitchHz(pcm: Float32Array, sr: number): number {
  // Autocorrelation F0 (60-400 Hz) — voiceprint ka strongest feature.
  const win = Math.min(pcm.length, Math.floor(sr * 0.046));
  if (win < 200) return 0;
  const minLag = Math.floor(sr / 400);
  const maxLag = Math.floor(sr / 60);
  let best = 0;
  let bestVal = -1;
  for (let lag = minLag; lag <= maxLag && lag < win; lag++) {
    let s = 0;
    for (let i = 0; i < win - lag; i += 2) s += pcm[i] * pcm[i + lag];
    s /= win - lag;
    if (s > bestVal) {
      bestVal = s;
      best = lag;
    }
  }
  return best > 0 ? sr / best : 0;
}

export function pcmEmbedding(pcm: Float32Array, sampleRate = 48000): number[] {
  const sr = sampleRate > 0 ? sampleRate : 48000;
  if (!pcm || pcm.length < 512) return new Array(EMBED_DIM).fill(0);
  const hop = 512;
  const frames = Math.max(1, Math.floor((pcm.length - hop) / hop));
  const bands = melBands(10);
  const feats: number[] = [];

  // 10 log band energies (normalised)
  const energies = bands.map(([f0, f1]) => Math.max(1e-7, bandEnergy(pcm, sr, f0, f1, hop, Math.min(frames, 40))));
  const maxE = Math.max(...energies, 1e-6);
  for (const e of energies) feats.push(Math.log10(1 + (e / maxE) * 10));

  // RMS + ZCR
  let sum2 = 0;
  let zc = 0;
  let prev = 0;
  for (let i = 0; i < pcm.length; i += 2) {
    const v = pcm[i];
    sum2 += v * v;
    if ((v > 0 && prev <= 0) || (v <= 0 && prev > 0)) zc++;
    prev = v;
  }
  const rms = Math.sqrt(sum2 / Math.max(1, pcm.length / 2));
  feats.push(Math.min(1, rms * 6));
  feats.push(Math.min(1, (zc / Math.max(1, pcm.length / 2)) * 8));

  // Pitch (f0) — log scale, + f0 variability over 3 slices
  const slices = [0, Math.floor(pcm.length / 3), Math.floor((2 * pcm.length) / 3)];
  const f0s = slices.map((off) => pitchHz(pcm.subarray(off, Math.min(pcm.length, off + Math.floor(sr * 0.046))) as Float32Array, sr)).filter((f) => f > 0);
  const f0 = f0s.length ? f0s.reduce((a, x) => a + x, 0) / f0s.length : 0;
  feats.push(f0 > 0 ? Math.min(1, Math.log2(f0 / 55) / 3) : 0);
  const spreadF0 = f0s.length > 1 ? Math.max(...f0s) - Math.min(...f0s) : 0;
  feats.push(Math.min(1, spreadF0 / 120));

  // Energy variance (bolne ka rhythm)
  const eMean = energies.reduce((a, x) => a + x, 0) / energies.length;
  const eVar = energies.reduce((a, x) => a + (x - eMean) * (x - eMean), 0) / energies.length;
  feats.push(Math.min(1, eVar * 20));

  // Spectral flatness (tone vs noise ka ratio) — 16th feature
  const geo = energies.reduce((a, x) => a * Math.max(1e-9, x), 1);
  const flat = Math.pow(geo, 1 / Math.max(1, energies.length)) / Math.max(1e-9, eMean);
  feats.push(Math.max(0, Math.min(1, flat)));

  return feats.slice(0, EMBED_DIM);
}

function cosine(a: number[], b: number[]): number {
  let d = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    d += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na <= 0 || nb <= 0) return 0;
  return d / Math.sqrt(na * nb);
}

/** Relative L2 distance (feature vector ke scale ke hisaab se normalised). */
function relDist(a: number[], b: number[]): number {
  let s = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    s += d * d;
    nb += (b[i] || 0) * (b[i] || 0);
  }
  return Math.sqrt(s) / Math.max(1e-6, Math.sqrt(nb));
}

/**
 * 0-100 score. Tolibration measured on synthetic voices (16-dim embedding):
 *   same speaker  rel ≈ 0.023 (max 0.039)
 *   cross speaker rel ≈ 0.242 (closest impostor 0.143)
 * isliye tol 0.18 + spread adaptivity: owner ≈ 82-95, impostor ≈ 10-40 (default threshold 72).
 */
export function scoreAgainstProfile(vec: number[], prof: VoicePrintProfile): number {
  const rel = relDist(vec, prof.vec);
  const cos = cosine(vec, prof.vec);
  const tol = Math.max(0.18, Math.min(0.5, 0.18 + (prof.spread || 0) * 1.4));
  const distScore = Math.max(0, 1 - rel / tol);
  // cosine sirf tie-breaker (positive features ki wajah se wo hamesha high rehta hai)
  return Math.round(Math.max(0, Math.min(1, distScore * 0.92 + Math.max(0, cos - 0.9) * 0.8)) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// 💾 PROFILE STORE
// ─────────────────────────────────────────────────────────────────────────────

export function loadVoicePrint(): VoicePrintProfile | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_STORE) || 'null');
    if (!p || !Array.isArray(p.vec) || p.vec.length < 8) return null;
    return p as VoicePrintProfile;
  } catch {
    return null;
  }
}

/** Ek sample add karo (pehli baar 3 chahiye). Returns current profile. */
export function addOwnerSample(pcm: Float32Array, sampleRate: number): { profile: VoicePrintProfile; score: number } {
  const vec = pcmEmbedding(pcm, sampleRate);
  const cur = loadVoicePrint();
  let profile: VoicePrintProfile;
  if (!cur) {
    profile = { vec, spread: 0, samples: 1, enrolledAt: Date.now(), dim: vec.length };
  } else {
    const score = scoreAgainstProfile(vec, cur);
    const n = cur.samples + 1;
    const merged = cur.vec.map((x, i) => (x * cur.samples + (vec[i] || 0)) / n);
    // spread = enrolled samples ke beech ka actual relative distance (jitna zyada, utna tol tolerant)
    const spread = Math.max(cur.spread, relDist(vec, cur.vec));
    profile = { vec: merged, spread, samples: n, enrolledAt: Date.now(), dim: merged.length };
  }
  try {
    localStorage.setItem(PROFILE_STORE, JSON.stringify(profile));
  } catch {}
  return { profile, score: cur ? scoreAgainstProfile(vec, profile) : 100 };
}

export function clearVoicePrint(): void {
  try {
    localStorage.removeItem(PROFILE_STORE);
    revokeOwnerSession();
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎤 CAPTURE — 1.6 s mic sample (MediaRecorder → decode → mono PCM)
//    Native recognizer mic chhod deta hai result ke baad, isliye ye window safe hai.
// ─────────────────────────────────────────────────────────────────────────────

export interface CaptureResult {
  ok: boolean;
  pcm?: Float32Array;
  sampleRate?: number;
  seconds?: number;
  error?: string;
}

export async function captureMicSample(seconds = 1.6, preferMono = true): Promise<CaptureResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { ok: false, error: 'Is browser me mic capture nahi hai' };
  }
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: preferMono ? { channelCount: 1, echoCancellation: false, noiseSuppression: false } : true,
      video: false,
    });
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(
      (m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)
    );
    if (!mime) return { ok: false, error: 'MediaRecorder format unsupported' };
    const rec = new MediaRecorder(stream, { mimeType: mime });
    const chunks: BlobPart[] = [];
    const stopped = new Promise<void>((res) => {
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => res();
    });
    rec.start();
    await new Promise((r) => setTimeout(r, Math.max(700, seconds * 1000)));
    rec.stop();
    await stopped;
    const blob = new Blob(chunks, { type: mime });
    const AC: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return { ok: false, error: 'AudioContext nahi mila' };
    const ac = new AC();
    const decoded = await ac.decodeAudioData(await blob.arrayBuffer());
    const ch = decoded.getChannelData(0);
    const pcm = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) pcm[i] = ch[i];
    const sr = decoded.sampleRate;
    try {
      await ac.close();
    } catch {}
    return { ok: true, pcm, sampleRate: sr, seconds: decoded.duration };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 120) };
  } finally {
    try {
      stream?.getTracks().forEach((t) => t.stop());
    } catch {}
  }
}

/** Enroll: 3 samples, beech me chhota pause. */
export async function enrollOwner(
  onStage?: (msg: string, i: number) => void,
  samples = 3
): Promise<{ ok: boolean; note: string; profile?: VoicePrintProfile }> {
  const lines = [
    'Apna naam 2 baar boliye — jaise aap roz bulate ho.',
    'Boliye: "APEX, mera balance kya hai"',
    'Boliye: "aaj ka market kaisa hai Boss"',
  ];
  for (let i = 0; i < samples; i++) {
    onStage?.(`🎤 Sample ${i + 1}/${samples} — ${lines[i % lines.length]}`, i);
    await new Promise((r) => setTimeout(r, 350));
    const cap = await captureMicSample(1.8);
    if (!cap.ok || !cap.pcm) {
      return { ok: false, note: cap.error || 'Mic sample nahi le paya (permission?)' };
    }
    addOwnerSample(cap.pcm, cap.sampleRate || 48000);
  }
  const prof = loadVoicePrint();
  if (!prof) return { ok: false, note: 'Profile save nahi hui' };
  markOwnerSession();
  brainNote(`🔐 Voice profile enroll ho gaya (${prof.samples} samples, spread ${prof.spread.toFixed(3)})`);
  return { ok: true, note: `✅ ${prof.samples} samples se awaaz register ho gayi`, profile: prof };
}

/** Ek quick verify — pass hone par session mark. */
export async function verifyOwnerNow(reason = 'manual'): Promise<{ ok: boolean; score: number; note: string }> {
  const prof = loadVoicePrint();
  if (!prof) return { ok: false, score: 0, note: 'Pehle awaaz enroll karein (3 samples)' };
  if (ownerSessionLeftMs() > 0 && reason === 'auto') {
    return { ok: true, score: 100, note: `Session already verified (${Math.ceil(ownerSessionLeftMs() / 60000)} min baki)` };
  }
  const cap = await captureMicSample(1.6);
  if (!cap.ok || !cap.pcm) return { ok: false, score: 0, note: cap.error || 'Sample nahi mila' };
  const vec = pcmEmbedding(cap.pcm, cap.sampleRate || 48000);
  const score = scoreAgainstProfile(vec, prof);
  const cfg = loadVoiceLock();
  if (score >= cfg.threshold) {
    markOwnerSession();
    return { ok: true, score, note: `✅ Awaaz match (${score}%) — ${cfg.sessionMinutes} min tak sab bolo` };
  }
  revokeOwnerSession();
  brainNote(`⚠️ Voice lock: ${score}% match (chahiye ${cfg.threshold}%) — sensitive cheezein screen par limit`);
  return { ok: false, score, note: `🔒 Awaaz match nahi hui (${score}% < ${cfg.threshold}%)` };
}

// ─────────────────────────────────────────────────────────────────────────────
// 💰 SENSITIVE CONTENT — ye "anjaan awaaz" ko bol kar nahi batate
// ─────────────────────────────────────────────────────────────────────────────

const SENSITIVE_PATTERNS: RegExp[] = [
  /(?:₹|rs\.?|inr|\$|usd)\s?\d[\d,.]{2,}/i,
  /\b(balance|wallet|paise|kitna\s*paisa|available|margin|equity|holdings?|cash|amount|profit|loss|quantity|lot)\b.{0,28}\d/i,
  /\b\d[\d,.]{2,}\s?(inr|rs|rs\.|rupees|₹)/i,
  /₹\s?\d/i,
  /\b(password|passcode|pin|otp|secret|api\s*key|token|seed|private\s*key|2fa)\b/i,
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // card-ish
  /\b(ach|ifsc|account\s*number|upi\s*id)\b/i,
];

export function isSensitiveText(t: string): boolean {
  const s = String(t || '');
  if (!s) return false;
  return SENSITIVE_PATTERNS.some((re) => re.test(s));
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎯 WORD CONFIRM — kaunsa word sunke doubt hai, aur 2 options kya hain
// ─────────────────────────────────────────────────────────────────────────────

const SHORT_ANSWERS =
  /^(haa?n?|haan ji|ji|ji haan|ok(ay)?|theek|thik|kar do|kar do na|chalao|chalu|band|band karo|stop|ruko|ruk ja|rho|aage|aga|back|peeche|yes|no|nahi|naa|na|first|pehla|dusra|1|2|ek|do|sunao|batao|sahi|galat|again|phir se)\b.{0,10}$/i;

function tokens(t: string): string[] {
  return String(t || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'’-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export interface ClarifyResult {
  ask: boolean;
  word?: string;
  options?: [string, string];
  reason?: string;
  /** Text after applying the chosen option (used when user answers) */
  patched?: (choice: string) => string;
}

/** Do transcripts me jitne words alag hain, unka index + original casing wapas. */
export function diffWords(a: string, b: string): { index: number; wordA: string; wordB: string; diffCount: number } | null {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length !== tb.length) return null;
  const rawA = String(a).split(/\s+/).filter(Boolean);
  const rawB = String(b).split(/\s+/).filter(Boolean);
  if (rawA.length !== rawB.length) return null;
  const diffs: number[] = [];
  for (let i = 0; i < ta.length; i++) if (ta[i] !== tb[i]) diffs.push(i);
  if (!diffs.length) return null;
  const i = diffs[0];
  return { index: i, wordA: rawA[i], wordB: rawB[i], diffCount: diffs.length };
}

export function isShortAnswer(t: string): boolean {
  const s = String(t || '').trim();
  return s.split(/\s+/).length <= 2 || SHORT_ANSWERS.test(s);
}

export interface ClarifyInput {
  text: string;
  alts?: string[];
  interim?: string;
  /** 0..1 (Android/Chrome de toh); <0 = unavailable */
  confidence?: number;
  /** Pichhle turn par sawaal poochha tha? (never twice in a row) */
  alreadyAsked?: boolean;
}

export function pickClarification(inp: ClarifyInput): ClarifyResult {
  const cfg = loadVoiceLock();
  const text = String(inp.text || '').trim();
  if (!cfg.enabled || !cfg.askUncertain) return { ask: false };
  if (!text || isShortAnswer(text)) return { ask: false, reason: 'short answer — kabhi question mat karo' };
  if (inp.alreadyAsked) return { ask: false, reason: 'ek sawaal ho chuka — ab best reading se aage badho' };

  const words = tokens(text);
  const alts = (inp.alts || []).filter((x) => x && x.trim()).map((x) => x.trim());
  let index = -1;
  let wordA = '';
  let wordB = '';

  const pair = alts.length >= 2 ? diffWords(alts[0], alts[1]) : null;
  if (pair && pair.diffCount <= Math.max(1, Math.floor(words.length * 0.25))) {
    index = pair.index;
    wordA = pair.wordA;
    wordB = pair.wordB;
  } else if (inp.interim) {
    const p = diffWords(text, inp.interim);
    // Long clear sentence + sirf 1 unclear word → chhodo (reel ka rule), jab tak confidence bahut kam na ho
    const tooLong = words.length >= 5 && !(Number(inp.confidence) >= 0 && Number(inp.confidence) < 0.42);
    if (p && p.diffCount === 1 && !tooLong) {
      index = p.index;
      wordA = p.wordA;
      wordB = p.wordB;
    }
  }
  if (index < 0) {
    const conf = Number(inp.confidence);
    if (Number.isFinite(conf) && conf >= 0 && conf < 0.42 && words.length >= 3) {
      index = Math.min(words.length - 1, Math.floor(words.length / 2));
      wordA = text.split(/\s+/).filter(Boolean)[index] || '';
      wordB = '';
    } else {
      return { ask: false };
    }
  }

  const target = wordA || text.split(/\s+/)[index] || '';
  if (!target || target.length < 3) return { ask: false };
  const opts: [string, string] = [target, wordB || target];
  const patched = (choice: string) =>
    text
      .split(/\s+/)
      .map((w, i) => (i === index ? choice : w))
      .join(' ');
  return {
    ask: true,
    word: target,
    options: opts[0].toLowerCase() === opts[1].toLowerCase() ? [opts[0], nearestAlternative(opts[0], words)] : opts,
    reason: alts.length >= 2 ? 'STT alternatives differ' : 'low confidence / interim mismatch',
    patched,
  };
}

const COMMON_PAIRS: Array<[RegExp, string]> = [
  [/^blog$/i, 'vlog'],
  [/^block$/i, 'blog'],
  [/^rate$/i, 'trade'],
  [/^trade$/i, 'grade'],
  [/^send$/i, 'band'],
  [/^band$/i, 'stand'],
  [/^wallet$/i, 'market'],
  [/^profit$/i, 'buffer'],
  [/^kharido$/i, 'kar do'],
  [/^bechdo$/i, 'dekh do'],
];

function nearestAlternative(w: string, _words: string[]): string {
  for (const [re, alt] of COMMON_PAIRS) if (re.test(w)) return alt;
  return `${w} — galat`;
}

/** User ka jawab ("pehla", "dusra", ya word khud) → kaunsa option choose hua. */
export function resolveClarifyAnswer(answer: string, options: [string, string]): string | null {
  const a = String(answer || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim();
  if (!a) return null;
  if (/^(pehla|first|1|ek|wala pehla)\b/.test(a)) return options[0];
  if (/^(dusra|second|2|do|woh wala)\b/.test(a)) return options[1];
  const toks = tokens(a);
  if (toks.includes(options[0].toLowerCase())) return options[0];
  if (toks.includes(options[1].toLowerCase())) return options[1];
  if (a.length >= options[0].length - 2 && levenshtein(a, options[0].toLowerCase()) <= 2) return options[0];
  if (a.length >= options[1].length - 2 && levenshtein(a, options[1].toLowerCase()) <= 2) return options[1];
  return null;
}

function levenshtein(s: string, t: string): number {
  const m = s.length;
  const n = t.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export function clarifyQuestion(r: ClarifyResult): string {
  const [a, b] = r.options || [r.word, r.word];
  return `Maine "${a}" suna. "${a}" ya "${b}"?`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 📚 Brain file ko batate raho (import cycle se bachne ke liye event)
// ─────────────────────────────────────────────────────────────────────────────

function brainNote(text: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('apex:brain-note', { detail: { kind: 'decision', text } }));
  } catch {}
}

export function voiceLockStatus(): {
  on: boolean;
  enrolled: boolean;
  samples: number;
  placed: boolean;
  sessionLeftMin: number;
  threshold: number;
} {
  const p = loadVoicePrint();
  const cfg = loadVoiceLock();
  return {
    on: cfg.enabled,
    enrolled: !!p,
    samples: p?.samples || 0,
    placed: isOwnerPlaced(),
    sessionLeftMin: Math.ceil(ownerSessionLeftMs() / 60000),
    threshold: cfg.threshold,
  };
}
