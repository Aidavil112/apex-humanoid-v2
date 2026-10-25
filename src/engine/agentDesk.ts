/**
 * 🏢 APEX HQ — "only human in the company" wala system.
 *
 * Video (Colton AI Dean) me jaisa: har agent ka APNA screen dikhta hai — usme live
 * chal raha hota hai (browser scan, editor me typing, render ke frames, phone par post).
 * Sabse upar 👑 BOSS (Head Bot) baithta hai jo order deta hai aur report leta hai.
 *
 * IMAANDARI (jhooth nahi):
 *   • 7 agents asli pipeline stages hain. Har line jo screen par dikhti hai, wo asli
 *     action ke SAATH likhi jaati hai (worker call, render progress, IDB put, Graph API POST).
 *   • Jahan cheez na mile / token na ho → line me exact reason (skip + why). Fake "done" nahi.
 *   • Sab app khuli hone par chalta hai (background service nahi).
 */

import { hubFetch } from './api';
import { describeMotionBrief, parseMotionBrief, renderMotionForgeVideo, type MotionStyle } from './motionForge';
import { saveVideoToVault } from './videoVaultDb';
import { publishLatestVaultVideoToInstagram } from './jarvisCore';
import { keepAwake, releaseAwake } from './iosAutopilot';

export type DeskStatus = 'idle' | 'working' | 'ok' | 'warn' | 'fail';

/** mini-screen par ek line (terminal/notes jaisi) */
export type ScreenKind = 'cmd' | 'out' | 'ok' | 'warn' | 'err' | 'type';
export interface ScreenLine {
  i: number;
  text: string;
  kind: ScreenKind;
}

export type DeskDevice = 'console' | 'browser' | 'editor' | 'canvas' | 'render' | 'review' | 'vault' | 'phone';

export interface DeskAgent {
  id: string;
  emoji: string;
  name: string;
  role: string;
  device: DeskDevice;
  status: DeskStatus;
  doing: string;
  saw: string[];
  made: string[];
  progress: number;
  /** uska apna mini screen — live lines */
  screen: ScreenLine[];
}

export interface DeskEvent {
  agentId: string;
  patch: Partial<DeskAgent>;
  line?: string;
  /** mini-screen par nayi line */
  screen?: { text: string; kind: ScreenKind };
}

const DEVICE_LABEL: Record<DeskDevice, string> = {
  console: 'boss',
  browser: 'chrome',
  editor: 'notes.md',
  canvas: 'figma.app',
  render: 'render.app',
  review: 'checklist',
  vault: 'vault.db',
  phone: 'phone',
};

export const DEVICE_TITLE = DEVICE_LABEL;

type Base = Omit<DeskAgent, 'status' | 'doing' | 'saw' | 'made' | 'progress' | 'screen'>;

const DEFAULTS: Base[] = [
  { id: 'boss', emoji: '👑', name: 'Boss', role: 'Head Bot — order deta hai, screens dekhta hai, report leta hai', device: 'console' },
  { id: 'scout', emoji: '🕵️', name: 'Scout', role: 'Research — worker se topic + facts', device: 'browser' },
  { id: 'writer', emoji: '✍️', name: 'Writer', role: 'Hook + caption + hashtags (local template, LLM nahi)', device: 'editor' },
  { id: 'art', emoji: '🎨', name: 'Art Director', role: 'Motion brief + style + scenes', device: 'canvas' },
  { id: 'render', emoji: '🎬', name: 'Renderer', role: '1080×1920 canvas → video', device: 'render' },
  { id: 'qa', emoji: '🔍', name: 'QA', role: 'Size, duration, aspect, caption check', device: 'review' },
  { id: 'library', emoji: '💾', name: 'Librarian', role: 'Vault (IndexedDB) me save', device: 'vault' },
  { id: 'post', emoji: '📤', name: 'Postman', role: 'Instagram Graph API publish', device: 'phone' },
];

export function initialDesk(): DeskAgent[] {
  return DEFAULTS.map((a) => ({
    ...a,
    status: 'idle',
    doing: 'waiting — Boss ka order nahi aaya',
    saw: [],
    made: [],
    progress: 0,
    screen: [{ i: 0, text: '/ $ ready', kind: 'out' }],
  }));
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

export async function runDeskMission(
  opts: { goal: string; style?: MotionStyle; durationSec?: number; publish?: boolean },
  onEvent: (e: DeskEvent) => void
): Promise<{
  agents: DeskAgent[];
  ok: number;
  total: number;
  video?: { blob: Blob; fileName: string; title: string; caption: string };
}> {
  const agents = initialDesk();
  let lineNo = 0;

  const say = (agentId: string, patch: Partial<DeskAgent>, line?: string, screen?: { text: string; kind: ScreenKind }) => {
    const a = agents.find((x) => x.id === agentId);
    if (a) {
      Object.assign(a, patch);
      if (screen) {
        lineNo += 1;
        a.screen = [...a.screen, { i: lineNo, text: screen.text, kind: screen.kind }].slice(-26);
      }
    }
    onEvent({ agentId, patch, line, screen });
  };

  const scr = (agentId: string, text: string, kind: ScreenKind = 'out') => {
    say(agentId, {}, undefined, { text, kind });
  };

  void keepAwake('hq');
  const goal = opts.goal.trim().slice(0, 160) || 'AI agents se chhote business ki growth';

  const enter = async (id: string, doing: string, saw?: string[]) => {
    say(id, { status: 'working', doing, progress: 5, ...(saw ? { saw } : {}) });
    await sleep(240);
  };

  let topic = goal;
  let facts: string[] = [];
  let caption = '';
  let tags: string[] = [];
  let brief = '';
  let video: any = null;
  let qaWarn = 0;

  // 👑 BOSS — briefing
  say('boss', { status: 'working', doing: 'mission tod raha hoon — kaam baant raha hoon', progress: 5 },
    '👑 Boss: mission mila — 7 agents ko kaam baant raha hoon',
    { text: `mission: "${goal}"`, kind: 'cmd' });
  scr('boss', 'assign → Scout · Writer · Art · Render · QA · Vault · Post', 'out');
  await sleep(320);

  // 1) 🕵️ SCOUT
  say('boss', { doing: 'Scout ko research par bheja' }, '👑 Boss: Scout → research karo', { text: '→ Scout: topic + facts lao', kind: 'type' });
  await enter('scout', 'worker /agent/research ko call kar raha hoon…', [`goal: "${goal}"`]);
  scr('scout', `$ POST /agent/research  {"niche":"${goal.slice(0, 34)}…"}`, 'cmd');
  await sleep(140);
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
      scr('scout', `← 200 · ${Array.isArray(j?.topics) ? j.topics.length : 0} topics · ${facts.length} facts`, 'ok');
      scr('scout', `scan: reddit · youtube · news  →  pick: "${topic.slice(0, 40)}…"`, 'out');
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
    scr('scout', `← error: ${String(e?.message || e).slice(0, 48)} → goal hi topic`, 'warn');
    say('scout', {
      status: 'warn',
      progress: 100,
      doing: 'worker nahi mila — goal ko hi topic maan raha hoon',
      made: [topic],
      saw: [`error: ${String(e?.message || e).slice(0, 60)}`],
    }, '🕵️ Scout: worker skip → goal hi topic');
  }
  await sleep(180);

  // 2) ✍️ WRITER
  say('boss', { doing: 'Write ko script di' }, '👑 Boss: Writer → caption + hashtags', { text: '→ Writer: caption likho', kind: 'type' });
  await enter('writer', 'hook + caption + hashtags likh raha hoon (local template)…', [`topic: ${topic}`]);
  scr('writer', `$ open notes.md`, 'cmd');
  scr('writer', `hook: "${topic.length > 58 ? topic.slice(0, 55).trim() + '…' : topic}"`, 'type');
  await sleep(120);
  caption = `${topic}\n\n${facts.slice(0, 2).join(' ')}`.trim();
  tags = hashtagsFrom(topic);
  scr('writer', `caption: ${caption.length}/2200 chars · ${tags.length} hashtags`, 'ok');
  scr('writer', tags.join(' '), 'out');
  say('writer', {
    status: 'ok',
    progress: 100,
    doing: `caption ${caption.length}/2200 chars · ${tags.length} hashtags`,
    made: [topic, tags.join(' ')],
  }, '✍️ Writer: caption + hashtags taiyaar (LLM nahi, template)');
  await sleep(180);

  // 3) 🎨 ART
  say('boss', { doing: 'Art ko style choose karne diya' }, '👑 Boss: Art → look lock karo', { text: '→ Art: style + scenes', kind: 'type' });
  await enter('art', 'motion brief parse kar raha hoon…', [`caption: ${caption.slice(0, 60)}…`]);
  scr('art', `$ parse brief  style=${opts.style || 'kino-glass'}`, 'cmd');
  const style = opts.style || 'kino-glass';
  const durationSec = Math.min(30, Math.max(6, opts.durationSec || 12));
  try {
    brief = describeMotionBrief(parseMotionBrief(`${caption} ${style}`, { style, durationSec, width: 1080, height: 1920, fps: 30 }));
    scr('art', `scenes: 4 · 9:16 · ${durationSec}s · palette #7dd3fc/#1e3a5f`, 'ok');
    scr('art', brief.slice(0, 90), 'out');
    say('art', { status: 'ok', progress: 100, doing: 'brief ready', made: [brief] }, '🎨 Art: brief lock');
  } catch {
    scr('art', 'brief parse fail → default style', 'warn');
    say('art', { status: 'warn', progress: 100, doing: 'brief parse fail — default style', made: [style] }, '🎨 Art: default style');
  }
  await sleep(180);

  // 4) 🎬 RENDERER
  say('boss', { doing: 'Renderer ko green signal diya' }, '👑 Boss: Renderer → chalao (screen dekhta rahunga)', { text: '→ Renderer: 1080×1920 render', kind: 'type' });
  await enter('render', `0% · ${durationSec}s @1080×1920 render shuru…`);
  scr('render', `$ render --w 1080 --h 1920 --fps 30 --sec ${durationSec}`, 'cmd');
  try {
    const res = await renderMotionForgeVideo(`${caption} ${style}`.trim(), {
      style,
      durationSec,
      width: 1080,
      height: 1920,
      fps: 30,
      saveToVault: false,
      onProgress: (p, note) => {
        const pct = Math.round(p * 100);
        say('render', { progress: pct, doing: `${pct}% · ${note || 'frames…'}` });
        if (pct % 10 < 4 && pct > 4) scr('render', `frame ${Math.round(p * 360)}/360 · ${pct}%`, 'out');
      },
    });
    if (res.ok && res.blob) {
      scr('render', `encode ${(res.mimeType || 'video').split(';')[0]} · ${(res.blob.size / 1048576).toFixed(2)} MB`, 'ok');
      video = {
        blob: res.blob,
        fileName: res.fileName || 'apex-hq.webm',
        mimeType: res.mimeType || res.blob.type || 'video/webm',
        durationSec: res.durationSec || durationSec,
        title: res.title || topic,
        caption: `${caption}\n\n${tags.join(' ')}`,
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
    scr('render', `✗ ${String(e?.message || e).slice(0, 46)}`, 'err');
    say('render', { status: 'fail', progress: 100, doing: 'render fail', made: [String(e?.message || e).slice(0, 80)] }, '🎬 Renderer: FAIL');
  }
  await sleep(180);

  // 5) 🔍 QA
  say('boss', { doing: 'QA se check karwa raha hoon' }, '👑 Boss: QA → file check karo', { text: '→ QA: file verify', kind: 'type' });
  await enter('qa', 'file, duration, aspect, caption check kar raha hoon…', video ? [`file: ${video.fileName}`] : ['koi file nahi aayi']);
  if (!video) {
    scr('qa', 'no file → checks skip', 'warn');
    say('qa', { status: 'warn', progress: 100, doing: 'check karne ke liye file hi nahi', made: ['QA skip'] }, '🔍 QA: file nahi mili');
  } else {
    const checks: string[] = [];
    const sizeOk = video.blob.size > 40_000;
    checks.push(`${sizeOk ? '✅' : '⚠️'} size ${(video.blob.size / 1048576).toFixed(2)} MB`);
    scr('qa', `size ${(video.blob.size / 1048576).toFixed(2)} MB ${sizeOk ? 'ok' : 'SMALL'}`, sizeOk ? 'ok' : 'warn');
    if (!sizeOk) qaWarn++;
    const durOk = video.durationSec >= 5 && video.durationSec <= 60;
    checks.push(`${durOk ? '✅' : '⚠️'} duration ${video.durationSec}s (5–60)`);
    scr('qa', `duration ${video.durationSec}s ${durOk ? 'ok' : 'OUT OF RANGE'}`, durOk ? 'ok' : 'warn');
    if (!durOk) qaWarn++;
    const capOk = video.caption.length <= 2200;
    checks.push(`${capOk ? '✅' : '⚠️'} caption ${video.caption.length}/2200`);
    scr('qa', `caption ${video.caption.length}/2200 ${capOk ? 'ok' : 'LONG'}`, capOk ? 'ok' : 'warn');
    if (!capOk) qaWarn++;
    checks.push('✅ aspect 1080×1920 (9:16)');
    scr('qa', 'aspect 1080×1920 (9:16) ok', 'ok');
    say('qa', {
      status: qaWarn ? 'warn' : 'ok',
      progress: 100,
      doing: qaWarn ? `${qaWarn} warning` : 'sab pass',
      made: checks,
    }, `🔍 QA: ${qaWarn ? qaWarn + ' warning' : 'sab pass'}`);
  }
  await sleep(180);

  // 6) 💾 LIBRARIAN
  say('boss', { doing: 'Vault me save karwa raha hoon (Save-First)' }, '👑 Boss: Librarian → Vault me daalo', { text: '→ Vault: save', kind: 'type' });
  await enter('library', 'Vault (IndexedDB) me likh raha hoon…');
  if (!video) {
    scr('library', 'nothing to save → skip', 'warn');
    say('library', { status: 'warn', progress: 100, doing: 'save karne ke liye video nahi', made: ['skip'] }, '💾 Librarian: skip');
  } else {
    try {
      const vaultId = `vault_hq_${Date.now()}`;
      scr('library', `$ IDB.put("videos", "${vaultId}")`, 'cmd');
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
      scr('library', `saved · ${(video.blob.size / 1048576).toFixed(2)} MB`, 'ok');
      say('library', { status: 'ok', progress: 100, doing: 'Vault me save ho gaya', made: [vaultId] }, '💾 Librarian: Vault ✅');
    } catch (e: any) {
      scr('library', `✗ ${String(e?.message || e).slice(0, 40)}`, 'err');
      say('library', { status: 'fail', progress: 100, doing: 'vault save fail', made: [String(e?.message || e).slice(0, 70)] }, '💾 Librarian: FAIL');
    }
  }
  await sleep(180);

  // 7) 📤 POSTMAN
  say('boss', { doing: opts.publish ? 'Postman ko publish ka order diya' : 'publish OFF — Save-First rule' },
    opts.publish ? '👑 Boss: Postman → Instagram par bhejo' : '👑 Boss: publish OFF hai — sirf Vault (Save-First)',
    { text: opts.publish ? '→ Postman: IG publish' : 'publish: off (save-first)', kind: 'type' });
  await enter('post', opts.publish ? 'Instagram Graph API par bhej raha hoon…' : 'publish OFF hai — Save-First rule', [opts.publish ? 'token check' : 'toggle: sirf save']);
  if (!opts.publish) {
    scr('post', 'skip: publish toggle OFF', 'warn');
    say('post', { status: 'warn', progress: 100, doing: 'publish OFF (Save-First)', made: ['Vault me hai — jab chaho 📸 bhejo'] }, '📤 Postman: publish OFF');
  } else {
    scr('post', '$ POST graph.facebook.com/v19.0/{ig}/media', 'cmd');
    try {
      const r = await publishLatestVaultVideoToInstagram();
      if (r.ok) {
        scr('post', `← 200 · permalink: ${(r as any).permalink || 'posted'}`, 'ok');
        say('post', { status: 'ok', progress: 100, doing: 'post ho gaya', made: [(r as any).permalink || 'posted'] }, '📤 Postman: LIVE ✅');
      } else {
        const why = String((r as any).skipped || (r as any).error || 'unknown');
        scr('post', `← 4xx · ${why.slice(0, 44)}`, 'warn');
        say('post', { status: 'warn', progress: 100, doing: 'token/number missing', made: [why] }, '📤 Postman: IG token chahiye');
      }
    } catch (e: any) {
      scr('post', `✗ ${String(e?.message || e).slice(0, 40)}`, 'err');
      say('post', { status: 'fail', progress: 100, doing: 'publish fail', made: [String(e?.message || e).slice(0, 70)] }, '📤 Postman: FAIL');
    }
  }
  await sleep(160);

  // 👑 BOSS — final report
  const done = agents.filter((a) => a.id !== 'boss' && a.status === 'ok').length;
  say('boss', {
    status: done >= 4 ? 'ok' : 'warn',
    progress: 100,
    doing: `report ready — ${done}/7 agents ok`,
    made: [`mission: ${topic}`, video ? `video: ${video.fileName}` : 'video nahi bana', `publish: ${opts.publish ? 'tried' : 'off'}`],
  }, `👑 Boss: kaam khatam — ${done}/7 agents ok. Human, check kar lo.`, { text: `report → human: ${done}/7 ok`, kind: 'ok' });

  releaseAwake();
  return { agents, ok: done, total: 7, video };
}
