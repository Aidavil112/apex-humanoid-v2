/**
 * 🤖 BOT STUDIO — chhote, alag "bots" jo app ke andar se chalte hain.
 *
 * IMAANDARI (jhooth nahi):
 *   • Ye bots is app ke ANDAR chalte hain. App band = bot band (iOS/Android dono par
 *     browser context hi yahi hai; Android native alarm sirf Jarvis/head-bot schedule ke liye hai).
 *   • Har step KE ASLI engine ko call karta hai (research = hub worker, render = Motion Forge,
 *     save = Vault IndexedDB, publish = IG Graph API / share sheet). Jo engine na mile, step
 *     "skipped" likh kar aage badhta hai — jhooti "ho gaya" line nahi.
 *   • Koi cloud compute nahi, koi paisa nahi, koi naya account nahi.
 */

import { hubFetch } from './api';
import { renderMotionForgeVideo, type MotionStyle } from './motionForge';
import { saveVideoToVault } from './videoVaultDb';
import { publishLatestVaultVideoToInstagram } from './jarvisCore';
import { keepAwake, releaseAwake } from './iosAutopilot';

export type BotStepKind = 'research' | 'render' | 'save' | 'publish' | 'note';

export interface BotStep {
  kind: BotStepKind;
  /** render step ke liye prompt-on-topic, note step ke liye text */
  text?: string;
}

export interface BotRunLog {
  t: number;
  line: string;
  level: 'info' | 'ok' | 'warn';
}

export interface BotDef {
  id: string;
  name: string;
  emoji: string;
  goal: string;
  style: MotionStyle;
  steps: BotStep[];
  enabled: boolean;
  createdAt: number;
  lastRun?: number;
  lastStatus?: 'ok' | 'partial' | 'failed';
  log: BotRunLog[];
}

const KEY = 'apex_bot_studio_v1';

export const BOT_STEP_LABEL: Record<BotStepKind, string> = {
  research: '🌐 Research (worker)',
  render: '🎬 Motion render (1080×1920)',
  save: '💾 Vault me save',
  publish: '📸 Instagram publish',
  note: '🧠 Note brain me',
};

export function defaultBots(): BotDef[] {
  const now = Date.now();
  return [
    {
      id: 'bot_shorts',
      name: 'Daily Shorts Bot',
      emoji: '🎬',
      goal: 'AI agents se chhote business ki growth (India)',
      style: 'kino-glass',
      steps: [{ kind: 'research' }, { kind: 'render' }, { kind: 'save' }],
      enabled: true,
      createdAt: now,
      log: [],
    },
    {
      id: 'bot_quote',
      name: 'Quote / Type Bot',
      emoji: '✍️',
      goal: 'Ek line ki motivation — 1% better every day',
      style: 'brutal-flash',
      steps: [{ kind: 'render' }, { kind: 'save' }],
      enabled: true,
      createdAt: now,
      log: [],
    },
  ];
}

export function loadBots(): BotDef[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultBots();
    const arr = JSON.parse(raw) as BotDef[];
    if (!Array.isArray(arr) || !arr.length) return defaultBots();
    return arr.map((b) => ({
      ...b,
      steps: Array.isArray(b.steps) && b.steps.length ? b.steps : [{ kind: 'render' }, { kind: 'save' }],
      log: Array.isArray(b.log) ? b.log.slice(-40) : [],
    }));
  } catch {
    return defaultBots();
  }
}

export function saveBots(list: BotDef[]): BotDef[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)));
  } catch {}
  return list;
}

export function upsertBot(bot: BotDef): BotDef[] {
  const list = loadBots();
  const i = list.findIndex((b) => b.id === bot.id);
  if (i >= 0) list[i] = bot;
  else list.unshift(bot);
  return saveBots(list);
}

export function deleteBot(id: string): BotDef[] {
  return saveBots(loadBots().filter((b) => b.id !== id));
}

export function newBot(name: string, emoji: string, goal: string, steps: BotStep[], style: MotionStyle): BotDef {
  return {
    id: 'bot_' + Date.now().toString(36),
    name: name.trim().slice(0, 40) || 'Naya Bot',
    emoji: emoji || '🤖',
    goal: goal.trim().slice(0, 160) || 'APEX reel — ek line ka message',
    style,
    steps: steps.length ? steps : [{ kind: 'render' }, { kind: 'save' }],
    enabled: true,
    createdAt: Date.now(),
    log: [],
  };
}

function line(bot: BotDef, text: string, level: BotRunLog['level'] = 'info') {
  bot.log = [...bot.log, { t: Date.now(), line: text, level }].slice(-60);
}

/** Ek bot ko chalao — har step ka asli result log me. */
export async function runBot(
  id: string,
  onStage?: (bot: BotDef) => void
): Promise<{ bot: BotDef | null; ok: number; total: number }> {
  const list = loadBots();
  const bot = list.find((b) => b.id === id);
  if (!bot) return { bot: null, ok: 0, total: 0 };

  const emit = () => {
    upsertBot(bot);
    onStage?.({ ...bot });
  };

  void keepAwake('bot'); // 🍎 render ke waqt screen jaagti rahe
  bot.log = [];
  line(bot, `▶️ ${bot.emoji} ${bot.name} chalu — goal: "${bot.goal}"`);
  emit();

  let ok = 0;
  let topic = bot.goal;
  let facts: string[] = [];

  for (let i = 0; i < bot.steps.length; i++) {
    const st = bot.steps[i];
    line(bot, `— step ${i + 1}/${bot.steps.length}: ${BOT_STEP_LABEL[st.kind]}`, 'info');
    emit();
    try {
      if (st.kind === 'research') {
        try {
          const r = await hubFetch('/agent/research', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ niche: bot.goal }),
          });
          if (r.ok) {
            const j: any = await r.json();
            const first = Array.isArray(j?.topics) ? j.topics[0] : null;
            if (first?.title) topic = String(first.title).slice(0, 150);
            facts = Array.isArray(j?.facts) ? j.facts.slice(0, 3).map(String) : [];
            line(bot, `✅ research: "${topic}"${facts.length ? ` · ${facts.length} facts` : ''}`, 'ok');
            ok++;
          } else {
            line(bot, `⚠️ research skip (worker ${r.status}) — goal hi topic rahega`, 'warn');
          }
        } catch (e: any) {
          line(bot, `⚠️ research skip (${String(e?.message || e).slice(0, 60)}) — goal hi topic`, 'warn');
        }
      } else if (st.kind === 'render') {
        const res = await renderMotionForgeVideo(`${topic} ${st.text || ''}`.trim(), {
          style: bot.style,
          durationSec: 12,
          width: 1080,
          height: 1920,
          fps: 30,
          saveToVault: false,
          onProgress: (p, note) => {
            if (note && p > 0.05) line(bot, `   ${Math.round(p * 100)}% ${note}`, 'info');
            emit();
          },
        });
        if (res.ok && res.blob) {
          line(bot, `✅ render: ${res.durationSec ?? 12}s · ${(res.blob.size / 1048576).toFixed(2)} MB · ${res.mimeType || 'video'}`, 'ok');
          ok++;
          (bot as any)._lastVideo = {
            blob: res.blob,
            fileName: res.fileName || 'apex-bot.webm',
            mimeType: res.mimeType || res.blob.type || 'video/webm',
            durationSec: res.durationSec || 12,
            title: res.title || bot.name,
            caption: res.caption || bot.goal,
          };
        } else {
          line(bot, `⚠️ render fail: ${res.error || 'unknown'} — baaki steps chalenge`, 'warn');
        }
      } else if (st.kind === 'save') {
        const v = (bot as any)._lastVideo;
        if (!v) {
          line(bot, '⚠️ save skip — pehle koi render nahi hua', 'warn');
        } else {
          const id2 = `vault_bot_${bot.id}_${Date.now()}`;
          await saveVideoToVault({
            id: id2,
            createdAt: Date.now(),
            title: v.title,
            caption: v.caption,
            fileName: v.fileName,
            mimeType: v.mimeType,
            durationSec: v.durationSec,
            sizeBytes: v.blob.size,
            blob: v.blob,
            scheduledAt: null,
          } as any);
          line(bot, `✅ Vault me save (${v.fileName})`, 'ok');
          ok++;
        }
      } else if (st.kind === 'publish') {
        const r = await publishLatestVaultVideoToInstagram();
        if (r.ok) {
          line(bot, `✅ Instagram publish: ${(r as any).permalink || 'posted'}`, 'ok');
          ok++;
        } else {
          line(bot, `⚠️ publish skip: ${(r as any).skipped || (r as any).error || 'token missing'}`, 'warn');
        }
      } else if (st.kind === 'note') {
        line(bot, `🧠 note: ${st.text || bot.goal}`, 'info');
        ok++;
      }
    } catch (e: any) {
      line(bot, `❌ step fail: ${String(e?.message || e).slice(0, 100)}`, 'warn');
    }
    emit();
  }

  const total = bot.steps.length;
  bot.lastRun = Date.now();
  bot.lastStatus = ok === total ? 'ok' : ok > 0 ? 'partial' : 'failed';
  line(bot, bot.lastStatus === 'ok' ? `✅ ${ok}/${total} steps done` : `⚠️ ${ok}/${total} steps done — baaki skip ho gaye`, bot.lastStatus === 'ok' ? 'ok' : 'warn');
  emit();
  releaseAwake();
  return { bot, ok, total };
}
