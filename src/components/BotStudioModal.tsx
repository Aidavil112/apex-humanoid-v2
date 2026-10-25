import { useEffect, useMemo, useState } from 'react';
import {
  BOT_STEP_LABEL,
  deleteBot,
  loadBots,
  newBot,
  runBot,
  saveBots,
  type BotDef,
  type BotStep,
  type BotStepKind,
} from '../engine/botStudio';
import type { MotionStyle } from '../engine/motionForge';
import { isAppleTouch } from '../engine/iosAutopilot';

/**
 * 🤖 BOT STUDIO — alag screen (Jarvis/Head Bot se alag). Apne chhote bots banao aur chalao.
 */
export function BotStudioModal({
  isOpen,
  onClose,
  onToast,
}: {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [bots, setBots] = useState<BotDef[]>(() => loadBots());
  const [busyId, setBusyId] = useState('');
  const [openId, setOpenId] = useState('');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🤖');
  const [goal, setGoal] = useState('');
  const [style, setStyle] = useState<MotionStyle>('kino-glass');
  const [picked, setPicked] = useState<BotStepKind[]>(['research', 'render', 'save']);

  useEffect(() => {
    if (isOpen) setBots(loadBots());
  }, [isOpen]);

  const toggleStep = (k: BotStepKind) =>
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const create = () => {
    if (name.trim().length < 2) {
      onToast('⚠️ Bot ka naam likho (2+ letters)');
      return;
    }
    const steps: BotStep[] = picked.map((k) => ({ kind: k }));
    const b = newBot(name, emoji, goal, steps, style);
    const list = saveBots([b, ...loadBots()]);
    setBots(list);
    setName('');
    setGoal('');
    setOpenId(b.id);
    onToast(`🤖 ${b.emoji} ${b.name} ban gaya`);
  };

  const run = async (id: string) => {
    setBusyId(id);
    setOpenId(id);
    try {
      const r = await runBot(id, (b) => setBots(loadBots().map((x) => (x.id === b.id ? b : x))));
      onToast(
        r.bot
          ? r.ok === r.total
            ? `✅ ${r.bot.name}: ${r.ok}/${r.total} steps done`
            : `⚠️ ${r.bot.name}: ${r.ok}/${r.total} (baaki skip)`
          : '⚠️ Bot nahi mila'
      );
    } finally {
      setBusyId('');
      setBots(loadBots());
    }
  };

  const totalSteps = useMemo(() => picked.length, [picked]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl border border-fuchsia-400/25 bg-[#070e18] shadow-[0_20px_60px_rgba(0,0,0,0.9)]">
        {/* header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2.5 border-b border-white/10 bg-[#070e18]/95 backdrop-blur">
          <div>
            <div className="text-[11px] font-black text-fuchsia-200">🤖 BOT STUDIO</div>
            <div className="text-[8.5px] font-bold text-slate-400">apne chhote bots · alag screen (Head Bot se alag)</div>
          </div>
          <button onClick={onClose} className="cursor-pointer w-7 h-7 rounded-full bg-white/10 text-white/80 text-xs font-black">
            ✕
          </button>
        </div>

        <div className="p-2.5 space-y-2.5">
          <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-2 py-1.5 text-[8.5px] font-bold text-amber-100/85 leading-snug">
            ⚠️ Sach: bots <b>app ke andar</b> chalte hain — app band = bot band. Har step asli engine call karta hai
            (worker research · Motion Forge render · Vault save · IG publish), na mile to “skip” likhta hai.
          </div>

          {/* existing bots */}
          <div className="space-y-1.5">
            {bots.map((b) => (
              <div key={b.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">{b.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black text-slate-100 truncate">{b.name}</div>
                    <div className="text-[8px] font-bold text-slate-400 truncate">{b.goal}</div>
                  </div>
                  <button
                    onClick={() => setOpenId(openId === b.id ? '' : b.id)}
                    className="px-1.5 py-1 rounded-lg text-[8.5px] font-black bg-white/10 text-slate-200 cursor-pointer"
                  >
                    {openId === b.id ? '▲' : '▼'}
                  </button>
                  <button
                    disabled={!!busyId}
                    onClick={() => run(b.id)}
                    className={`px-2 py-1 rounded-lg text-[9px] font-black cursor-pointer ${
                      busyId === b.id ? 'bg-white/10 text-slate-400' : 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white'
                    }`}
                  >
                    {busyId === b.id ? '⏳' : '▶️ CHALAO'}
                  </button>
                  <button
                    onClick={() => {
                      setBots(deleteBot(b.id));
                      onToast('🗑️ Bot hata diya');
                    }}
                    className="px-1.5 py-1 rounded-lg text-[9px] font-black bg-rose-500/20 text-rose-200 cursor-pointer"
                  >
                    🗑
                  </button>
                </div>

                <div className="flex flex-wrap gap-1">
                  {b.steps.map((s, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded-md bg-white/[0.06] text-[8px] font-bold text-slate-300">
                      {BOT_STEP_LABEL[s.kind]}
                    </span>
                  ))}
                  {b.lastStatus && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[8px] font-black ${
                        b.lastStatus === 'ok' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-200'
                      }`}
                    >
                      {b.lastStatus === 'ok' ? '✅ last run ok' : `⚠️ last run ${b.lastStatus}`}
                    </span>
                  )}
                </div>

                {openId === b.id && (
                  <div className="rounded-lg bg-[#04090e] border border-white/10 p-1.5 max-h-40 overflow-y-auto space-y-0.5">
                    {b.log.length === 0 && <div className="text-[8px] font-bold text-slate-500">abhi koi run nahi — ▶️ CHALAO dabao</div>}
                    {b.log.map((l, i) => (
                      <div
                        key={i}
                        className={`text-[8px] font-semibold leading-snug ${
                          l.level === 'ok' ? 'text-emerald-300' : l.level === 'warn' ? 'text-amber-300' : 'text-slate-300'
                        }`}
                      >
                        {new Date(l.t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {l.line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* new bot */}
          <div className="rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/[0.07] p-2 space-y-1.5">
            <div className="text-[9.5px] font-black text-fuchsia-100">➕ NAYA BOT BANAO</div>
            <div className="flex gap-1.5">
              <input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
                className="w-11 bg-[#0b1220] border border-white/10 rounded-lg px-1 py-1.5 text-center text-[12px]"
              />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Bot ka naam (e.g. Crypto News Bot)"
                className="flex-1 bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-100"
              />
            </div>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Goal / topic — e.g. 'Bitcoin ke 3 rules jo koi nahi batata'"
              className="w-full bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-100"
            />
            <div className="flex flex-wrap gap-1">
              {(Object.keys(BOT_STEP_LABEL) as BotStepKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => toggleStep(k)}
                  className={`px-1.5 py-1 rounded-lg text-[8.5px] font-black cursor-pointer ${
                    picked.includes(k) ? 'bg-fuchsia-500/30 text-fuchsia-100 border border-fuchsia-400/40' : 'bg-white/[0.06] text-slate-300'
                  }`}
                >
                  {BOT_STEP_LABEL[k]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {(['kino-glass', 'neon-pulse', 'brutal-flash'] as MotionStyle[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`px-1.5 py-1 rounded-lg text-[8.5px] font-black cursor-pointer ${
                    style === s ? 'bg-indigo-500/30 text-indigo-100' : 'bg-white/[0.06] text-slate-300'
                  }`}
                >
                  {s === 'kino-glass' ? '🎥 KINO' : s === 'neon-pulse' ? '⚡ NEON' : '🔥 BRUTAL'}
                </button>
              ))}
            </div>
            <button
              onClick={create}
              className="w-full py-2 rounded-xl text-[10px] font-black bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white cursor-pointer"
            >
              ➕ BOT BANAO ({totalSteps} steps)
            </button>
          </div>

          <div className="text-[8px] font-bold text-slate-500 leading-snug">
            {isAppleTouch()
              ? '🍎 iPhone: run ke waqt screen jaagti rehti hai; app band kiya to bot agle open par dubara chalana padega.'
              : '🤖 Android: run ke waqt screen on rehti hai; app band karne par bot rukega (background service nahi).'}
          </div>
        </div>
      </div>
    </div>
  );
}
