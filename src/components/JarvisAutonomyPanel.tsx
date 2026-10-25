/**
 * 🛰️ JARVIS AUTONOMY CORE PANEL — "Khud ka system"
 * Boss ko ek bhi order nahi dena: live research → video → save → publish →
 * comments padhna → AI reply → market cycle (sub-bots research → Head Bot khud BUY/SELL).
 * Sab kuch limits + kill switch ke andar, sirf aapke APNE content/accounts par.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apexCopy, apexOpen, apexPaste } from '../engine/nativeUi';
import { bundledClipList, probeBundledClips, type BundledClip } from '../engine/bundledVideos';
import { daySummary, logDayEvent, type DaySummary } from '../engine/dayLog';
import { isSmoothMode, setSmoothMode } from '../engine/perfMode';
import { resetVoiceLock, runVoiceDoctor, type VoiceCheckRow } from '../engine/voiceDoctor';
import {
  addTarget,
  getTradingExecutor,
  armSlotAlarms,
  humanNextRun,
  loadState,
  patrolTarget,
  removeTarget,
  saveState,
  syncOwnInstagramMedia,
  toggleCore,
  type JarvisSlot,
  type JarvisState,
} from '../engine/jarvisCore';
import { loadSettings, resumeInterruptedMissions, runMissionNow, saveSettings } from '../engine/headBotAutopilot';
import { iosAutopilotNote, isAppleTouch, keepAwake, releaseAwake, wakeLockState, wakeLockSupported } from '../engine/iosAutopilot';
import { publishLatestVaultVideoToInstagram } from '../engine/jarvisCore';
import { hubFetch } from '../engine/api';
import { checkGithubAccess } from '../engine/assetHost';
import {
  describeMotionBrief,
  motionForgeSupported,
  parseMotionBrief,
  renderMotionForgeVideo,
  type MotionStyle,
} from '../engine/motionForge';
import { runCompanyStandup, saveStandupCache, standupFromCache, type StandupResult } from '../engine/companyMode';
import { describeBuild, selfCheck, type SelfCheckResult } from '../engine/buildInfo';
import { listVaultVideos, type SavedVaultVideo } from '../engine/videoVaultDb';
import {
  checkR2Access,
  describeR2,
  ensureR2Cors,
  loadR2Settings,
  parseR2Paste,
  r2CredentialCandidates,
  saveR2Settings,
  type R2Settings,
} from '../engine/r2Host';
import {
  clearVoicePrint,
  enrollOwner,
  loadVoiceLock,
  saveVoiceLock,
  verifyOwnerNow,
  voiceLockStatus,
  isSensitiveText,
  isOwnerPlaced,
} from '../engine/voiceAuth';
import { runOutsideEye } from '../engine/outsideEye';
import {
  clearBrainSection,
  exportBrainMarkdown,
  forgetBrain,
  loadBrain,
  pullBrainFromGithub,
  pullBrainFromWorker,
  pushBrainToWorker,
  readBrainLock,
  remember as rememberBrain,
  saveBrain,
  syncBrainToGithub,
  writeBrainLock,
  type BrainFile,
  type BrainKind,
} from '../engine/brainMemory';

const KIND_ICON: Record<JarvisSlot['kind'], string> = {
  market: '📰',
  research: '🌐',
  content: '🎬',
  engagement: '💬',
};

export const JarvisAutonomyPanel: React.FC<{
  onToast: (m: string) => void;
  onRunResearchCycle?: (why: string) => Promise<{ traded: boolean; note: string }> | void;
}> = ({ onToast, onRunResearchCycle }) => {
  const [st, setSt] = useState<JarvisState>(() => loadState());
  const [linkInput, setLinkInput] = useState('');
  const [patrolling, setPatrolling] = useState(false);
  const [cycleBusy, setCycleBusy] = useState(false);
  const [srv, setSrv] = useState<{ ok: boolean; enabled?: boolean; note?: string; repliesToday?: number; kvReady?: boolean; ytAuth?: boolean; error?: string }>({ ok: false });
  const [srvBusy, setSrvBusy] = useState(false);

  // 🔐 VOICE LOCK state
  const [vlock, setVlock] = useState(() => ({ ...loadVoiceLock(), ...voiceLockStatus() }));
  const [veBusy, setVeBusy] = useState('');
  const [eyeText, setEyeText] = useState('');
  const [eyeBusy, setEyeBusy] = useState(false);
  const refreshVoice = useCallback(() => setVlock({ ...loadVoiceLock(), ...voiceLockStatus() }), []);
  useEffect(() => {
    const t = window.setInterval(refreshVoice, 5000);
    return () => window.clearInterval(t);
  }, [refreshVoice]);

  // 📚 BRAIN FILE state
  const [brain, setBrain] = useState<BrainFile>(() => loadBrain());
  const [brainNote, setBrainNote] = useState('');
  const [brainKind, setBrainKind] = useState<BrainKind>('rule');
  const [brainShow, setBrainShow] = useState(false);
  const [brainBusy, setBrainBusy] = useState('');
  const [brainLock, setBrainLock] = useState(() => readBrainLock());
  const brainMd = brainShow ? exportBrainMarkdown() : '';

  const pullServer = useCallback(async () => {
    try {
      const r = await hubFetch('/jarvis/config');
      const j: any = await r.json().catch(() => ({}));
      setSrv({
        ok: Boolean(j?.ok),
        enabled: Boolean(j?.state?.enabled),
        note: String(j?.state?.lastNote || ''),
        repliesToday: Number(j?.state?.repliesToday || 0),
        kvReady: Boolean(j?.kvReady),
        ytAuth: Boolean(j?.ytAuth),
      });
    } catch (e: any) {
      setSrv({ ok: false, error: String(e?.message || 'worker offline') });
    }
  }, []);

  useEffect(() => {
    void pullServer();
  }, [pullServer]);

  const refresh = useCallback(() => {
    setSt(loadState());
    setBrain(loadBrain());
  }, []);

  useEffect(() => {
    const t = window.setInterval(refresh, 6000);
    window.addEventListener('apex:jarvis-log', refresh);
    window.addEventListener('apex:brain-update', refresh as EventListener);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('apex:brain-update', refresh as EventListener);
      window.removeEventListener('apex:jarvis-log', refresh);
    };
  }, [refresh]);

  const [igSettings, setIgSettings] = useState(() => loadSettings());
  const [ghCheck, setGhCheck] = useState<{ ok: boolean; note: string; repoExists?: boolean; writeOk?: boolean; publicReadOk?: boolean } | null>(null);
  const [ghBusy, setGhBusy] = useState(false);
  // 🪣 R2 (Cloudflare object host) — GitHub host ka bada-bhai, 10 GB free
  const [r2, setR2] = useState<R2Settings>(() => loadR2Settings());
  const [r2Paste, setR2Paste] = useState('');
  const [r2Busy, setR2Busy] = useState(false);
  const [r2Report, setR2Report] = useState<null | {
    ok: boolean;
    note: string;
    credsOk?: boolean;
    bucketExists?: boolean;
    writeOk?: boolean;
    publicReadOk?: boolean;
    buckets?: string[];
    matchedLabel?: string;
  }>(null);
  const patchR2 = (patch: Partial<R2Settings>) => setR2(saveR2Settings(patch));
  // 🎛️ REEL ENGINE — Head Bot ka video source (auto/motion/footage) + ek tap me auto reel
  const [autoReelBusy, setAutoReelBusy] = useState(false);
  const [screenLock, setScreenLock] = useState<'on' | 'off' | 'unsupported'>(() => wakeLockState());
  const [autoReelLine, setAutoReelLine] = useState('');
  const [autoPublish, setAutoPublish] = useState(false);
  // 🎬 Motion Forge (prompt → cinematic reel, device par render)
  const [mfPrompt, setMfPrompt] = useState('');
  const [mfStyle, setMfStyle] = useState<MotionStyle | 'auto'>('auto');
  const [mfBusy, setMfBusy] = useState(false);
  const [mfPct, setMfPct] = useState(0);
  const [mfOut, setMfOut] = useState<{ ok: boolean; text: string; vaultId?: string } | null>(null);
  const [mfUrl, setMfUrl] = useState('');
  // 🏢 Company mode (departments ka live standup)
  const [standup, setStandup] = useState<StandupResult | null>(() => standupFromCache());
  const [suBusy, setSuBusy] = useState(false);
  const [suDeep, setSuDeep] = useState(false);
  // 🔎 build self-check + 📁 saare videos isi panel me (koi alag page nahi)
  const [chk, setChk] = useState<SelfCheckResult | null>(null);
  const [chkBusy, setChkBusy] = useState(false);
  const [videoHub, setVideoHub] = useState(false);
  const [hubVids, setHubVids] = useState<Array<SavedVaultVideo & { previewUrl: string }>>([]);
  const [playing, setPlaying] = useState<string>('');
  // 📦 app ke andar ke clips (motion_videos/clip_*.webm) — pehle ye gine hi nahi jaate the
  // ⚠️ count 0 na dikhe isliye list turant (sync) bhar dete hain; size baad me probe hota hai
  const [appVids, setAppVids] = useState<BundledClip[]>(() => bundledClipList());
  const loadHub = async () => {
    const items = await listVaultVideos().catch(() => [] as SavedVaultVideo[]);
    setHubVids(items.map((v) => ({ ...v, previewUrl: URL.createObjectURL(v.blob) })) as any);
    try {
      const probed = await probeBundledClips();
      setAppVids(probed.length ? probed : bundledClipList());
    } catch {
      setAppVids(bundledClipList());
    }
  };
  // 📊 din bhar ka kaam (kaun · kya · kaise · theek/atka)
  const [dl, setDl] = useState<DaySummary | null>(null);
  const [dlOpen, setDlOpen] = useState(false);
  const [dlBusy, setDlBusy] = useState(false);
  const refreshDl = (open = true) => {
    setDl(daySummary());
    if (open) setDlOpen(true);
  };
  useEffect(() => {
    const h = () => setDl(daySummary());
    window.addEventListener('apex:day-log', h as EventListener);
    return () => window.removeEventListener('apex:day-log', h as EventListener);
  }, []);
  const [igBusy, setIgBusy] = useState(false);
  const settings = igSettings;

  const patchIg = (patch: Parameters<typeof saveSettings>[0]) => setIgSettings(saveSettings(patch));

  const setSlotTime = (id: string, patch: Partial<JarvisSlot>) => {
    const next = saveState({ slots: st.slots.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
    setSt(next);
    armSlotAlarms();
    onToast('⏰ Slot time update ho gaya — alarm bhi aage kar diya');
  };

  const addLink = () => {
    if (!linkInput.trim()) {
      onToast('Pehle reel/short ka link paste karein');
      return;
    }
    const t = addTarget(linkInput.trim());
    if (!t) {
      onToast('⚠️ Link samajh nahi aaya — Instagram reel ya YouTube shorts/watch ka link daaliye');
      return;
    }
    setLinkInput('');
    refresh();
    onToast(`🔗 ${t.label} patrol list me add ho gaya — ab main iske comments dekhunga`);
  };

  const patrolNow = async () => {
    if (!st.targets.length) {
      onToast('Pehle ek reel/short link add karein');
      return;
    }
    setPatrolling(true);
    try {
      let replied = 0;
      let drafted = 0;
      for (const t of st.targets) {
        const r = await patrolTarget(t, (line) => onToast(line));
        replied += r.replied;
        drafted += r.drafted;
      }
      refresh();
      onToast(`💬 Patrol done — ${replied} khud reply, ${drafted} draft ready`);
    } catch (e: any) {
      onToast(`⚠️ ${String(e?.message || e).slice(0, 120)}`);
    } finally {
      setPatrolling(false);
    }
  };

  const runCycle = async () => {
    const exec = onRunResearchCycle || getTradingExecutor();
    if (!exec) {
      onToast('⚠️ Trading engine abhi load nahi hua — ek baar Trading modal khol do');
      return;
    }
    setCycleBusy(true);
    try {
      const r: any = await exec('jarvis_panel');
      onToast(r?.note || '🛰️ Research cycle complete');
      refresh();
    } finally {
      setCycleBusy(false);
    }
  };

  const nextIst = humanNextRun(st);
  const autoPl = st.limits;

  // 📱 v6.6.10: PHONE FIX — lag (smooth mode) + voice doctor
  const [smooth, setSmoothUi] = useState<boolean>(() => isSmoothMode());
  const [vdRows, setVdRows] = useState<VoiceCheckRow[] | null>(null);
  const [vdGood, setVdGood] = useState(0);
  const [vdBusy, setVdBusy] = useState(false);
  // 🧭 SETUP card (worker/KV + R2 + GitHub PAT) — status, steps, ek-jagah actions
  const [setupStep, setSetupStep] = useState('');
  const [setupActBusy, setSetupActBusy] = useState('');
  const [setupProbe, setSetupProbe] = useState<{ note: string; kvReady?: boolean; ok?: boolean } | null>(null);

  // ⏳ 6.6.13 BUSY-GUARD — "button dabaya, kaam shuru hua, phir hamesha ⏳ me atak gaya"
  //    iska ilaaj: har busy-flag ka apna timer. Timeout par flag khud chhod dete hain
  //    (kaam background me jaari rahe to bhi button wapas zinda rahe) + user ko batate hain.
  const busyEntries: Array<[string, boolean, (v: boolean) => void]> = [
    ['🎙️ Voice doctor', vdBusy, setVdBusy],
    ['🔎 Self-check', chkBusy, setChkBusy],
    ['👁️ Bahar ki aankh', eyeBusy, setEyeBusy],
    ['🐙 GitHub', ghBusy, setGhBusy],
    ['🪣 R2', r2Busy, setR2Busy],
    ['🎬 Motion Forge', mfBusy, setMfBusy],
    ['☀️ Company standup', suBusy, setSuBusy],
    ['📸 Instagram post', igBusy, setIgBusy],
    ['🌙 Server night shift', srvBusy, setSrvBusy],
    ['🛰️ Research cycle', cycleBusy, setCycleBusy],
    ['📸 Reels patrol', patrolling, setPatrolling],
    ['📊 Day log', dlBusy, setDlBusy],
  ];
  const busyEntriesRef = useRef(busyEntries);
  busyEntriesRef.current = busyEntries;
  const busySinceRef = useRef<Record<string, number>>({});
  const [busyStuckCleared, setBusyStuckCleared] = useState<string[]>([]);
  const BUSY_TIMEOUT_MS = import.meta.env?.DEV ? 8000 : 55000;
  const clearAllBusy = useCallback(() => {
    const names: string[] = [];
    for (const [name, on, off] of busyEntriesRef.current) {
      if (on) {
        off(false);
        names.push(name);
      }
      busySinceRef.current[name] = 0;
    }
    if (names.length) {
      setBusyStuckCleared(names);
      onToast(`↺ ${names.length} atka hua kaam chhod diya — button ab dobara chalte hain`);
      try {
        logDayEvent('🛰️ Jarvis', 'atke hue kaam chhode (user ne ↺ dabaya)', names.join(', '), true);
      } catch {}
    } else {
      onToast('✅ Koi kaam atka hua nahi hai — sab button taiyar hain');
    }
  }, [onToast]);
  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now();
      const freed: string[] = [];
      for (const [name, on, off] of busyEntriesRef.current) {
        if (on) {
          if (!busySinceRef.current[name]) busySinceRef.current[name] = now;
          if (now - busySinceRef.current[name] > BUSY_TIMEOUT_MS) {
            off(false);
            busySinceRef.current[name] = 0;
            freed.push(name);
          }
        } else if (busySinceRef.current[name]) {
          busySinceRef.current[name] = 0;
        }
      }
      if (freed.length) {
        setBusyStuckCleared(freed);
        onToast(`⏳ ${freed.join(' · ')} ${Math.round(BUSY_TIMEOUT_MS / 1000)} second se atka tha — button chhod diye (kaam background me chal raha ho sakta hai)`);
        try {
          logDayEvent('🛰️ Jarvis', 'atka busy-flag khud chhoda', freed.join(', '), false);
        } catch {}
      }
      (window as any).__apexPanelBusy = () =>
        busyEntriesRef.current.filter(([, on]) => on).map(([n]) => n);
    }, 2000);
    (window as any).__apexPanelBusy = () => busyEntriesRef.current.filter(([, on]) => on).map(([n]) => n);
    // DEV-only: jsdom test isi se "kaam atak gaya" ki halat banata hai (ship build me nahi hota)
    if (import.meta.env?.DEV) {
      (window as any).__apexPanelStuck = () => {
        setSuBusy(true);
        busySinceRef.current['☀️ Company standup'] = Date.now() - (BUSY_TIMEOUT_MS + 900);
      };
    }
    return () => clearInterval(tick);
  }, [BUSY_TIMEOUT_MS, onToast]);

  // 🧭 SETUP — 3 kaam (worker+KV, R2, GitHub PAT) ki asli halat + micro-steps.
  //    Rule: sab Jarvis ke andar — isliye yahin status, link, command aur samjhao;
  //    niche wale cards se state share karte hain (ek hi system, do jagah nahi).
  const r2Filled = Boolean(r2.enabled && r2.endpoint && r2.bucket && r2.accessKeyId && r2.secretAccessKey);
  const GH_CMD = 'bash tools/push-github.sh <PAT>   # repo folder me, PC par';
  const WR_CMD = 'cd cloudflare-bot && ./DEPLOY-NOW.sh --kv';
  const R2_TEMPLATE = ['endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com', 'bucket:   apex', 'access:   <Access Key ID>', 'secret:   <Secret Access Key>', 'public:   https://pub-<xxxx>.r2.dev'].join('\n');
  const SETUP_ROWS = [
    {
      id: 'worker',
      title: '1️⃣ ☁️ WORKER + KV (server — night shift, brain, IG queue yahi chalta hai)',
      ok: Boolean(srv.ok && srv.kvReady),
      note: !srv.ok
        ? `Worker reachable nahi (${srv.error || 'unknown'}) — pehle ` + '🔄 CHECK KARO'
        : srv.kvReady
          ? `KV ready ✅ · replies aaj: ${srv.repliesToday ?? 0}${srv.enabled ? ' · night shift ON' : ' · night shift OFF (app se ON karo)'}`
          : '⚠️ APEX_KV binding nahi — /jarvis/brain "binding missing" deta hai (aaj napā)',
      linkLabel: 'CLOUDFLARE KHOLO',
      link: 'https://dash.cloudflare.com/',
      copy: WR_CMD,
      copyName: 'DEPLOY COMMAND',
      actionLabel: '🔄 LIVE CHECK',
      say: 'Server ka kaam do cheez me hai. Ek: dash.cloudflare.com par KV namespace banao, naam APEX KV. Do: Workers and Pages me apex-humanoid-v2 kholo, settings me bindings me KV add karo, variable name APEX KV, phir code tab me worker.js ka naya content paste karke save and deploy dabao. App me wapas aakar ye check button dabaao, green ho jayega.',
      action: async () => {
        await pullServer();
      },
      steps: [
        'https://dash.cloudflare.com → left menu → Storage & Databases → KV → Create a namespace → naam: APEX_KV → Create (ID copy kar lo, dashboard ko chahiye nahi — bas bind karna hai).',
        'Workers & Pages → apex-humanoid-v2 → Settings → Bindings → Add → KV namespace → Variable name: APEX_KV → KV namespace: APEX_KV → Save and Deploy.',
        'Code tab → box me pura select-all (Ctrl+A) delete karo → repo ke cloudflare-bot/worker.js ka sara content paste karo → Save and Deploy. (Koi line mat badalna.)',
        'Settings → Triggers (Cron) me: */10 * * * * → Save. Isse har 10 minute comment-patrol + brain copy chalta rahega.',
        'PC se karna ho to ek command: ' + WR_CMD + ' (ye build + site copy + KV create + id bhar ke deploy khud kar deta hai).',
        'Wapas app me ye button dabaao → line "✅ KV storage ready" dikhni chahiye.',
      ],
    },
    {
      id: 'r2',
      title: '2️⃣ 🪣 R2 (HD video ka public link — Instagram ko yahi chahiye, ₹0)',
      ok: r2Filled,
      note: r2Filled ? describeR2(r2) : 'Abhi: ' + describeR2(r2) + ' — bucket + 4 values bharne hain',
      linkLabel: 'R2 KHOLO',
      link: 'https://dash.cloudflare.com/?to=/:account/r2/buckets',
      copy: R2_TEMPLATE,
      copyName: '4-LINE TEMPLATE',
      actionLabel: '🧪 R2 CHECK',
      say: 'R2 ke liye: dashboard me R2 kholo, bucket banao jiska naam apex. Bucket ki settings me public development URL enable karo. Phir Manage R2 API Tokens se token banao, permission Object Read and Write rakho. Access key aur secret key copy karke, niche R2 vault card me 4 line paste karo aur check dabaao.',
      action: async () => {
        const r = await checkR2Access({ ...r2, ...(r2Paste.trim() ? { pasteForCreds: r2Paste } : {}) });
        setR2Report(r);
        if (r.credsOk) setR2(loadR2Settings());
        onToast(r.ok ? `🪣 R2 ✅ ${r.note}` : `🪣 R2 ️ ${r.note}`);
      },
      steps: [
        'dash.cloudflare.com → Storage & Databases → R2 → Create bucket → naam: apex → Create (koi region setting chhoo-ne ki zaroorat nahi, free tier).',
        'Bucket khule → Settings tab → Public development → "Enable public development bucket URL" → copy: https://pub-xxxx.r2.dev (ye wo link hai jo Meta/Instagram ko chahiye).',
        'R2 home (left menu) → Manage R2 API Tokens → Create API token → Permissions: Object Read & Write → TTL: Never → Create → Access Key ID aur Secret Access Key copy (sirf ek baar dikhte hain).',
        'Neeche 🪣 R2 VAULT card me 4 line paste karo (is card ke "📋 4-LINE TEMPLATE" se template copy ho jayega) → ✂️ PASTE SE BHARO dabao.',
        'CORS ki galti aaye to: 🛠️ CORS FIX → jo JSON dikhe use R2 → bucket → Settings → CORS policy → Edit me paste → Save.',
        'Phir 🧪 R2 CHECK (ya is card ka button) — green = video save hote hi uska public link ban jaayega.',
      ],
    },
    {
      id: 'github',
      title: '3️⃣ 🐙 GITHUB PAT (code ka backup + brain file — aaj tip v6.6.4 par atka hai)',
      ok: Boolean(settings.ghToken && ghCheck?.ok),
      note: !settings.ghToken
        ? '⚠️ App me token khaali hai — 404/403 isi se aata hai'
        : ghCheck?.ok
          ? `✅ ${ghCheck.note}`
          : ghCheck
            ? `⚠️ ${ghCheck.note}`
            : 'Token laga hai, par abhi check nahi kiya — neeche wala check dabaao',
      linkLabel: 'PAT BANAO',
      link: 'https://github.com/settings/personal-access-tokens/new',
      copy: GH_CMD,
      copyName: 'PUSH COMMAND',
      actionLabel: '🧪 ACCESS CHECK',
      say: 'GitHub ke liye: github.com par personal access tokens ki page kholo, fine grained token banao. Repository access me Only select repositories chuno aur Aidavil112 slash apex-humanoid-v2 add karo. Permission me Contents ko Read and write karo, bas. Token copy karke app ke GitHub card me paste karo aur access check dabaao. Code push karne ke liye PC par push script chala do, ya token chat me de do.',
      action: async () => {
        const r = await checkGithubAccess({ token: settings.ghToken, owner: settings.ghOwner || '', repo: settings.ghRepo || 'apex-humanoid-v2' });
        setGhCheck({ ok: r.ok, note: r.note, repoExists: r.repoExists, writeOk: r.writeOk, publicReadOk: r.publicReadOk });
        onToast(r.ok ? `🐙 GitHub ✅ ${r.note}` : `🐙 GitHub ️ ${r.note}`);
      },
      steps: [
        'https://github.com/settings/personal-access-tokens/new → Generate new token (fine-grained).',
        'Repository access → "Only select repositories" → search: Aidavil112/apex-humanoid-v2 → select.',
        'Permissions → Contents → **Read and write** (baaki kuchh mat chhoo). Expiration: 1 week → Generate token → token copy (ghp_… ya github_pat_…).',
        'Neeche 🐙 GITHUB HOST card ke token box me paste karo → 🧪 GITHUB ACCESS CHECK → "repo ✅ · write ✅ · public read ✅" chahiye.',
        'Code push (PC par, repo folder me): ' + GH_CMD + '  — token kisi file me nahi likha jaata. Ya PAT chat me de do, agent push + raw-URL test khud kar dega.',
        'Ho jaaye to GitHub → repo → Settings → Developer settings → Tokens → **Revoke** kar do (chat me aaya token public ho sakta hai).',
      ],
    },
  ] as const;
  const setupPending = SETUP_ROWS.filter((r) => !r.ok).map((r) => r.id);
  const setupDone = setupPending.length === 0;
  const setupRefreshAll = async () => {
    try {
      await pullServer();
    } catch {}
    try {
      const r = await checkR2Access(r2);
      setR2Report(r);
    } catch {}
    try {
      const g = await checkGithubAccess({ token: settings.ghToken, owner: settings.ghOwner || '', repo: settings.ghRepo || 'apex-humanoid-v2' });
      setGhCheck({ ok: g.ok, note: g.note, repoExists: g.repoExists, writeOk: g.writeOk, publicReadOk: g.publicReadOk });
    } catch {}
    setSetupProbe({ note: 'Teen kaam ek saath check ho gaye', kvReady: undefined, ok: true });
    logDayEvent('🛰️ Jarvis', 'setup ke 3 kaam check kiye (worker/R2/GitHub)', 'setup card', true);
    onToast('🧭 Setup status taza kar diya — green jo hain wo ready, baki me ▸ KAISE KAREIN khula hua hai');
  };
  // voice/badge se seedha is card par aayein to step khul jaaye
  useEffect(() => {
    const h = (ev: Event) => {
      const id = String((ev as CustomEvent).detail || '');
      if (id === 'setup' || id === 'all') setSetupStep('worker');
      else if (id) setSetupStep(id);
    };
    window.addEventListener('apex:setup-jump', h as EventListener);
    return () => window.removeEventListener('apex:setup-jump', h as EventListener);
  }, []);
  const toggleSmooth = () => {
    const next = !smooth;
    setSmoothUi(next);
    setSmoothMode(next);
    onToast(next ? '⚡ Smooth mode ON — blur/glow off, ab phone tez' : '⚡ Smooth mode OFF — full glow wapas');
  };
  const runDoctor = async () => {
    setVdBusy(true);
    try {
      const r = await runVoiceDoctor();
      setVdRows(r.rows);
      setVdGood(r.good);
      onToast(r.verdict);
    } catch {
      onToast('⚠️ Voice doctor chal hi nahi paya');
    }
    setVdBusy(false);
  };
  const copyDoctor = async () => {
    if (!vdRows) return;
    const md = vdRows.map((r) => (r.ok ? 'OK   ' : 'FAIL ') + r.label + (r.ok || !r.fix ? '' : '  → ' + r.fix)).join('\n');
    const ok = await apexCopy('APEX Voice Doctor — ' + vdGood + '/' + vdRows.length + ' theek\n' + md);
    onToast(ok ? '📋 Report copy ho gayi' : '⚠️ Copy nahi ho paya');
  };

  return (
    <div className="space-y-2.5">
      {/* 📱 PHONE FIX — LAG & AWAAZ (1 tap me jaanch) */}
      <div className="rounded-2xl border border-[rgba(34,211,238,0.4)] bg-[rgba(34,211,238,0.07)] p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[12px] font-black tracking-wide text-white">📱 PHONE FIX — LAG &amp; AWAAZ</div>

        <div className="flex items-center gap-1.5 flex-wrap text-[9px] font-black">
          <span className="text-slate-200">
            {busyEntries.some(([, on]) => on)
              ? `⏳ abhi chal raha hai: ${busyEntries.filter(([, on]) => on).map(([n]) => n).join(' · ')}`
              : busyStuckCleared.length
                ? `↺ atka hua chhoda gaya: ${busyStuckCleared.join(' · ')}`
                : '✅ koi kaam atka nahi — sab button taiyar'}
          </span>
          <button
            onClick={clearAllBusy}
            className="px-2 py-0.5 rounded-full bg-amber-500/30 text-white border border-amber-300/50 cursor-pointer text-[9px] font-black"
          >
            ↺ ATKA HUA CHHODO
          </button>
        </div>          <button
            onClick={toggleSmooth}
            className={`px-2.5 py-1 rounded-full text-[9.5px] font-black cursor-pointer border ${
              smooth ? 'bg-[#22d3ee] text-[#041820] border-[#22d3ee]' : 'bg-white/5 text-slate-300 border-white/15'
            }`}
          >
            {smooth ? '⚡ SMOOTH: ON' : '⚡ SMOOTH: OFF'}
          </button>
        </div>
        <div className="text-[9.5px] text-slate-400 leading-relaxed">
          Phone atakta hai? Smooth mode backdrop-blur + glow off kar deta hai (mid-range MIUI me yahi fps
          khaata hai). Kamzor device par ye khud ON ho jaata hai.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={runDoctor}
            className="px-2.5 py-1.5 rounded-xl bg-[rgba(46,242,164,0.16)] border border-[rgba(46,242,164,0.45)] text-[10px] font-black text-[#8ff7cf] cursor-pointer"
          >
            {vdBusy ? '🎙️ CHECK KAR RAHA…' : '🎙️ VOICE DOCTOR CHECK'}
          </button>
          <button
            onClick={() => {
              const r = resetVoiceLock();
              onToast(`🎙️ ${r.note}`);
              logDayEvent('🎙️ Voice', 'lock reset kiya (mic atakne par)', r.note, r.ok);
            }}
            className="px-2 py-2 rounded-xl text-[9.5px] font-black cursor-pointer bg-rose-500/25 text-white border border-rose-300/50"
          >
            🎙️ AWAAZ RESET KARO
          </button>
          {vdRows && (
            <button
              onClick={copyDoctor}
              className="px-2.5 py-1.5 rounded-xl bg-white/6 border border-white/15 text-[10px] font-black text-slate-200 cursor-pointer"
            >
              📋 REPORT COPY
            </button>
          )}
          {vdRows && (
            <span className={`text-[10px] font-black ${vdGood === (vdRows?.length || 0) ? 'text-[#2ef2a4]' : 'text-amber-300'}`}>
              {vdGood}/{vdRows?.length || 0} theek
            </span>
          )}
        </div>
        {vdRows && (
          <div className="space-y-1 pt-0.5">
            {vdRows.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-2 text-[9.5px] leading-snug">
                <span className={r.ok ? 'text-slate-300' : 'text-rose-300 font-bold'}>
                  {r.ok ? '✅' : '❌'} {r.label}
                </span>
                {!r.ok && r.fix ? <span className="text-slate-500 text-right shrink-0 max-w-[52%]">{r.fix}</span> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ 🧭 JARVIS SETUP — 3 KAAM, EK JAGAH (alag app/site me config nahi; sab isi panel me) ═══
           User bola: "mujhe nahi aa raha, kahan se karna hai bata do" + "alag-alag mat karo,
           Jarvis ke andar hi sab rakho" → isliye status + link + command + explain ek hi card me. */}
      <div className="rounded-2xl border border-[rgba(125,211,252,0.4)] bg-[rgba(125,211,252,0.06)] p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[12px] font-black tracking-wide text-white">🧭 JARVIS SETUP — 3 KAAM</div>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${setupDone ? 'bg-emerald-500/30 text-white border border-emerald-300/50' : 'bg-amber-500/30 text-white border border-amber-300/50'}`}>
            {setupDone ? '✅ SAB TAIYAR' : `⏳ ${setupPending.length} BAKI`}
          </span>
        </div>
        <div className="text-[9.5px] text-slate-200 leading-relaxed">
          Ye 3 kaam ho jayein to night-shift, IG queue aur HD video ke public link apne aap chalenge.
          Sab kuchh isi panel me hai — kahin aur login/config karne ki zaroorat nahi. Har line par
          <b> ▸ KAISE KAREIN</b> dabao, step-by-step khul jayega.
        </div>
        {SETUP_ROWS.map((row) => {
          const open = setupStep === row.id;
          return (
            <div key={row.id} className="rounded-xl border border-white/10 bg-black/30 p-2 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[10.5px] font-black text-white leading-tight">{row.title}</div>
                  <div className={`text-[9px] font-bold leading-snug ${row.ok ? 'text-emerald-300' : 'text-amber-200'}`}>{row.note}</div>
                </div>
                <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-black ${row.ok ? 'bg-emerald-500/30 text-white' : 'bg-amber-500/25 text-white'}`}>
                  {row.ok ? '✅' : '⚠️'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSetupStep(open ? '' : row.id)}
                  className="px-2 py-1.5 rounded-lg bg-[#7dd3fc] text-[#06212e] text-[9px] font-black cursor-pointer"
                >
                  {open ? '▸ BAND KARO' : '▸ KAISE KAREIN (3-5 step)'}
                </button>
                <button
                  onClick={() => {
                    void apexOpen(row.link);
                  }}
                  className="px-2 py-1.5 rounded-lg bg-white/15 border border-white/30 text-white text-[9px] font-black cursor-pointer"
                >
                  🔗 {row.linkLabel}
                </button>
                <button
                  onClick={async () => {
                    const ok = await apexCopy(row.copy);
                    onToast(ok ? `📋 ${row.copyName} copy ho gaya` : '⚠️ Copy nahi ho paya — screen se select karke copy karo');
                  }}
                  className="px-2 py-1.5 rounded-lg bg-white/15 border border-white/30 text-white text-[9px] font-black cursor-pointer"
                >
                  📋 {row.copyName}
                </button>
                {row.action && (
                  <button
                    onClick={() => void row.action!()}
                    disabled={!!setupActBusy}
                    className={`px-2 py-1.5 rounded-lg text-[9px] font-black cursor-pointer border ${setupActBusy ? 'bg-white/10 text-white border-white/20' : 'bg-gradient-to-r from-cyan-600 to-emerald-600 text-white border-white/25'}`}
                  >
                    {setupActBusy === row.id ? '⏳…' : row.actionLabel}
                  </button>
                )}
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('apex:jarvis-say', { detail: row.say }));
                    logDayEvent('🛰️ Jarvis', `setup row samjhaya: ${row.title}`, row.say.slice(0, 70), true);
                  }}
                  className="px-2 py-1.5 rounded-lg bg-white/15 border border-white/30 text-white text-[9px] font-black cursor-pointer"
                >
                  🗣️ BOLO
                </button>
              </div>
              {open && (
                <div className="rounded-lg bg-[#06212e]/70 border border-[#7dd3fc]/30 p-2 space-y-1">
                  {row.steps.map((stp, i) => (
                    <div key={i} className="flex gap-1.5 text-[9px] leading-snug text-slate-100">
                      <span className="font-black text-[#7dd3fc] shrink-0">{i + 1}.</span>
                      <span className="flex-1">{stp}</span>
                    </div>
                  ))}
                  <div className="text-[8.5px] font-mono text-slate-300 break-all pt-1 border-t border-white/10">{row.copy}</div>
                </div>
              )}
            </div>
          );
        })}
        {setupDone ? (
          <div className="rounded-xl bg-emerald-500/25 border border-emerald-300/40 px-2 py-1.5 text-[9.5px] font-black text-white">
            ✅ Setup pura — 👑 Head Bot ab khud chalayega: night shift (har 10 min), IG queue, R2 public links.
          </div>
        ) : (
          <button
            onClick={() => {
              setSetupActBusy('all');
              void (async () => {
                try {
                  await setupRefreshAll();
                } finally {
                  setSetupActBusy('');
                }
              })();
            }}
            disabled={!!setupActBusy}
            className={`w-full py-2 rounded-xl text-[10px] font-black cursor-pointer ${setupActBusy ? 'bg-white/10 text-white' : 'bg-gradient-to-r from-[#7dd3fc] to-[#34d399] text-[#06212e]'}`}
          >
            {setupActBusy === 'all' ? '⏳ TEEK KAR RAHA…' : '🔄 TINO KAAM CHECK KARO'}
          </button>
        )}
      </div>

      {/* 📊 AAJ KYA KIYA — DAY LOG (aapke bheje wale reel ka system: poore din ka hisaab) */}
      <div className="rounded-2xl border border-[rgba(167,139,250,0.4)] bg-[rgba(167,139,250,0.07)] p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[12px] font-black tracking-wide text-white">📊 AAJ KYA KIYA — DAY LOG</div>
          <button
            onClick={() => {
              setDlBusy(true);
              refreshDl(true);
              window.setTimeout(() => setDlBusy(false), 300);
            }}
            className="px-2.5 py-1 rounded-full bg-[#a78bfa] text-[#160b26] text-[9.5px] font-black cursor-pointer"
          >
            {dlBusy ? '⟳…' : '⟳ TAZA'}
          </button>
        </div>
        <div className="text-[9.5px] text-slate-200 leading-relaxed">
          Kaunsa agent kitna kaam kar raha hai aur kaise (raasta, size, samay, result) — sab
          isi phone par record hota hai, koi server nahi. Engine ke apne kaam (video save,
          Instagram post, standup, research cycle, self-check) apne aap yahan girtay hain.
        </div>
        {dl && (
          <div className="space-y-1.5">
            <div className={`rounded-xl px-2 py-1.5 text-[9.5px] font-black ${dl.stuck ? 'bg-amber-500/25 text-amber-50 border border-amber-300/40' : 'bg-emerald-500/25 text-emerald-50 border border-emerald-300/40'}`}>
              {dl.verdict}
            </div>
            {dl.total > 0 && (
              <div className="text-[8.5px] font-black text-slate-200 tracking-tight">
                00h → 23h <span className="text-[#c4b5fd]">{dl.hours.map((n) => (n === 0 ? '·' : n < 2 ? '▁' : n < 4 ? '▃' : n < 7 ? '▅' : '█')).join('')}</span>
              </div>
            )}
            {dl.byAgent.slice(0, 6).map((a) => (
              <div key={a.who} className="flex items-center justify-between gap-2 text-[9px]">
                <span className="font-black text-white">{a.who}</span>
                <span className={a.ok === a.n ? 'text-emerald-300' : 'text-amber-300'}>
                  {a.n} kaam · {a.ok} ok{a.lastAt ? ` · last ${new Date(a.lastAt).toTimeString().slice(0, 5)}` : ''}
                </span>
              </div>
            ))}
            <div className={`overflow-y-auto space-y-1 pt-1 ${dlOpen ? 'max-h-[300px]' : 'max-h-[150px]'}`}>
              {(dlOpen ? dl.events : dl.events.slice(0, 18)).map((e, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[8.5px] leading-snug border-b border-white/5 pb-1">
                  <span className="text-slate-300 shrink-0">{new Date(e.t).toTimeString().slice(0, 5)}</span>
                  <span className={e.ok ? 'text-emerald-300' : 'text-rose-300'}>{e.ok ? '✅' : '⚠️'}</span>
                  <span className="text-white font-bold shrink-0">{e.who}</span>
                  <span className="text-slate-200 flex-1">
                    {e.what}
                    {e.how ? <span className="text-slate-400"> · {e.how}</span> : null}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 pt-0.5">
              <button
                onClick={async () => {
                  const ok = await apexCopy(dl.report);
                  onToast(ok ? '📋 Day report copy ho gayi' : '⚠️ Copy nahi ho paya');
                }}
                className="flex-1 py-1.5 rounded-xl bg-white/10 border border-white/25 text-white text-[9px] font-black cursor-pointer"
              >
                📋 COPY REPORT
              </button>
              <button
                onClick={() => {
                  refreshDl(true);
                  onToast(`📊 ${daySummary().verdict}`);
                }}
                className="flex-1 py-1.5 rounded-xl bg-white/10 border border-white/25 text-white text-[9px] font-black cursor-pointer"
              >
                🗣️ “aaj kya kiya” bolo
              </button>
            </div>
          </div>
        )}
        {/* 🧩 6.6.12: pehle ye button sirf tab tak zinda tha jab tak pehli baar log load
            na ho jaye — phir gayab ho jata tha (test ne pakda). Ab hamesha rehta hai aur
            khulta/band hota hai. */}
        <button
          onClick={() => {
            if (!dl) {
              refreshDl(true);
              setDlOpen(true);
              return;
            }
            setDlOpen((v) => !v);
          }}
          className="w-full py-2 rounded-xl bg-[#a78bfa] text-[#160b26] text-[10px] font-black cursor-pointer"
        >
          {dl ? (dlOpen ? `📊 LIST CHHUPAO (${dl.total} entries)` : `📊 AAJ KA KAAM DIKHAO — POORI LIST (${dl.total})`) : '📊 AAJ KA KAAM DIKHAO'}
        </button>
      </div>

      {/* MASTER SWITCH + NEXT RUN */}
      <div
        className={`rounded-2xl border p-3 ${
          st.enabled ? 'border-[rgba(46,242,164,0.45)] bg-[rgba(46,242,164,0.06)]' : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)]'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[12px] font-black tracking-wide text-white flex items-center gap-1.5">
              🛰️ JARVIS AUTONOMY CORE
              <span
                className={`px-1.5 py-0.5 rounded text-[8.5px] font-black ${
                  st.enabled ? 'bg-[#2ef2a4] text-[#04180f]' : 'bg-white/10 text-slate-300'
                }`}
              >
                {st.enabled ? 'SELF-RUNNING' : 'MANUAL'}
              </span>
            </div>
            <div className="text-[9.5px] text-slate-400 font-semibold mt-0.5">
              Order dene ki zaroorat nahi — main sochta, research karta, banata, save karta aur post karta hoon.
            </div>
          </div>
          <button
            onClick={() => {
              const next = toggleCore();
              setSt(next);
              onToast(next.enabled ? '🛰️ Jarvis Core ON — ab khud chalta raunga' : '🛑 Jarvis Core OFF (kill switch)');
            }}
            className={`px-3 py-2 rounded-xl text-[10.5px] font-black cursor-pointer transition-all ${
              st.enabled ? 'bg-rose-600 text-white' : 'bg-[#2ef2a4] text-[#04180f]'
            }`}
          >
            {st.enabled ? '🔴 KILL SWITCH' : '⭕ TURN ON'}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[9.5px] font-black">
          <span className="px-2 py-1 rounded-lg bg-white/5 text-slate-300">⏭️ NEXT: {nextIst}</span>
          <span className="px-2 py-1 rounded-lg bg-white/5 text-slate-300">💬 Aaj replies: {st.repliesToday}/{autoPl.maxRepliesPerDay}</span>
          <span className="px-2 py-1 rounded-lg bg-white/5 text-slate-300">📊 Aaj trades: {st.tradesToday}/{autoPl.maxTradesPerDay}</span>
          <span className={`px-2 py-1 rounded-lg ${settings.youtubeAccessToken ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-200'}`}>
            🔑 {settings.youtubeAccessToken ? 'YouTube token ready' : 'YouTube connect karein'}
          </span>
        </div>
      </div>

      {/* DAILY SCHEDULE */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-2.5 space-y-1.5">
        <div className="text-[10.5px] font-black text-slate-200">🗓️ MERA AUTO-SCHEDULE (roz, time badal sakte ho)</div>
        {st.slots.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5 p-1.5 rounded-xl bg-white/[0.04]">
            <span className="text-[13px]">{KIND_ICON[s.kind]}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[10.5px] font-bold text-white truncate">{s.label}</div>
              <div className="text-[9px] text-slate-400 font-semibold">
                last run: {st.lastRun[s.id] || '—'} {st.lastRun[s.id] === new Date().toISOString().slice(0, 10) ? '✅ aaj ho gaya' : ''}
              </div>
            </div>
            <select
              value={s.hour}
              onChange={(e) => setSlotTime(s.id, { hour: +e.target.value })}
              className="bg-[#0b1220] border border-white/10 rounded-lg px-1 py-1 text-[9.5px] font-black text-white"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}
                </option>
              ))}
            </select>
            <select
              value={s.minute}
              onChange={(e) => setSlotTime(s.id, { minute: +e.target.value })}
              className="bg-[#0b1220] border border-white/10 rounded-lg px-1 py-1 text-[9.5px] font-black text-white"
            >
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>
                  :{String(m).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* REEL / SHORT LINK → COMMENT PATROL */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-2.5 space-y-2">
        <div className="text-[10.5px] font-black text-slate-200">💬 REEL / SHORT LINK DHO — COMMENTS KA REPLY MAIN KARUNGA</div>
        <div className="flex gap-1.5">
          <input
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="https://www.instagram.com/reel/xxxx  ya  youtube.com/shorts/xxxx"
            className="flex-1 bg-[#0b1220] border border-white/10 rounded-xl px-2.5 py-2 text-[10.5px] font-bold text-white"
          />
          <button onClick={addLink} className="px-2.5 py-2 rounded-xl bg-[#38bdf8] text-[#04121b] text-[10px] font-black cursor-pointer">
            ＋ ADD
          </button>
        </div>

        {st.targets.length === 0 && (
          <div className="text-[9.5px] text-slate-500 font-semibold">
            Abhi koi link nahi. Link daalte hi main uske comments padhunga aur reply draft karunga — aapke APNE video par auto-post bhi kar
            dunga.
          </div>
        )}
        {st.targets.map((t) => (
          <div key={t.id} className="flex items-center gap-1.5 p-1.5 rounded-xl bg-white/[0.04]">
            <span className="text-[11px]">{t.platform === 'youtube' ? '▶️' : '📸'}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold text-white truncate">{t.label}</div>
              <div className="text-[8.5px] text-slate-400 font-mono truncate">{t.url}</div>
            </div>
            <span className="text-[8.5px] font-black text-slate-400">
              {t.repliesToday} 💬 {t.lastPatrolAt ? new Date(t.lastPatrolAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'never'}
            </span>
            <button
              onClick={() => {
                setSt(removeTarget(t.id));
                onToast('Target hata diya');
              }}
              className="px-1.5 py-1 rounded-lg bg-rose-500/20 text-rose-200 text-[9px] font-black cursor-pointer"
            >
              ✕
            </button>
          </div>
        ))}

        <div className="flex gap-1.5">
          <button
            onClick={async () => {
              await patrolNow();
              logDayEvent('🛰️ Jarvis Core', 'comment patrol chalaya', 'comments padhe → AI reply draft', true);
            }}
            disabled={patrolling}
            className={`flex-1 py-2 rounded-xl text-[10.5px] font-black cursor-pointer ${
              patrolling ? 'bg-white/10 text-white border border-white/20' : 'bg-gradient-to-r from-fuchsia-600 to-sky-600 text-white'
            }`}
          >
            {patrolling ? '🔎 Comments padh raha hoon…' : '🔎 ABHI PATROL KARO'}
          </button>
          <button
            onClick={async () => {
              const r = await syncOwnInstagramMedia();
              refresh();
              logDayEvent('📸 Instagram', 'apne reels sync kiye', r.ok ? `${r.added} naye clips list me` : String(r.error || 'fail'), Boolean(r.ok));
              onToast(r.ok ? `📸 ${r.added} apne IG reels list me add ho gaye` : `⚠️ ${r.error}`);
            }}
            className="px-2.5 py-2 rounded-xl bg-white/10 text-white text-[10px] font-black cursor-pointer"
          >
            📸 APNE REELS LAO
          </button>
        </div>

        {st.drafts.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="text-[9.5px] font-black text-slate-400">LATEST REPLIES / DRAFTS</div>
            {st.drafts.slice(0, 5).map((d, i) => (
              <div key={i} className="p-2 rounded-xl bg-white/[0.04] border border-white/5">
                <div className="text-[9px] font-black text-slate-400">
                  @{d.author} — "{d.commentText.slice(0, 80)}"
                </div>
                <div className="text-[10px] font-bold text-emerald-300 mt-0.5">↳ {d.replyText}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-[8.5px] font-black ${d.posted ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {d.posted ? '✅ AUTO-POSTED' : `📝 ${d.note}`}
                  </span>
                  {!d.posted && (
                    <button
                      onClick={async () => {
                        try {
                          await apexCopy(d.replyText);
                          onToast('Reply copy ho gaya — composer me paste karke post kar dijiye');
                        } catch {
                          onToast('Copy nahi ho paya');
                        }
                      }}
                      className="px-2 py-0.5 rounded-lg bg-sky-500/25 text-sky-200 text-[8.5px] font-black cursor-pointer"
                    >
                      COPY
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MARKET AUTONOMY */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10.5px] font-black text-slate-200">📰 SUB-BOTS RESEARCH → 👑 HEAD BOT BUY/SELL (bina puche)</div>
          <button
            onClick={() => {
              const next = saveState({ tradingKillSwitch: !st.tradingKillSwitch });
              setSt(next);
              onToast(next.tradingKillSwitch ? '🔴 Trading ruk gayi (content loop chalta rahega)' : '🟢 Trading autonomy chalu');
            }}
            className={`px-2 py-1 rounded-lg text-[9px] font-black cursor-pointer ${
              st.tradingKillSwitch ? 'bg-rose-600 text-white' : 'bg-emerald-500/20 text-emerald-200'
            }`}
          >
            {st.tradingKillSwitch ? '🔴 STOPPED' : '🟢 AUTO'}
          </button>
        </div>
        {st.lastPlanSummary && (
          <div className="p-2 rounded-xl bg-white/[0.04] text-[9.5px] font-semibold text-slate-300 leading-snug">🧠 {st.lastPlanSummary}</div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {[
            { k: 'maxInrPerTrade', label: '₹ PER TRADE', min: 60, max: 100000 },
            { k: 'minConfidence', label: 'MIN CONFIDENCE %', min: 40, max: 99 },
            { k: 'maxOpenPositions', label: 'MAX OPEN', min: 1, max: 12 },
            { k: 'maxTradesPerDay', label: 'TRADES / DAY', min: 1, max: 60 },
          ].map((f) => (
            <label key={f.k} className="text-[8.5px] font-black text-slate-400">
              {f.label}
              <input
                type="number"
                min={f.min}
                max={f.max}
                value={(autoPl as any)[f.k]}
                onChange={(e) => {
                  const v = Math.max(f.min, Math.min(f.max, Number(e.target.value) || f.min));
                  setSt(saveState({ limits: { ...autoPl, [f.k]: v } }));
                }}
                className="mt-0.5 w-full bg-[#0b1220] border border-white/10 rounded-lg px-1.5 py-1 text-[10px] font-bold text-white"
              />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {[
            { k: 'maxSlipPct', label: 'MAX SLIP %', min: 0.1, max: 5 },
            { k: 'dailyLossCapPctOfWallet', label: 'LOSS CAP % WALLET', min: 1, max: 40 },
            { k: 'emergencySlMultiplier', label: 'EMERGENCY SL ×', min: 1.1, max: 4 },
            { k: 'dailyLossCapInr', label: 'LOSS CAP ₹', min: 250, max: 1000000 },
          ].map((f) => (
            <label key={f.k} className="text-[8.5px] font-black text-slate-400">
              {f.label}
              <input
                type="number"
                step="0.1"
                min={f.min}
                max={f.max}
                value={(autoPl as any)[f.k] ?? ''}
                onChange={(e) => {
                  const v = Math.max(f.min, Math.min(f.max, Number(e.target.value) || f.min));
                  setSt(saveState({ limits: { ...autoPl, [f.k]: v } }));
                }}
                className="mt-0.5 w-full bg-[#0b1220] border border-white/10 rounded-lg px-1.5 py-1 text-[10px] font-bold text-white"
              />
            </label>
          ))}
        </div>
        <button
          onClick={() => {
            const next = saveState({ limits: { ...autoPl, requireNewsOrExtremeRsi: !autoPl.requireNewsOrExtremeRsi } });
            setSt(next);
            onToast(next.limits.requireNewsOrExtremeRsi ? '🛡️ News Guard ON — bina live headline ke trade nahi' : '⚠️ News Guard OFF — technical-only entries chalengi');
          }}
          className={`w-full py-1.5 rounded-xl text-[9.5px] font-black cursor-pointer ${
            autoPl.requireNewsOrExtremeRsi ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-100'
          }`}
        >
          🛡️ NEWS/FALSE-PUMP GUARD: {autoPl.requireNewsOrExtremeRsi ? 'ON (sirf live headline ya extreme RSI par entry)' : 'OFF (risk zyada)'}
        </button>
        <div className="flex gap-1.5">
          <button
            onClick={async () => {
              await runCycle();
              logDayEvent('🛰️ Jarvis Core', 'research cycle pura hua', 'web research → decision → vault save', true);
            }}
            disabled={cycleBusy}
            className={`flex-1 py-2 rounded-xl text-[10.5px] font-black cursor-pointer ${
              cycleBusy ? 'bg-white/10 text-white border border-white/20' : 'bg-gradient-to-r from-amber-500 to-rose-600 text-white'
            }`}
          >
            {cycleBusy ? '🛰️ Research + decision ho raha hai…' : '🛰️ EK RESEARCH CYCLE CHALAO'}
          </button>
          <button
            onClick={() => {
              const next = saveState({
                limits: { ...autoPl, autoReplyComments: !autoPl.autoReplyComments },
              });
              setSt(next);
              onToast(next.limits.autoReplyComments ? '💬 Auto-reply ON (sirf apne content par)' : '💬 Auto-reply OFF — ab sirf draft banega');
            }}
            className={`px-2.5 py-2 rounded-xl text-[10px] font-black cursor-pointer ${
              autoPl.autoReplyComments ? 'bg-emerald-500/25 text-emerald-50 border border-emerald-300/50' : 'bg-white/10 text-white border border-white/25'
            }`}
          >
            {autoPl.autoReplyComments ? '💬 AUTO-REPLY ON' : '💬 DRAFT-ONLY'}
          </button>
        </div>
      </div>

{/* 🌙 SERVER NIGHT SHIFT — phone band ho tab bhi server chalta hai */}
      <div className={`rounded-2xl border p-2.5 space-y-2 ${srv.enabled ? 'border-[rgba(46,242,164,0.4)] bg-[rgba(46,242,164,0.05)]' : 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]'}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10.5px] font-black text-slate-200">🌙 SERVER NIGHT SHIFT (Cloudflare cron — 10 min)</div>
            <div className="text-[9px] text-slate-400 font-semibold mt-0.5">
              Phone bilkul band ho, app na khula ho — tab bhi server aapke <b>apne uploads</b> ke naye comments padhta hai aur AI reply khud
              post karta hai. Telegram par report bhi aata hai.
            </div>
          </div>
          <button
            disabled={srvBusy}
            onClick={async () => {
              setSrvBusy(true);
              try {
                const r = await hubFetch('/jarvis/config', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ enabled: !srv.enabled, maxRepliesPerDay: autoPl.maxRepliesPerDay }),
                });
                const j: any = await r.json().catch(() => ({}));
                setSrv({
                  ok: Boolean(j?.ok),
                  enabled: Boolean(j?.state?.enabled),
                  note: String(j?.test?.note || j?.state?.lastNote || j?.test?.reason || ''),
                  repliesToday: Number(j?.state?.repliesToday || 0),
                  kvReady: Boolean(j?.kvReady),
                  ytAuth: Boolean(j?.ytAuth),
                });
                onToast(j?.ok ? (j?.state?.enabled ? '🌙 Server night shift ON' : '🌙 Server night shift OFF') : `⚠️ ${String(j?.error || 'worker reply nahi aaya').slice(0, 80)}`);
              } catch (e: any) {
                onToast(`⚠️ ${String(e?.message || e).slice(0, 90)}`);
              } finally {
                setSrvBusy(false);
              }
            }}
            className={`px-2.5 py-2 rounded-xl text-[10px] font-black cursor-pointer ${srv.enabled ? 'bg-rose-600 text-white' : 'bg-[#38bdf8] text-[#04141d]'}`}
          >
            {srvBusy ? '⏳…' : srv.enabled ? '🔴 STOP' : '🌙 TURN ON'}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[8.5px] font-black">
          <span className={`px-2 py-1 rounded-lg ${srv.kvReady ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-200'}`}>
            {srv.kvReady ? '✅ KV storage ready' : '⚠️ APEX_KV binding chahiye'}
          </span>
          <span className={`px-2 py-1 rounded-lg ${srv.ytAuth ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-200'}`}>
            {srv.ytAuth ? '✅ YouTube refresh token' : '⏳ Connect YouTube (1-tap)'}
          </span>
          <span className="px-2 py-1 rounded-lg bg-white/5 text-slate-300">Aaj server replies: {srv.repliesToday ?? 0}</span>
        </div>
        {srv.note && <div className="text-[9px] font-bold text-sky-200 leading-snug">📋 {srv.note}</div>}
        <button onClick={() => void pullServer()} className="text-[9px] font-black text-slate-400 cursor-pointer">
          🔄 Status refresh karo
        </button>
      </div>


      {/* 📸 INSTAGRAM 100% AUTO (public URL host + Graph publish) */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10.5px] font-black text-slate-200">📸 INSTAGRAM — 100% AUTO (zero tap)</div>
          <button
            onClick={() => {
              const next = saveState({ igAutoPublish: !st.igAutoPublish });
              setSt(next);
              onToast(next.igAutoPublish ? '📸 IG auto-publish ON (21:30 slot me khud post hoga)' : '📸 IG auto-publish OFF — ab 1-tap handoff');
            }}
            className={`px-2 py-1 rounded-lg text-[9px] font-black cursor-pointer ${st.igAutoPublish ? 'bg-emerald-500/25 text-emerald-100' : 'bg-white/10 text-slate-300'}`}
          >
            {st.igAutoPublish ? '✅ AUTO ON' : '⭕ OFF'}
          </button>
        </div>
        <div className="text-[9px] font-semibold text-slate-400 leading-snug">
          Meta Graph API browser se file upload nahi karta — isliye video pehle aapke <b>GitHub repo</b> me jaake ek <b>public raw URL</b>
          banata hai (₹0), phir Meta use khud kheench kar Reel bana deta hai. <b>Repo public rahega toh video bhi public rahega</b> —
          sirf apna content daaliye.
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <input
            value={settings.ghOwner}
            onChange={(e) => patchIg({ ghOwner: e.target.value.trim() })}
            placeholder="GitHub username"
            className="bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white"
          />
          <input
            value={settings.ghRepo}
            onChange={(e) => patchIg({ ghRepo: e.target.value.trim() })}
            placeholder="repo (apex-humanoid-v2)"
            className="bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white"
          />
          <input
            value={settings.ghToken}
            onChange={(e) => patchIg({ ghToken: e.target.value.trim() })}
            placeholder="GitHub PAT (Contents: Read & write)"
            className="col-span-2 bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white"
          />
          <input
            value={settings.igBusinessId}
            onChange={(e) => patchIg({ igBusinessId: e.target.value.trim() })}
            placeholder="IG Business User ID (numeric)"
            className="bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white"
          />
          <input
            value={settings.ghBranch}
            onChange={(e) => patchIg({ ghBranch: e.target.value.trim() || 'main' })}
            placeholder="branch (main)"
            className="bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white"
          />
          <input
            value={settings.igAccessToken}
            onChange={(e) => patchIg({ igAccessToken: e.target.value.trim() })}
            placeholder="IG long-lived access token (instagram_basic + publish_video)"
            className="col-span-2 bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white"
          />
        </div>
        <div className="flex gap-1.5">
          <button
            disabled={igBusy}
            onClick={async () => {
              setIgBusy(true);
              try {
                const r = await publishLatestVaultVideoToInstagram();
                onToast(r.ok ? `📸 Reel LIVE: ${r.permalink || 'posted'}` : `⚠️ ${r.skipped || r.error}`);
                refresh();
              } finally {
                setIgBusy(false);
              }
            }}
            className={`flex-1 py-2 rounded-xl text-[10.5px] font-black cursor-pointer ${igBusy ? 'bg-white/10 text-slate-400' : 'bg-gradient-to-r from-pink-600 to-purple-600 text-white'}`}
          >
            {igBusy ? '⏳ Host + publish ho raha hai…' : '🧪 VAULT KA NAYA VIDEO ABHI POST KARO'}
          </button>
          <button
            disabled={ghBusy}
            onClick={async () => {
              setGhBusy(true);
              try {
                const r = await checkGithubAccess({
                  token: settings.ghToken,
                  owner: settings.ghOwner || '',
                  repo: settings.ghRepo || '',
                  branch: settings.ghBranch,
                });
                setGhCheck({ ok: r.ok, note: r.note, repoExists: r.repoExists, writeOk: r.writeOk, publicReadOk: r.publicReadOk });
                onToast(r.ok ? `🧪 ${r.note}` : `⚠️ ${r.note}`);
              } catch (e: any) {
                setGhCheck({ ok: false, note: String(e?.message || 'check fail') });
                onToast('⚠️ Check nahi ho paya');
              } finally {
                setGhBusy(false);
              }
            }}
            className={`px-2 py-2 rounded-xl text-[9.5px] font-black cursor-pointer border ${ghBusy ? 'bg-white/10 text-white border-white/10' : 'bg-white/10 text-white border-white/25'}`}
          >
            {ghBusy ? '⏳ checking…' : '🧪 GITHUB ACCESS CHECK'}
          </button>
          <button
            onClick={() => {
              const next = saveState({ autoDiscoverIg: !st.autoDiscoverIg });
              setSt(next);
              onToast(next.autoDiscoverIg ? '📸 Apne reels khud dhoondhe jayenge' : '📸 Auto-discover OFF');
            }}
            className={`px-2 py-2 rounded-xl text-[9.5px] font-black cursor-pointer border ${st.autoDiscoverIg ? 'bg-sky-500/30 text-white border-sky-300/50' : 'bg-white/10 text-white border-white/25'}`}
          >
            🔎 APNE REELS<br />AUTO LAO
          </button>
        </div>
        {ghCheck && (
          <div className={`rounded-xl px-2 py-1.5 text-[9px] font-bold leading-snug ${ghCheck.ok ? 'bg-emerald-500/15 text-emerald-200' : 'bg-rose-500/15 text-rose-200'}`}>
            🧪 GitHub: repo {ghCheck.repoExists ? '✅' : '❌'} · write {ghCheck.writeOk ? '✅' : '❌'} · public read{' '}
            {ghCheck.publicReadOk ? '✅' : '❌'} — {ghCheck.note}
          </div>
        )}
      </div>


      {/* 🔎 BUILD BADGE + SELF-CHECK + 📁 ALL VIDEOS (sab kuch isi panel ke andar) */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10.5px] font-black text-slate-200">🔎 {describeBuild()}</div>
          <div className="flex gap-1.5">
            <button
              disabled={chkBusy}
              onClick={async () => {
                setChkBusy(true);
                try {
                  const r = await selfCheck();
                  setChk(r);
                  logDayEvent('🔎 Self-check', r.warnCount ? `${r.warnCount} cheez check karni hai` : 'sab theek', `${r.okCount}/${r.items.length} systems pass`, !r.warnCount);
                  onToast(r.warnCount ? `🔎 ${r.verdict}` : `✅ ${r.verdict}`);
                } finally {
                  setChkBusy(false);
                }
              }}
              className={`px-2 py-1 rounded-lg text-[9px] font-black cursor-pointer ${chkBusy ? 'bg-white/10 text-slate-400' : 'bg-emerald-500/20 text-emerald-100'}`}
            >
              {chkBusy ? '⏳ CHECK…' : '✅ PURA LATEST? CHECK KARO'}
            </button>
            <button
              onClick={async () => {
                const next = !videoHub;
                setVideoHub(next);
                if (next) await loadHub();
              }}
              className={`px-2 py-1 rounded-lg text-[9px] font-black cursor-pointer ${videoHub ? 'bg-sky-500/25 text-sky-100' : 'bg-white/10 text-slate-200'}`}
            >
              📁 ALL VIDEOS {videoHub ? '▲' : `(${hubVids.length + appVids.length})`}
            </button>
          </div>
        </div>
        {chk && (
          <div className="space-y-1">
            <div className={`rounded-xl px-2 py-1.5 text-[9px] font-bold ${chk.warnCount ? 'bg-amber-500/15 text-amber-100' : 'bg-emerald-500/15 text-emerald-200'}`}>🔎 {chk.verdict}</div>
            {chk.items.map((it) => (
              <div key={it.label} className="flex items-start gap-1.5 text-[9px] leading-snug">
                <span className={it.ok ? 'text-emerald-300' : 'text-amber-300'}>{it.ok ? '✅' : '⚠️'}</span>
                <span className="font-black text-slate-200">{it.label}</span>
                <span className="text-slate-400 flex-1">{it.note}</span>
              </div>
            ))}
          </div>
        )}
        {videoHub && (
          <div className="space-y-2">
            {playing && (
              <video
                src={hubVids.find((v) => v.id === playing)?.previewUrl || ''}
                controls
                autoPlay
                playsInline
                className="w-full max-h-[320px] rounded-xl bg-black border border-white/15"
              />
            )}
            <div className="grid grid-cols-2 gap-1.5">
              {hubVids.length === 0 && appVids.length === 0 && (
                <div className="col-span-2 text-[9px] font-bold text-slate-300">Vault abhi khaali hai — 🎬 Motion Forge se pehli reel banao.</div>
              )}
              {appVids.length > 0 && (
                <div className="col-span-2 space-y-1.5 pt-1.5 border-t border-white/10">
                  <div className="text-[9px] font-black text-slate-100">
                    📦 APK KE ANDAR KE CLIPS ({appVids.length}) — koi download nahi, yahin isi screen par chalte hain
                  </div>
                  {appVids.map((c) => (
                    <div key={c.id} className="rounded-xl border border-white/10 bg-white/[0.05] p-1.5">
                      <button
                        onClick={() => {
                          setPlaying(playing === c.id ? '' : c.id);
                          logDayEvent('📁 Video Hub', `clip khola — ${c.title}`, playing === c.id ? 'band kiya' : 'inline player (app ke andar)', true);
                        }}
                        className="w-full flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <span className="text-[9.5px] font-black text-white text-left">{playing === c.id ? '⏸' : '▶'} {c.title}</span>
                        <span className="text-[8.5px] font-bold text-slate-200 shrink-0">
                          {c.sizeBytes ? (c.sizeBytes / 1e6).toFixed(1) + ' MB' : '.webm'} · {playing === c.id ? '▲ band karo' : 'chalao'}
                        </span>
                      </button>
                      {playing === c.id && (
                        <video src={c.url} controls autoPlay playsInline className="w-full max-h-[300px] rounded-lg bg-black mt-1.5 border border-white/10" />
                      )}
                    </div>
                  ))}
                </div>
              )}
              {hubVids.map((v) => (
                <div key={v.id} className={`rounded-xl px-2 py-1.5 text-[9px] font-bold leading-snug cursor-pointer ${playing === v.id ? 'bg-sky-500/20 text-sky-100' : 'bg-white/[0.04] text-slate-300'}`} onClick={() => setPlaying(playing === v.id ? '' : v.id)}>
                  ▶️ {v.title.slice(0, 34)}
                  <div className="text-[8px] text-slate-500 font-semibold">
                    {Math.round((v.durationSec || 0) * 10) / 10}s · {Math.round((v.sizeBytes || 0) / 1048576) || '<1'} MB · {new Date(v.createdAt).toLocaleDateString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={async () => {
                const r = await publishLatestVaultVideoToInstagram();
                onToast(r.ok ? `📸 Reel LIVE: ${r.permalink || 'posted'}` : `⚠️ ${r.skipped || r.error}`);
                refresh();
              }}
              className="w-full py-2 rounded-xl text-[10px] font-black bg-gradient-to-r from-pink-600 to-purple-600 text-white cursor-pointer"
            >
              📸 SABSE NAYA VIDEO IG PE BHEJO (R2/GitHub host auto)
            </button>
          </div>
        )}
      </div>

      {/* 🪣 R2 VAULT — FREE PUBLIC ASSET HOST (bade HD reel ke liye, GitHub 90 MB par atakta hai) */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10.5px] font-black text-slate-200">🪣 R2 VAULT — PUBLIC ASSET HOST</div>
          <button
            onClick={() => {
              const next = settings.assetHostKind === 'r2' ? 'github' : 'r2';
              patchIg({ assetHostKind: next });
              onToast(next === 'r2' ? '🪣 Video ab R2 se jaayega (bada file chalega, egress free)' : '🐙 Video GitHub raw se jaayega (90 MB tak)');
            }}
            className={`px-2 py-1 rounded-lg text-[9px] font-black cursor-pointer ${
              settings.assetHostKind === 'r2' ? 'bg-emerald-500/25 text-emerald-100' : 'bg-white/10 text-slate-300'
            }`}
          >
            {settings.assetHostKind === 'r2' ? '🪣 R2 ACTIVE' : '🐙 GITHUB HOST'}
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 leading-snug">
          Meta ko video ka <b>public link</b> chahiye. GitHub 90 MB commit cap par atak jaata hai — Cloudflare R2 (10 GB
          free, 0 egress) me HD reel aaram se jaati hai. R2 config adhoora ho to app apne aap GitHub par laut aata hai.
          <span className="text-slate-300"> {describeR2(r2)}</span>
        </div>
        <textarea
          value={r2Paste}
          onChange={(e) => setR2Paste(e.target.value)}
          placeholder={'Cloudflare dashboard → R2 → Manage R2 API Tokens → “Copy” ka pura blob yahan paste karo\n(endpoint + Access Key ID + Secret Access saath hi aayenge — app khud tod ke sahi split dhundh lega)'}
          className="w-full h-14 bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[9.5px] font-mono text-slate-200 resize-none"
        />
        <div className="grid grid-cols-2 gap-1.5">
          <input
            value={r2.endpoint}
            onChange={(e) => patchR2({ endpoint: e.target.value.trim() })}
            placeholder="R2 endpoint (https://&lt;acct&gt;.r2.cloudflarestorage.com)"
            className="col-span-2 bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white"
          />
          <input
            value={r2.bucket}
            onChange={(e) => patchR2({ bucket: e.target.value.trim() || 'apex' })}
            placeholder="bucket (apex)"
            className="bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white"
          />
          <input
            value={r2.keyPrefix}
            onChange={(e) => patchR2({ keyPrefix: e.target.value.trim() || 'vault' })}
            placeholder="folder (vault)"
            className="bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white"
          />
          <input
            value={r2.accessKeyId}
            onChange={(e) => patchR2({ accessKeyId: e.target.value.trim() })}
            placeholder="Access Key ID"
            className="bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white"
          />
          <input
            value={r2.secretAccessKey}
            onChange={(e) => patchR2({ secretAccessKey: e.target.value.trim() })}
            placeholder="Secret Access Key"
            type="password"
            className="bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white"
          />
          <input
            value={r2.publicBaseUrl}
            onChange={(e) => patchR2({ publicBaseUrl: e.target.value.trim() })}
            placeholder="public URL: https://pub-xxxx.r2.dev (optional)"
            className="col-span-2 bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white"
          />
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              const parsed = parseR2Paste(r2Paste);
              const cand = r2CredentialCandidates(r2Paste)[0];
              const patch: Partial<R2Settings> = { ...parsed, enabled: true };
              if (cand) {
                patch.accessKeyId = cand.accessKeyId;
                patch.secretAccessKey = cand.secretAccessKey;
              }
              if (!Object.keys(parsed).length && !cand) {
                onToast('⚠️ Paste me kuch padha nahi gaya — pura blob paste karo');
                return;
              }
              patchR2(patch);
              onToast(cand ? `✂️ Paste se bhar diya (split: ${cand.label}) — ab 🧪 R2 CHECK dabao` : '✂️ Endpoint/bucket bhar diya');
            }}
            className="flex-1 py-2 rounded-xl text-[10px] font-black bg-white/10 text-slate-200 cursor-pointer"
          >
            ✂️ PASTE SE BHARO
          </button>
          <button
            disabled={r2Busy}
            onClick={async () => {
              setR2Busy(true);
              try {
                const r = await checkR2Access({ ...r2, ...(r2Paste.trim() ? { pasteForCreds: r2Paste } : {}) });
                setR2Report(r);
                onToast(r.ok ? `🪣 ${r.note}` : `⚠️ ${r.note}`);
                if (r.credsOk) setR2(loadR2Settings());
              } catch (e: any) {
                setR2Report({ ok: false, note: String(e?.message || 'R2 check fail') });
                onToast('⚠️ R2 check nahi ho paya');
              } finally {
                setR2Busy(false);
              }
            }}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black cursor-pointer ${r2Busy ? 'bg-white/10 text-slate-400' : 'bg-gradient-to-r from-cyan-600 to-emerald-600 text-white'}`}
          >
            {r2Busy ? '⏳ R2 probe…' : '🧪 R2 CHECK'}
          </button>
          <button
            disabled={r2Busy}
            onClick={async () => {
              setR2Busy(true);
              try {
                const r = await ensureR2Cors(r2);
                onToast(r.ok ? '🛠️ CORS policy set — ab browser/WebView se PUT/GET chalega' : `⚠️ ${r.error}`);
              } finally {
                setR2Busy(false);
              }
            }}
            className="px-2 py-2 rounded-xl text-[9.5px] font-black bg-white/10 text-slate-200 cursor-pointer"
          >
            🛠️ CORS<br />FIX
          </button>
          <button
            onClick={() => patchR2({ useWorkerProxy: !r2.useWorkerProxy })}
            className={`px-2 py-2 rounded-xl text-[9.5px] font-black cursor-pointer ${r2.useWorkerProxy ? 'bg-sky-500/25 text-sky-100' : 'bg-white/10 text-slate-300'}`}
          >
            🔗 HUB /asset/<br />PROXY
          </button>
        </div>
        {r2Report && (
          <div
            className={`rounded-xl px-2 py-1.5 text-[9px] font-bold leading-snug ${r2Report.ok ? 'bg-emerald-500/15 text-emerald-200' : 'bg-rose-500/15 text-rose-200'}`}
          >
            🪣 R2: creds {r2Report.credsOk ? '✅' : '❌'} · bucket {r2Report.bucketExists ? '✅' : '❌'} · write{' '}
            {r2Report.writeOk ? '✅' : '❌'} · public read {r2Report.publicReadOk ? '✅' : '❌'}
            {r2Report.matchedLabel ? ` · split: ${r2Report.matchedLabel}` : ''}
            {r2Report.buckets && r2Report.buckets.length ? ` · buckets: ${r2Report.buckets.join(', ')}` : ''} —{' '}
            {r2Report.note}
          </div>
        )}
      </div>


      {/* 🎬 MOTION FORGE — ek line se cinematic reel (KATANA style, ₹0) */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10.5px] font-black text-slate-200">🎬 MOTION FORGE — PROMPT SE REEL</div>
          <span className={`px-2 py-1 rounded-lg text-[9px] font-black ${motionForgeSupported().ok ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-200'}`}>
            {motionForgeSupported().ok ? 'READY · 0 API COST' : 'RECORDER NAHI'}
          </span>
        </div>
        <div className="text-[9px] font-bold text-slate-400 leading-snug">
          KATANA/After Effects wala kaam bina paisa: kinetic typography + morphing shapes + camera moves + transitions —
          Canvas + MediaRecorder se 1080×1920 reel, seedha <b>Vault</b> me (Save-First), wahan se 📸/📘/▶️.
        </div>
        <textarea
          value={mfPrompt}
          onChange={(e) => setMfPrompt(e.target.value)}
          placeholder='Prompt likho, e.g. "41 agents, 0 meetings, 10x faster delivery. Follow APEX for the setup."'
          className="w-full h-16 bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-100 resize-none"
        />
        <div className="text-[9px] font-black text-emerald-200">🎛️ REEL ENGINE — Head Bot isi engine se auto reel banayega</div>
        <div className="text-[9px] font-bold text-slate-400 leading-snug">🔁 pipeline: 🌐 live research → 🕵️ clips → ✨ motion render (watchdog 120s, stuck nahi hota) → 💾 Vault + Gallery → ⏰ time par upload</div>
        {isAppleTouch() && (
          <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1.5 space-y-1">
            <div className="text-[9px] font-black text-amber-100">🍎 iPHONE MODE — jo sach me chal sakta hai</div>
            <div className="text-[8.5px] font-bold text-amber-100/80 leading-snug">{iosAutopilotNote()}</div>
            <div className="flex gap-1.5">
              <button
                disabled={!wakeLockSupported()}
                onClick={async () => {
                  if (screenLock === 'on') { releaseAwake(); setScreenLock('off'); onToast('🖥️ Screen lock chhod diya'); return; }
                  const ok = await keepAwake('user');
                  setScreenLock(wakeLockState());
                  onToast(ok ? '🖥️ Screen jaagti rahegi — autopilot ke waqt phone so nahi jayega' : '⚠️ Wake Lock nahi mila (iOS 16.4+ / battery saver off karo)');
                }}
                className={`px-2 py-1 rounded-lg text-[8.5px] font-black cursor-pointer disabled:opacity-40 ${screenLock === 'on' ? 'bg-emerald-500/25 text-emerald-100' : 'bg-white/10 text-slate-200'}`}
              >
                {screenLock === 'on' ? '🖥️ SCREEN ON: ON' : wakeLockSupported() ? '🖥️ SCREEN ON KARO' : '🖥️ WAKE LOCK NAHI'}
              </button>
              <button
                onClick={() => {
                  const r = resumeInterruptedMissions({ staleMs: 0 });
                  onToast(r.found ? `🍎 Catch-up: ${r.requeued} render + ${r.uploadRetried} upload dobara queue me` : '🍎 Koi adhoori mission nahi mili');
                  refresh();
                }}
                className="px-2 py-1 rounded-lg text-[8.5px] font-black bg-white/10 text-slate-200 cursor-pointer"
              >
                🔁 CATCH-UP CHALAO
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {(['auto', 'footage', 'motion'] as const).map((k) => (
            <button
              key={k}
              onClick={() => { patchIg({ reelEngine: k }); onToast(k === 'motion' ? '🎛️ Engine: Motion Forge (0 GPU, 0 paisa)' : k === 'footage' ? '🎛️ Engine: web footage' : '🎛️ Engine: auto (motion pehle, fail par footage)'); }}
              className={`px-2 py-1 rounded-lg text-[9px] font-black cursor-pointer ${settings.reelEngine === k ? 'bg-emerald-500/25 text-emerald-100' : 'bg-white/10 text-slate-300'}`}
            >
              {k === 'auto' ? '🎲 AUTO' : k === 'footage' ? '📹 FOOTAGE' : '✨ MOTION'}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            disabled={autoReelBusy}
            onClick={async () => {
              setAutoReelBusy(true);
              setAutoReelLine('🌐 research → 🎬 render → 💾 save…');
              try {
                const goal = mfPrompt.trim().length > 6 ? mfPrompt.trim() : 'AI agents se chhote business ki growth (India)';
                patchIg({ autoPublishDefault: autoPublish });
                const mission = await runMissionNow(
                  { goal, niche: goal, targetSeconds: 30, platforms: { instagram: true, facebook: true, youtube: true } },
                  (m) => setAutoReelLine(`${m.stage || m.status} · ${m.progress || 0}%`)
                );
                setAutoReelLine(mission ? `✅ ${mission.status} · ${mission.title || mission.goal}` : '⚠️ mission nahi chala (worker/research fail — footage fallback dekho)');
                onToast(mission ? `🎬 Auto reel: ${mission.status}` : '⚠️ Auto reel fail');
                refresh();
              } catch (e: any) {
                setAutoReelLine(`⚠️ ${String(e?.message || e).slice(0, 110)}`);
              } finally {
                setAutoReelBusy(false);
              }
            }}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black cursor-pointer ${autoReelBusy ? 'bg-white/10 text-slate-400' : 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white'}`}
          >
            {autoReelBusy ? '⏳ AUTO REEL CHAL RAHI…' : '🤖 AUTO REEL CHALAO'}
          </button>
          <button
            onClick={() => { setAutoPublish(!autoPublish); patchIg({ autoPublishDefault: !autoPublish }); onToast(!autoPublish ? '📤 Save + publish ON' : '💾 Sirf save (Save-First) ON'); }}
            className={`px-2 py-2 rounded-xl text-[9px] font-black cursor-pointer ${autoPublish ? 'bg-amber-500/25 text-amber-100' : 'bg-white/10 text-slate-200'}`}
          >
            {autoPublish ? '📤 SAVE + PUBLISH' : '📥 SIRF SAVE'}
          </button>
        </div>
        {!!autoReelLine && <div className="text-[9px] font-bold text-emerald-200/90 leading-snug">{autoReelLine}</div>}
        <div className="flex flex-wrap gap-1.5">
          {(['auto', 'neon-pulse', 'kino-glass', 'brutal-flash'] as const).map((k) => (
            <button
              key={k}
              onClick={() => { setMfStyle(k); if (k !== 'auto') patchIg({ motionStyle: k }); }}
              className={`px-2 py-1 rounded-lg text-[9px] font-black cursor-pointer ${mfStyle === k ? 'bg-fuchsia-500/25 text-fuchsia-100' : 'bg-white/10 text-slate-300'}`}
            >
              {k === 'auto' ? '🎲 AUTO' : k === 'neon-pulse' ? '⚡ NEON' : k === 'kino-glass' ? '🎥 KINO' : '🔥 BRUTAL'}
            </button>
          ))}
        </div>
        {mfPrompt.trim().length > 3 && (
          <div className="text-[9px] font-bold text-slate-400">📋 Brief: {describeMotionBrief(parseMotionBrief(mfPrompt, { style: (mfStyle === 'auto' ? undefined : mfStyle) as any }))}</div>
        )}
        <div className="flex gap-1.5">
          <button
            disabled={mfBusy || mfPrompt.trim().length < 4}
            onClick={async () => {
              setMfBusy(true);
              setMfPct(0);
              setMfOut(null);
              try {
                const res = await renderMotionForgeVideo(mfPrompt.trim(), {
                  style: mfStyle === 'auto' ? (undefined as any) : mfStyle,
                  saveToVault: true,
                  onProgress: (p) => setMfPct(p),
                });
                if (res.ok) {
                  setMfUrl(res.url || '');
                  setMfOut({ ok: true, text: `✅ ${Math.round((res.durationSec || 0) * 10) / 10}s · ${Math.round(((res.blob?.size || 0) / 1048576) * 10) / 10} MB · ${res.frames} frames → Vault me save ${res.vaultId ? '✅' : '⚠️'}`, vaultId: res.vaultId });
                  onToast('🎬 Motion reel taiyaar — Vault me save ho gayi');
                } else {
                  setMfOut({ ok: false, text: `⚠️ ${res.error}` });
                  onToast('⚠️ Render fail');
                }
              } catch (e: any) {
                setMfOut({ ok: false, text: `⚠️ ${String(e?.message || e).slice(0, 120)}` });
              } finally {
                setMfBusy(false);
                setMfPct(0);
              }
            }}
            className={`flex-1 py-2 rounded-xl text-[10.5px] font-black cursor-pointer ${mfBusy ? 'bg-white/10 text-slate-400' : 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white'}`}
          >
            {mfBusy ? `⏳ ${Math.round(mfPct * 100)}% render…` : '▶️ RENDER KARO → VAULT SAVE'}
          </button>
          <button
            disabled={mfBusy || !mfOut?.vaultId}
            onClick={async () => {
              const r = await publishLatestVaultVideoToInstagram();
              onToast(r.ok ? `📸 Reel LIVE: ${r.permalink || 'posted'}` : `⚠️ ${r.skipped || r.error}`);
              refresh();
            }}
            className="px-2 py-2 rounded-xl text-[9.5px] font-black bg-white/10 text-slate-200 cursor-pointer disabled:opacity-40"
          >
            📸 IG<br />PE BHEJO
          </button>
        </div>
        {mfBusy && mfPct > 0 && <div className="h-1 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-fuchsia-400" style={{ width: `${Math.round(mfPct * 100)}%` }} /></div>}
        {mfOut && (
          <div className={`rounded-xl px-2 py-1.5 text-[9px] font-bold leading-snug ${mfOut.ok ? 'bg-emerald-500/15 text-emerald-200' : 'bg-rose-500/15 text-rose-200'}`}>{mfOut.text}</div>
        )}
        {mfUrl && (
          <video src={mfUrl} controls playsInline className="w-full max-h-[300px] rounded-xl bg-black border border-white/15" />
        )}
      </div>

      {/* 🏢 COMPANY MODE — agents chala rahe hain, sirf ek human (aap) */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10.5px] font-black text-slate-200">🏢 COMPANY MODE — AAP AKELA HUMAN</div>
          <button
            onClick={() => setSuDeep((v) => !v)}
            className={`px-2 py-1 rounded-lg text-[9px] font-black cursor-pointer ${suDeep ? 'bg-sky-500/25 text-sky-100' : 'bg-white/10 text-slate-300'}`}
          >
            {suDeep ? '🔬 DEEP ON' : '🔬 DEEP OFF'}
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 leading-snug">
          Har department ka sub-bot apni <b>asal</b> jaanch karta hai (hub /health, GitHub, R2, voice lock, brain, trading keys) —
          blocker mile to seedha 📚 brain file me OPEN entry ban jaati hai. Trade/social kuch bhi standup me khud nahi hota.
        </div>
        <button
          disabled={suBusy}
          onClick={async () => {
            setSuBusy(true);
            try {
              const res = await runCompanyStandup({ deep: suDeep });
              setStandup(res);
              saveStandupCache(res);
              onToast(res.red ? `🏢 ${res.red} department blocker par — brain me likh diya` : `🏢 Sab green ✅ (${res.green} depts)`);
            } catch (e: any) {
              onToast(`⚠️ Standup fail: ${String(e?.message || e).slice(0, 80)}`);
            } finally {
              setSuBusy(false);
            }
          }}
          className={`w-full py-2 rounded-xl text-[10.5px] font-black cursor-pointer ${suBusy ? 'bg-white/10 text-slate-400' : 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white'}`}
        >
          {suBusy ? '⏳ Departments check ho rahe hain…' : '☀️ STANDUP CHALAO (live checks)'}
        </button>
        {standup && (
          <div className="space-y-1.5">
            <div className="flex gap-1.5 text-[9px] font-black">
              <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-200">🟢 {standup.green}</span>
              <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-100">🟡 {standup.amber}</span>
              <span className="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-200">🔴 {standup.red}</span>
              <span className="px-2 py-1 rounded-lg bg-white/10 text-slate-300">⏱ {standup.durationMs} ms</span>
            </div>
            {standup.reports.map((d) => (
              <div key={d.id} className="rounded-xl bg-white/[0.03] px-2 py-1.5 text-[9px] leading-snug">
                <span className="font-black text-slate-100">
                  {d.status === 'green' ? '🟢' : d.status === 'amber' ? '🟡' : '🔴'} {d.emoji} {d.dept}
                </span>
                <span className="text-slate-400"> · {d.agent}</span>
                <div className="text-slate-300">{d.evidence}</div>
                {d.task && <div className="text-amber-200/90">↳ {d.task}{d.logged ? ' (📚 brain me OPEN)' : ''}</div>}
              </div>
            ))}
            <div className="text-[8.5px] font-bold text-slate-500">
              {new Date(standup.at).toLocaleString('en-IN', { hour12: true })} · voice me: &quot;company standup&quot;
            </div>
          </div>
        )}
      </div>

      {/* 🔐 VOICE LOCK + 🎯 WORD CONFIRM + 👁️ OUTSIDE EYE */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10.5px] font-black text-slate-200">🔐 AWAAZ PEHCHAAN + 🎯 WORD CONFIRM</div>
          <button
            onClick={() => {
              const next = saveVoiceLock({ enabled: !vlock.enabled });
              refreshVoice();
              onToast(next.enabled ? '🔐 Voice lock ON — awaaz verify ke bina paisa/password bola nahi jayega' : '🔓 Voice lock OFF — sab kuch bolega');
            }}
            className={`px-2 py-1 rounded-lg text-[9px] font-black cursor-pointer ${vlock.enabled ? 'bg-emerald-500/25 text-emerald-100' : 'bg-white/10 text-slate-300'}`}
          >
            {vlock.enabled ? '✅ LOCK ON' : '⭕ OFF'}
          </button>
        </div>
        <div className="text-[9px] font-semibold text-slate-400 leading-snug">
          Do cheezein: <b>(1)</b> APEX aapki awaaz pehchaanta hai — anjaan/unverified awaaz ko <b>₹ number, balance, password, OTP bol kar nahi</b> batayega
          (screen par dikhega hi). <b>(2)</b> Jo word galat suna ho sakta hai, usi word ka sawaal poochhta hai — <i>&quot;maine 'block' suna — 'blog' ya
          'block'?&quot;</i> — short answer (haan/band/ruko) par kabhi nahi poochhta, aur <b>lagataar 2 baar nahi</b> poochhta.
        </div>
        <div className="text-[8.5px] font-bold text-amber-200/80 leading-snug">
          ⚠️ Imaandari se: ye device par bana 16-feature spectral voice profile hai — bank-grade voiceprint nahi (koi 2-4 word ka sample aasani se pass ho
          sakta hai, isliye ise "sensitive cheezein bolne ka lock" samjhiye, vault nahi). Android ka native recognizer mic kheench leta hai, isliye verify alag
          1.6-second sample leta hai; ek baar pass ho jaye to {vlock.sessionLeftMin > 0 ? `${vlock.sessionLeftMin} min` : `${vlock.sessionMinutes} min`} ka owner session chalta hai.
        </div>

        <div className="flex flex-wrap gap-1.5 text-[8.5px] font-black">
          <span className={`px-2 py-1 rounded-lg ${vlock.enrolled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-200'}`}>
            {vlock.enrolled ? `✅ profile ready (${vlock.samples} samples)` : '⏳ awaaz enroll karein'}
          </span>
          <span className={`px-2 py-1 rounded-lg ${vlock.placed ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-200'}`}>
            {vlock.placed ? `🔓 owner session (verified)` : '🔒 awaaz unverified'}
          </span>
          <span className="px-2 py-1 rounded-lg bg-white/5 text-slate-300">🎚 match ≥ {vlock.threshold}%</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-slate-400">THRESHOLD</span>
          <input
            type="range"
            min={55}
            max={95}
            step={1}
            value={vlock.threshold}
            onChange={(e) => {
              saveVoiceLock({ threshold: Number(e.target.value) });
              refreshVoice();
            }}
            className="flex-1"
          />
          <span className="text-[9.5px] font-black text-slate-200 w-8 text-right">{vlock.threshold}%</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => {
              const next = saveVoiceLock({ muteSensitive: !vlock.muteSensitive });
              refreshVoice();
              onToast(next.muteSensitive ? '🔒 Sensitive reply sirf screen par (unverified awaaz)' : '🔊 Sensitive reply bol kar bhi chalega');
            }}
            className={`px-2 py-1.5 rounded-xl text-[9.5px] font-black cursor-pointer ${vlock.muteSensitive ? 'bg-violet-600/70 text-white' : 'bg-white/10 text-slate-300'}`}
          >
            🔒 SENSITIVE SIRF SCREEN
          </button>
          <button
            onClick={() => {
              const next = saveVoiceLock({ askUncertain: !vlock.askUncertain });
              refreshVoice();
              onToast(next.askUncertain ? '🎯 Word confirm ON' : '🎯 Word confirm OFF');
            }}
            className={`px-2 py-1.5 rounded-xl text-[9.5px] font-black cursor-pointer ${vlock.askUncertain ? 'bg-sky-500/25 text-sky-100' : 'bg-white/10 text-slate-300'}`}
          >
            🎯 WORD CONFIRM
          </button>
          <button
            onClick={() => {
              const next = saveVoiceLock({ sessionMinutes: ((Number(vlock.sessionMinutes) || 10) % 60) + 5 });
              refreshVoice();
              onToast(`⏱ Owner session ab ${next.sessionMinutes} min tak chalega`);
            }}
            className="px-2 py-1.5 rounded-xl text-[9.5px] font-black bg-white/10 text-slate-200 cursor-pointer"
          >
            ⏱ SESSION {vlock.sessionMinutes} MIN
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            disabled={!!veBusy}
            onClick={async () => {
              setVeBusy('enroll');
              try {
                const r = await enrollOwner((msg, i) => onToast(`🎤 ${i + 1}/3 — ${msg}`));
                onToast(r.ok ? `🔐 ${r.note}` : `⚠️ ${r.note}`);
                refreshVoice();
              } finally {
                setVeBusy('');
              }
            }}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black cursor-pointer ${veBusy === 'enroll' ? 'bg-white/10 text-slate-400' : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white'}`}
          >
            {veBusy === 'enroll' ? '🎤 Boliye… (3 samples)' : '🎤 APNI AWAAZ REGISTER KARO (3 BAAR)'}
          </button>
          <button
            disabled={!!veBusy}
            onClick={async () => {
              setVeBusy('verify');
              try {
                const r = await verifyOwnerNow('panel');
                onToast(r.ok ? `✅ ${r.note}` : `🔒 ${r.note}`);
                refreshVoice();
              } finally {
                setVeBusy('');
              }
            }}
            className={`px-2.5 py-2 rounded-xl text-[9.5px] font-black cursor-pointer ${veBusy === 'verify' ? 'bg-white/10 text-slate-400' : 'bg-white/10 text-slate-200'}`}
          >
            {veBusy === 'verify' ? '⏳…' : '✅ ABHI VERIFY'}
          </button>
          <button
            onClick={() => {
              clearVoicePrint();
              refreshVoice();
              onToast('🗑 Voice profile hata di (lock ab enforce nahi karega jab tak dobara enroll)');
            }}
            className="px-2.5 py-2 rounded-xl text-[9.5px] font-black bg-rose-600/25 text-rose-200 cursor-pointer"
          >
            🗑 PROFILE HATAO
          </button>
        </div>

        <button
          onClick={() => {
            const sample = 'Aapka total balance ₹48,320 hai aur spot cash ₹12,000 hai.';
            onToast(
              `🧪 sensitive test: ${isSensitiveText(sample) ? 'text sensitive flag hua' : '⚠️ flag nahi hua'} • owner placed: ${
                isOwnerPlaced() ? 'haan (bolega)' : 'nahi (sirf screen)'
              }`
            );
          }}
          className="text-[9px] font-black text-slate-400 cursor-pointer"
        >
          🧪 SENSITIVE-DETECT TEST
        </button>

        {/* 👁️ BAHAR KI AANKH — project ka outside review */}
        <div className="pt-1 border-t border-white/5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-black text-slate-200">👁️ BAHAR KI AANKH (outside review)</div>
            <button
              disabled={eyeBusy}
              onClick={async () => {
                setEyeBusy(true);
                setEyeText('…padh raha hoon');
                try {
                  const r = await runOutsideEye();
                  setEyeText(r.ok ? r.text : `⚠️ ${r.note || 'review fail'}`);
                  onToast(r.ok ? `👁️ Review aa gaya (${r.source})` : '⚠️ Review nahi ho paya');
                } finally {
                  setEyeBusy(false);
                }
              }}
              className={`px-2.5 py-1.5 rounded-xl text-[9.5px] font-black cursor-pointer ${eyeBusy ? 'bg-white/10 text-slate-400' : 'bg-amber-500/25 text-amber-100'}`}
            >
              {eyeBusy ? '⏳…' : '🔊 ABHI REVIEW LO'}
            </button>
          </div>
          <div className="text-[8.5px] font-semibold text-slate-500 leading-snug">
            Brain file + apna core log padh ke 3 risk, 3 next step aur 1 STOP deta hai — jo NEXT/STOP me aaye wahi brain ke OPEN section me save hota hai.
          </div>
          {eyeText && (
            <textarea
              readOnly
              value={eyeText}
              onFocus={(e) => e.currentTarget.select()}
              rows={6}
              className="w-full bg-[#050a12] border border-white/10 rounded-xl p-2 font-mono text-[9px] leading-snug text-slate-200"
            />
          )}
        </div>
      </div>

      {/* 📚 BRAIN FILE — persistent memory (CLAUDE.md pattern, reel wala fix) */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10.5px] font-black text-slate-200">📚 BRAIN FILE — jo kabhi nahi bhoolna chahiye</div>
          <div className="flex gap-1">
            <button
              onClick={() => {
                const next = saveBrain({ autoWrite: !brain.autoWrite });
                setBrain(next);
                onToast(next.autoWrite ? '🧠 Auto-write ON (har kaam ke baad brain khud update)' : '🧠 Auto-write OFF (sirf aapke notes)');
              }}
              className={`px-2 py-1 rounded-lg text-[9px] font-black cursor-pointer ${brain.autoWrite ? 'bg-emerald-500/25 text-emerald-100' : 'bg-white/10 text-slate-300'}`}
            >
              🧠 AUTO-WRITE
            </button>
            <button
              onClick={() => {
                const next = saveBrain({ autoSync: !brain.autoSync });
                setBrain(next);
                onToast(next.autoSync ? '📤 Auto-sync ON (har entry ke baad GitHub + server)' : '📤 Auto-sync OFF');
              }}
              className={`px-2 py-1 rounded-lg text-[9px] font-black cursor-pointer ${brain.autoSync ? 'bg-sky-500/25 text-sky-100' : 'bg-white/10 text-slate-300'}`}
            >
              📤 AUTO-SYNC
            </button>
          </div>
        </div>
        <div className="text-[9px] font-semibold text-slate-400 leading-snug">
          Ye problem solve karta hai: AI har nayi chat me sab bhool jaata hai (kal ka kaam aaj dobara banana padta hai). Isliye APEX ek{' '}
          <b>persistent brain file</b> rakhta hai — <b>har AI reply (chat/voice) me ise padhta hai</b> aur <b>har autonomous kaam ke baad khud update</b>{' '}
          karta hai (trade, guard skip, video, publish, research). Chaho toh ise GitHub par <b>CLAUDE.md + AGENTS.md</b> bana kar likh do — phir koi bhi
          coding agent aapka repo kholte hi project samajh jaayega.
        </div>
        <div className="flex flex-wrap gap-1.5 text-[8.5px] font-black">
          <span className="px-2 py-1 rounded-lg bg-white/5 text-slate-300">🧾 {brain.entries.length} lines</span>
          <span className="px-2 py-1 rounded-lg bg-white/5 text-slate-300">
            ✍️ {brain.updatedAt ? new Date(brain.updatedAt).toLocaleString('en-IN') : 'abhi khaali'}
          </span>
          <span className={`px-2 py-1 rounded-lg ${brain.autoWrite ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-200'}`}>
            {brain.autoWrite ? '✅ khud likhta hai' : '⏳ sirf aapke notes'}
          </span>
        </div>

        <div className="flex gap-1.5">
          <select
            value={brainKind}
            onChange={(e) => setBrainKind(e.target.value as BrainKind)}
            className="bg-[#0b1220] border border-white/10 rounded-lg px-1.5 py-1.5 text-[9.5px] font-bold text-white"
          >
            <option value="rule">⚖️ RULE</option>
            <option value="project">🏗️ PROJECT</option>
            <option value="decision">🧠 DECISION</option>
            <option value="open">⏳ OPEN</option>
            <option value="learned">📌 NOTE</option>
          </select>
          <input
            value={brainNote}
            onChange={(e) => setBrainNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && brainNote.trim()) {
                rememberBrain(brainKind, brainNote);
                setBrainNote('');
                setBrain(loadBrain());
                onToast('📚 Brain me likh diya — ab har session me dikhega');
              }
            }}
            placeholder="jaise: Telegram alert sirf shaam 7 ke baad bhejo"
            className="flex-1 bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white"
          />
          <button
            onClick={() => {
              if (!brainNote.trim()) return onToast('⚠️ Pehle line likhiye');
              rememberBrain(brainKind, brainNote);
              setBrainNote('');
              setBrain(loadBrain());
              onToast('📚 Brain me likh diya');
            }}
            className="px-2.5 py-1.5 rounded-xl text-[10px] font-black bg-[#38bdf8] text-[#04141d] cursor-pointer"
          >
            ➕ LIKHO
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setBrainShow((v) => !v)}
            className="px-2.5 py-1.5 rounded-xl text-[9.5px] font-black bg-white/10 text-slate-200 cursor-pointer"
          >
            {brainShow ? '🙈 CHHUPAO' : '📄 MARKDOWN DEKHO'}
          </button>
          <button
            onClick={() => {
              const md = exportBrainMarkdown();
              try {
                void apexCopy(md);
                onToast('📋 Brain markdown copy ho gaya');
              } catch {
                onToast('⚠️ Copy nahi hua — “MARKDOWN DEKHO” se select kar lein');
              }
            }}
            className="px-2.5 py-1.5 rounded-xl text-[9.5px] font-black bg-white/10 text-slate-200 cursor-pointer"
          >
            📋 COPY
          </button>
          <button
            disabled={!!brainBusy}
            onClick={async () => {
              setBrainBusy('gh');
              try {
                const r = await syncBrainToGithub();
                onToast(r.ok ? `📤 ${r.note}` : `⚠️ ${r.note}`);
              } finally {
                setBrainBusy('');
              }
            }}
            className={`px-2.5 py-1.5 rounded-xl text-[9.5px] font-black cursor-pointer ${brainBusy === 'gh' ? 'bg-white/10 text-slate-400' : 'bg-emerald-600/80 text-white'}`}
          >
            {brainBusy === 'gh' ? '⏳…' : '📤 GITHUB: CLAUDE.md + AGENTS.md'}
          </button>
          <button
            disabled={!!brainBusy}
            onClick={async () => {
              setBrainBusy('ghpull');
              try {
                const r = await pullBrainFromGithub();
                setBrain(loadBrain());
                onToast(r.ok ? `⬇️ ${r.note}` : `⚠️ ${r.note}`);
              } finally {
                setBrainBusy('');
              }
            }}
            className={`px-2.5 py-1.5 rounded-xl text-[9.5px] font-black cursor-pointer ${brainBusy === 'ghpull' ? 'bg-white/10 text-slate-400' : 'bg-white/10 text-slate-200'}`}
          >
            {brainBusy === 'ghpull' ? '⏳…' : '⬇️ GITHUB SE LAO'}
          </button>
          <button
            disabled={!!brainBusy}
            onClick={async () => {
              setBrainBusy('srv');
              try {
                const r = await pushBrainToWorker();
                onToast(r.ok ? `☁️ ${r.note}` : `⚠️ ${r.note}`);
              } finally {
                setBrainBusy('');
              }
            }}
            className={`px-2.5 py-1.5 rounded-xl text-[9.5px] font-black cursor-pointer ${brainBusy === 'srv' ? 'bg-white/10 text-slate-400' : 'bg-violet-600/80 text-white'}`}
          >
            {brainBusy === 'srv' ? '⏳…' : '☁️ SERVER (KV) PAR BHEJO'}
          </button>
          <button
            disabled={!!brainBusy}
            onClick={async () => {
              setBrainBusy('srvpull');
              try {
                const r = await pullBrainFromWorker();
                setBrain(loadBrain());
                onToast(r.ok ? `☁️ ${r.note}` : `⚠️ ${r.note}`);
              } finally {
                setBrainBusy('');
              }
            }}
            className={`px-2.5 py-1.5 rounded-xl text-[9.5px] font-black cursor-pointer ${brainBusy === 'srvpull' ? 'bg-white/10 text-slate-400' : 'bg-white/10 text-slate-200'}`}
          >
            {brainBusy === 'srvpull' ? '⏳…' : '⬇️ NAYE PHONE ME LAO (KV)'}
          </button>
          <button
            onClick={() => {
              clearBrainSection('done');
              setBrain(loadBrain());
              onToast('🧹 DONE LOG saaf kiya — rules/decisions safe hain');
            }}
            className="px-2.5 py-1.5 rounded-xl text-[9.5px] font-black bg-rose-600/25 text-rose-200 cursor-pointer"
          >
            🧹 DONE LOG SAFAI
          </button>
        </div>

        <input
          value={brainLock}
          onChange={(e) => {
            const v = e.target.value.trim();
            setBrainLock(v);
            writeBrainLock(v);
          }}
          placeholder="🔑 Brain lock key (optional — worker ka APEX_BRAIN_KEY)"
          className="w-full bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white"
        />

        {brainShow && (
          <textarea
            readOnly
            value={brainMd}
            onFocus={(e) => e.currentTarget.select()}
            rows={10}
            className="w-full bg-[#050a12] border border-white/10 rounded-xl p-2 font-mono text-[9px] leading-snug text-slate-200"
          />
        )}

        <details className="text-[9px] font-semibold text-slate-400">
          <summary className="cursor-pointer select-none">🧾 Brain ki lines (delete karne ke liye)</summary>
          <div className="max-h-40 overflow-y-auto space-y-1 pt-1">
            {brain.entries.length === 0 && <div className="text-slate-600">Abhi brain khaali hai — ek line likhiye ya Jarvis ko kaam karne dijiye.</div>}
            {brain.entries.map((e) => (
              <div key={e.id} className="flex items-start gap-1.5 bg-white/5 rounded-lg px-1.5 py-1">
                <span className="text-[8px] font-black text-slate-400 shrink-0 mt-0.5">{e.kind.toUpperCase()}</span>
                <span className="flex-1 text-[9px] font-bold text-slate-200 leading-snug">{e.text}</span>
                <button onClick={() => setBrain(forgetBrain(e.id))} className="text-[9px] font-black text-rose-300 cursor-pointer shrink-0">
                  ✕
                </button>
              </div>
            ))}
          </div>
        </details>
      </div>

      {/* LIVE CORE LOG */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#050a12] p-2.5">
        <div className="text-[9.5px] font-black text-slate-400 mb-1">🛰️ CORE LOG</div>
        <div className="max-h-32 overflow-y-auto font-mono text-[9.5px] space-y-0.5">
          {st.log.length === 0 && <div className="text-slate-600">Abhi koi auto-kaam nahi hua. Core ON karein — agla slot main khud chalaunga.</div>}
          {st.log
            .slice(-24)
            .reverse()
            .map((l, i) => (
              <div key={i} className={l.level === 'ok' ? 'text-emerald-300' : l.level === 'warn' ? 'text-amber-300' : 'text-slate-300'}>
                › {new Date(l.t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} {l.line}
              </div>
            ))}
        </div>
      </div>

      <div className="text-[8.5px] font-semibold text-slate-500 leading-snug px-1">
        ⚖️ Main kya JAAN-BUJH kar nahi karta: koi naya account khud banana, ya aapke password se doosre app me ghus kar auto-login karna —
        isse account suspend hota hai. Iski jagah official API (aapki ek-baar ki permission) se poora kaam ho jata hai — wahi chal raha hai.
      </div>
    </div>
  );
};

export default JarvisAutonomyPanel;
