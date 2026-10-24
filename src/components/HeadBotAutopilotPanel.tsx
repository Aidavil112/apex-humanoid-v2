/**
 * 👑 HEAD BOT AUTOPILOT HQ — Boss bolta hai, Head Bot khud:
 *   🌐 online research karta hai → 🕵️ dusri website se real HD footage dhundhta hai →
 *   🎬 video bana kar 💾 Vault + Gallery me SAVE karta hai → ⏰ set time pe khud upload karta hai
 *   (YouTube = permanent Google Auto-Login token se headless publish, 📘 FB Page = Graph token, 📸 IG = 1-tap handoff).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  armDailyAlarm,
  createMission,
  deleteMission,
  ensureDailyMission,
  executeMission,
  humanCountdown,
  loadQueue,
  loadSettings,
  saveSettings,
  type AutoPilotSettings,
  type HeadBotMission,
} from '../engine/headBotAutopilot';
import { hubFetch } from '../engine/api';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  queued: { label: '⏳ Queue me', cls: 'bg-slate-200 text-slate-800' },
  researching: { label: '🌐 Live Research…', cls: 'bg-sky-200 text-sky-900' },
  producing: { label: '🎬 Video ban raha hai…', cls: 'bg-amber-200 text-amber-900' },
  saved: { label: '💾 Vault me Save', cls: 'bg-emerald-200 text-emerald-900' },
  awaiting_time: { label: '⏰ Time ka wait', cls: 'bg-indigo-200 text-indigo-900' },
  uploading: { label: '🚀 Upload ho raha hai…', cls: 'bg-fuchsia-200 text-fuchsia-900' },
  published: { label: '✅ PUBLISHED', cls: 'bg-emerald-500 text-white' },
  failed: { label: '⚠️ Retry karein', cls: 'bg-rose-200 text-rose-900' },
};

function nextSlotTs(hour: number, minute: number, tomorrow = false): number {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  if (tomorrow || d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export const HeadBotAutopilotPanel: React.FC<{ onToast: (m: string) => void }> = ({ onToast }) => {
  const [goal, setGoal] = useState('AI Agents Se YouTube Growth Kaise Karein — 2026 Ka Sach');
  const [niche, setNiche] = useState('AI & Tech Growth');
  const [duration, setDuration] = useState<30 | 60>(30);
  const [platforms, setPlatforms] = useState({ instagram: true, facebook: true, youtube: true });
  const [mode, setMode] = useState<'now' | 'schedule'>('schedule');
  const [hour, setHour] = useState(18);
  const [minute, setMinute] = useState(30);
  const [queue, setQueue] = useState<HeadBotMission[]>([]);
  const [active, setActive] = useState<HeadBotMission | null>(null);
  const [running, setRunning] = useState(false);
  const [ytStatus, setYtStatus] = useState<{ connected: boolean; channelTitle?: string; error?: string }>({ connected: false });
  const [settings, setSettings] = useState<AutoPilotSettings>(() => loadSettings());
  const [showKeys, setShowKeys] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  const refreshQueue = () => setQueue(loadQueue());

  useEffect(() => {
    refreshQueue();
    const t = window.setInterval(refreshQueue, 8000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await hubFetch('/yt/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
        const j = await r.json();
        if (alive) setYtStatus({ connected: !!j?.connected, channelTitle: String(j?.channelTitle || '') });
      } catch {
        if (alive) setYtStatus({ connected: false });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [active?.log?.length]);

  const patchSettings = (p: Partial<AutoPilotSettings>): AutoPilotSettings => {
    const next = saveSettings(p);
    setSettings(next);
    return next;
  };

  const start = async () => {
    if (!goal.trim()) {
      onToast('Pehle topic/goal likhein Boss!');
      return;
    }
    if (running) return;
    setRunning(true);
    try {
      const m = createMission({
        goal: goal.trim(),
        niche: niche.trim() || goal.trim(),
        targetSeconds: duration,
        platforms,
        scheduledAt: mode === 'schedule' ? nextSlotTs(hour, minute) : null,
      });
      setActive(m);
      onToast(
        mode === 'schedule'
          ? `👑 Head Bot ab live internet research karega, video bana kar SAVE karega aur ${new Date(
              m.scheduledAt || Date.now()
            ).toLocaleString('en-IN')} ko khud upload karega!`
          : '👑 Head Bot live research + video + auto-upload shuru kar raha hai!'
      );
      const done = await executeMission(m.id, (mm) => setActive({ ...mm }));
      if (done) setActive({ ...done });
      refreshQueue();
    } catch (e: any) {
      onToast(`⚠️ ${String(e?.message || e)}`);
    } finally {
      setRunning(false);
    }
  };

  const fireNow = async (m: HeadBotMission) => {
    const upd = { ...m, scheduledAt: Date.now() - 1000 };
    setQueue(loadQueue().map((x) => (x.id === m.id ? upd : x)));
    setActive(upd);
    onToast(`⏩ "${m.title || m.goal}" turant publish kar diya ja raha hai!`);
    await executeMission(m.id, (mm) => setActive({ ...mm }));
    refreshQueue();
  };

  const totalClips = useMemo(() => (active?.sources || []).filter((s) => s.kind === 'video').length, [active]);
  const pct = active?.progress ?? 0;
  const meta = STATUS_META[active?.status || 'queued'] || STATUS_META.queued;

  return (
    <div className="space-y-3">
      {/* HEADER */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-950 via-[#0b1b2a] to-indigo-950 text-white border border-indigo-400/40 shadow-lg">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <div className="text-[13px] font-black tracking-wide flex items-center gap-1.5">
              👑 HEAD BOT AUTOPILOT HQ
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-[9.5px] font-black text-amber-950">FULLY AUTONOMOUS</span>
            </div>
            <div className="text-[10.5px] text-slate-300 mt-0.5 leading-snug">
              🌐 Live internet research → 🕵️ Dusri website se real HD footage → 🎬 9:16 video → 💾 Vault + Gallery SAVE → ⏰ Set
              time pe <b className="text-emerald-300">khud login karke auto-upload</b>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9.5px] text-slate-400 font-bold">AUTO-LOGIN STATUS</div>
            <div className={`text-[10.5px] font-black ${ytStatus.connected ? 'text-emerald-300' : 'text-amber-300'}`}>
              ▶️ {ytStatus.connected ? `YouTube: ${ytStatus.channelTitle || 'Connected'}` : 'YouTube: 1-Tap Connect'}
            </div>
            <div className="text-[10.5px] font-black text-sky-300">
              📘 {settings.facebookPageToken ? 'FB Page Token Saved' : 'FB: Token Optional'}
            </div>
          </div>
        </div>

        {/* 4-STEP PIPELINE STRIP */}
        <div className="grid grid-cols-4 gap-1.5 mt-3 text-[9.5px] font-black">
          {[
            { k: 'researching', ic: '🌐', t: 'RESEARCH' },
            { k: 'producing', ic: '🎬', t: 'DUSRI SITE → VIDEO' },
            { k: 'saved', ic: '💾', t: 'SAVE-FIRST' },
            { k: 'uploading', ic: '⏰', t: 'AUTO-UPLOAD' },
          ].map((s, i) => {
            const order = ['researching', 'producing', 'saved', 'awaiting_time', 'uploading', 'published'];
            const done = active ? order.indexOf(active.status) > i : false;
            const now = active?.status === s.k;
            return (
              <div
                key={s.k}
                className={`rounded-xl px-1.5 py-2 text-center border ${
                  done || active?.status === 'published'
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                    : now
                    ? 'bg-amber-500/25 border-amber-400 text-amber-100 animate-pulse'
                    : 'bg-white/5 border-white/15 text-slate-300'
                }`}
              >
                <div className="text-sm">{s.ic}</div>
                <div>{s.t}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MISSION FORM */}
      <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2.5">
        <div>
          <div className="text-[10px] font-black text-slate-500 mb-1">🎯 BOSS KA ORDER (kya research karna hai)</div>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            placeholder='Jaise: "CoinDCX naye listings par research karke 1 min video banao aur kal shaam 6:30 pe YouTube daal do"'
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <label className="col-span-2 text-[10px] font-black text-slate-500">
            NICHE / CHANNEL
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="mt-0.5 w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-[11px] font-bold text-slate-900"
            />
          </label>
          <label className="text-[10px] font-black text-slate-500">
            VIDEO LENGTH
            <select
              value={duration}
              onChange={(e) => setDuration(+e.target.value as 30 | 60)}
              className="mt-0.5 w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-[11px] font-bold text-slate-900"
            >
              <option value={30}>30 sec Short</option>
              <option value={60}>60 sec Reel</option>
            </select>
          </label>
          <label className="text-[10px] font-black text-slate-500">
            MODE
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as 'now' | 'schedule')}
              className="mt-0.5 w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-[11px] font-bold text-slate-900"
            >
              <option value="schedule">⏰ Time pe Auto-Upload</option>
              <option value="now">⚡ Abhi sab kuch</option>
            </select>
          </label>
        </div>

        {mode === 'schedule' && (
          <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-indigo-50 border border-indigo-200">
            <span className="text-[10.5px] font-black text-indigo-900">⏰ UPLOAD TIME (IST)</span>
            <select
              value={hour}
              onChange={(e) => setHour(+e.target.value)}
              className="bg-white border border-indigo-300 rounded-lg px-2 py-1 text-[11px] font-black text-indigo-950"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')} baje
                </option>
              ))}
            </select>
            <select
              value={minute}
              onChange={(e) => setMinute(+e.target.value)}
              className="bg-white border border-indigo-300 rounded-lg px-2 py-1 text-[11px] font-black text-indigo-950"
            >
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>
                  :{String(m).padStart(2, '0')}
                </option>
              ))}
            </select>
            <span className="text-[10px] font-bold text-indigo-800">
              → {new Date(nextSlotTs(hour, minute)).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
              ko head bot khud uth ke publish karega
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {(['instagram', 'facebook', 'youtube'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatforms((s) => ({ ...s, [p]: !s[p] }))}
              className={`flex-1 py-1.5 rounded-xl text-[10.5px] font-black border cursor-pointer transition-all ${
                platforms[p]
                  ? p === 'instagram'
                    ? 'bg-pink-500 border-pink-600 text-white'
                    : p === 'facebook'
                    ? 'bg-blue-600 border-blue-700 text-white'
                    : 'bg-rose-600 border-rose-700 text-white'
                  : 'bg-slate-50 border-slate-300 text-slate-500'
              }`}
            >
              {p === 'instagram' ? '📸 Instagram' : p === 'facebook' ? '📘 Facebook' : '▶️ YouTube'} {platforms[p] ? '✓ ON' : '○ OFF'}
            </button>
          ))}
        </div>

        <button
          onClick={start}
          disabled={running}
          className={`w-full py-2.5 rounded-xl font-black text-[12.5px] cursor-pointer transition-all ${
            running ? 'bg-slate-400 text-white' : 'bg-gradient-to-r from-amber-500 via-orange-600 to-rose-600 text-white hover:brightness-110 shadow-md'
          }`}
        >
          {running ? `⏳ Head Bot kaam kar raha hai… (${pct}%)` : '👑 HEAD BOT: RESEARCH KARO, VIDEO BANAO, SAVE KARO, TIME PE UPLOAD KARO'}
        </button>
      </div>

      {/* 🗓️ DAILY AUTOPILOT — bina order ke roz khud */}
      <div
        className={`p-3 rounded-2xl border space-y-2 ${
          settings.dailyEnabled ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-black text-slate-900">
            🗓️ DAILY AUTOPILOT <span className="font-bold text-slate-500">— order dene ki zaroorat nahi</span>
          </div>
          <button
            onClick={() => {
              const next = patchSettings({ dailyEnabled: !settings.dailyEnabled });
              if (next.dailyEnabled) {
                const armed = armDailyAlarm();
                onToast(armed ? `🗓️ Roz ${String(next.dailyHour).padStart(2, '0')}:${String(next.dailyMinute).padStart(2, '0')} baje — head bot khud research + video + upload karega (alarm bhi lag gaya)` : `🗓️ Roz ka auto mode chalu (browser me tab alarm nahi)`);
              } else onToast('🛑 Daily Autopilot band kar diya');
            }}
            className={`px-3 py-1.5 rounded-full text-[10.5px] font-black cursor-pointer transition-all ${
              settings.dailyEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
            }`}
          >
            {settings.dailyEnabled ? '✅ CHALU' : '⭕ OFF'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-700">
          <span>ROZ</span>
          <select
            value={settings.dailyHour}
            onChange={(e) => {
              patchSettings({ dailyHour: +e.target.value });
              armDailyAlarm();
            }}
            className="bg-white border border-slate-300 rounded-lg px-1.5 py-1 font-black"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')} baje
              </option>
            ))}
          </select>
          <select
            value={settings.dailyMinute}
            onChange={(e) => {
              patchSettings({ dailyMinute: +e.target.value });
              armDailyAlarm();
            }}
            className="bg-white border border-slate-300 rounded-lg px-1.5 py-1 font-black"
          >
            {[0, 15, 30, 45].map((m) => (
              <option key={m} value={m}>
                :{String(m).padStart(2, '0')}
              </option>
            ))}
          </select>
          <span>par</span>
          <input
            value={settings.dailyNiche}
            onChange={(e) => patchSettings({ dailyNiche: e.target.value })}
            placeholder="niche… (jaise AI, Crypto, Business)"
            className="flex-1 min-w-[140px] bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold"
          />
          <button
            onClick={() => {
              void ensureDailyMission(undefined, true).then(() => refreshQueue());
              onToast('🗓️ Test run — head bot abhi research karke video bana raha hai');
            }}
            className="px-2 py-1 rounded-lg bg-amber-500 text-amber-950 font-black cursor-pointer"
          >
            🧪 Abhi Test
          </button>
        </div>

        <div className="text-[9.5px] font-semibold text-slate-600 leading-snug">
          {settings.dailyEnabled ? (
            <>
              Head Bot har din is time <b>live web research</b> se khud topic chunega → <b>dusri websites</b> (Wikimedia · NASA · Internet
              Archive) se real HD footage uthayega → video bana kar <b>Vault + Gallery me SAVE</b> karega → aur{' '}
              <b>set platforms par khud upload</b> kar dega. Aaj ka run:{' '}
              <b className={settings.lastDailyRunDay === new Date().toLocaleDateString('en-CA') ? 'text-emerald-700' : 'text-slate-500'}>
                {settings.lastDailyRunDay === new Date().toLocaleDateString('en-CA') ? '✅ ho gaya' : '⏳ baaki hai'}
              </b>{' '}
              · <span className="text-slate-500">({new Date().toLocaleDateString('en-CA')})</span>
            </>
          ) : (
            <>OFF — chalu karne ke baad app khulte hi, har din set time par, poora mission apne aap chalega (din me ek baar).</>
          )}
        </div>
      </div>

      {/* LIVE LOG + SOURCES */}
      {active && (
        <div className="p-3 rounded-2xl bg-[#0b0f19] border border-slate-800 text-slate-100 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-black ${meta.cls}`}>{meta.label}</span>
            <span className="text-[10px] font-black text-emerald-300">
              {totalClips > 0 ? `🕵️ ${totalClips} clips dusri websites se` : '🎞️ Bundled HD motion library'}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div ref={logRef} className="max-h-32 overflow-y-auto font-mono text-[10px] leading-relaxed space-y-0.5">
            {active.log.map((l, i) => (
              <div key={i} className={l.level === 'ok' ? 'text-emerald-300' : l.level === 'warn' ? 'text-amber-300' : 'text-slate-300'}>
                › {l.line}
              </div>
            ))}
          </div>

          {active.sources?.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
              {active.sources.slice(0, 6).map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block p-2 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-400/60"
                >
                  <div className="flex items-center justify-between text-[9.5px] font-black text-emerald-300">
                    <span>{s.kind === 'video' ? '🎞️ ' : '📰 '}{s.site}</span>
                    <span className="text-slate-400">{s.kind === 'video' ? 'FOOTAGE' : 'SOURCE'}</span>
                  </div>
                  <div className="text-[11px] font-bold text-white truncate">{s.title}</div>
                  <div className="text-[9.5px] text-slate-400 line-clamp-2">{s.snippet}</div>
                </a>
              ))}
            </div>
          )}

          {active.youtubeUrl && (
            <a
              href={active.youtubeUrl}
              target="_blank"
              rel="noreferrer"
              className="block text-center py-2 rounded-xl bg-rose-600 text-white font-black text-[11.5px]"
            >
              ▶️ LIVE ON YOUTUBE: {active.youtubeUrl}
            </a>
          )}
        </div>
      )}

      {/* MISSION QUEUE */}
      <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black text-slate-800">🗓️ AUTOPILOT QUEUE ({queue.length})</span>
          <span className="text-[10px] font-bold text-slate-500">App khula ho toh time pe khud fire karega + phone alarm laga deta hoon</span>
        </div>
        {queue.length === 0 && <div className="text-[11px] text-slate-500 font-semibold">Abhi koi mission nahi — upar order dein.</div>}
        <div className="space-y-1.5">
          {queue.slice(0, 6).map((m) => {
            const st = STATUS_META[m.status] || STATUS_META.queued;
            return (
              <div key={m.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-black text-slate-900 truncate">{m.title || m.goal}</div>
                  <div className="text-[9.5px] text-slate-600 font-semibold">
                    ⏰ {m.scheduledAt ? new Date(m.scheduledAt).toLocaleString('en-IN') : 'Immediate'} · {humanCountdown(m.scheduledAt || null)} ·{' '}
                    {(Object.keys(m.platforms) as (keyof typeof m.platforms)[]).filter((p) => m.platforms[p]).join('+') || 'no platform'}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${st.cls}`}>{st.label}</span>
                {(m.status === 'awaiting_time' || m.status === 'saved') && (
                  <button onClick={() => void fireNow(m)} className="px-2 py-1 rounded-lg bg-slate-900 text-white text-[9.5px] font-black cursor-pointer">
                    ⏩ Abhi
                  </button>
                )}
                <button
                  onClick={() => {
                    deleteMission(m.id);
                    refreshQueue();
                  }}
                  className="px-2 py-1 rounded-lg bg-rose-100 text-rose-800 text-[9.5px] font-black cursor-pointer"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* AUTO-LOGIN CONNECTOR */}
      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-300 space-y-2">
        <button
          onClick={() => setShowKeys((v) => !v)}
          className="w-full flex items-center justify-between text-[11px] font-black text-slate-800 cursor-pointer"
        >
          <span>🔑 KHUD LOGIN SETUP (Head Bot apne aap publish kare)</span>
          <span className="text-slate-500">{showKeys ? '▲ BAND KAREIN' : '▼ KHOLEIN'}</span>
        </button>

        {showKeys && (
          <div className="space-y-2">
            <div className="p-2 rounded-xl bg-white border border-slate-200 text-[10px] font-semibold text-slate-700 leading-relaxed">
              <b className="text-rose-700">▶ YouTube = 100% automatic.</b> Ek baar Connect karo (permanent refresh token browser me save
              rehta hai) — uske baad head bot <b>bina password mange</b> upload kar dega.
              <a
                href="https://apex-humanoid-v2.pradhanbibek53.workers.dev/yt/auth"
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-1 px-2.5 py-1 rounded-lg bg-rose-600 text-white font-black"
              >
                🚀 1-Tap Google Connect
              </a>
              {ytStatus.connected && <span className="ml-1.5 text-emerald-700 font-black">✓ Connected: {ytStatus.channelTitle}</span>}
            </div>

            <input
              value={settings.youtubeAccessToken}
              onChange={(e) => patchSettings({ youtubeAccessToken: e.target.value.trim() })}
              placeholder="ya yahan ya29.… access/refresh token paste karein (optional)"
              className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-[10.5px] font-bold"
            />

            <div className="grid grid-cols-2 gap-2">
              <input
                value={settings.facebookPageId}
                onChange={(e) => patchSettings({ facebookPageId: e.target.value.trim() })}
                placeholder="📘 FB Page ID"
                className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-[10.5px] font-bold"
              />
              <input
                value={settings.facebookPageToken}
                onChange={(e) => patchSettings({ facebookPageToken: e.target.value.trim() })}
                placeholder="📘 Page Access Token (auto-post)"
                className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-[10.5px] font-bold"
              />
            </div>
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-[9.5px] font-semibold text-amber-900 leading-snug">
              📸 Instagram: Meta ne browser automation band kar rakha hai, isliye IG ke liye head bot set time pe aapka phone uthata
              hai, caption copy karke <b>Reel composer</b> khol deta hai — bas <b>1 tap</b> me share. Chrome me ek baar login rahega toh
              <b> dobara login nahi puchega</b>. (FB Page token daalne par wo bhi poori tarah auto ho jayega.)
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HeadBotAutopilotPanel;
