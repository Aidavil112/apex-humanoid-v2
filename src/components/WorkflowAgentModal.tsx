import { useEffect, useState } from 'react';
import {
  WF_NODE_LABEL,
  deleteWorkflow,
  loadWorkflows,
  newWorkflow,
  runWorkflow,
  saveWorkflows,
  type WfDef,
  type WfNode,
  type WfNodeKind,
} from '../engine/workflowAgent';
import type { MotionStyle } from '../engine/motionForge';

/**
 * 🕸️ WORKFLOW AI AGENT — alag screen. Steps ki chain, fallback branch, live node status.
 * (Bot Studio se alag: yahan poora pipeline banta hai, ek chhota bot nahi.)
 */
export function WorkflowAgentModal({
  isOpen,
  onClose,
  onToast,
}: {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [wfs, setWfs] = useState<WfDef[]>(() => loadWorkflows());
  const [busyId, setBusyId] = useState('');
  const [openId, setOpenId] = useState('');
  const [name, setName] = useState('');
  const [niche, setNiche] = useState('');
  const [style, setStyle] = useState<MotionStyle>('kino-glass');
  const [chain, setChain] = useState<WfNodeKind[]>(['trigger', 'research', 'motion', 'save', 'publish']);

  useEffect(() => {
    if (isOpen) setWfs(loadWorkflows());
  }, [isOpen]);

  const addNode = (k: WfNodeKind) => setChain((c) => [...c, k]);
  const removeNode = (i: number) => setChain((c) => c.filter((_, idx) => idx !== i));

  const create = () => {
    if (name.trim().length < 2) {
      onToast('⚠️ Workflow ka naam likho');
      return;
    }
    const nodes: WfNode[] = chain.map((kind, i) => ({
      id: 'n' + (i + 1),
      kind,
      fallback: kind === 'motion' ? 'n' + (i + 2) : undefined,
    }));
    const w = newWorkflow(name, '🕸️', niche, nodes, style);
    setWfs(saveWorkflows([w, ...loadWorkflows()]));
    setName('');
    setNiche('');
    setOpenId(w.id);
    onToast('🕸️ Workflow ban gaya');
  };

  const run = async (id: string) => {
    setBusyId(id);
    setOpenId(id);
    try {
      const r = await runWorkflow(id, (w) => setWfs(loadWorkflows().map((x) => (x.id === w.id ? w : x))));
      onToast(r.wf ? `🕸️ ${r.wf.name}: ${r.ok}/${r.total} nodes ok` : '⚠️ Workflow nahi mila');
    } finally {
      setBusyId('');
      setWfs(loadWorkflows());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl border border-cyan-400/25 bg-[#070e18] shadow-[0_20px_60px_rgba(0,0,0,0.9)]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2.5 border-b border-white/10 bg-[#070e18]/95 backdrop-blur">
          <div>
            <div className="text-[11px] font-black text-cyan-200">🕸️ WORKFLOW AI AGENT</div>
            <div className="text-[8.5px] font-bold text-slate-400">steps ki chain · fallback branch · live node status</div>
          </div>
          <button onClick={onClose} className="cursor-pointer w-7 h-7 rounded-full bg-white/10 text-white/80 text-xs font-black">
            ✕
          </button>
        </div>

        <div className="p-2.5 space-y-2.5">
          <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-2 py-1.5 text-[8.5px] font-bold text-amber-100/85 leading-snug">
            ⚠️ Sach: workflow app khuli hone par chalta hai — cloud queue nahi (wo R2/KV + worker chahiye). Node fail ho to
            fallback branch chalti hai (motion → footage) aur wo log me saaf likha jaata hai.
          </div>

          {wfs.map((w) => (
            <div key={w.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-base">{w.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-black text-slate-100 truncate">{w.name}</div>
                  <div className="text-[8px] font-bold text-slate-400 truncate">{w.nodes.length} nodes · {w.niche}</div>
                </div>
                <button
                  onClick={() => setOpenId(openId === w.id ? '' : w.id)}
                  className="px-1.5 py-1 rounded-lg text-[8.5px] font-black bg-white/10 text-slate-200 cursor-pointer"
                >
                  {openId === w.id ? '▲' : '▼'}
                </button>
                <button
                  disabled={!!busyId}
                  onClick={() => run(w.id)}
                  className={`px-2 py-1 rounded-lg text-[9px] font-black cursor-pointer ${
                    busyId === w.id ? 'bg-white/10 text-slate-400' : 'bg-gradient-to-r from-cyan-600 to-emerald-600 text-white'
                  }`}
                >
                  {busyId === w.id ? '⏳' : '▶️ CHALAO'}
                </button>
                <button
                  onClick={() => {
                    setWfs(deleteWorkflow(w.id));
                    onToast('🗑️ Workflow hata diya');
                  }}
                  className="px-1.5 py-1 rounded-lg text-[9px] font-black bg-rose-500/20 text-rose-200 cursor-pointer"
                >
                  🗑
                </button>
              </div>

              {/* node chain visual */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {w.nodes.map((n, i) => {
                  const res = w.results.find((r) => r.nodeId === n.id);
                  const tone =
                    res?.status === 'ok'
                      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                      : res?.status === 'fail'
                        ? 'bg-rose-500/20 text-rose-200 border-rose-400/40'
                        : res?.status === 'skip'
                          ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                          : 'bg-white/[0.06] text-slate-300 border-white/10';
                  return (
                    <div key={n.id} className="flex items-center gap-1 shrink-0">
                      <span className={`px-1.5 py-1 rounded-lg border text-[8px] font-black ${tone}`}>
                        {res?.status === 'ok' ? '✅ ' : res?.status === 'fail' ? '❌ ' : res?.status === 'skip' ? '⚠️ ' : ''}
                        {WF_NODE_LABEL[n.kind]}
                      </span>
                      {i < w.nodes.length - 1 && <span className="text-[9px] text-slate-500">→</span>}
                    </div>
                  );
                })}
              </div>

              {openId === w.id && (
                <div className="rounded-lg bg-[#04090e] border border-white/10 p-1.5 max-h-40 overflow-y-auto space-y-0.5">
                  {w.results.length === 0 && <div className="text-[8px] font-bold text-slate-500">abhi koi run nahi — ▶️ CHALAO dabao</div>}
                  {w.results.map((r, i) => (
                    <div
                      key={i}
                      className={`text-[8px] font-semibold leading-snug ${
                        r.status === 'ok' ? 'text-emerald-300' : r.status === 'fail' ? 'text-rose-300' : 'text-amber-300'
                      }`}
                    >
                      {r.status === 'ok' ? '✅' : r.status === 'fail' ? '❌' : '⚠️'} {WF_NODE_LABEL[w.nodes.find((n) => n.id === r.nodeId)?.kind || 'trigger']} · {r.note}{' '}
                      <span className="text-slate-500">({r.ms}ms)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* builder */}
          <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/[0.07] p-2 space-y-1.5">
            <div className="text-[9.5px] font-black text-cyan-100">➕ NAYA WORKFLOW</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workflow ka naam (e.g. Crypto Daily Pipeline)"
              className="w-full bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-100"
            />
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Niche / topic (e.g. Crypto India)"
              className="w-full bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-100"
            />
            <div className="flex flex-wrap gap-1">
              {(['trigger', 'research', 'motion', 'footage', 'save', 'publish', 'notify'] as WfNodeKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => addNode(k)}
                  className="px-1.5 py-1 rounded-lg text-[8.5px] font-black bg-white/[0.06] text-slate-200 cursor-pointer"
                >
                  ＋ {WF_NODE_LABEL[k]}
                </button>
              ))}
            </div>
            <div className="rounded-lg bg-[#04090e] border border-white/10 p-1.5 min-h-8 flex flex-wrap items-center gap-1">
              {chain.length === 0 && <span className="text-[8px] font-bold text-slate-500">upar se step chuno…</span>}
              {chain.map((k, i) => (
                <span key={i} className="flex items-center gap-0.5">
                  <button
                    onClick={() => removeNode(i)}
                    className="px-1.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/30 text-cyan-100 text-[8px] font-black cursor-pointer"
                    title="nikalo"
                  >
                    {WF_NODE_LABEL[k]} ✕
                  </button>
                  {i < chain.length - 1 && <span className="text-[9px] text-slate-500">→</span>}
                </span>
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
              className="w-full py-2 rounded-xl text-[10px] font-black bg-gradient-to-r from-cyan-600 to-emerald-600 text-white cursor-pointer"
            >
              ➕ WORKFLOW BANAO ({chain.length} nodes)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
