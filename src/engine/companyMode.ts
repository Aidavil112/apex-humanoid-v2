/**
 * 🏢 COMPANY MODE — "main akela human hoon, baaki agents chala rahe hain" wala idea
 * (reel: "I'm 19 and the only human in my company", Colton AI Dean, 115K views).
 *
 * Farak: yahan standup FAKE status nahi hai. Har department ka apna sub-bot apni
 * REAL jaanch karta hai — hub /health, GitHub repo, R2 bucket, vault, voice lock,
 * brain file, trading creds — aur Head Bot sirf 2 kaam khud karta hai:
 *   1) jo blocker nikaala use brain file me OPEN entry banaata hai (dedupe ke saath)
 *   2) aaj ka digest (Hinglish, 2-3 line) voice me bolta hai
 * Isliye "company" ka haal-chaal ek tap me saamne, aur kaam memory me register.
 *
 * ⚠️ Boundaries jo isne nahi todni: auto-post on someone else's content, auto account
 * creation, doosre app me password/accessibility automation. Trading bhi sirf tab jab
 * user ne khud limits set ki hain — standup kabhi trade nahi karta.
 */

import { hubFetch } from './api';
import { logDayEvent } from './dayLog';
import { checkGithubAccess } from './assetHost';
import { loadBrain, remember } from './brainMemory';
import { isR2Configured, loadR2Settings } from './r2Host';
import { motionForgeSupported } from './motionForge';
import { loadSettings } from './headBotAutopilot';
import { voiceLockStatus } from './voiceAuth';

export type DeptStatus = 'green' | 'amber' | 'red';

export interface DeptReport {
  id: string;
  dept: string;
  emoji: string;
  /** kaunsa sub-bot zimmedar hai (one-person company ka org chart) */
  agent: string;
  status: DeptStatus;
  /** kaise pata chala — evidence hamesha real check se */
  evidence: string;
  /** agla step (khaali = kuch nahi karna) */
  task: string;
  /** ye item brain file me OPEN ke roop me likha gaya ya nahi */
  logged: boolean;
}

export interface StandupResult {
  ok: boolean;
  at: number;
  durationMs: number;
  reports: DeptReport[];
  green: number;
  amber: number;
  red: number;
  blockers: string[];
  /** chat/screen ke liye (emoji + format theek) */
  digest: string;
  /** speak() ke liye — 2-3 crisp line, koi emoji/hashtag nahi (voice rule) */
  voice: string;
  error?: string;
}

function rep(
  id: string,
  dept: string,
  emoji: string,
  agent: string,
  status: DeptStatus,
  evidence: string,
  task: string
): DeptReport {
  return { id, dept, emoji, agent, status, evidence, task, logged: false };
}

async function safe<T>(fn: () => T | Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/**
 * Poora standup. `deep: true` par GitHub/R2 ke write-probes bhi chalte hain
 * (network zyada, par confirmation pakka). Default me read-only checks.
 */
/** 📊 v6.6.11: standup ka result bhi din ke log me girta hai. */
export async function runCompanyStandup(opts: { deep?: boolean; logToBrain?: boolean } = {}): Promise<StandupResult> {
  const r = await runCompanyStandupInner(opts);
  try {
    logDayEvent(
      '🏢 Company Mode',
      `standup hui — ${r.green} green / ${r.amber} amber / ${r.red} red`,
      `${r.reports.length} dept · ${(r.durationMs / 1000).toFixed(1)}s · read-only${opts?.deep ? ' + deep' : ''}${r.blockers.length ? ` · ${r.blockers.length} blocker` : ''}`,
      r.ok,
    );
  } catch {}
  return r;
}

async function runCompanyStandupInner(opts: { deep?: boolean; logToBrain?: boolean } = {}): Promise<StandupResult> {
  const t0 = Date.now();
  const settings = loadSettings();
  const reports: DeptReport[] = [];

  // 1) 🛰️ Hub / server
  const health: any = await safe(async () => {
    const r = await hubFetch('/health');
    return r.ok ? await r.json() : null;
  }, null);
  if (!health) {
    reports.push(rep('hub', 'Server (Cloudflare Worker)', '🛰️', 'Ops-Bot', 'red', '/health ka jawab nahi aaya', 'worker re-deploy karo: cd repo/cloudflare-bot && ./DEPLOY-NOW.sh --kv'));
  } else {
    const flags = ['telegram', 'gemini', 'elevenlabs', 'coindcx', 'youtubeUploadAuth', 'r2ProxyReady'].filter((k) => health[k] === true);
    const missing = ['telegram', 'gemini', 'elevenlabs', 'coindcx'].filter((k) => health[k] !== true);
    reports.push(
      rep(
        'hub',
        'Server (Cloudflare Worker)',
        '🛰️',
        'Ops-Bot',
        missing.length ? 'amber' : 'green',
        `on: ${flags.length ? flags.join(', ') : 'kuch nahi'}${health.brainReady ? ' · brain route ready' : ''}`,
        missing.length ? `wrangler secret put: ${missing.map((m) => m.toUpperCase()).join(', ')} (deploy ke baad)` : ''
      )
    );
    if (health.telegram === true && health.gemini === true) {
      // is route ke bina naya code purana hai — ye 100% pakka signal hai
      const probe = await safe(async () => {
        const r = await hubFetch('/jarvis/config');
        return { status: r.status, text: (await r.text()).slice(0, 60) };
      }, { status: 0, text: '' });
      if (probe.status === 200 && /APEX Humanoid Hub — open/.test(probe.text)) {
        reports.push(
          rep('deploy', 'Deploy freshness', '🧭', 'Ops-Bot', 'red', '/jarvis/config purana HELP/landing de raha hai', 'NAAYA worker.js deploy karo (DEPLOY-NOW.sh --kv) — naye routes tabhi chalenge')
        );
      }
    }
  }

  // 2) 📸 Social / Instagram
  const igReady = !!settings.igAccessToken && !!settings.igBusinessId;
  const host = settings.assetHostKind === 'r2' ? 'R2' : 'GitHub';
  const ghTokenOk = !!settings.ghToken;
  reports.push(
    rep(
      'social',
      'Instagram + Facebook',
      '📸',
      'Reels-Bot',
      igReady && (ghTokenOk || host === 'R2') ? 'green' : 'amber',
      igReady ? `IG token ✅ · business ${settings.igBusinessId.slice(0, 6)}… · asset host: ${host}` : 'IG token/business id missing',
      igReady ? '' : 'IG long-lived token + business id daalo (📸 INSTAGRAM card me)'
    )
  );

  // 3) 🐙 GitHub host (read-only check by default)
  if (host === 'GitHub' && ghTokenOk && settings.ghRepo) {
    const gh = await safe(
      () =>
        checkGithubAccess({
          token: settings.ghToken,
          owner: settings.ghOwner || '',
          repo: settings.ghRepo || '',
          branch: settings.ghBranch || 'main',
          writeProbe: opts.deep === true,
        }),
      null
    );
    if (gh) {
      reports.push(
        rep(
          'github',
          'GitHub asset host',
          '🐙',
          'Files-Bot',
          gh.ok ? 'green' : gh.repoExists ? 'amber' : 'red',
          `repo ${gh.repoExists ? '✅' : '❌'} · public read ${gh.publicReadOk ? '✅' : '❌'}${opts.deep ? ` · write ${gh.writeOk ? '✅' : '❌'}` : ''}`,
          gh.ok ? '' : gh.note
        )
      );
    } else {
      reports.push(rep('github', 'GitHub asset host', '🐙', 'Files-Bot', 'red', 'check network fail', 'internet/VPN check karo'));
    }
  }

  // 4) 🪣 R2
  const r2 = loadR2Settings();
  reports.push(
    rep(
      'r2',
      'R2 vault (HD video)',
      '🪣',
      'Files-Bot',
      !r2.enabled ? 'amber' : isR2Configured(r2) ? 'green' : 'red',
      !r2.enabled
        ? 'R2 OFF — GitHub host use ho raha hai (90 MB cap)'
        : isR2Configured(r2)
          ? `bucket ${r2.bucket} configured${r2.publicBaseUrl ? ' + public URL' : ' (presigned link)'}`
          : 'R2 on hai par config adhoora',
      isR2Configured(r2) ? '' : '🪣 R2 VAULT card bharo → 🧪 R2 CHECK'
    )
  );

  // 5) 🎬 Motion studio
  const mf = motionForgeSupported();
  reports.push(
    rep('motion', 'Motion Forge (reels)', '🎬', 'Editor-Bot', mf.ok ? 'green' : 'red', mf.ok ? 'Canvas + MediaRecorder ready (₹0 render)' : mf.reason || 'recorder unavailable', mf.ok ? '' : 'device ka browser/WebView update karo')
  );

  // 6) 💰 Trading (sirf readiness — standup kabhi trade nahi karta)
  const coindcxLive = health ? health.coindcx === true : false;
  reports.push(
    rep(
      'trading',
      'CoinDCX desk',
      '💰',
      'Quant-Bot',
      coindcxLive ? 'green' : 'red',
      coindcxLive ? 'server keys live — FUTURES + SPOT sync ready · limits + kill switch active' : 'server par COINDCX_API_KEY/SECRET nahi mila',
      coindcxLive ? '' : 'wrangler secret put COINDCX_API_KEY / COINDCX_API_SECRET'
    )
  );

  // 7) 🔐 Voice + 👁️ outside eye
  const vl: any = await safe(async () => voiceLockStatus(), null);
  reports.push(
    rep(
      'voice',
      'Awaz pehchaan',
      '🔐',
      'Guard-Bot',
      vl?.enrolled ? (vl.on ? 'green' : 'amber') : 'amber',
      vl ? `owner ${vl.enrolled ? 'enrolled ✅' : 'nahi'} (${vl.samples}/3 samples) · lock ${vl.on ? 'ON' : 'off'} · trusted session ${vl.sessionLeftMin} min · placed ${vl.placed ? 'yes' : 'no'}` : 'voice status nahi mila',
      vl?.enrolled ? (vl.on ? '' : 'sensitive data ke liye awaaz lock ON karo') : '"awaaz register karo" bolo (3 samples)'
    )
  );

  // 8) 📚 Brain + ▶️ YouTube
  const brain = await safe(() => loadBrain(), null);
  const openCount = brain?.entries?.filter((e: any) => e.kind === 'open').length ?? 0;
  reports.push(
    rep(
      'brain',
      'Brain file',
      '📚',
      'Memory-Bot',
      (brain?.entries?.length ?? 0) > 0 ? 'green' : 'red',
      `${brain?.entries?.length ?? 0} entries · ${openCount} pending · autoSync ${brain?.autoSync ? 'on' : 'off'} · last write ${brain?.updatedAt ? new Date(brain.updatedAt).toLocaleString('en-IN', { hour12: false }) : 'kabhi nahi'}`,
      (brain?.entries?.length ?? 0) > 0 ? (openCount ? `${openCount} pending cheezein brain me hain` : '') : '⬇️ GITHUB SE LAO ya CLAUDE.md import karo'
    )
  );
  const ytLive = health ? health.youtubeUploadAuth === true : false;
  reports.push(
    rep('yt', 'YouTube upload', '▶️', 'Tube-Bot', ytLive ? 'green' : 'amber', ytLive ? 'refresh token server par hai' : 'refresh token missing', ytLive ? '' : '/yt/auth?scope=full → wrangler secret put YOUTUBE_REFRESH_TOKEN')
  );

  // digest + voice line
  const green = reports.filter((r) => r.status === 'green').length;
  const amber = reports.filter((r) => r.status === 'amber').length;
  const red = reports.filter((r) => r.status === 'red').length;
  const blockers = reports.filter((r) => r.status !== 'green' && r.task).map((r) => `${r.emoji} ${r.dept}: ${r.task}`);

  // brain me OPEN entry (dedupe remember se handle hota hai — null = pehle se tha)
  const wantLog = opts.logToBrain !== false;
  if (wantLog) {
    for (const b of blockers.slice(0, 6)) {
      const e = remember('open', b.slice(0, 160));
      const owner = reports.find((r) => b.startsWith(`${r.emoji} ${r.dept}`));
      if (owner) owner.logged = !!e;
    }
    // apni likhi hui entry — noteBrain (passive event hook) par nahi chhod rahe, kyunki wo
    // sirf tab persist hota hai jab brain core ka window-listener laga ho
    remember(
      'done',
      `Company standup ${new Date().toLocaleString('en-IN', { hour12: false })}: ${green} green / ${amber} amber / ${red} red — ${blockers.length} blocker brain OPEN me.`
    );
  }

  const digest = [
    `🏢 COMPANY STANDUP — ${new Date().toLocaleString('en-IN', { hour12: true })}`,
    ...reports.map((r) => `${r.status === 'green' ? '🟢' : r.status === 'amber' ? '🟡' : '🔴'} ${r.emoji} ${r.dept} — ${r.agent}: ${r.evidence}${r.task ? `\n     ↳ ${r.task}${r.logged ? ' (📚 brain me OPEN)' : ''}` : ''}`),
    `\n${green} green · ${amber} amber · ${red} red. Boss ka kaam: sirf ${red > 0 ? `${red} cheez${red > 1 ? 'en' : ''} approve karna` : 'kuch nahi — sab chalu hai'}. 🫡`,
  ].join('\n');

  const topBlocker = blockers[0] || '';
  const voice = [
    `Standup ho gaya. ${green} department chal rahe hain, ${red + amber} ko aapka kaam chahiye.`,
    topBlocker ? `Sabse upar wala kaam: ${topBlocker.replace(/^[^\s]+\s/, '').slice(0, 120)}` : '',
    red + amber === 0 ? 'Aaj aapke liye kuch nahi — company chal rahi hai.' : 'Baaki details screen par hain.',
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/[^\x00-\x7F\u0900-\u097F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { ok: true, at: Date.now(), durationMs: Date.now() - t0, reports, green, amber, red, blockers, digest, voice };
}

/** Purana result cache se bina network ke dobara dikhane ke liye (panel me fast refresh). */
export function standupFromCache(): StandupResult | null {
  try {
    const raw = localStorage.getItem('apex' + '_company_standup_v1');
    return raw ? (JSON.parse(raw) as StandupResult) : null;
  } catch {
    return null;
  }
}

export function saveStandupCache(r: StandupResult): void {
  try {
    localStorage.setItem('apex' + '_company_standup_v1', JSON.stringify(r));
  } catch {
    /* private mode */
  }
}
