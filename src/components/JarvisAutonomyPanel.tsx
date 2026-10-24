/**
 * 🛰️ JARVIS AUTONOMY CORE PANEL — "Khud ka system"
 * Boss ko ek bhi order nahi dena: live research → video → save → publish →
 * comments padhna → AI reply → market cycle (sub-bots research → Head Bot khud BUY/SELL).
 * Sab kuch limits + kill switch ke andar, sirf aapke APNE content/accounts par.
 */

import React, { useCallback, useEffect, useState } from 'react';
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
import { loadSettings, saveSettings } from '../engine/headBotAutopilot';
import { publishLatestVaultVideoToInstagram } from '../engine/jarvisCore';
import { hubFetch } from '../engine/api';
import { checkGithubAccess } from '../engine/assetHost';
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

  return (
    <div className="space-y-2.5">
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
            onClick={patrolNow}
            disabled={patrolling}
            className={`flex-1 py-2 rounded-xl text-[10.5px] font-black cursor-pointer ${
              patrolling ? 'bg-white/10 text-slate-400' : 'bg-gradient-to-r from-fuchsia-600 to-sky-600 text-white'
            }`}
          >
            {patrolling ? '🔎 Comments padh raha hoon…' : '🔎 ABHI PATROL KARO'}
          </button>
          <button
            onClick={async () => {
              const r = await syncOwnInstagramMedia();
              refresh();
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
                          await navigator.clipboard.writeText(d.replyText);
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
            onClick={runCycle}
            disabled={cycleBusy}
            className={`flex-1 py-2 rounded-xl text-[10.5px] font-black cursor-pointer ${
              cycleBusy ? 'bg-white/10 text-slate-400' : 'bg-gradient-to-r from-amber-500 to-rose-600 text-white'
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
              autoPl.autoReplyComments ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/10 text-slate-300'
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
            className={`px-2 py-2 rounded-xl text-[9.5px] font-black cursor-pointer ${ghBusy ? 'bg-white/10 text-slate-400' : 'bg-white/10 text-slate-200'}`}
          >
            {ghBusy ? '⏳…' : '🧪 GITHUB<br />ACCESS CHECK'}
          </button>
          <button
            onClick={() => {
              const next = saveState({ autoDiscoverIg: !st.autoDiscoverIg });
              setSt(next);
              onToast(next.autoDiscoverIg ? '📸 Apne reels khud dhoondhe jayenge' : '📸 Auto-discover OFF');
            }}
            className={`px-2 py-2 rounded-xl text-[9.5px] font-black cursor-pointer ${st.autoDiscoverIg ? 'bg-sky-500/25 text-sky-100' : 'bg-white/10 text-slate-300'}`}
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
                void navigator.clipboard?.writeText(md);
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
