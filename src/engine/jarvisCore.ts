/**
 * 🛰️ JARVIS CORE — "Khud ka System" (Zero-Order Autonomous Operator)
 * -------------------------------------------------------------------
 * Yeh APEX ka always-on operating loop hai. Boss kuch boley bina, apne aap:
 *   05:30  📰 MARKET RESEARCH   → sub-bots bahar jaake news + technicals laate hain → 👑 Head Bot khud BUY/SELL + size decide karta hai
 *   12:30  🌐 CONTENT RESEARCH  → live web research → naye video topics + script memory me save
 *   19:00  🎬 VIDEO + 💾 SAVE    → dusri websites se footage → 9:16 HD video → Vault + Gallery
 *   21:30  💬 COMMENT PATROL    → sirf APNE hi channel/media ke comments padho → AI reply khud post karo
 * Har slot din me ek baar chalta hai, app band ho toh native alarm se uth jata hai, aur
 * 🔴 KILL SWITCH / ₹ caps / max trades / max replies ke beech kabhi boundary cross nahi karta.
 *
 * ⚖️ Hard rules (safety + platform policy):
 *   • Koi account creation NAHI, koi doosre app me ghus kar password automation NAHI.
 *   • Comments sirf aapke APNE content ke padhe/reply hote hain (official Google/Meta API se).
 *   • Dusron ke posts ke liye sirf DRAFT banta hai — post aap ek tap me karte ho.
 */

import { hubFetch } from './api';
import { logDayEvent } from './dayLog';
import { createMission, executeMission, loadSettings } from './headBotAutopilot';
import { parseGithubRepo, uploadBlobToGithub } from './assetHost';
import { isR2Configured, loadR2Settings, uploadBlobToR2 } from './r2Host';
import { noteBrain } from './brainMemory';
import { listVaultVideos } from './videoVaultDb';

const STATE_KEY = 'apex_jarvis_core_v1';

export type SlotKind = 'market' | 'research' | 'content' | 'engagement';

export interface JarvisSlot {
  id: string;
  kind: SlotKind;
  label: string;
  hour: number;
  minute: number;
}

export interface JarvisLimits {
  autoReplyComments: boolean;
  maxRepliesPerDay: number;
  replyGapSec: number;
  minConfidence: number;
  maxInrPerTrade: number;
  maxOpenPositions: number;
  maxTradesPerDay: number;
  dailyLossCapInr: number;
  /** 🛡️ Safety hardening (v6.6.0) */
  maxSlipPct: number;
  dailyLossCapPctOfWallet: number;
  requireNewsOrExtremeRsi: boolean;
  emergencySlMultiplier: number;
}

export interface JarvisTarget {
  id: string;
  platform: 'youtube' | 'instagram';
  url: string;
  videoId?: string;
  mediaId?: string;
  label: string;
  addedAt: number;
  lastPatrolAt?: number;
  repliesToday: number;
  lastDay: string;
}

export interface JarvisLogItem {
  t: number;
  line: string;
  level: 'info' | 'ok' | 'warn';
}

export interface JarvisDraftReply {
  commentId: string;
  author: string;
  commentText: string;
  replyText: string;
  at: number;
  posted: boolean;
  note?: string;
}

export interface JarvisState {
  enabled: boolean;
  nightlyOnly: boolean;
  /** 📸 Apne IG reels khud dhoondh kar patrol me daalo (token chahiye) */
  autoDiscoverIg: boolean;
  /** 🔁 IG/YouTube patrol ka self-loop: har patrol ke baad turant dobara dekho */
  igAutoPublish: boolean;
  /** 🔴 Trading ka apna kill switch — content loop chalte rahe par order na chale */
  tradingKillSwitch: boolean;
  slots: JarvisSlot[];
  lastRun: Record<string, string>;
  limits: JarvisLimits;
  targets: JarvisTarget[];
  log: JarvisLogItem[];
  drafts: JarvisDraftReply[];
  repliesToday: number;
  tradesToday: number;
  lastPlanSummary?: string;
  updatedAt?: number;
}

export const DEFAULT_SLOTS: JarvisSlot[] = [
  { id: 'market_am', kind: 'market', label: '📰 Market Research + Head Bot Buy/Sell', hour: 5, minute: 30 },
  { id: 'research_noon', kind: 'research', label: '🌐 New-Wave Web Research (topics + facts)', hour: 12, minute: 30 },
  { id: 'content_eve', kind: 'content', label: '🎬 Video banao + 💾 Save', hour: 19, minute: 0 },
  { id: 'engage_night', kind: 'engagement', label: '💬 Comment Patrol + AI Reply', hour: 21, minute: 30 },
];

const DEFAULT_STATE: JarvisState = {
  enabled: false,
  nightlyOnly: false,
  autoDiscoverIg: true,
  igAutoPublish: false,
  tradingKillSwitch: false,
  slots: DEFAULT_SLOTS,
  lastRun: {},
  limits: {
    autoReplyComments: true,
    maxRepliesPerDay: 20,
    replyGapSec: 45,
    minConfidence: 62,
    maxInrPerTrade: 500,
    maxOpenPositions: 3,
    maxTradesPerDay: 12,
    dailyLossCapInr: 1500,
    maxSlipPct: 0.9,
    dailyLossCapPctOfWallet: 6,
    requireNewsOrExtremeRsi: true,
    emergencySlMultiplier: 1.6,
  },
  targets: [],
  log: [],
  drafts: [],
  repliesToday: 0,
  tradesToday: 0,
};

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function loadState(): JarvisState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return structuredCloneSafe(DEFAULT_STATE);
    const parsed = JSON.parse(raw) as Partial<JarvisState>;
    const merged = { ...structuredCloneSafe(DEFAULT_STATE), ...parsed } as JarvisState;
    merged.limits = { ...DEFAULT_STATE.limits, ...(parsed.limits || {}) };
    if (!Array.isArray(merged.slots) || !merged.slots.length) merged.slots = DEFAULT_SLOTS;
    if (!Array.isArray(merged.targets)) merged.targets = [];
    if (!Array.isArray(merged.log)) merged.log = [];
    if (!Array.isArray(merged.drafts)) merged.drafts = [];
    // Din badalte hi counters reset
    const stamp = merged.lastRun?.__day || '';
    if (stamp !== todayKey()) {
      merged.repliesToday = 0;
      merged.tradesToday = 0;
      merged.lastRun = { __day: todayKey() };
    }
    return merged;
  } catch {
    return structuredCloneSafe(DEFAULT_STATE);
  }
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function saveState(patch: Partial<JarvisState>): JarvisState {
  const next = { ...loadState(), ...patch, updatedAt: Date.now() };
  next.log = next.log.slice(-120);
  next.drafts = next.drafts.slice(-60);
  next.targets = next.targets.slice(0, 12);
  next.lastRun = { ...next.lastRun, __day: todayKey() };
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function jarvisLog(line: string, level: JarvisLogItem['level'] = 'info'): JarvisState {
  const st = loadState();
  // 📚 BRAIN FILE — agent ka har milestone (trade, guard skip, publish, research) persistent
  // memory me bhi jaata hai, taaki agli session/chat me Jarvis apna kaam na bhhoole.
  if (level !== 'info' || /^[✅🎬📸🚨🛡️⚠️🛰️🚀🧠💾]/u.test(line)) {
    noteBrain(level === 'warn' ? 'open' : 'done', line);
  }
  return saveState({ log: [...st.log, { t: Date.now(), line, level }].slice(-120) });
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔗 REEL / SHORT LINK → TARGET
// ─────────────────────────────────────────────────────────────────────────────

export function parseMediaUrl(raw: string): { platform: 'youtube' | 'instagram'; videoId?: string; mediaId?: string } | null {
  const u = raw.trim();
  const yt =
    u.match(/(?:youtube\.com\/(?:shorts|watch|live)\/?|youtu\.be\/)([A-Za-z0-9_-]{6,20})/i) ||
    u.match(/[?&]v=([A-Za-z0-9_-]{6,20})/i);
  if (yt) return { platform: 'youtube', videoId: yt[1] };
  const ig = u.match(/instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]{4,20})/i);
  if (ig) return { platform: 'instagram', mediaId: ig[1] };
  const numeric = u.match(/\bIGomid-(\d{6,40})\b/i);
  if (numeric) return { platform: 'instagram', mediaId: numeric[1] };
  return null;
}

export function addTarget(rawUrl: string, label = ''): JarvisTarget | null {
  const parsed = parseMediaUrl(rawUrl);
  if (!parsed) return null;
  const target: JarvisTarget = {
    id: 'tgt_' + Date.now().toString(36),
    platform: parsed.platform,
    url: rawUrl.trim().slice(0, 240),
    videoId: parsed.videoId,
    mediaId: parsed.mediaId,
    label: label || (parsed.videoId ? `YT ${parsed.videoId}` : `IG ${parsed.mediaId}`),
    addedAt: Date.now(),
    repliesToday: 0,
    lastDay: todayKey(),
  };
  const st = loadState();
  saveState({ targets: [target, ...st.targets.filter((t) => t.url !== target.url)].slice(0, 12) });
  jarvisLog(`🔗 Target add hua: ${target.label} (${target.platform})`, 'ok');
  return target;
}

export function removeTarget(id: string): JarvisState {
  const st = loadState();
  return saveState({ targets: st.targets.filter((t) => t.id !== id) });
}

// ─────────────────────────────────────────────────────────────────────────────
// 💬 COMMENT PATROL — sirf APNE content ke comments, official API se
// ─────────────────────────────────────────────────────────────────────────────

async function draftReply(commentText: string, author: string, title: string): Promise<string> {
  try {
    const r = await hubFetch('/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text:
          `Reply as the creator of the video "${title}" to this viewer comment in natural Roman Hinglish, 1 line, max 22 words, ` +
          `warm + genuinely useful, no emoji spam, no links, no "follow me" begging. Comment by @${author}: "${commentText.slice(0, 300)}"`,
      }),
    });
    if (r.ok) {
      const j: any = await r.json();
      const txt = String(j?.text || j?.reply || '').replace(/\s+/g, ' ').trim();
      if (txt.length > 6) return txt.slice(0, 320);
    }
  } catch {}
  return `Shukriya @${author}! Aisi hi breakdowns laate rahenge — batayein kaunsa topic next chahiye.`;
}

export interface PatrolResult {
  target: JarvisTarget;
  fetched: number;
  replied: number;
  drafted: number;
  skipped: number;
  error?: string;
}

export async function patrolTarget(target: JarvisTarget, onEvent?: (line: string) => void): Promise<PatrolResult> {
  const st = loadState();
  const settings = loadSettings();
  const out: PatrolResult = { target, fetched: 0, replied: 0, drafted: 0, skipped: 0 };
  const alreadyReplied = new Set(st.drafts.map((d) => d.commentId));
  const today = todayKey();
  let sentToday = st.targets.filter((t) => t.lastDay === today).reduce((a, t) => a + (t.repliesToday || 0), 0);

  const body: any =
    target.platform === 'youtube'
      ? { platform: 'youtube', videoId: target.videoId, accessToken: settings.youtubeAccessToken, maxResults: 25 }
      : { platform: 'instagram', mediaId: target.mediaId, igAccessToken: settings.igAccessToken };

  let res: Response;
  try {
    res = await hubFetch('/social/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    out.error = String(e?.message || 'network');
    return out;
  }
  const txt = await res.text().catch(() => '');
  let j: any = {};
  try {
    j = JSON.parse(txt);
  } catch {
    j = null;
  }
  if (!j || !res.ok || !j?.ok) {
    out.error = j
      ? String(j?.error || `HTTP ${res.status}`).slice(0, 160)
      : 'Worker par yeh route abhi deploy nahi hua — ek baar `npx wrangler deploy` chalao (tabhi comments live padh paunga)';
    jarvisLog(`⚠️ ${out.error}`, 'warn');
    onEvent?.(`⚠️ ${out.error}`);
    return out;
  }

  const comments: any[] = Array.isArray(j?.comments) ? j.comments : [];
  out.fetched = comments.length;
  const own = Boolean(j?.isOwnContent);
  if (!own && target.platform === 'youtube') {
    out.skipped = comments.length;
    jarvisLog(`🛡️ ${target.label} aapke channel ka video nahi — isliye auto-reply skip, sirf 1-tap drafts banenge`, 'warn');
  }

  for (const c of comments) {
    const cid = String(c?.id || '');
    if (!cid || alreadyReplied.has(cid)) {
      out.skipped += 1;
      continue;
    }
    const text = String(c?.text || '').trim();
    if (text.length < 3 || Number(c?.replyCount || 0) > 0 && !st.limits.autoReplyComments) {
      out.skipped += 1;
      continue;
    }
    if (sentToday >= st.limits.maxRepliesPerDay) {
      jarvisLog(`⏸️ Din ka reply cap (${st.limits.maxRepliesPerDay}) poora — kal phir se chal jayega`, 'warn');
      break;
    }

    const replyText = await draftReply(text, String(c?.author || 'viewer'), target.label);
    let posted = false;
    let note = own ? 'Draft ready — auto-reply OFF' : 'Not your video → sirf draft (1-tap post)';

    if (st.limits.autoReplyComments && own) {
      try {
        const rr = await hubFetch('/social/reply', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(
            target.platform === 'youtube'
              ? { platform: 'youtube', parentId: cid, videoId: target.videoId, text: replyText, accessToken: settings.youtubeAccessToken }
              : { platform: 'instagram', commentId: cid, text: replyText, igAccessToken: settings.igAccessToken }
          ),
        });
        const rj: any = await rr.json().catch(() => ({}));
        if (rr.ok && rj?.ok) {
          posted = true;
          note = '✅ Khud reply post ho gaya';
          out.replied += 1;
          sentToday += 1;
          onEvent?.(`💬 @${c?.author} ko reply ho gaya`);
          const gap = Math.max(5, st.limits.replyGapSec) * 1000;
          await new Promise((r) => setTimeout(r, Math.min(gap, 12_000)));
        } else {
          note = String(rj?.error || rj?.refused || 'reply failed') .slice(0, 120);
          out.drafted += 1;
        }
      } catch (e: any) {
        note = String(e?.message || 'reply error');
        out.drafted += 1;
      }
    } else {
      out.drafted += 1;
    }

    const next = loadState();
    saveState({
      drafts: [
        { commentId: cid, author: String(c?.author || 'viewer'), commentText: text.slice(0, 220), replyText, at: Date.now(), posted, note },
        ...next.drafts,
      ].slice(-60),
      repliesToday: posted ? next.repliesToday + 1 : next.repliesToday,
      targets: next.targets.map((t) =>
        t.id === target.id ? { ...t, lastPatrolAt: Date.now(), repliesToday: (t.repliesToday || 0) + (posted ? 1 : 0), lastDay: today } : t
      ),
    });
    alreadyReplied.add(cid);
  }

  return out;
}

export async function patrolAllTargets(onEvent?: (line: string) => void): Promise<PatrolResult[]> {
  const st = loadState();
  const results: PatrolResult[] = [];
  for (const t of st.targets) {
    onEvent?.(`🔎 ${t.label} ke comments padh raha hoon…`);
    results.push(await patrolTarget(t, onEvent));
  }
  return results;
}

/** Instagram ke liye apne recent media khud dhoondhna (mediaId manual nahi daalna pade). */
export async function syncOwnInstagramMedia(): Promise<{ ok: boolean; added: number; error?: string }> {
  const settings = loadSettings();
  if (!settings.igAccessToken || !settings.igBusinessId) return { ok: false, added: 0, error: 'IG token / business id missing' };
  try {
    const r = await hubFetch('/social/ig/media', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ igAccessToken: settings.igAccessToken, igUserId: settings.igBusinessId, limit: 12 }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!j?.ok) return { ok: false, added: 0, error: String(j?.error || 'IG media list failed') };
    const st = loadState();
    const items: any[] = j.items || [];
    let added = 0;
    const targets = [...st.targets];
    for (const m of items.slice(0, 6)) {
      if (targets.some((t) => t.mediaId === m.mediaId)) continue;
      targets.unshift({
        id: 'tgt_' + Math.random().toString(36).slice(2, 9),
        platform: 'instagram',
        url: String(m.permalink || ''),
        mediaId: String(m.mediaId),
        label: String(m.caption || m.mediaId).slice(0, 40),
        addedAt: Date.now(),
        repliesToday: 0,
        lastDay: todayKey(),
      });
      added += 1;
    }
    saveState({ targets: targets.slice(0, 12) });
    return { ok: true, added };
  } catch (e: any) {
    return { ok: false, added: 0, error: String(e?.message || e) };
  }
}

/** IG Business token ho toh apne recent reels khud list karke patrol me daal deta hai — link dene ki zaroorat nahi. */
export async function autoDiscoverOwnInstagramReels(
  onEvent?: (line: string) => void
): Promise<{ added: number; error?: string }> {
  const st = loadState();
  if (!st.autoDiscoverIg) return { added: 0, error: 'auto-discover OFF' };
  const r = await syncOwnInstagramMedia();
  if (!r.ok) {
    onEvent?.(`📸 IG auto-discover: ${r.error}`);
    return { added: 0, error: r.error };
  }
  return { added: r.added };
}

// ─────────────────────────────────────────────────────────────────────────────
// 📸 INSTAGRAM AUTO-PUBLISH (100% automatic — koi tap nahi)
// Meta ki Graph API file upload nahi karti, isliye video pehle ek PUBLIC URL
// banta hai (aapke GitHub repo me, ₹0), phir Meta use khud kheench leta hai.
// ─────────────────────────────────────────────────────────────────────────────

const IG_PUBLISHED_KEY = 'apex_ig_published_video_ids_v1';

function publishedIgIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(IG_PUBLISHED_KEY) || '[]') as string[];
  } catch {
    return [];
  }
}

function markIgPublished(id: string) {
  const list = publishedIgIds();
  if (!list.includes(id)) {
    localStorage.setItem(IG_PUBLISHED_KEY, JSON.stringify([id, ...list].slice(0, 60)));
  }
}

export interface IgPublishResult {
  ok: boolean;
  skipped?: string;
  permalink?: string;
  error?: string;
  videoTitle?: string;
}

/** 📊 v6.6.11: din bhar ka kaam dikhane ke liye har publish record hota hai. */
export async function publishLatestVaultVideoToInstagram(): Promise<IgPublishResult> {
  const r = await publishLatestVaultVideoToInstagramInner();
  try {
    logDayEvent(
      '📸 Instagram',
      r.ok ? 'nayi reel post bhej di' : 'post skip karna pada',
      r.ok ? 'Graph API · R2/GitHub public URL → media_publish' : String((r as any).skipped || (r as any).error || 'unknown'),
      Boolean(r.ok),
    );
  } catch {}
  return r;
}

async function publishLatestVaultVideoToInstagramInner(): Promise<IgPublishResult> {
  const settings = loadSettings();
  if (!settings.igAccessToken || !settings.igBusinessId) return { ok: false, skipped: 'IG token / business id missing' };
  const vault = await listVaultVideos();
  const done = publishedIgIds();
  const target = vault.find((v) => !done.includes(v.id));
  if (!target) return { ok: false, skipped: 'Vault me naya (un-published) video nahi hai' };

  // 🪣 Public host choose karo: R2 (10 GB free, 0 egress, bada file chalega) ya GitHub raw
  //    (90 MB commit cap). 88 MB se upar ka file R2 ready ho to automatically R2 se jaayega.
  const r2Settings = loadR2Settings();
  const bigFile = target.blob.size > 88 * 1024 * 1024;
  const useR2 = (settings.assetHostKind === 'r2' || bigFile) && isR2Configured(r2Settings);
  if (!useR2 && (!settings.ghToken || (!settings.ghRepo && !settings.ghOwner))) {
    return { ok: false, skipped: 'Public asset host missing — GitHub PAT+repo daalo ya 🪣 R2 card bhar do' };
  }

  const host = useR2
    ? await uploadBlobToR2({ blob: target.blob, fileName: target.fileName, settings: r2Settings })
    : await uploadBlobToGithub({
    token: settings.ghToken,
    owner: settings.ghOwner || (parseGithubRepo(settings.ghRepo)?.owner ?? ''),
    repo: settings.ghRepo.includes('/') ? (parseGithubRepo(settings.ghRepo)?.repo ?? settings.ghRepo) : settings.ghRepo,
    branch: settings.ghBranch || 'main',
    fileName: target.fileName,
    blob: target.blob,
  });
  if (!host.ok || !host.url) return { ok: false, error: `Host(${useR2 ? 'R2' : 'GitHub'}): ${host.error}`, videoTitle: target.title };

  try {
    const r = await hubFetch('/social/ig/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        igAccessToken: settings.igAccessToken,
        igUserId: settings.igBusinessId,
        videoUrl: host.url,
        caption: target.caption || target.title,
        share_to_feed: true,
      }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (r.ok && j?.ok) {
      markIgPublished(target.id);
      jarvisLog(`📸 IG auto-publish ho gaya (${useR2 ? 'R2' : 'GitHub'} host): ${j.permalink || j.mediaId}`, 'ok');
      return { ok: true, permalink: String(j.permalink || ''), videoTitle: target.title };
    }
    return { ok: false, error: String(j?.error || `HTTP ${r.status}`).slice(0, 220), videoTitle: target.title };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 200), videoTitle: target.title };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧠 TRADING EXECUTOR HOOK (useAutoTrader isko register karta hai)
// ─────────────────────────────────────────────────────────────────────────────

export type TradingCycleFn = (reason: string) => Promise<{ traded: boolean; note: string }>;
let tradingExecutor: TradingCycleFn | null = null;

export function registerTradingExecutor(fn: TradingCycleFn) {
  tradingExecutor = fn;
}
export function getTradingExecutor(): TradingCycleFn | null {
  return tradingExecutor;
}

/** ₹ daily loss cap — wallet ke % se auto-tighten hota hai (bade account par zyada, chhote par kam nuksaan). */
export function effectiveLossCapInr(usableWalletInr: number): number {
  const st = loadState();
  const pctCap =
    usableWalletInr > 0
      ? Math.max(250, (usableWalletInr * Math.max(1, Math.min(50, st.limits.dailyLossCapPctOfWallet))) / 100)
      : Number.MAX_SAFE_INTEGER;
  return Math.max(250, Math.min(st.limits.dailyLossCapInr || 1500, pctCap));
}

export function canTradeMore(): { ok: boolean; reason: string } {
  const st = loadState();
  if (st.tradingKillSwitch) return { ok: false, reason: 'Trading kill switch ON hai (🔴 band)' };
  if (st.tradesToday >= st.limits.maxTradesPerDay)
    return { ok: false, reason: `din ka trade cap ${st.limits.maxTradesPerDay} poora` };
  return { ok: true, reason: '' };
}

export function bumpTradesToday(n = 1) {
  const st = loadState();
  saveState({ tradesToday: st.tradesToday + n });
}

// ─────────────────────────────────────────────────────────────────────────────
// 🛰️ THE CORE LOOP
// ─────────────────────────────────────────────────────────────────────────────

let stopFn: (() => void) | null = null;
let coreBusy = false;

export interface CoreTickReport {
  fired: string[];
}

async function runSlot(slot: JarvisSlot, onEvent?: (line: string, level?: JarvisLogItem['level']) => void): Promise<void> {
  const st = loadState();
  onEvent?.(`▶️ Slot "${slot.label}" shuru`, 'info');

  if (slot.kind === 'content') {
    const goalPool = [
      'AI Agents Se Business Growth — Aaj Ka Live Research',
      'Naye AI Tools Jo Purera Workflow Badal Rahe Hain',
      'Instagram + YouTube Algorithm 2026 — Kya Badla',
    ];
    const goal = goalPool[Math.floor(Date.now() / 86_400_000) % goalPool.length];
    const m = createMission({ goal, niche: goal, targetSeconds: 30, platforms: { instagram: true, facebook: false, youtube: true }, scheduledAt: null });
    onEvent?.(`🎬 Auto video mission bana: ${goal}`, 'ok');
    void executeMission(m.id);
    return;
  }

  if (slot.kind === 'engagement') {
    const auto = await autoDiscoverOwnInstagramReels((line) => onEvent?.(line));
    if (auto.added > 0) onEvent?.(`📸 ${auto.added} naye apne IG reels patrol list me aa gaye`, 'ok');
    const res = await patrolAllTargets((line) => onEvent?.(line));
    if (loadState().igAutoPublish) {
      const pub = await publishLatestVaultVideoToInstagram();
      if (pub.ok) onEvent?.(`📸 Reel khud post ho gayi: ${pub.permalink}`, 'ok');
      else onEvent?.(`📸 IG auto-publish: ${pub.skipped || pub.error}`, 'warn');
    }
    const replied = res.reduce((a, r) => a + r.replied, 0);
    const drafted = res.reduce((a, r) => a + r.drafted, 0);
    onEvent?.(`💬 Patrol done — ${replied} auto-reply, ${drafted} draft (targets: ${res.length})`, replied || drafted ? 'ok' : 'warn');
    return;
  }

  if (slot.kind === 'market') {
    const gate = canTradeMore();
    if (!gate.ok) {
      onEvent?.(`⏸️ Market cycle skip — ${gate.reason}`, 'warn');
      return;
    }
    if (!tradingExecutor) {
      onEvent?.(`⚠️ Trading executor ready nahi (Trading modal ek baar khol do)`, 'warn');
      return;
    }
    const r = await tradingExecutor('jarvis_slot_market');
    onEvent?.(`📊 ${r.note}`, r.traded ? 'ok' : 'warn');
    if (r.traded) bumpTradesToday(1);
    return;
  }

  if (slot.kind === 'research') {
    try {
      const r = await hubFetch('/agent/research', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ niche: st.lastPlanSummary || 'AI, Tech & Business Growth India' }),
      });
      const j: any = await r.json().catch(() => ({}));
      const topics: any[] = Array.isArray(j?.topics) ? j.topics : [];
      if (topics.length) {
        const lines = topics
          .slice(0, 4)
          .map((t) => `${t.title} (${Number(t.viralPotential || 0)}% viral)`)
          .join(' · ');
        saveState({ lastPlanSummary: lines.slice(0, 400) });
        window.dispatchEvent(new CustomEvent('apex:jarvis-memory', { detail: `🛰️ New-wave research ${new Date().toLocaleDateString('en-IN')}: ${lines}` }));
        onEvent?.(`🌐 Research saved: ${topics.length} topics`, 'ok');
      } else {
        onEvent?.(`🌐 Research empty — worker redeploy karein toh aur achha aayega`, 'warn');
      }
    } catch (e: any) {
      onEvent?.(`🌐 Research failed: ${String(e?.message || e)}`, 'warn');
    }
    return;
  }
}

/** Loop: har 45 second me slots check. sirf tab jab enabled ho. */
export function startJarvisCore(onEvent?: (line: string, level?: JarvisLogItem['level']) => void): () => void {
  const tick = async () => {
    if (coreBusy) return;
    const st = loadState();
    if (!st.enabled) return;
    const now = new Date();
    const today = todayKey();
    const due = st.slots.filter((s) => {
      const past = now.getHours() > s.hour || (now.getHours() === s.hour && now.getMinutes() >= s.minute);
      return past && st.lastRun[s.id] !== today;
    });
    if (!due.length) return;
    coreBusy = true;
    try {
      for (const slot of due) {
        const cur = loadState();
        saveState({ lastRun: { ...cur.lastRun, [slot.id]: today } });
        try {
          await runSlot(slot, onEvent);
        } catch (e: any) {
          jarvisLog(`⚠️ ${slot.id}: ${String(e?.message || e)}`, 'warn');
          onEvent?.(`⚠️ ${String(e?.message || e)}`, 'warn');
        }
      }
    } finally {
      coreBusy = false;
    }
  };

  const alarm = () => armSlotAlarms();
  const vis = () => {
    if (document.visibilityState === 'visible') void tick();
  };

  const timer = window.setInterval(tick, 45_000);
  window.addEventListener('focus', alarm);
  document.addEventListener('visibilitychange', vis);
  window.setTimeout(() => {
    alarm();
    void tick();
  }, 6_000);

  stopFn = () => {
    window.clearInterval(timer);
    window.removeEventListener('focus', alarm);
    document.removeEventListener('visibilitychange', vis);
  };
  return () => {
    stopFn?.();
    stopFn = null;
  };
}

export function armSlotAlarms(): boolean {
  const st = loadState();
  const bridge = typeof window !== 'undefined' ? (window as any).ApexAndroid : null;
  if (!bridge?.setAlarm || !st.enabled) return false;
  const upcoming = st.slots
    .map((s) => ({ s, mins: s.hour * 60 + s.minute }))
    .sort((a, b) => a.mins - b.mins)
    .find((x) => x.mins > new Date().getHours() * 60 + new Date().getMinutes());
  if (!upcoming) return false;
  try {
    bridge.setAlarm(upcoming.s.hour, Math.max(0, upcoming.s.minute - 1), `🛰️ APEX Jarvis: ${upcoming.s.label}`);
    return true;
  } catch {
    return false;
  }
}

export function toggleCore(force?: boolean): JarvisState {
  const st = loadState();
  const next = saveState({ enabled: typeof force === 'boolean' ? force : !st.enabled });
  jarvisLog(next.enabled ? '🛰️ JARVIS CORE ON — ab main bina bole chalta raunga' : '🛑 JARVIS CORE OFF (kill switch)', next.enabled ? 'ok' : 'warn');
  if (next.enabled) armSlotAlarms();
  return next;
}

export function humanNextRun(state: JarvisState = loadState()): string {
  if (!state.enabled) return 'Core OFF';
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const today = todayKey();
  const upcoming = state.slots
    .map((s) => ({ s, m: s.hour * 60 + s.minute }))
    .filter((x) => x.m > mins || state.lastRun[x.s.id] !== today)
    .sort((a, b) => a.m - b.m)[0];
  if (!upcoming) return 'Aaj ke saare slots done — kal phir';
  const minsLeft = upcoming.m <= mins ? upcoming.m + 1440 - mins : upcoming.m - mins;
  return `${upcoming.s.label} · ${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m baaki`;
}
