/**
 * 📚 BRAIN FILE — "APEX jo kabhi nahi bhoolta"
 * ---------------------------------------------------------------------------
 * Reel ka lesson (Nexa Byte, 2026): coding agent har nayi chat me sab bhool
 * jaata tha (kal ka auth aaj dobara banana) — fix tha project root me ek
 * CLAUDE.md jo model HAR session ke start par khud padhta hai aur har feature
 * ke baad update hota hai.
 *
 * APEX me bilkul wahi pattern, bas automatic:
 *  1) Har AI reply (chat / voice / Gemini Live) ke saath ye brain model ko diya jaata hai.
 *  2) Jarvis ke har autonomous kaam (slot, research, video, publish, trade, guard skip)
 *     ke baad YE FILE APNE-AAP update hoti hai — user ko kuch likhna nahi.
 *  3) GitHub par CLAUDE.md + AGENTS.md + APEX-BRAIN.md likh deta hai → koi bhi coding
 *     agent (Claude Code / Codex / Gemini CLI) repo kholte hi project samajh jaata hai.
 *  4) Worker KV (POST /jarvis/brain) par copy → phone badla ya app data clear hua, brain saath.
 *
 * Import graph: sirf ./assetHost + ./api → isliye jarvisCore / autopilot yahan se
 * import kar sakte hain, cycle nahi banega.
 */

import { uploadBlobToGithub } from './assetHost';
import { hubFetch } from './api';

export type BrainKind = 'rule' | 'project' | 'decision' | 'done' | 'open' | 'learned';

export interface BrainEntry {
  id: string;
  kind: BrainKind;
  text: string;
  at: number;
}

export interface BrainFile {
  v: 1;
  /** Jarvis apne-aap kaam ki memory likhe? (off = sirf user ke notes) */
  autoWrite: boolean;
  /** Save ke baad chup-chaap GitHub + Worker par bhi push karo? */
  autoSync: boolean;
  entries: BrainEntry[];
  updatedAt: number;
}

const BRAIN_KEY = 'apex_brain_file_v1';
const LEGACY_MEM_KEY = 'jarvis_memories';
/** headBotAutopilot ka settings key — wahan se GitHub repo/PAT uthate hain (import nahi, cycle se bachne ke liye) */
const AUTOPILOT_SETTINGS_KEY = 'apex_headbot_autopilot_settings_v1';
/** Worker par brain lock set kiya ho (APEX_BRAIN_KEY) toh ye header bheja jaata hai */
const BRAIN_LOCK_KEY = 'apex_brain_server_key';

function brainLockHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = { ...extra };
  try {
    const k = String(localStorage.getItem(BRAIN_LOCK_KEY) || '').trim();
    if (k) out['x-apex-brain'] = k;
  } catch {}
  return out;
}

export function readBrainLock(): string {
  try {
    return String(localStorage.getItem(BRAIN_LOCK_KEY) || '');
  } catch {
    return '';
  }
}

export function writeBrainLock(v: string): void {
  try {
    const t = v.trim();
    if (t) localStorage.setItem(BRAIN_LOCK_KEY, t);
    else localStorage.removeItem(BRAIN_LOCK_KEY);
  } catch {}
}

const KIND_META: Record<BrainKind, { heading: string; icon: string; cap: number }> = {
  rule: { heading: 'RULES (user preferences — never break)', icon: '⚖️', cap: 24 },
  project: { heading: 'PROJECT (kya hai + stack)', icon: '🏗️', cap: 16 },
  decision: { heading: 'DECISIONS (jo pakka ho chuka hai)', icon: '🧠', cap: 24 },
  done: { heading: 'DONE LOG (agent ne khud kya kiya)', icon: '✅', cap: 40 },
  open: { heading: 'OPEN / PENDING (abhi kya karna hai)', icon: '⏳', cap: 24 },
  learned: { heading: 'NOTES (user ne bulwaya)', icon: '📌', cap: 30 },
};

const KIND_ORDER: BrainKind[] = ['rule', 'project', 'decision', 'done', 'open', 'learned'];
const HEAD_TO_KIND: Record<string, BrainKind> = {
  rules: 'rule',
  project: 'project',
  decisions: 'decision',
  'done log': 'done',
  open: 'open',
  notes: 'learned',
};

const MAX_TEXT = 260;

function nowId(): string {
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function trimText(t: string): string {
  const one = String(t || '')
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u0008]/g, '')
    .trim();
  return one.length > MAX_TEXT ? `${one.slice(0, MAX_TEXT - 1)}…` : one;
}

function norm(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]+/g, ' ').trim();
}

const EMPTY: BrainFile = { v: 1, autoWrite: true, autoSync: false, entries: [], updatedAt: 0 };

function isBrainFile(x: any): x is BrainFile {
  return !!x && Array.isArray(x.entries);
}

export function loadBrain(): BrainFile {
  if (typeof localStorage === 'undefined') return structuredCloneSafe(EMPTY);
  try {
    const raw = localStorage.getItem(BRAIN_KEY);
    if (!raw) return structuredCloneSafe(EMPTY);
    const parsed = JSON.parse(raw) as any;
    if (!isBrainFile(parsed)) return structuredCloneSafe(EMPTY);
    const out: BrainFile = {
      v: 1,
      autoWrite: parsed.autoWrite !== false,
      autoSync: parsed.autoSync === true,
      updatedAt: Number(parsed.updatedAt || 0),
      entries: (parsed.entries || [])
        .filter((e: any) => e && typeof e.text === 'string' && KIND_META[e.kind as BrainKind])
        .map((e: any) => ({
          id: String(e.id || nowId()),
          kind: e.kind as BrainKind,
          text: trimText(e.text),
          at: Number(e.at || Date.now()),
        })),
    };
    return out;
  } catch {
    return structuredCloneSafe(EMPTY);
  }
}

function writeBrain(next: BrainFile): BrainFile {
  for (const kind of KIND_ORDER) {
    const list = next.entries.filter((e) => e.kind === kind).sort((a, b) => b.at - a.at);
    if (list.length > KIND_META[kind].cap) {
      const keep = new Set(list.slice(0, KIND_META[kind].cap).map((e) => e.id));
      next.entries = next.entries.filter((e) => e.kind !== kind || keep.has(e.id));
    }
  }
  next.updatedAt = Date.now();
  try {
    localStorage.setItem(BRAIN_KEY, JSON.stringify(next));
  } catch {
    // storage full → purana DONE LOG phenk do, brain zinda rahe
    try {
      next.entries = next.entries.filter((e) => e.kind !== 'done').slice(-40);
      localStorage.setItem(BRAIN_KEY, JSON.stringify(next));
    } catch {
      /* chhodo */
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('apex:brain-update', { detail: { entries: next.entries.length } }));
  }
  return next;
}

export function saveBrain(patch: Partial<BrainFile>): BrainFile {
  const cur = loadBrain();
  return writeBrain({ ...cur, ...patch });
}

/** User ne khud bulwaya — hamesha likha jaata hai (autoWrite off ho tab bhi). */
export function remember(kind: BrainKind, text: string): BrainEntry | null {
  return addEntry(kind, text, false);
}

/** Agent ka apna kaam — sirf tab jab autoWrite ON ho. */
export function autoRemember(kind: BrainKind, text: string): BrainEntry | null {
  return addEntry(kind, text, true);
}

function addEntry(kind: BrainKind, rawText: string, onlyIfAuto: boolean): BrainEntry | null {
  const text = trimText(rawText);
  if (!text) return null;
  const brain = loadBrain();
  if (onlyIfAuto && !brain.autoWrite) return null;
  const key = `${kind}|${norm(text)}`;
  if (brain.entries.some((e) => `${e.kind}|${norm(e.text)}` === key)) return null;
  const entry: BrainEntry = { id: nowId(), kind, text, at: Date.now() };
  brain.entries = [entry, ...brain.entries];
  writeBrain(brain);
  if (brain.autoSync) void syncBrainOut({ quiet: true });
  return entry;
}

export function forgetBrain(id: string): BrainFile {
  const brain = loadBrain();
  brain.entries = brain.entries.filter((e) => e.id !== id);
  return writeBrain(brain);
}

export function clearBrainSection(kind?: BrainKind): BrainFile {
  const brain = loadBrain();
  brain.entries = kind ? brain.entries.filter((e) => e.kind !== kind) : [];
  return writeBrain(brain);
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧪 PROMPT BLOCK — ye har AI call ke saath jaata hai
// ─────────────────────────────────────────────────────────────────────────────

export function brainDigest(maxChars = 1700): string {
  const brain = loadBrain();
  if (!brain.entries.length) return '';
  const parts: string[] = [];
  for (const kind of KIND_ORDER) {
    const list = brain.entries
      .filter((e) => e.kind === kind)
      .sort((a, b) => b.at - a.at)
      .slice(0, kind === 'done' ? 8 : 12);
    if (!list.length) continue;
    const lines = list.map((e) => `- ${e.text}`);
    parts.push(`${KIND_META[kind].icon} ${KIND_META[kind].heading}\n${lines.join('\n')}`);
  }
  let out = parts.join('\n');
  if (out.length > maxChars) out = `${out.slice(0, maxChars - 1)}…`;
  return out;
}

/** Full instruction text (empty string = kuch yaad nahi, prompt ko kuch add nahi karna). */
export function buildBrainPrompt(maxChars = 1700): string {
  const digest = brainDigest(maxChars);
  if (!digest) return '';
  return (
    `APEX BRAIN FILE (persistent memory — ye purana kaam aur rules hain, inhe DOHRA mat poochho, ` +
    `RULES ka palan sabse pehle karo, aur jo OPEN/PENDING me hai use hi priority do):\n${digest}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 📄 MARKDOWN (GitHub par jaane wala format — CLAUDE.md / AGENTS.md)
// ─────────────────────────────────────────────────────────────────────────────

export function exportBrainMarkdown(): string {
  const brain = loadBrain();
  const stamp = brain.updatedAt ? new Date(brain.updatedAt).toLocaleString('en-IN') : 'abhi';
  const head =
    `# APEX BRAIN FILE\n\n` +
    `_Auto-updated by APEX Jarvis (v6.6.1+). Last write: ${stamp}._\n\n` +
    `**AI agents ke liye Nirdesh:** ye file project ka persistent memory hai. Session ke start par\n` +
    `ise PADHO, RULES follow karo, DECISIONS dobara mat poochho, aur kaam khatam hote hi\n` +
    `DONE LOG me ek line aur (agar naya kaam hai) PROJECT/DECISIONS sections update karo.\n`;
  const sections = KIND_ORDER.map((kind) => {
    const list = brain.entries
      .filter((e) => e.kind === kind)
      .sort((a, b) => b.at - a.at)
      .map((e) => `- [${new Date(e.at).toLocaleDateString('en-IN')}] ${e.text}`);
    return `## ${KIND_META[kind].heading}\n\n${list.length ? list.join('\n') : '- (khaali)'}\n`;
  });
  return `${head}\n${sections.join('\n')}`;
}

export function importBrainMarkdown(md: string): { added: number; total: number } {
  let added = 0;
  let kind: BrainKind = 'learned';
  for (const rawLine of String(md || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^#{1,6}\s/.test(line)) {
      const h = line
        .replace(/^#+\s*/, '')
        .toLowerCase()
        .replace(/[^\w ]/g, '')
        .trim();
      for (const token of Object.keys(HEAD_TO_KIND)) {
        if (h.startsWith(token)) {
          kind = HEAD_TO_KIND[token];
          break;
        }
      }
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (!bullet) continue;
    const text = bullet[1].replace(/^\[[^\]]{4,20}\]\s*/, '').trim();
    if (!text || /^[(]khaali[)]$/i.test(text)) continue;
    if (remember(kind, text)) added += 1;
  }
  return { added, total: loadBrain().entries.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// 📤 SYNC — GitHub (CLAUDE.md + AGENTS.md + APEX-BRAIN.md) aur Worker KV copy
// ─────────────────────────────────────────────────────────────────────────────

interface GhSettings {
  ghToken?: string;
  ghOwner?: string;
  ghRepo?: string;
  ghBranch?: string;
}

function readGhSettings(): GhSettings {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(AUTOPILOT_SETTINGS_KEY) || '{}') as GhSettings;
  } catch {
    return {};
  }
}

export interface BrainSyncResult {
  ok: boolean;
  note: string;
  urls: string[];
}

/** Ek hi markdown ko 3 naam par likhta hai taaki Claude Code, Codex aur APEX teeno padh lein. */
export async function syncBrainToGithub(mdOverride?: string): Promise<BrainSyncResult> {
  const cfg = readGhSettings();
  if (!cfg.ghToken || !cfg.ghOwner || !cfg.ghRepo) {
    return { ok: false, note: 'GitHub token/repo setting missing (IG card wala hi use hoga)', urls: [] };
  }
  const md = (mdOverride || exportBrainMarkdown()).trim();
  if (!md) return { ok: false, note: 'Brain file khaali hai', urls: [] };
  const blob = new Blob([`${md}\n`], { type: 'text/markdown' });
  const targets = ['CLAUDE.md', 'AGENTS.md', 'APEX-BRAIN.md'];
  const urls: string[] = [];
  let lastErr = '';
  for (const fileName of targets) {
    const res = await uploadBlobToGithub({
      token: cfg.ghToken,
      owner: cfg.ghOwner,
      repo: cfg.ghRepo,
      branch: cfg.ghBranch || 'main',
      folder: '',
      fileName,
      blob,
    });
    if (res.ok && res.url) urls.push(res.url);
    else lastErr = res.error || 'upload failed';
    if (!res.ok && /credential|bad credentials|401|403/i.test(lastErr)) break;
  }
  if (!urls.length) return { ok: false, note: lastErr || 'GitHub par likha nahi ja paya', urls: [] };
  return {
    ok: true,
    note: `${urls.length}/${targets.length} file likh di gayi (CLAUDE.md + AGENTS.md + APEX-BRAIN.md)`,
    urls,
  };
}

export async function pullBrainFromGithub(): Promise<{ ok: boolean; note: string; added?: number }> {
  const cfg = readGhSettings();
  if (!cfg.ghOwner || !cfg.ghRepo) return { ok: false, note: 'GitHub owner/repo setting missing' };
  const branch = cfg.ghBranch || 'main';
  const url = `https://raw.githubusercontent.com/${cfg.ghOwner}/${cfg.ghRepo}/${branch}/APEX-BRAIN.md`;
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return { ok: false, note: `GitHub se nahi aaya (HTTP ${r.status})` };
    const res = importBrainMarkdown(await r.text());
    return { ok: true, note: `${res.added} nayi line merge hui`, added: res.added };
  } catch (e: any) {
    return { ok: false, note: String(e?.message || 'network error') };
  }
}

/** Worker KV copy — phone reset/new device par brain wapas aane ke liye. */
export async function pushBrainToWorker(): Promise<{ ok: boolean; note: string }> {
  try {
    const r = await hubFetch('/jarvis/brain', {
      method: 'POST',
      headers: brainLockHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ markdown: exportBrainMarkdown(), at: Date.now() }),
    });
    const txt = await r.text();
    let j: any = {};
    if (r.status === 403) return { ok: false, note: 'Brain lock galat hai (APEX_BRAIN_KEY se milao)' };
    try {
      j = JSON.parse(txt);
    } catch {
      return { ok: false, note: 'Server ne JSON nahi diya (worker purana/deploy nahi?)' };
    }
    return { ok: Boolean(j.ok), note: j.ok ? 'KV me save ho gaya' : String(j.error || 'save failed') };
  } catch (e: any) {
    return { ok: false, note: String(e?.message || 'server offline') };
  }
}

export async function pullBrainFromWorker(): Promise<{ ok: boolean; note: string; added?: number }> {
  try {
    const r = await hubFetch('/jarvis/brain', { headers: brainLockHeaders() });
    const txt = await r.text();
    let j: any = {};
    try {
      j = JSON.parse(txt);
    } catch {
      return { ok: false, note: 'Server ne JSON nahi diya (worker deploy karo ya brain lock check karo)' };
    }
    if (r.status === 403) return { ok: false, note: 'Server ne brain lock maanga (X-Apex-Brain key galat/khaali)' };
    if (!j.ok || !j.markdown) return { ok: false, note: String(j.error || 'KV me kuch nahi') };
    const res = importBrainMarkdown(String(j.markdown));
    return { ok: true, note: `${res.added} line merge hui`, added: res.added };
  } catch (e: any) {
    return { ok: false, note: String(e?.message || 'server offline') };
  }
}

/** autoSync ON ho to GitHub + Worker dono par bhejo (chup-chaap). */
async function syncBrainOut(_opts: { quiet: boolean }): Promise<void> {
  try {
    await syncBrainToGithub();
  } catch {
    /* network — agli baar */
  }
  try {
    await pushBrainToWorker();
  } catch {
    /* network — agli baar */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔄 AUTO-CAPTURE — koi bhi engine bina import ke line daal sakta hai
//    window.dispatchEvent(new CustomEvent('apex:brain-note', { detail: { kind, text } }))
// ─────────────────────────────────────────────────────────────────────────────

let brainStop: (() => void) | null = null;

export function startBrainCore(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (brainStop) return brainStop;

  // 1) Purane "yaad rakhna" notes ko ek baar brain me migrate karo (userScopedKey ka owner prefix khali hota hai)
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_MEM_KEY) || '[]');
    if (Array.isArray(legacy)) {
      for (const m of legacy.slice(0, 12)) {
        const t = typeof m === 'string' ? m : String(m?.text || '');
        if (t) remember('learned', t);
      }
    }
  } catch {
    /* no legacy */
  }

  // 2) Project ka stack/self-info ek baar khud likho (naye device par bhi turant kaam kare)
  const b = loadBrain();
  if (!b.entries.some((e) => e.kind === 'project')) {
    remember(
      'project',
      'APEX AI = Android (Capacitor WebView + React/Vite) Jarvis-style assistant: hologram HUD, PTT voice hi-IN, ' +
        'CoinDCX Spot+Futures Head-Bot trading, YouTube/Insta/FB content autopilot, free hosting (Cloudflare Worker + GitHub Pages).'
    );
    remember('rule', 'Hamesha Hinglish (Roman) me jawab do, 2-3 crisp sentences, emoji/asterisk mat use karo (voice ke liye).');
    remember('rule', 'Trading me Head Bot bina puche decide+execute karta hai, par LIMITS + KILL SWITCH kabhi na todein; sirf user ke apne keys/account.' );
    remember('rule', 'Doosron ke content par auto-comment/auto-post NAHI (platform rules). Sirf user ka apna content + draft/1-tap handoff.');
  }

  // 3) External note events (jarvisLog/trade/publish yahi se aate hain — import cycle zero)
  const onNote = (ev: Event) => {
    const d = (ev as CustomEvent)?.detail as { kind?: BrainKind; text?: string } | undefined;
    if (!d || !d.text) return;
    autoRemember(KIND_META[d.kind as BrainKind] ? (d.kind as BrainKind) : 'done', String(d.text));
  };
  const onLegacyMemory = (ev: Event) => {
    const detail = (ev as CustomEvent)?.detail;
    if (typeof detail === 'string' && detail.trim()) autoRemember('learned', detail);
  };
  window.addEventListener('apex:brain-note', onNote as EventListener);
  window.addEventListener('apex:jarvis-memory', onLegacyMemory as EventListener);

  brainStop = () => {
    window.removeEventListener('apex:brain-note', onNote as EventListener);
    window.removeEventListener('apex:jarvis-memory', onLegacyMemory as EventListener);
    brainStop = null;
  };
  return brainStop;
}

/** Engine helper — import karne ki zaroorat bina safe note. */
export function noteBrain(kind: BrainKind, text: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('apex:brain-note', { detail: { kind, text } }));
  } catch {
    /* ignore */
  }
}

function structuredCloneSafe<T>(v: T): T {
  try {
    return structuredClone(v);
  } catch {
    return JSON.parse(JSON.stringify(v)) as T;
  }
}
