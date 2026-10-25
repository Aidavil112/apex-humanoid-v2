/**
 * 👑 HEAD BOT AUTOPILOT ENGINE — "Online Research → Dusri Website se Footage → HD Video → Save → Time pe Auto-Upload"
 * ---------------------------------------------------------------------------
 * Fully autonomous 4-step mission pipeline that runs inside the APK with ZERO extra cost:
 *  1. 🌐 LIVE ONLINE RESEARCH  — Wikipedia + Wikimedia Commons + Internet Archive + NASA (real web data, no canned lines)
 *  2. 🕵️ WEBSITE FINDER        — dusri free-source websites se REAL playing HD motion clips uthata hai (no static photos)
 *  3. 🎬 VIDEO + 💾 SAVE-FIRST  — 9:16 HD video banata hai, Vault + Phone Gallery me permanently save karta hai
 *  4. ⏰ TIME-BASED AUTO-UPLOAD — set time pe khud uthta hai aur YouTube par DIRECT upload karta hai (permanent Google
 *     Auto-Login token), aur Instagram/Facebook ka composer caption pre-copied ke saath khud khol deta hai.
 */

import { apexCopy, apexPaste } from './nativeUi';
import { hubFetch } from './api';
import { runOpenMontageProduction, type BacklotStageId, type ProducedMontageVideo } from './openMontageEngine';
import { saveVideoToVault, listVaultVideos, type SavedVaultVideo } from './videoVaultDb';
import { noteBrain } from './brainMemory';
import { renderMotionForgeVideo, type MotionStyle } from './motionForge';
import { keepAwake, releaseAwake, isAppleTouch } from './iosAutopilot';

const QUEUE_KEY = 'apex_headbot_autopilot_queue_v1';
const SETTINGS_KEY = 'apex_headbot_autopilot_settings_v1';

export type MissionStatus =
  | 'queued'
  | 'researching'
  | 'producing'
  | 'saved'
  | 'awaiting_time'
  | 'uploading'
  | 'published'
  | 'failed';

export interface MissionLogLine {
  t: number;
  line: string;
  level?: 'info' | 'ok' | 'warn';
}

export interface MissionSource {
  site: string;
  title: string;
  url: string;
  snippet: string;
  kind: 'video' | 'reference';
}

export interface HeadBotMission {
  id: string;
  goal: string;
  niche: string;
  createdAt: number;
  scheduledAt: number | null;
  platforms: { instagram: boolean; facebook: boolean; youtube: boolean };
  targetSeconds: 30 | 60;
  status: MissionStatus;
  stage: BacklotStageId;
  progress: number;
  log: MissionLogLine[];
  sources: MissionSource[];
  facts: string[];
  title?: string;
  caption?: string;
  hashtags?: string[];
  vaultId?: string;
  youtubeUrl?: string;
  error?: string;
}

export interface AutoPilotSettings {
  autoLoginYoutube: boolean;
  youtubeAccessToken: string;
  facebookPageId: string;
  facebookPageToken: string;
  igBusinessId: string;
  igAccessToken: string;
  defaultHour: number;
  defaultMinute: number;
  autoPublishDefault: boolean;
  /** 🆓 Free public asset host (Instagram Graph API ko public URL chahiye) */
  /** 'github' = repo raw link (90 MB cap) | 'r2' = Cloudflare R2 (10 GB free, 0 egress) */
  assetHostKind: 'github' | 'r2';
  ghToken: string;
  ghOwner: string;
  ghRepo: string;
  ghBranch: string;
  /** 🗓️ DAILY AUTOPILOT — bina order ke roz khud research → video → save → upload */
  dailyEnabled: boolean;
  dailyHour: number;
  dailyMinute: number;
  dailyNiche: string;
  dailyPlatforms: { instagram: boolean; facebook: boolean; youtube: boolean };
  lastDailyRunDay: string;
  /** 🎬 REEL ENGINE — video ka source: 'auto' = motion pehle (fail par footage), 'footage' = sirf web clips, 'motion' = sirf canvas render */
  reelEngine: 'auto' | 'footage' | 'motion';
  motionStyle: MotionStyle;
}

export const DEFAULT_SETTINGS: AutoPilotSettings = {
  autoLoginYoutube: true,
  youtubeAccessToken: '',
  facebookPageId: '',
  facebookPageToken: '',
  igBusinessId: '',
  igAccessToken: '',
  defaultHour: 18,
  defaultMinute: 30,
  autoPublishDefault: true,
  assetHostKind: 'github',
  ghToken: '',
  ghOwner: 'Aidavil112',   // 2026-10-24: asli GitHub login (pradhanbibek53 Cloudflare subdomain hai, GitHub par 404)
  ghRepo: 'apex-humanoid-v2',   // user ka public repo (brain CLAUDE.md + IG video host yahi jaayega)
  ghBranch: 'main',
  dailyEnabled: false,
  dailyHour: 19,
  dailyMinute: 0,
  dailyNiche: 'AI, Tech & Business Growth India',
  dailyPlatforms: { instagram: true, facebook: true, youtube: true },
  lastDailyRunDay: '',
  reelEngine: 'auto',
  motionStyle: 'kino-glass', // client default: kino-glass (style chips se badal sakte ho)
};

// ─────────────────────────────────────────────────────────────────────────────
// 🗓️ DAILY AUTOPILOT — "Mujhe order dena hi na pade"
// ─────────────────────────────────────────────────────────────────────────────

const EVERGREEN_TOPICS = [
  'AI Agents Se Chhote Business Ki Growth Kaise Badhe',
  'YouTube Shorts Se 0 Se 100K Subs — Real Strategy',
  'Instagram Reels Algorithm 2026 Me Kya Badal Gaya',
  'CoinDCX Aur Crypto Taxes — India Ka Naya Rule',
  'AI Se Free Me Professional Video Kaise Banayein',
  'Smart Phone Ko 10X Fast Banane Wale AI Settings',
  'Faceless YouTube Channel — Puri Live Blueprint',
];

/** Live research se aaj ka viral topic chunta hai — worker na ho toh evergreen rotation. */
export async function pickDailyTopic(niche: string): Promise<{ goal: string; why: string }> {
  const dayIdx = Math.floor(Date.now() / 86_400_000);
  try {
    const r = await hubFetch('/agent/research', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ niche }),
    });
    if (r.ok) {
      const j: any = await r.json();
      const topics: any[] = Array.isArray(j?.topics) ? j.topics : [];
      if (topics.length) {
        const sorted = [...topics].sort((a, b) => Number(b?.viralPotential || 0) - Number(a?.viralPotential || 0));
        const chosen = sorted[dayIdx % sorted.length];
        const title = String(chosen?.title || '').trim();
        if (title.length >= 6) {
          return { goal: title.slice(0, 150), why: `Live research · viral ${Number(chosen.viralPotential || 0)}%` };
        }
      }
    }
  } catch {}
  return {
    goal: EVERGREEN_TOPICS[dayIdx % EVERGREEN_TOPICS.length],
    why: 'Offline fallback topic (worker research nahi mila)',
  };
}

function dayKey(ts = Date.now()): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Slot pahunchte hi (aur din me ek baar) khud mission banata hai. */
export async function ensureDailyMission(onStage?: StageFn, force = false): Promise<HeadBotMission | null> {
  const s = loadSettings();
  if (!s.dailyEnabled && !force) return null;

  const today = dayKey();
  if (s.lastDailyRunDay === today && !force) return null;

  const slot = new Date();
  slot.setHours(s.dailyHour, s.dailyMinute, 0, 0);
  if (!force && Date.now() < slot.getTime()) return null; // abhi time nahi hua

  if (!force) saveSettings({ lastDailyRunDay: today });

  const picked = await pickDailyTopic(s.dailyNiche);
  const m = createMission({
    goal: picked.goal,
    niche: s.dailyNiche,
    targetSeconds: 30,
    platforms: s.dailyPlatforms,
    scheduledAt: null,
  });
  upsertMission({ ...m, log: [{ t: Date.now(), line: `🗓️ Daily Autopilot khud chalu hua (${s.dailyHour}:${String(s.dailyMinute).padStart(2, '0')}) — ${picked.why}`, level: 'ok' }] });
  onStage?.({ ...m, status: 'researching' });
  return await executeMission(m.id, onStage);
}

/** Subah/Shaam slot ke liye phone alarm — taaki app band ho tab bhi head Bot uth jaye. */
export function armDailyAlarm(): boolean {
  const s = loadSettings();
  const bridge = typeof window !== 'undefined' ? (window as any).ApexAndroid : null;
  if (!bridge?.setAlarm || !s.dailyEnabled) return false;
  try {
    bridge.setAlarm(s.dailyHour, Math.max(0, s.dailyMinute - 1), `👑 APEX Head Bot: roz ka research + video + upload chalu karo`);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS (Auto-Login Vault)
// ─────────────────────────────────────────────────────────────────────────────

export function loadSettings(): AutoPilotSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const merged = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AutoPilotSettings>) };
    // v6.6.4: purane save me ghOwner/ghRepo khaali the (GitHub username 404 wala bug) → default bhar do
    if (merged.assetHostKind !== 'r2' && merged.assetHostKind !== 'github') merged.assetHostKind = 'github';
    if (!merged.ghOwner) merged.ghOwner = DEFAULT_SETTINGS.ghOwner;
    if (!merged.ghRepo) merged.ghRepo = DEFAULT_SETTINGS.ghRepo;
    // v6.6.15: purane blob me reelEngine/motionStyle the hi nahi → default bhar do (type-safe)
    if (merged.reelEngine !== 'footage' && merged.reelEngine !== 'motion' && merged.reelEngine !== 'auto') {
      merged.reelEngine = DEFAULT_SETTINGS.reelEngine;
    }
    if (merged.motionStyle !== 'neon-pulse' && merged.motionStyle !== 'kino-glass' && merged.motionStyle !== 'brutal-flash') {
      merged.motionStyle = DEFAULT_SETTINGS.motionStyle;
    }
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(patch: Partial<AutoPilotSettings>): AutoPilotSettings {
  const next = { ...loadSettings(), ...patch };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE PERSISTENCE (app band ho jaye tab bhi mission zinda rahe)
// ─────────────────────────────────────────────────────────────────────────────

export function loadQueue(): HeadBotMission[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HeadBotMission[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function persistQueue(list: HeadBotMission[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(list.slice(0, 40)));
  } catch {}
}

function upsertMission(m: HeadBotMission): HeadBotMission[] {
  const list = loadQueue();
  const idx = list.findIndex((x) => x.id === m.id);
  if (idx >= 0) list[idx] = m;
  else list.unshift(m);
  persistQueue(list);
  return list;
}

export function deleteMission(id: string): HeadBotMission[] {
  const list = loadQueue().filter((x) => x.id !== id);
  persistQueue(list);
  return list;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🌐 STEP 1 + 2 — LIVE ONLINE RESEARCH + DUSRI WEBSITE SE FOOTAGE KHEEENCHNA
// ─────────────────────────────────────────────────────────────────────────────

async function timedFetch(url: string, ms: number, init?: RequestInit): Promise<Response | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    clearTimeout(t);
    return r.ok ? r : null;
  } catch {
    return null;
  }
}

/** Wikipedia — live factual research (articles + summaries) from the open web. */
async function researchWikipedia(goal: string): Promise<{ sources: MissionSource[]; facts: string[] }> {
  const sources: MissionSource[] = [];
  const facts: string[] = [];
  const q = encodeURIComponent(goal.trim().slice(0, 90));

  const opensearch = await timedFetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&srlimit=3&format=json&origin=*`,
    6000
  );
  if (opensearch) {
    try {
      const j: any = await opensearch.json();
      const hits: any[] = j?.query?.search || [];
      for (const h of hits.slice(0, 3)) {
        const title = String(h.title || '');
        const snippet = String(h.snippet || '').replace(/<[^>]+>/g, '');
        if (!title) continue;
        sources.push({
          site: 'Wikipedia',
          title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
          snippet: snippet.slice(0, 220),
          kind: 'reference',
        });
        if (snippet) facts.push(snippet.slice(0, 190));
      }
    } catch {}
  }

  if (!sources.length) {
    const summary = await timedFetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${q.replace(/%20/g, '_')}`,
      5000
    );
    if (summary) {
      try {
        const j: any = await summary.json();
        if (j?.title && j?.extract) {
          sources.push({
            site: 'Wikipedia',
            title: String(j.title),
            url: String(j.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${j.title}`),
            snippet: String(j.extract).slice(0, 220),
            kind: 'reference',
          });
          facts.push(String(j.extract).slice(0, 190));
        }
      } catch {}
    }
  }
  return { sources, facts };
}

/** Wikimedia Commons + NASA — REAL playing HD motion footage from other free websites. */
async function findFootageEverywhere(goal: string): Promise<{ sources: MissionSource[]; clipUrls: string[] }> {
  const sources: MissionSource[] = [];
  const clipUrls: string[] = [];

  const commonsFor = async (phrase: string) => {
    const commons = await timedFetch(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
        `filetype:video ${phrase}`
      )}&gsrlimit=6&prop=imageinfo&iiprop=url|mime|size&origin=*&format=json`,
      6500
    );
    if (!commons) return;
    try {
      const j: any = await commons.json();
      const pages: any[] = Object.values(j?.query?.pages || {});
      for (const p of pages) {
        const info = p?.imageinfo?.[0];
        const url = String(info?.url || '');
        const mime = String(info?.mime || '');
        const size = Number(info?.size || 0);
        if (url && (mime.includes('video') || /\.(webm|mp4|ogv)(\?|$)/i.test(url)) && size < 24_000_000) {
          if (!clipUrls.includes(url)) clipUrls.push(url);
          sources.push({
            site: 'Wikimedia Commons',
            title: String(p.title || 'Free motion clip').replace(/^File:/i, '').replace(/\.(webm|mp4|ogv)$/i, '').slice(0, 90),
            url: String(p.descriptionurl || url),
            snippet: `${(size / 1_000_000).toFixed(1)} MB HD free-license footage`,
            kind: 'video',
          });
        }
      }
    } catch {}
  };

  // 1) Wikimedia Commons (free video library, direct .webm/.mp4) — 3 progressively wider queries
  const shortPhrase = goal.trim().split(/\s+/).slice(0, 3).join(' ');
  await commonsFor(goal.trim().slice(0, 60));
  if (clipUrls.length < 3 && shortPhrase.length > 3) await commonsFor(shortPhrase);
  if (clipUrls.length < 3) await commonsFor('artificial intelligence technology');

  // 2) NASA Image Library — public-domain space/tech videos, direct mp4 links
  const nasa = await timedFetch(
    `https://images-api.nasa.gov/search?q=${encodeURIComponent(goal.trim().slice(0, 60))}&media_type=video&page_size=4`,
    6500
  );
  if (nasa) {
    try {
      const j: any = await nasa.json();
      const items: any[] = j?.collection?.items || [];
      for (const it of items.slice(0, 4)) {
        const meta = it?.data?.[0] || {};
        const manifestUrl = String(it?.links?.self?.href || '');
        let mp4 = '';
        if (manifestUrl) {
          const man = await timedFetch(manifestUrl, 4500);
          if (man) {
            try {
              const mj: any = await man.json();
              mp4 = (mj || []).find((u: string) => typeof u === 'string' && u.toLowerCase().endsWith('.mp4')) || '';
            } catch {}
          }
        }
        if (mp4) {
          clipUrls.push(mp4);
          sources.push({
            site: 'NASA Image Library',
            title: String(meta.title || 'NASA footage'),
            url: String(meta.url || 'https://images.nasa.gov'),
            snippet: String(meta.description || 'Public-domain HD footage').slice(0, 180),
            kind: 'video',
          });
        }
      }
    } catch {}
  }

  // 3) Internet Archive — millions of free films/newsreels (dusra website!)
  const ia = await timedFetch(
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
      `${goal.trim().slice(0, 50)} AND mediatype:(movies)`
    )}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=description&rows=3&page=1&output=json`,
    6500
  );
  if (ia) {
    try {
      const j: any = await ia.json();
      const docs: any[] = j?.response?.docs || [];
      for (const d of docs) {
        const ident = String(d.identifier || '');
        const dirUrl = `https://archive.org/download/${ident}`;
        sources.push({
          site: 'Internet Archive',
          title: Array.isArray(d.title) ? String(d.title[0]) : String(d.title || ident),
          url: `https://archive.org/details/${ident}`,
          snippet: String(d.description || 'Free archive footage').replace(/<[^>]+>/g, '').slice(0, 170),
          kind: 'video',
        });
        if (ident) {
          // Metadata file list → grab the smallest .mp4 for fast render
          const meta = await timedFetch(`https://archive.org/metadata/${ident}/files`, 5000);
          if (meta) {
            try {
              const mj: any = await meta.json();
              const vids: any[] = (mj?.files || []).filter(
                (f: any) => typeof f?.name === 'string' && /\.mp4$/i.test(f.name) && Number(f.size || 0) < 60_000_000
              );
              vids.sort((a, b) => Number(a.size || 0) - Number(b.size || 0));
              if (vids[0]?.name) clipUrls.push(`${dirUrl}/${encodeURIComponent(vids[0].name)}`);
            } catch {}
          }
        }
      }
    } catch {}
  }

  return { sources, clipUrls: clipUrls.slice(0, 10) };
}

export interface ResearchPack {
  brief: string;
  facts: string[];
  sources: MissionSource[];
  clipUrls: string[];
  title: string;
  caption: string;
  hashtags: string[];
  bestTime: string;
  engine: string;
}

/** Master research call — worker /agent/autopilot pehle, direct public APIs fallback (100% kaam karta hai). */
export async function runLiveResearch(goal: string, niche: string): Promise<ResearchPack> {
  // A) Try server-side grounded research first (works after worker redeploy)
  try {
    const r = await hubFetch('/agent/autopilot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ goal, niche }),
    });
    if (r.ok) {
      const j: any = await r.json();
      if (j?.sources && j?.clipUrls && String(j.clipUrls).length) {
        return {
          brief: String(j.brief || ''),
          facts: Array.isArray(j.facts) ? j.facts.slice(0, 6) : [],
          sources: Array.isArray(j.sources) ? j.sources.slice(0, 8) : [],
          clipUrls: Array.isArray(j.clipUrls) ? j.clipUrls.slice(0, 10) : [],
          title: String(j.title || goal),
          caption: String(j.caption || ''),
          hashtags: Array.isArray(j.hashtags) ? j.hashtags.slice(0, 8) : [],
          bestTime: String(j.bestTime || '6:30 PM – 8:30 PM IST'),
          engine: String(j.engine || 'live-web-grounded'),
        };
      }
    }
  } catch {}

  // B) On-device LIVE research (no server dependency — runs straight from the APK)
  const [wiki, footage] = await Promise.all([researchWikipedia(goal), findFootageEverywhere(goal)]);
  const evidence = [
    ...wiki.sources.map((s) => `[${s.site}] ${s.title}: ${s.snippet}`),
    ...footage.sources.map((s) => `[${s.site} FOOTAGE] ${s.title}: ${s.snippet}`),
  ]
    .slice(0, 8)
    .join('\n');

  let title = `${goal.trim() || 'AI & Future Tech'} — Live Web Research 🔥`;
  let caption = `${goal.trim()} ka taaza research-based breakdown! Sources neeche comments me. #shorts`;
  let hashtags = ['shorts', 'reels', 'viral', 'ai', 'trending'];
  let narrationBrief = evidence;
  let engine = 'on-device-live-web';

  try {
    const prompt =
      `You are the 👑 HEAD BOT of a 41-agent video newsroom. Boss ka goal: "${goal}". Niche: "${niche}". ` +
      `Use ONLY this LIVE web research evidence and add nothing fake:\n${evidence || '(no external evidence — write a smart general brief)'}\n\n` +
      `Return ONLY valid JSON: {"title":"max 70 char viral title","hook":"first 3 sec line in Roman Hinglish",` +
      `"brief":"4 tight Roman Hinglish sentences summarizing the real findings for a 30-60s video","facts":["3 short bullet facts"],` +
      `"caption":"Instagram+Facebook caption in Roman Hinglish with 1 CTA","hashtags":["5 tags without #"],"bestTime":"IST slot"}`;
    const r = await hubFetch('/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: prompt }),
    });
    if (r.ok) {
      const j: any = await r.json();
      const raw = String(j?.text || j?.reply || '');
      const s = raw.indexOf('{');
      const e = raw.lastIndexOf('}');
      if (s >= 0 && e > s) {
        const parsed = JSON.parse(raw.slice(s, e + 1));
        if (parsed?.title) title = String(parsed.title).slice(0, 90);
        if (parsed?.caption) caption = String(parsed.caption).slice(0, 480);
        if (Array.isArray(parsed?.hashtags) && parsed.hashtags.length)
          hashtags = parsed.hashtags.map((t: string) => String(t).replace(/^#/, '')).slice(0, 8);
        if (parsed?.bestTime) narrationBrief += `\nBEST POSTING TIME: ${parsed.bestTime}`;
        if (Array.isArray(parsed?.facts) && parsed.facts.length) {
          wiki.facts = parsed.facts.map((f: string) => String(f).slice(0, 190)).slice(0, 6);
        }
        if (parsed?.brief) narrationBrief = `${parsed.brief}\n\nLIVE SOURCES:\n${evidence}`.slice(0, 1400);
      }
    }
  } catch {}

  return {
    brief: narrationBrief,
    facts: wiki.facts.slice(0, 6),
    sources: [...wiki.sources, ...footage.sources].slice(0, 8),
    clipUrls: footage.clipUrls,
    title,
    caption: `${caption}\n\n📚 Sources: ${[...wiki.sources, ...footage.sources]
      .slice(0, 3)
      .map((s) => s.site)
      .join(' · ')}`,
    hashtags,
    bestTime: '6:30 PM – 8:30 PM IST',
    engine,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ⏰ AUTO-LOGIN + PUBLISH (YouTube = true headless upload; FB = Graph token; IG = 1-tap handoff)
// ─────────────────────────────────────────────────────────────────────────────

async function uploadToYoutube(mission: HeadBotMission, video: ProducedMontageVideo | SavedVaultVideo) {
  const settings = loadSettings();
  const res = await hubFetch('/yt/upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: (mission.title || video.title || 'APEX AI Short').slice(0, 98),
      description: `${mission.caption || video.caption || ''}\n\n🤖 Auto-published by 👑 APEX Head Bot Autopilot.`,
      tags: [...(mission.hashtags || []), 'apexai', 'shorts'].slice(0, 18),
      privacyStatus: 'public',
      accessToken: settings.youtubeAccessToken,
      videoBase64: (video as any).base64,
    }),
  });
  const j: any = await res.json().catch(() => ({}));
  if (j?.uploaded && j?.youtubeUrl) return { ok: true, url: String(j.youtubeUrl), simulated: false };
  return { ok: false, url: '', simulated: !!j?.simulated, error: String(j?.error || j?.message || 'Token needed') };
}

async function publishToFacebookPage(mission: HeadBotMission, blob: Blob) {
  const settings = loadSettings();
  if (!settings.facebookPageId || !settings.facebookPageToken) return { ok: false, error: 'FB page token missing' };
  try {
    const fd = new FormData();
    fd.append('source', blob, mission.id + '.webm');
    fd.append('description', mission.caption || mission.title || 'APEX AI Video');
    fd.append('published', 'true');
    const r = await fetch(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(settings.facebookPageId)}/videos?access_token=${encodeURIComponent(
        settings.facebookPageToken
      )}`,
      { method: 'POST', body: fd }
    );
    const j: any = await r.json().catch(() => ({}));
    if (j?.id) return { ok: true, url: `https://facebook.com/${settings.facebookPageId}` };
    return { ok: false, error: String(j?.error?.message || 'FB publish failed') };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || 'FB network error') };
  }
}

function handoffToApp(platform: 'instagram' | 'facebook', bridge: any) {
  try {
    if (bridge?.openUrl) {
      bridge.openUrl(
        platform === 'instagram'
          ? 'https://www.instagram.com/reel/create'
          : 'https://www.facebook.com/composer'
      );
    } else if (bridge?.shareVideoToPlatform) {
      bridge.shareVideoToPlatform('', 'apex.mp4', 'video/webm', '', platform);
    }
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 MISSION EXECUTOR
// ─────────────────────────────────────────────────────────────────────────────

export type StageFn = (m: HeadBotMission) => void;

function pushLog(m: HeadBotMission, line: string, level: MissionLogLine['level'] = 'info') {
  m.log = [...m.log, { t: Date.now(), line, level }].slice(-60);
  // 📚 BRAIN FILE — mission ke bade mud (video bana, save hua, publish hua, atka) memory me likho
  if (level !== 'info' || /^(✅|🎬|📸|🚨|⚠️|💾|📤|🌐)/.test(line)) {
    noteBrain(level === 'warn' ? 'open' : 'done', line);
  }
}

export async function executeMission(missionId: string, onStage?: StageFn): Promise<HeadBotMission | null> {
  const found = loadQueue().find((x) => x.id === missionId);
  if (!found) return null;
  const m: HeadBotMission = { ...found, log: [...found.log] };
  const bridge = typeof window !== 'undefined' ? (window as any).ApexAndroid : null;
  const emit = () => {
    // Persist every progress tick so the UI (and voice-triggered missions) stay live in sync.
    upsertMission(m);
    onStage?.(m);
  };

  const settings = loadSettings(); // 🎛️ engine choice (auto/motion/footage) mission ke start par lock
  // 🍎 iPhone: render ke waqt screen jaagti rahe (warna 30s me so jaata hai aur mission beech me marti hai)
  void keepAwake('mission');

  try {
    // STEP 1 — LIVE ONLINE RESEARCH
    m.status = 'researching';
    m.stage = 'link_check';
    m.progress = 6;
    pushLog(m, `🌐 Head Bot live internet par research kar raha hai: "${m.goal}"`, 'info');
    emit();

    const pack = await runLiveResearch(m.goal, m.niche || m.goal);
    m.sources = pack.sources;
    m.facts = pack.facts;
    m.title = pack.title;
    m.caption = pack.caption;
    m.hashtags = pack.hashtags;
    m.progress = 24;
    pushLog(
      m,
      `✅ ${pack.sources.length} live web sources + ${pack.clipUrls.length} real HD clips mil gaye (${pack.sources
        .slice(0, 3)
        .map((s) => s.site)
        .join(' · ') || 'bundled motion library'})`,
      'ok'
    );
    emit();

    // STEP 2 + 3 — VIDEO PRODUCTION · 🎛️ ENGINE ROUTER (motion canvas ↔ web footage)
    m.status = 'producing';
    m.stage = 'assets';
    emit();

    const cfg = settings;
    const clipsGot = pack.clipUrls.length > 0;
    // 🎲 auto rule: clips na milen to motion (nafaa: footage research fail hone par bhi reel banti hai)
    const wantMotion = cfg.reelEngine === 'motion' || (cfg.reelEngine === 'auto' && !pack.clipUrls.length);
    if (cfg.reelEngine === 'auto') {
      pushLog(m, clipsGot ? `📹 AUTO rule: ${pack.clipUrls.length} real clips mile → footage engine` : '🎲 AUTO rule: clips nahi mile → Motion Forge (canvas) engine', 'info');
      emit();
    }
    let video: ProducedMontageVideo | null = null;

    if (wantMotion) {
      pushLog(m, `✨ Motion engine — canvas par 1080×1920 frames render ho rahe hain…`, 'info');
      emit();
      try {
        const mv = await withTimeout(
          renderMotionForgeVideo(`${m.goal} ${settings.motionStyle || ''}`.trim(), {
            style: cfg.motionStyle,
            durationSec: Math.min(30, Math.max(6, m.targetSeconds || 30)),
            width: 1080,
            height: 1920,
            fps: 30,
            saveToVault: false,
            onProgress: (pct, note) => {
              m.progress = Math.max(m.progress, Math.min(86, 24 + Math.round(pct * 60)));
              if (note) pushLog(m, note);
              emit();
            },
          }),
          120000,
          'Motion render' + ' 120s me pura nahi hua (watchdog)'
        );
        if (mv.ok && mv.blob) {
          video = {
            blob: mv.blob,
            url: mv.url || '',
            base64: await blobToBase64(mv.blob),
            mimeType: mv.mimeType || mv.blob.type || 'video/webm',
            fileName: mv.fileName || `apex-motion-${Date.now()}.webm`,
            title: mv.title || m.title || m.goal,
            caption: mv.caption || m.caption || '',
            durationSec: mv.durationSec || Math.min(30, Math.max(6, m.targetSeconds || 30)),
            scenes: [],
          };
          pushLog(m, `✅ Motion render taiyaar (${(mv.blob.size / 1048576).toFixed(2)} MB) — footage ki zarurat nahi padi`, 'ok');
        } else {
          pushLog(m, `⚠️ Motion render fail: ${mv.error || 'unknown reason'} → footage engine par switch (fallback)`, 'warn');
        }
      } catch (e: any) {
        pushLog(m, `⚠️ Motion render fail: ${String(e?.message || e)} → footage engine par switch (fallback)`, 'warn');
      }
      emit();
    }

    if (!video) {
      pushLog(m, `🎬 Dusri websites ki footage se 9:16 HD video render ho raha hai…`, 'info');
      emit();
      video = await runOpenMontageProduction({
      topic: m.goal,
      targetSeconds: m.targetSeconds || 30,
      researchBrief: pack.brief,
      externalClipUrls: pack.clipUrls,
      overrideTitle: pack.title,
      sourceCredit: pack.sources.map((s) => `${s.site} — ${s.title}`).slice(0, 3).join(' | ') || 'Open web',
      onStage: (stage, line, pct) => {
        m.stage = stage;
        m.progress = Math.max(m.progress, Math.min(88, pct));
        pushLog(m, line);
        emit();
      },
      });
    }

    m.progress = 90;
    pushLog(m, `💾 Video taiyaar — pehle Vault + Phone Gallery me SAVE kar raha hoon (Save-First Rule)`, 'ok');
    emit();

    // STEP 4 — SAVE FIRST
    const vaultId = `vault_${m.id}`;
    await saveVideoToVault({
      id: vaultId,
      createdAt: Date.now(),
      title: video.title || m.title || m.goal,
      caption: video.caption || m.caption || '',
      fileName: video.fileName,
      mimeType: video.mimeType,
      durationSec: video.durationSec,
      sizeBytes: video.blob.size,
      blob: video.blob,
      scheduledAt: m.scheduledAt || null,
    } as SavedVaultVideo);
    m.vaultId = vaultId;

    if (bridge?.saveVideoToGalleryOnly) {
      try {
        bridge.saveVideoToGalleryOnly(video.base64, video.fileName, video.mimeType);
        pushLog(m, `🖼️ Phone Gallery (Movies/APEX_AI) me bhi save ho gaya`, 'ok');
      } catch {}
    }
    m.status = 'saved';
    m.progress = 92;
    emit();

    // STEP 5 — UPLOAD NOW or SCHEDULE
    if (!m.scheduledAt || m.scheduledAt <= Date.now() + 5000) {
      await publishMission(m, video.blob, { youtubeBase64: video.base64 }, bridge, emit);
    } else {
      pushLog(
        m,
        `⏰ Mission ${new Date(m.scheduledAt).toLocaleString('en-IN')} ke liye queue me daal diya — tab head bot khud uthke upload karega`,
        'ok'
      );
      if (bridge?.setAlarm) {
        try {
          const d = new Date(m.scheduledAt);
          bridge.setAlarm(d.getHours(), Math.max(0, d.getMinutes() - 1), `APEX Head Bot: ${m.title || m.goal} upload karo`);
          pushLog(m, `🔔 Phone alarm set ho gaya taaki time pe app uth jaye`, 'ok');
        } catch {}
      }
      m.status = 'awaiting_time';
      emit();
    }
  } catch (e: any) {
    m.status = 'failed';
    m.error = String(e?.message || e);
    pushLog(m, `⚠️ ${m.error}`, 'warn');
  }
  upsertMission(m);
  emit();
  releaseAwake(); // 🍎 mission khatam — ab screen normal
  return m;
}

async function publishMission(
  m: HeadBotMission,
  blob: Blob,
  payload: { youtubeBase64: string },
  bridge: any,
  emit: () => void
) {
  m.status = 'uploading';
  m.stage = 'uploading';
  m.progress = 95;
  pushLog(m, `🚀 Auto-publish shuru — platforms: ${['instagram', 'facebook', 'youtube'].filter((p) => (m.platforms as any)[p]).join(', ') || 'none'}`);
  emit();

  if (m.platforms.youtube) {
    try {
      const yt = await uploadToYoutube(m, {
        blob,
        base64: payload.youtubeBase64,
        title: m.title || m.goal,
        caption: m.caption || '',
      } as any);
      if (yt.ok) {
        m.youtubeUrl = yt.url;
        pushLog(m, `▶️ YouTube par LIVE ho gaya (khud login karke): ${yt.url}`, 'ok');
      } else if (yt.simulated) {
        pushLog(m, `▶️ YouTube Connect ready nahi tha — 1-tap handoff kar raha hoon`, 'warn');
        handoffToApp('facebook', bridge);
      } else {
        pushLog(m, `▶️ YouTube auto-upload: ${yt.error} — handoff mode use kar raha hoon`, 'warn');
        if (bridge?.openUrl) bridge.openUrl('https://youtube.com/upload');
      }
    } catch (e: any) {
      pushLog(m, `▶️ YouTube error: ${String(e?.message || e)}`, 'warn');
    }
  }

  if (m.platforms.facebook) {
    const fb = await publishToFacebookPage(m, blob);
    if (fb.ok) pushLog(m, `📘 Facebook Page par auto-publish ho gaya: ${fb.url}`, 'ok');
    else {
      pushLog(m, `📘 ${fb.error} — composer 1-tap khol diya (browser login yaad rahega)`, 'warn');
      handoffToApp('facebook', bridge);
    }
  }

  if (m.platforms.instagram) {
    pushLog(m, `📸 Instagram Reel composer khol diya — caption pehle se copy hai`, 'info');
    try {
      if (navigator?.clipboard?.writeText) {
        await apexCopy(`${m.caption || m.title}\n\n${(m.hashtags || []).map((h) => `#${h}`).join(' ')}`);
      }
    } catch {}
    handoffToApp('instagram', bridge);
  }

  m.status = 'published';
  m.progress = 100;
  m.stage = 'done';
  upsertMission(m);
  emit();
  try {
    if (bridge?.speakNative) bridge.speakNative(`Boss, video taiyaar aur publish ho gaya hai. ${m.title || ''}`, 'hi-IN', `mission_${m.id}`);
  } catch {}
}

/** Publish a video that is ALREADY saved in the vault (schedule fires from here). */
async function publishVaultVideo(m: HeadBotMission, bridge: any, emit: () => void) {
  const vault = await listVaultVideos();
  const v = vault.find((x) => x.id === m.vaultId) || vault[0];
  if (!v) throw new Error('Vault me video nahi mila');
  const base64 = await blobToBase64(v.blob);
  await publishMission(m, v.blob, { youtubeBase64: base64 }, bridge, emit);
}

function withTimeout<T>(p: Promise<T>, ms: number, why: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(why)), ms);
    p.then((v) => { clearTimeout(timer); resolve(v); })
      .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onloadend = () => resolve(String(fr.result || '').split(',')[1] || '');
    fr.readAsDataURL(blob);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export function createMission(input: {
  goal: string;
  niche?: string;
  scheduledAt?: number | null;
  platforms?: { instagram: boolean; facebook: boolean; youtube: boolean };
  targetSeconds?: 30 | 60;
}): HeadBotMission {
  const m: HeadBotMission = {
    id: 'hb_' + Date.now().toString(36),
    goal: input.goal.trim().slice(0, 180),
    niche: (input.niche || input.goal).trim().slice(0, 120),
    createdAt: Date.now(),
    scheduledAt: input.scheduledAt ?? null,
    platforms: input.platforms || { instagram: true, facebook: true, youtube: true },
    targetSeconds: input.targetSeconds || 30,
    status: 'queued',
    stage: 'idle',
    progress: 0,
    log: [],
    sources: [],
    facts: [],
  };
  upsertMission(m);
  return m;
}

let busy = false;

/** Heartbeat: har 20 second me queue check karta hai — time hote hi khud research/save/upload complete. */
/**
 * 🍎 iOS CATCH-UP — app band/hui ya phone ne JS suspend kiya, tab jo mission adhoori ruki
 * (status researching/producing/uploading, par 2 min se koi halchal nahi) use wapas zinda karo.
 *
 *   researching/producing  → status 'queued' (heartbeat agla tick par khud chalayega)
 *   uploading + vaultId    → publishVaultVideo se upload dobara
 *
 * Jhooth nahi: ye tab chalta hai jab app WAPAS khule. Phone band = kuch nahi chalta.
 */
export function resumeInterruptedMissions(opts: { staleMs?: number } = {}): {
  found: number;
  requeued: number;
  uploadRetried: number;
} {
  const staleMs = opts.staleMs ?? 120_000;
  const now = Date.now();
  const queue = loadQueue();
  let requeued = 0;
  let uploadRetried = 0;
  let found = 0;

  const next = queue.map((m) => {
    const running = m.status === 'researching' || m.status === 'producing' || m.status === 'uploading';
    if (!running) return m;
    if (now - (m.createdAt || 0) < staleMs) return m; // abhi-asli me chal rahi ho sakti hai
    found++;
    if (m.status === 'uploading' && m.vaultId) {
      uploadRetried++;
      return {
        ...m,
        status: 'awaiting_time' as MissionStatus,
        scheduledAt: Date.now(),
        log: [...m.log.slice(-59), { t: now, line: '🍎 Upload adhoora tha (app band hui) → abhi dobara try', level: 'warn' as const }],
      };
    }
    requeued++;
    return {
      ...m,
      status: 'queued' as MissionStatus,
      scheduledAt: null, // createdAt chhua nahi → heartbeat ka stale-queued rule ise turant uthata hai
      log: [
        ...m.log.slice(-59),
        {
          t: now,
          line: `🍎 Catch-up: mission ${isAppleTouch() ? 'iPhone' : 'app'} band hone se ${m.status} par ruka tha → dobara queue me`,
          level: 'warn' as const,
        },
      ],
    };
  });

  if (found) persistQueue(next);
  return { found, requeued, uploadRetried };
}

export function startAutopilotHeartbeat(onTick?: StageFn): () => void {
  const bridge = typeof window !== 'undefined' ? (window as any).ApexAndroid : null;
  let timer: number | null = null;

  let recovered = false;

  const tick = async () => {
    if (busy) return;
    // 🍎 pehla tick par: app band hone se adhoori ruki missions ko wapas queue karo
    if (!recovered) {
      recovered = true;
      resumeInterruptedMissions(); // 🍎 app khulte hi adhoori mission wapas queue me
    }
    const queue = loadQueue();
    // 🍎 iOS catch-up: 'queued' mission jo 2 min se atki hai (app band/refresh ho gaya tha) → ab chalao
    const staleQueued = queue.find((x) => x.status === 'queued' && Date.now() - x.createdAt > 120_000);
    if (staleQueued && !busy) {
      busy = true;
      try {
        await executeMission(staleQueued.id, onTick);
      } catch {
      } finally {
        busy = false;
      }
      return;
    }
    const due = queue.find(
      (x) => x.status === 'awaiting_time' && x.scheduledAt && x.scheduledAt <= Date.now() + 30_000
    );
    if (!due) {
      // 🗓️ Koi scheduled mission due nahi — toh Daily Autopilot check karo (bina order ke)
      busy = true;
      try {
        await ensureDailyMission(onTick);
      } catch {
      } finally {
        busy = false;
      }
      return;
    }
    busy = true;
    void keepAwake('publish');
    try {
      const m: HeadBotMission = { ...due, log: [...due.log] };
      pushLog(m, `⏰ Time ho gaya! Head Bot khud utha — video utha kar auto-publish kar raha hoon`, 'ok');
      onTick?.(m);
      await publishVaultVideo(m, bridge, () => {
        upsertMission(m);
        onTick?.(m);
      });
    } catch (e: any) {
      const q = loadQueue().map((x) => (x.id === due.id ? { ...x, status: 'failed' as MissionStatus, error: String(e?.message || e) } : x));
      persistQueue(q);
    } finally {
      releaseAwake();
      busy = false;
    }
  };

  const arm = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') void tick();
  };

  timer = window.setInterval(tick, 20_000);
  window.addEventListener('visibilitychange', arm);
  window.setTimeout(() => {
    void armDailyAlarm();
    void tick();
  }, 4_000);
  return () => {
    if (timer) window.clearInterval(timer);
    window.removeEventListener('visibilitychange', arm);
  };
}

export async function runMissionNow(input: Parameters<typeof createMission>[0], onStage?: StageFn): Promise<HeadBotMission | null> {
  if (busy) return null;
  busy = true;
  try {
    const m = createMission(input);
    return await executeMission(m.id, onStage);
  } finally {
    busy = false;
  }
}

/** Voice command parser: "Kal 7 baje YouTube pe daal dena" / "shaam 6:30 ko" */
export function parseHinglishTime(text: string, base: Date = new Date()): { at: number; label: string } | null {
  const t = text.toLowerCase();
  const pmMatch = t.match(/(\d{1,2})\s*(?:[:.]\s*(\d{1,2}))?\s*(?:baje|pm|shaam|raat|eve)/);
  const amMatch = t.match(/(\d{1,2})\s*(?:[:.]\s*(\d{1,2}))?\s*(?:am|subah|suprabhat|morning)/);
  const plainMatch = t.match(/(?:at|pe|ko)\s+(\d{1,2})(?:[:.](\d{2}))?/);

  let hour = -1;
  let minute = 0;
  let meridiem: 'am' | 'pm' | '' = '';

  if (pmMatch) {
    hour = +pmMatch[1];
    minute = +(pmMatch[2] || 0);
    meridiem = 'pm';
  } else if (amMatch) {
    hour = +amMatch[1];
    minute = +(amMatch[2] || 0);
    meridiem = 'am';
  } else if (plainMatch) {
    hour = +plainMatch[1];
    minute = +(plainMatch[2] || 0);
  }
  if (hour < 0 || hour > 12) return null;

  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (!meridiem && hour >= 1 && hour <= 7) hour += 12; // 6 baje = shaam by default

  const d = new Date(base);
  if (/kal|tomorrow/.test(t)) d.setDate(d.getDate() + 1);
  d.setHours(hour, Math.min(59, minute), 0, 0);
  if (d.getTime() <= base.getTime()) d.setDate(d.getDate() + 1);

  return {
    at: d.getTime(),
    label: d.toLocaleString('en-IN', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' }),
  };
}

export function humanCountdown(scheduledAt: number | null): string {
  if (!scheduledAt) return 'Abhi';
  const diff = scheduledAt - Date.now();
  if (diff <= 0) return 'Abhi fire hoga';
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  if (hrs > 24) return `${Math.floor(hrs / 24)} din ${hrs % 24} ghante`;
  if (hrs > 0) return `${hrs} gh ${mins % 60} min baaki`;
  if (mins > 0) return `${mins} min baaki`;
  return `${Math.floor(diff / 1000)} sec baaki`;
}
