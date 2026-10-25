import { useEffect, useRef, useState } from 'react';
import { initialDesk, runDeskMission, type DeskAgent } from '../engine/agentDesk';
import type { MotionStyle } from '../engine/motionForge';
import { isAppleTouch } from '../engine/iosAutopilot';

/**
 * 🏢 AGENT DESK — "ek-ek karke" live floor: har agent ka box, uska kaam,
 * kya dekh raha hai / kya bana raha hai. (Video-jaisa scene, asli engines ke saath.)
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

  const run = async () => {
    setBusy(true);
    setAgents(initialDesk());
    setTicker([]);
    setElapsed(0);
    t0.current = Date.now();
    let lastVideo: any = null;
    try {
      const r = await runDeskMission({ goal, style, durationSec: 12, publish }, (e) => {
        setAgents((prev) => prev.map((a) => (a.id === e.agentId ? { ...a, ...e.patch } : a)));
        if (e.line) setTicker((prev) => [`${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · ${e.line}`, ...prev].slice(0, 40));
      });
      lastVideo = r.video;
      onToast(`🏢 Desk: ${r.ok}/${r.total} agents ok${lastVideo ? ' · video Vault me' : ''}`);
    } catch (e: any) {
      onToast(`⚠️ Desk fail: ${String(e?.message || e).slice(0, 80)}`);
    } finally {
      setBusy(false);
      setAgents((prev) => prev.map((a) => (a.status === 'working' ? { ...a, status: 'warn' as const } : a)));
    }
  };

  if (!isOpen) return null;

  const tone = (s: DeskAgent['status']) =>
    s === 'ok'
      ? 'border-emerald-400/40 bg-emerald-500/[0.10]'
      : s === 'working'
        ? 'border-fuchsia-400/50 bg-fuchsia-500/[0.12] animate-pulse'
        : s === 'warn'
          ? 'border-amber-400/40 bg-amber-500/[0.10]'
          : s === 'fail'
            ? 'border-rose-400/40 bg-rose-500/[0.10]'
            : 'border-white/10 bg-white/[0.03]';

  const pill = (s: DeskAgent['status']) =>
    s === 'ok' ? '✅ ok' : s === 'working' ? '⚙️ kaam pe' : s === 'warn' ? '⚠️ skip' : s === 'fail' ? '❌ fail' : '· idle';

  return (
    <div className="fixed inset-0 z-[85] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-1.5 sm:p-4">
      <div className="w-full max-w-lg max-h-[94vh] overflow-y-auto rounded-2xl border border-fuchsia-400/25 bg-[#060c14] shadow-[0_20px_60px_rgba(0,0,0,0.92)]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2.5 border-b border-white/10 bg-[#060c14]/95 backdrop-blur">
          <div>
            <div className="text-[11px] font-black text-fuchsia-200">🏢 AGENT DESK — LIVE FLOOR</div>
            <div className="text-[8.5px] font-bold text-slate-400">
              7 agents · ek-ek karke · kaun kya kar raha hai saaf dikhta hai
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {busy && <span className="px-1.5 py-1 rounded-md bg-fuchsia-500/20 text-[8px] font-black text-fuchsia-100">{elapsed}s</span>}
            <button onClick={onClose} className="cursor-pointer w-7 h-7 rounded-full bg-white/10 text-white/80 text-xs font-black">
              ✕
            </button>
          </div>
        </div>

        <div className="p-2.5 space-y-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 space-y-1.5">
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Mission — e.g. 'Crypto India ke 3 rules'"
              className="w-full bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-100"
            />
            <div className="flex flex-wrap gap-1">
              {(['kino-glass', 'neon-pulse', 'brutal-flash'] as MotionStyle[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`px-1.5 py-1 rounded-lg text-[8.5px] font-black cursor-pointer ${style === s ? 'bg-indigo-500/30 text-indigo-100' : 'bg-white/[0.06] text-slate-300'}`}
                >
                  {s === 'kino-glass' ? '🎥 KINO' : s === 'neon-pulse' ? '⚡ NEON' : '🔥 BRUTAL'}
                </button>
              ))}
              <button
                onClick={() => setPublish((v) => !v)}
                className={`px-1.5 py-1 rounded-lg text-[8.5px] font-black cursor-pointer ${publish ? 'bg-amber-500/25 text-amber-100' : 'bg-white/[0.06] text-slate-300'}`}
              >
                {publish ? '📤 SAVE + POST' : '💾 SIRF SAVE'}
              </button>
              <button
                disabled={busy}
                onClick={run}
                className={`ml-auto px-2.5 py-1.5 rounded-lg text-[9.5px] font-black cursor-pointer ${busy ? 'bg-white/10 text-slate-400' : 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white'}`}
              >
                {busy ? '⏳ DESK CHAL RAHA…' : '▶️ DESK CHALAO'}
              </button>
            </div>
          </div>

          {/* agent floor */}
          <div className="grid grid-cols-2 gap-1.5">
            {agents.map((a) => (
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
                <div className="text-[8px] font-bold text-slate-300 leading-snug mt-1 line-clamp-2">{a.doing}</div>
                <div className="h-0.5 mt-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full ${a.status === 'fail' ? 'bg-rose-400' : a.status === 'warn' ? 'bg-amber-400' : 'bg-emerald-400'}`}
                    style={{ width: `${a.progress}%` }}
                  />
                </div>

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

          {/* ticker */}
          <div className="rounded-xl border border-white/10 bg-[#04090e] p-1.5 max-h-32 overflow-y-auto space-y-0.5">
            <div className="text-[8px] font-black text-slate-400">📡 LIVE FEED</div>
            {ticker.length === 0 && <div className="text-[8px] font-bold text-slate-500">abhi kuch nahi — ▶️ DESK CHALAO</div>}
            {ticker.map((l, i) => (
              <div key={i} className="text-[8px] font-semibold text-slate-300 leading-snug">{l}</div>
            ))}
          </div>

          <div className="text-[7.5px] font-bold text-slate-500 leading-snug">
            ⚠️ Sach: ye 7 agents asli pipeline stages hain — Scout = worker API, Writer = local template (LLM nahi),
            Art = motion parser, Renderer = canvas, QA = asli checks, Librarian = Vault, Postman = IG token.
            Jahan cheez na mile wahan <b>skip</b> likha jaata hai. {isAppleTouch() ? '🍎 iPhone: app khuli rakho.' : '🤖 Android: app khuli rakho.'}
          </div>
        </div>
      </div>
    </div>
  );
}
