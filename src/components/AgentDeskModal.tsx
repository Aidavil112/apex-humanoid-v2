import { useEffect, useRef, useState } from 'react';
import { DEVICE_TITLE, initialDesk, runDeskMission, type DeskAgent, type ScreenKind } from '../engine/agentDesk';
import type { MotionStyle } from '../engine/motionForge';
import { isAppleTouch } from '../engine/iosAutopilot';

/**
 * 🏢 APEX HQ — video jaisa scene: har agent ka APNA live screen + 👑 Boss console.
 * Do view: 🖥️ LIVE SCREENS (default) aur 🗂️ FLOOR (kya dekha / kya banaya).
 */
export function AgentDeskModal({
  isOpen,
  onClose,
  onToast,
}: {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [agents, setAgents] = useState<DeskAgent[]>(() => initialDesk());
  const [view, setView] = useState<'screens' | 'floor'>('screens');
  const [openId, setOpenId] = useState<string>('scout');
  const [busy, setBusy] = useState(false);
  const [goal, setGoal] = useState('AI agents se chhote business ki growth (India)');
  const [style, setStyle] = useState<MotionStyle>('kino-glass');
  const [publish, setPublish] = useState(false);
  const [ticker, setTicker] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const t0 = useRef(0);

  useEffect(() => {
    if (!busy) return;
    const iv = setInterval(() => setElapsed(Math.round((Date.now() - t0.current) / 1000)), 500);
    return () => clearInterval(iv);
  }, [busy]);

  useEffect(() => {
    if (isOpen && !busy) setAgents(initialDesk());
  }, [isOpen]);

  const patchAgent = (id: string, patch: Partial<DeskAgent>) =>
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const run = async () => {
    setBusy(true);
    setAgents(initialDesk());
    setTicker([]);
    setElapsed(0);
    t0.current = Date.now();
    try {
      const r = await runDeskMission({ goal, style, durationSec: 12, publish }, (e) => {
        setAgents((prev) =>
          prev.map((a) => {
            if (a.id !== e.agentId) return a;
            const next = { ...a, ...e.patch };
            if (e.screen) next.screen = [...a.screen, { i: a.screen.length, text: e.screen.text, kind: e.screen.kind }].slice(-26);
            return next;
          })
        );
        if (e.line)
          setTicker((prev) =>
            [`${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · ${e.line}`, ...prev].slice(0, 40)
          );
      });
      onToast(`🏢 HQ: ${r.ok}/${r.total} agents ok${r.video ? ' · video Vault me' : ''}`);
    } catch (e: any) {
      onToast(`⚠️ HQ fail: ${String(e?.message || e).slice(0, 80)}`);
    } finally {
      setBusy(false);
      setAgents((prev) => prev.map((a) => (a.status === 'working' ? { ...a, status: 'warn' as const } : a)));
    }
  };

  if (!isOpen) return null;

  const tone = (s: DeskAgent['status']) =>
    s === 'ok'
      ? 'border-emerald-400/40 bg-emerald-500/[0.08]'
      : s === 'working'
        ? 'border-fuchsia-400/60 bg-fuchsia-500/[0.12] shadow-[0_0_22px_-8px_rgba(232,121,249,0.9)]'
        : s === 'warn'
          ? 'border-amber-400/40 bg-amber-500/[0.09]'
          : s === 'fail'
            ? 'border-rose-400/40 bg-rose-500/[0.09]'
            : 'border-white/10 bg-white/[0.02]';

  const pill = (s: DeskAgent['status']) =>
    s === 'ok' ? '✅ done' : s === 'working' ? '⚙️ live' : s === 'warn' ? '⚠️ skip' : s === 'fail' ? '❌ fail' : '· idle';

  const lineColor = (k: ScreenKind) =>
    k === 'cmd'
      ? 'text-cyan-300'
      : k === 'ok'
        ? 'text-emerald-300'
        : k === 'warn'
          ? 'text-amber-300'
          : k === 'err'
            ? 'text-rose-300'
            : k === 'type'
              ? 'text-fuchsia-200'
              : 'text-slate-300';

  const boss = agents.find((a) => a.id === 'boss');
  const workers = agents.filter((a) => a.id !== 'boss');
  const doneCount = workers.filter((a) => a.status === 'ok').length;

  /** ek agent ka mini window (video jaisa) */
  const ScreenWindow = ({ a, wide }: { a: DeskAgent; wide?: boolean }) => {
    const boxRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
      const el = boxRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, [a.screen.length]);
    return (
      <div className={`rounded-xl overflow-hidden border ${tone(a.status)} ${wide ? 'col-span-2' : ''}`}>
        {/* window title bar */}
        <div className="flex items-center gap-1 px-1.5 py-1 bg-black/50 border-b border-white/10">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff5f57]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#febc2e]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#28c840]" />
          <span className="ml-1 text-[8px] font-black text-slate-200 truncate">
            {a.emoji} {a.name}
          </span>
          <span className="ml-auto text-[7px] font-bold text-slate-500 truncate">{DEVICE_TITLE[a.device]}</span>
        </div>
        {/* live screen body */}
        <div ref={boxRef} className="h-[74px] overflow-y-auto bg-[#04090e] px-1.5 py-1 font-mono space-y-[1px]">
          {a.screen.slice(-8).map((l, idx, arr) => (
            <div key={l.i} className={`text-[7.5px] leading-[1.35] break-words ${lineColor(l.kind)}`}>
              {l.text}
              {idx === arr.length - 1 && a.status === 'working' && <span className="animate-pulse text-fuchsia-300">▊</span>}
            </div>
          ))}
        </div>
        {/* footer: status + progress */}
        <div className="px-1.5 py-1 bg-black/30 border-t border-white/10">
          <div className="flex items-center gap-1">
            <span className="text-[7.5px] font-black text-slate-300 truncate">{pill(a.status)}</span>
            <span className="ml-auto text-[7px] font-bold text-slate-400">{a.progress > 0 ? `${a.progress}%` : ''}</span>
          </div>
          <div className="h-[2px] mt-0.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full ${a.status === 'fail' ? 'bg-rose-400' : a.status === 'warn' ? 'bg-amber-400' : a.status === 'working' ? 'bg-fuchsia-400' : 'bg-emerald-400'}`}
              style={{ width: `${a.progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[85] bg-black/88 backdrop-blur-sm flex items-end sm:items-center justify-center p-1 sm:p-3">
      <div className="w-full max-w-lg max-h-[95vh] overflow-y-auto rounded-2xl border border-fuchsia-400/25 bg-[#060c14] shadow-[0_20px_60px_rgba(0,0,0,0.92)]">
        {/* header */}
        <div className="sticky top-0 z-10 px-2.5 py-2 border-b border-white/10 bg-[#060c14]/96 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-black text-fuchsia-200">🏢 APEX HQ — {doneCount}/7 agents done</div>
              <div className="text-[8px] font-bold text-slate-400">
                👤 HUMANS: 1 (tum) · 🤖 AGENTS: {workers.length} · 👑 BOSS: Head Bot
                {busy ? ` · ${elapsed}s` : ''}
              </div>
            </div>
            <button onClick={onClose} className="cursor-pointer w-7 h-7 rounded-full bg-white/10 text-white/80 text-xs font-black shrink-0">
              ✕
            </button>
          </div>
          {/* mission controls */}
          <div className="mt-1.5 space-y-1">
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Mission — e.g. 'Crypto India ke 3 rules'"
              className="w-full bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[9.5px] font-semibold text-slate-100"
            />
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setView('screens')}
                className={`px-1.5 py-1 rounded-lg text-[8.5px] font-black cursor-pointer ${view === 'screens' ? 'bg-fuchsia-500/30 text-fuchsia-100' : 'bg-white/[0.06] text-slate-300'}`}
              >
                🖥️ LIVE SCREENS
              </button>
              <button
                onClick={() => setView('floor')}
                className={`px-1.5 py-1 rounded-lg text-[8.5px] font-black cursor-pointer ${view === 'floor' ? 'bg-fuchsia-500/30 text-fuchsia-100' : 'bg-white/[0.06] text-slate-300'}`}
              >
                🗂️ FLOOR
              </button>
              {(['kino-glass', 'neon-pulse', 'brutal-flash'] as MotionStyle[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`px-1.5 py-1 rounded-lg text-[8.5px] font-black cursor-pointer ${style === s ? 'bg-indigo-500/30 text-indigo-100' : 'bg-white/[0.06] text-slate-300'}`}
                >
                  {s === 'kino-glass' ? '🎥' : s === 'neon-pulse' ? '⚡' : '🔥'}
                </button>
              ))}
              <button
                onClick={() => setPublish((v) => !v)}
                className={`px-1.5 py-1 rounded-lg text-[8.5px] font-black cursor-pointer ${publish ? 'bg-amber-500/25 text-amber-100' : 'bg-white/[0.06] text-slate-300'}`}
              >
                {publish ? '📤 POST' : '💾 SAVE'}
              </button>
              <button
                disabled={busy}
                onClick={run}
                className={`ml-auto px-2.5 py-1.5 rounded-lg text-[9px] font-black cursor-pointer ${busy ? 'bg-white/10 text-slate-400' : 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white'}`}
              >
                {busy ? '⏳ HQ LIVE…' : '▶️ START HQ'}
              </button>
            </div>
          </div>
        </div>

        <div className="p-2 space-y-2">
          {/* 👑 BOSS console */}
          {boss && (
            <div className={`rounded-xl border ${tone(boss.status)} overflow-hidden`}>
              <div className="flex items-center gap-1 px-1.5 py-1 bg-black/50 border-b border-white/10">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff5f57]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#febc2e]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#28c840]" />
                <span className="ml-1 text-[8px] font-black text-amber-200">👑 BOSS — command console</span>
                <span className="ml-auto text-[7px] font-bold text-slate-400">{pill(boss.status)}</span>
              </div>
              <div className="bg-[#04090e] px-1.5 py-1 font-mono max-h-[62px] overflow-y-auto space-y-[1px]">
                {boss.screen.slice(-5).map((l, idx, arr) => (
                  <div key={l.i} className={`text-[7.5px] leading-[1.35] break-words ${lineColor(l.kind)}`}>
                    {l.text}
                    {idx === arr.length - 1 && boss.status === 'working' && <span className="animate-pulse text-amber-300">▊</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'screens' ? (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                {workers.map((a) => (
                  <ScreenWindow key={a.id} a={a} wide={a.id === 'render'} />
                ))}
              </div>
              <div className="text-[7.5px] font-bold text-slate-500 leading-snug">
                ⚠️ Sach: har window me jo likha hai wo ASLI action ke saath likhta hai (worker call · render frame · IDB put · Graph API).
                Jahan token/worker na mile wahan <b>skip + reason</b>. {isAppleTouch() ? '🍎 iPhone: app khuli rakho.' : '🤖 Android: app khuli rakho.'}
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                {workers.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setOpenId(openId === a.id ? '' : a.id)}
                    className={`text-left rounded-xl border p-1.5 transition-all cursor-pointer ${tone(a.status)} ${openId === a.id ? 'col-span-2' : ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{a.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[9.5px] font-black text-slate-100 truncate">{a.name}</div>
                        <div className="text-[7.5px] font-bold text-slate-400 truncate">{pill(a.status)}</div>
                      </div>
                      {a.progress > 0 && a.progress < 100 && <span className="text-[8px] font-black text-fuchsia-200">{a.progress}%</span>}
                    </div>
                    <div className="text-[8px] font-bold text-slate-300 leading-snug mt-1">{a.doing}</div>
                    {openId === a.id && (
                      <div className="mt-1.5 space-y-1">
                        <div className="text-[7.5px] font-black text-slate-400 uppercase">{a.role}</div>
                        {a.saw.length > 0 && (
                          <div className="rounded-md bg-black/40 border border-white/10 p-1">
                            <div className="text-[7px] font-black text-cyan-300">👁️ KYA DEKHA / PADHA</div>
                            {a.saw.map((s, i) => (
                              <div key={i} className="text-[7.5px] font-semibold text-slate-300 leading-snug break-words">{s}</div>
                            ))}
                          </div>
                        )}
                        {a.made.length > 0 && (
                          <div className="rounded-md bg-black/40 border border-white/10 p-1">
                            <div className="text-[7px] font-black text-emerald-300">🛠️ KYA BANAYA</div>
                            {a.made.map((s, i) => (
                              <div key={i} className="text-[7.5px] font-semibold text-slate-300 leading-snug break-words">{s}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* live feed */}
          <div className="rounded-xl border border-white/10 bg-[#04090e] p-1.5 max-h-28 overflow-y-auto space-y-0.5">
            <div className="text-[8px] font-black text-slate-400">📡 LIVE FEED (Boss orders + agent results)</div>
            {ticker.length === 0 && <div className="text-[8px] font-bold text-slate-500">abhi kuch nahi — ▶️ START HQ dabao</div>}
            {ticker.map((l, i) => (
              <div key={i} className="text-[8px] font-semibold text-slate-300 leading-snug">{l}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
