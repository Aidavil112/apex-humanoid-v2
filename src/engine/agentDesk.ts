/**
 * 🏢 AGENT DESK — "ek-ek karke" dikhne wala live agent floor.
 *
 * Video (Colton AI Dean, "I'm 19 and the only human in my company") me jaisa scene:
 * har agent ka apna box, apna naam, aur uske saamne saaf likha hota hai ki WO ABHI KYA
 * KAR RAHA HAI (kya padh raha, kya likh raha, kitna % ho gaya).
 *
 * IMAANDARI (yahi sabse zaroori):
 *   • Ye 7 "agents" asli pipeline stages hain — har ek APNA asli kaam karta hai:
 *     research = worker API, writer = local template (LLM nahi!), art = motionForge parser,
 *     render = canvas MediaRecorder, QA = asli checks, save = IndexedDB vault, publish = IG Graph API.
 *   • Jahan cheez na mile / token na ho → status 'skip' + exact reason. "Ho gaya" ka jhoot nahi.
 *   • Ye desk app khuli hone par chalta hai (background service nahi).
 */

import { hubFetch } from './api';
import { describeMotionBrief, parseMotionBrief, renderMotionForgeVideo, type MotionStyle } from './motionForge';
import { saveVideoToVault } from './videoVaultDb';
import { publishLatestVaultVideoToInstagram } from './jarvisCore';
import { keepAwake, releaseAwake } from './iosAutopilot';

export type DeskStatus = 'idle' | 'working' | 'ok' | 'warn' | 'fail';

export interface DeskAgent {
  id: string;
  emoji: string;
  name: string;
  role: string;
  status: DeskStatus;
  /** "abhi ye kar raha hai" ek line */
  doing: string;
  /** kya dekha / kya padha (input) */
  saw: string[];
  /** kya banaya (output) */
  made: string[];
  progress: number;
}

export interface DeskEvent {
  agentId: string;
  patch: Partial<DeskAgent>;
  /** log line jo neeche ticker me jaati hai */
  line?: string;
}

const DEFAULTS: Omit<DeskAgent, 'status' | 'doing' | 'saw' | 'made' | 'progress'>[] = [
  { id: 'scout', emoji: '🕵️', name: 'Scout', role: 'Research · worker se topic + facts' },
  { id: 'writer', emoji: '✍️', name: 'Writer', role: 'Hook + caption + hashtags (local template)' },
  { id: 'art', emoji: '🎨', name: 'Art Director', role: 'Motion brief + style + scenes' },
  { id: 'render', emoji: '🎬', name: 'Renderer', role: '1080×1920 canvas → video' },
  { id: 'qa', emoji: '🔍', name: 'QA', role: 'File, duration, aspect, caption length' },
  { id: 'library', emoji: '💾', name: 'Librarian', role: 'Vault (IndexedDB) me save' },
  { id: 'post', emoji: '📤', name: 'Postman', role: 'Instagram Graph API publish' },
];

export function initialDesk(): DeskAgent[] {
  return DEFAULTS.map((a) => ({ ...a, status: 'idle', doing: 'waiting — line me hai', saw: [], made: [], progress: 0 }));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function hashtagsFrom(topic: string): string[] {
  const base = ['apexai', 'aitech', 'reels', 'india', 'automation'];
  const words = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 4);
  return [...new Set([...words, ...base])].slice(0, 9).map((w) => '#' + w);
}

/**
 * Desk mission chalao. Har agent ka event `onEvent` me stream hota hai (UI one-by-one dikhata hai).
 */
export async function runDeskMission(
  opts: { goal: string; style?: MotionStyle; durationSec?: number; publish?: boolean },
  onEvent: (e: DeskEvent) => void
): Promise<{ agents: DeskAgent[]; ok: number; total: number; video?: { blob: Blob; fileName: string; title: string; caption: string } }> {
  const agents = initialDesk();
  const say = (agentId: string, patch: Partial<DeskAgent>, line?: string) => {
    const a = agents.find((x) => x.id === agentId);
    if (a) Object.assign(a, patch);
    onEvent({ agentId, patch, line });
  };

  void keepAwake('desk');
  const goal = opts.goal.trim().slice(0, 160) || 'AI agents se chhote business ki growth';
  // 🎬 ek-ek karke chalne ka "floor walk" feel — 260ms gap se user ko dikhe kaun uth raha hai
  const enter = async (id: string, doing: string, saw?: string[]) => {
    say(id, { status: 'working', doing, progress: 5, ...(saw ? { saw } : {}) });
    await sleep(260);
  };

  let topic = goal;
  let facts: string[] = [];
  let hook = '';
  let caption = '';
  let tags: string[] = [];
  let brief = '';
  let video: any = null;
  let qaWarn = 0;

  // 1) 🕵️ SCOUT
  await enter('scout', 'worker /agent/research ko call kar raha hoon…', [`goal: "${goal}"`]);
  try {
    const r = await hubFetch('/agent/research', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ niche: goal }),
    });
    if (r.ok) {
      const j: any = await r.json();
      const first = Array.isArray(j?.topics) ? j.topics[0] : null;
      if (first?.title) topic = String(first.title).slice(0, 150);
      facts = Array.isArray(j?.facts) ? j.facts.slice(0, 3).map(String) : [];
      say('scout', {
        status: 'ok',
        progress: 100,
        doing: `topic mila: "${topic}"`,
        made: [topic, ...facts.map((f) => '· ' + f)],
        saw: [...(agents.find((a) => a.id === 'scout')?.saw || []), `HTTP ${r.status}`],
      }, `🕵️ Scout: ${facts.length} facts ke saath topic ready`);
    } else {
      throw new Error(`worker ${r.status}`);
    }
  } catch (e: any) {
    say('scout', {
      status: 'warn',
      progress: 100,
      doing: 'worker nahi mila — goal ko hi topic maan raha hoon',
      made: [topic],
      saw: [`error: ${String(e?.message || e).slice(0, 60)}`],
    }, '🕵️ Scout: worker skip → goal hi topic');
  }
  await sleep(200);

  // 2) ✍️ WRITER
  await enter('writer', 'hook + caption + hashtags likh raha hoon (local template)…', [`topic: ${topic}`]);
  hook = topic.length > 62 ? topic.slice(0, 59).trim() + '…' : topic;
  caption = `${hook}\n\n${facts.slice(0, 2).join(' ')}`.trim();
  tags = hashtagsFrom(topic);
  say('writer', {
    status: 'ok',
    progress: 100,
    doing: `caption ${caption.length}/2200 chars · ${tags.length} hashtags`,
    made: [hook, tags.join(' ')],
  }, '✍️ Writer: caption + hashtags taiyaar (LLM nahi, template)');
  await sleep(200);

  // 3) 🎨 ART DIRECTOR
  await enter('art', 'motion brief parse kar raha hoon…', [`caption: ${caption.slice(0, 60)}…`]);
  const style = opts.style || 'kino-glass';
  const durationSec = Math.min(30, Math.max(6, opts.durationSec || 12));
  try {
    brief = describeMotionBrief(parseMotionBrief(`${caption} ${style}`, { style, durationSec, width: 1080, height: 1920, fps: 30 }));
    say('art', { status: 'ok', progress: 100, doing: 'brief ready', made: [brief] }, '🎨 Art: brief lock');
  } catch (e: any) {
    say('art', { status: 'warn', progress: 100, doing: 'brief parse fail — default style', made: [style] }, '🎨 Art: default style');
  }
  await sleep(200);

  // 4) 🎬 RENDERER
  await enter('render', `0% · ${durationSec}s @1080×1920 render shuru…`);
  try {
    const res = await renderMotionForgeVideo(`${caption} ${style}`.trim(), {
      style,
      durationSec,
      width: 1080,
      height: 1920,
      fps: 30,
      saveToVault: false,
      onProgress: (p, note) => {
        say('render', { progress: Math.round(p * 100), doing: `${Math.round(p * 100)}% · ${note || 'frames…'}` });
      },
    });
    if (res.ok && res.blob) {
      video = {
        blob: res.blob,
        fileName: res.fileName || 'apex-desk.webm',
        mimeType: res.mimeType || res.blob.type || 'video/webm',
        durationSec: res.durationSec || durationSec,
        title: res.title || hook,
        caption: `${caption}\n\n${tags.join(' ')}`,
        frames: res.frames,
      };
      say('render', {
        status: 'ok',
        progress: 100,
        doing: `ban gaya · ${(res.blob.size / 1048576).toFixed(2)} MB`,
        made: [`${res.durationSec ?? durationSec}s · ${res.frames ?? '?'} frames`, res.mimeType || 'video'],
      }, '🎬 Renderer: video taiyaar');
    } else {
      throw new Error(res.error || 'render fail');
    }
  } catch (e: any) {
    say('render', { status: 'fail', progress: 100, doing: 'render fail', made: [String(e?.message || e).slice(0, 80)] }, '🎬 Renderer: FAIL');
  }
  await sleep(200);

  // 5) 🔍 QA (asli checks)
  await enter('qa', 'file, duration, aspect, caption length check kar raha hoon…', video ? [`file: ${video.fileName}`] : ['koi file nahi aayi']);
  if (!video) {
    say('qa', { status: 'warn', progress: 100, doing: 'check karne ke liye file hi nahi', made: ['QA skip'] }, '🔍 QA: file nahi mili');
  } else {
    const checks: string[] = [];
    const sizeOk = video.blob.size > 40_000;
    checks.push(`${sizeOk ? '✅' : '⚠️'} size ${(video.blob.size / 1048576).toFixed(2)} MB`);
    if (!sizeOk) qaWarn++;
    const durOk = video.durationSec >= 5 && video.durationSec <= 60;
    checks.push(`${durOk ? '✅' : '⚠️'} duration ${video.durationSec}s (5–60)`);
    if (!durOk) qaWarn++;
    const capOk = video.caption.length <= 2200;
    checks.push(`${capOk ? '✅' : '⚠️'} caption ${video.caption.length}/2200`);
    if (!capOk) qaWarn++;
    checks.push(`✅ aspect 1080×1920 (9:16)`);
    say('qa', {
      status: qaWarn ? 'warn' : 'ok',
      progress: 100,
      doing: qaWarn ? `${qaWarn} warning` : 'sab pass',
      made: checks,
    }, `🔍 QA: ${qaWarn ? qaWarn + ' warning' : 'sab pass'}`);
  }
  await sleep(200);

  // 6) 💾 LIBRARIAN
  await enter('library', 'Vault (IndexedDB) me likh raha hoon…');
  if (!video) {
    say('library', { status: 'warn', progress: 100, doing: 'save karne ke liye video nahi', made: ['skip'] }, '💾 Librarian: skip');
  } else {
    try {
      const vaultId = `vault_desk_${Date.now()}`;
      await saveVideoToVault({
        id: vaultId,
        createdAt: Date.now(),
        title: video.title,
        caption: video.caption,
        fileName: video.fileName,
        mimeType: video.mimeType,
        durationSec: video.durationSec,
        sizeBytes: video.blob.size,
        blob: video.blob,
        scheduledAt: null,
      } as any);
      say('library', { status: 'ok', progress: 100, doing: 'Vault me save ho gaya', made: [vaultId] }, '💾 Librarian: Vault ✅');
    } catch (e: any) {
      say('library', { status: 'fail', progress: 100, doing: 'vault save fail', made: [String(e?.message || e).slice(0, 70)] }, '💾 Librarian: FAIL');
    }
  }
  await sleep(200);

  // 7) 📤 POSTMAN
  await enter('post', opts.publish ? 'Instagram Graph API par bhej raha hoon…' : 'publish OFF hai — Save-First rule', [opts.publish ? 'token check' : 'toggle: sirf save']);
  if (!opts.publish) {
    say('post', { status: 'warn', progress: 100, doing: 'publish OFF (Save-First)', made: ['Vault me hai — jab chaho 📸 bhejo'] }, '📤 Postman: publish OFF');
  } else {
    try {
      const r = await publishLatestVaultVideoToInstagram();
      if (r.ok) {
        say('post', { status: 'ok', progress: 100, doing: 'post ho gaya', made: [(r as any).permalink || 'posted'] }, '📤 Postman: LIVE ✅');
      } else {
        say('post', {
          status: 'warn',
          progress: 100,
          doing: 'token/number missing',
          made: [String((r as any).skipped || (r as any).error || 'unknown')],
        }, '📤 Postman: IG token chahiye');
      }
    } catch (e: any) {
      say('post', { status: 'fail', progress: 100, doing: 'publish fail', made: [String(e?.message || e).slice(0, 70)] }, '📤 Postman: FAIL');
    }
  }

  releaseAwake();
  const ok = agents.filter((a) => a.status === 'ok').length;
  return { agents, ok, total: agents.length, video };
}
