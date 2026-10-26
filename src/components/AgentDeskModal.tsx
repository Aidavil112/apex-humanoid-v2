import { useEffect, useMemo, useRef, useState } from 'react';
import { DEVICE_TITLE, initialDesk, runDeskMission, type DeskAgent, type ScreenKind } from '../engine/agentDesk';
import type { MotionStyle } from '../engine/motionForge';
import { isAppleTouch } from '../engine/iosAutopilot';

/**
 * 🏢 APEX HQ — 3D NEON DASHBOARD (reel jaisa premium UI).
 *
 * Look: 3D perspective tilt + neon glow + glass cards + 3D typography + analytics cards
 * (CSS only — framer-motion nahi, Tailwind ka jhanjhat nahi). Kaam bilkul wahi:
 * 7 agents ek-ek karke, har agent ka apna live screen, 👑 Boss console.
 */

const CSS = `
@keyframes hq-float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-3px); } }
@keyframes hq-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(400%); } }
@keyframes hq-pulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
@keyframes hq-blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
@keyframes hq-sheen { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
@keyframes hq-bar { 0% { transform: scaleY(.25); } 100% { transform: scaleY(1); } }
.hq-root {
  --cyan: #22d3ee; --fuchsia: #e879f9; --violet: #8b5cf6; --emerald: #34d399; --amber: #fbbf24; --rose: #fb7185;
  position: fixed; inset: 0; z-index: 85; display: flex; align-items: flex-end; justify-content: center;
  background:
    radial-gradient(900px 500px at 50% -12%, rgba(34,211,238,.16), transparent 62%),
    radial-gradient(700px 420px at 12% 108%, rgba(232,121,249,.15), transparent 60%),
    rgba(2,5,10,.93);
  backdrop-filter: blur(9px); padding: 4px;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.hq-shell {
  width: 100%; max-width: 500px; max-height: 96vh; overflow-y: auto; border-radius: 22px;
  background: linear-gradient(160deg, rgba(12,22,34,.97), rgba(4,8,14,.99));
  border: 1px solid rgba(34,211,238,.28);
  box-shadow: 0 0 0 1px rgba(232,121,249,.09), 0 26px 70px rgba(0,0,0,.92),
              0 0 60px -22px rgba(34,211,238,.55), inset 0 1px 0 rgba(255,255,255,.06);
  position: relative; overflow-x: hidden;
}
.hq-shell::before {
  content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .5;
  background-image: linear-gradient(rgba(34,211,238,.07) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(232,121,249,.06) 1px, transparent 1px);
  background-size: 26px 26px;
  mask-image: radial-gradient(120% 80% at 50% 0%, #000 30%, transparent 78%);
}
.hq-top {
  position: sticky; top: 0; z-index: 6; padding: 9px 10px 8px;
  background: linear-gradient(180deg, rgba(6,12,20,.99), rgba(6,12,20,.90));
  border-bottom: 1px solid rgba(34,211,238,.18);
  backdrop-filter: blur(10px);
}
.hq-title {
  font-size: 15px; font-weight: 900; letter-spacing: .06em; line-height: 1.1;
  background: linear-gradient(92deg, #a5f3fc 0%, #e879f9 48%, #fde68a 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  text-shadow: 0 1px 0 rgba(0,0,0,.6), 0 0 22px rgba(232,121,249,.45);
  filter: drop-shadow(0 2px 6px rgba(34,211,238,.35));
}
.hq-sub { font-size: 8px; font-weight: 800; color: #93a9bd; letter-spacing: .04em; margin-top: 1px; }
.hq-card {
  border-radius: 14px; padding: 8px; position: relative;
  background: linear-gradient(158deg, rgba(23,36,52,.82), rgba(7,13,21,.92));
  border: 1px solid rgba(255,255,255,.10);
  box-shadow: 0 10px 24px -14px rgba(0,0,0,.95), inset 0 1px 0 rgba(255,255,255,.055);
}
.hq-card.glow-c { border-color: rgba(34,211,238,.34); box-shadow: 0 0 26px -12px rgba(34,211,238,.75), 0 10px 24px -16px #000; }
.hq-card.glow-f { border-color: rgba(232,121,249,.38); box-shadow: 0 0 30px -12px rgba(232,121,249,.8), 0 10px 24px -16px #000; }
.hq-card.glow-e { border-color: rgba(52,211,153,.34); box-shadow: 0 0 24px -13px rgba(52,211,153,.75), 0 10px 24px -16px #000; }
.hq-card.glow-a { border-color: rgba(251,191,36,.34); box-shadow: 0 0 24px -13px rgba(251,191,36,.72), 0 10px 24px -16px #000; }
.hq-card.glow-r { border-color: rgba(251,113,133,.34); box-shadow: 0 0 24px -13px rgba(251,113,133,.72), 0 10px 24px -16px #000; }

.hq-stat { border-radius: 12px; padding: 6px 7px; background: linear-gradient(160deg, rgba(255,255,255,.075), rgba(255,255,255,.02));
  border: 1px solid rgba(255,255,255,.10); position: relative; overflow: hidden; }
.hq-stat .k { font-size: 7px; font-weight: 900; letter-spacing: .10em; color: #7f94a8; text-transform: uppercase; }
.hq-stat .v { font-size: 15px; font-weight: 900; color: #eaf4ff; line-height: 1.05; margin-top: 1px;
  text-shadow: 0 0 14px rgba(34,211,238,.5); }
.hq-stat .v small { font-size: 8px; font-weight: 800; color: #93a9bd; }
.hq-spark { display: flex; align-items: flex-end; gap: 2px; height: 14px; margin-top: 4px; }
.hq-spark i { flex: 1; border-radius: 2px 2px 0 0; transform-origin: bottom; animation: hq-bar .9s ease-out both; }

.hq-win { border-radius: 13px; overflow: hidden; position: relative;
  border: 1px solid rgba(255,255,255,.11);
  background: linear-gradient(165deg, rgba(19,31,45,.86), rgba(4,9,15,.96));
  box-shadow: 0 12px 26px -16px #000, inset 0 1px 0 rgba(255,255,255,.05);
  transition: transform .35s ease, box-shadow .35s ease; transform-style: preserve-3d;
  transform: perspective(760px) rotateX(4.5deg) rotateY(-1.4deg);
}
.hq-win:hover { transform: perspective(760px) rotateX(0deg) rotateY(0deg) translateY(-2px); }
.hq-win.live { border-color: rgba(232,121,249,.62);
  box-shadow: 0 0 34px -10px rgba(232,121,249,.9), 0 0 0 1px rgba(232,121,249,.28), 0 14px 30px -18px #000;
  animation: hq-float 3.4s ease-in-out infinite; }
.hq-win.ok { border-color: rgba(52,211,153,.42); box-shadow: 0 0 26px -14px rgba(52,211,153,.85), 0 12px 26px -18px #000; }
.hq-win.warn { border-color: rgba(251,191,36,.40); box-shadow: 0 0 24px -14px rgba(251,191,36,.8), 0 12px 26px -18px #000; }
.hq-win.fail { border-color: rgba(251,113,133,.44); box-shadow: 0 0 24px -14px rgba(251,113,133,.85), 0 12px 26px -18px #000; }
.hq-bar { display: flex; align-items: center; gap: 4px; padding: 3px 6px;
  background: linear-gradient(180deg, rgba(255,255,255,.09), rgba(0,0,0,.55));
  border-bottom: 1px solid rgba(255,255,255,.09); }
.hq-dot { width: 5px; height: 5px; border-radius: 99px; box-shadow: 0 0 6px currentColor; }
.hq-bar .nm { font-size: 8px; font-weight: 900; color: #e8f1fa; letter-spacing: .02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hq-bar .dev { margin-left: auto; font-size: 6.5px; font-weight: 800; color: #6b8199; letter-spacing: .08em; text-transform: uppercase; }
.hq-body { position: relative; height: 76px; overflow: hidden; background: radial-gradient(120% 130% at 20% 0%, rgba(34,211,238,.10), transparent 62%), #03070d; }
.hq-body .scroll { height: 100%; overflow-y: auto; padding: 4px 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.hq-body .scroll div { font-size: 7.5px; line-height: 1.42; word-break: break-word; }
.hq-body .scan { position: absolute; left: 0; right: 0; height: 26px; pointer-events: none;
  background: linear-gradient(180deg, transparent, rgba(34,211,238,.10), transparent);
  animation: hq-scan 3.6s linear infinite; }
.hq-ln.cmd { color: #67e8f9; } .hq-ln.ok { color: #6ee7b7; } .hq-ln.warn { color: #fcd34d; }
.hq-ln.err { color: #fda4af; } .hq-ln.type { color: #f5d0fe; } .hq-ln.out { color: #c3d2e0; }
.hq-caret { display: inline-block; color: #f0abfc; animation: hq-blink 1s infinite; }

.hq-chip { border: 1px solid rgba(255,255,255,.13); background: rgba(255,255,255,.055); color: #cbd8e6;
  border-radius: 9px; padding: 3px 7px; font-size: 8px; font-weight: 900; cursor: pointer; letter-spacing: .02em;
  transition: all .18s ease; }
.hq-chip:hover { border-color: rgba(34,211,238,.5); color: #e0f7ff; box-shadow: 0 0 14px -6px rgba(34,211,238,.9); }
.hq-chip.on { background: linear-gradient(135deg, rgba(232,121,249,.30), rgba(139,92,246,.26));
  border-color: rgba(232,121,249,.55); color: #fae8ff; box-shadow: 0 0 18px -8px rgba(232,121,249,1); }
.hq-go { border: 0; border-radius: 10px; padding: 6px 11px; font-size: 9px; font-weight: 900; color: #04121c; cursor: pointer;
  background: linear-gradient(95deg, #22d3ee, #a78bfa 55%, #e879f9);
  box-shadow: 0 0 22px -8px rgba(34,211,238,.95), 0 6px 16px -10px #000;
  background-size: 200% 100%; animation: hq-sheen 4.5s linear infinite; letter-spacing: .03em; }
.hq-go:disabled { background: rgba(255,255,255,.10); color: #7c8ea0; box-shadow: none; animation: none; cursor: default; }
.hq-input { width: 100%; border-radius: 10px; padding: 6px 8px; font-size: 9.5px; font-weight: 700; color: #eaf4ff;
  background: linear-gradient(160deg, rgba(8,16,26,.98), rgba(4,9,15,.98));
  border: 1px solid rgba(34,211,238,.22); outline: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 0 0 0 rgba(34,211,238,0); transition: box-shadow .2s ease, border-color .2s; }
.hq-input:focus { border-color: rgba(34,211,238,.55); box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 0 20px -8px rgba(34,211,238,.95); }
.hq-k { font-size: 7px; font-weight: 900; letter-spacing: .12em; color: #7f94a8; text-transform: uppercase; }
.hq-pill { font-size: 7.5px; font-weight: 900; border-radius: 99px; padding: 1px 6px; border: 1px solid currentColor; }
.hq-feed { border-radius: 12px; background: linear-gradient(170deg, rgba(6,12,20,.98), rgba(3,7,12,.99));
  border: 1px solid rgba(139,92,246,.28); box-shadow: inset 0 0 26px -16px rgba(139,92,246,.9); padding: 6px;
  max-height: 104px; overflow-y: auto; }
.hq-feed div.l { font-size: 7.5px; font-weight: 700; color: #b9c9d8; line-height: 1.5; }
.hq-tilt { transform-style: preserve-3d; }
`;

const lineColor = (k: ScreenKind) =>
  k === 'cmd' ? 'cmd' : k === 'ok' ? 'ok' : k === 'warn' ? 'warn' : k === 'err' ? 'err' : k === 'type' ? 'type' : 'out';

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
  const [lastVideoMb, setLastVideoMb] = useState(0);
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
    setLastVideoMb(0);
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
      if (r.video) setLastVideoMb(r.video.blob.size / 1048576);
      onToast(`🏢 HQ: ${r.ok}/${r.total} agents ok${r.video ? ' · video Vault me' : ''}`);
    } catch (e: any) {
      onToast(`⚠️ HQ fail: ${String(e?.message || e).slice(0, 80)}`);
    } finally {
      setBusy(false);
      setAgents((prev) => prev.map((a) => (a.status === 'working' ? { ...a, status: 'warn' as const } : a)));
    }
  };

  const boss = agents.find((a) => a.id === 'boss');
  const workers = useMemo(() => agents.filter((a) => a.id !== 'boss'), [agents]);
  const doneCount = workers.filter((a) => a.status === 'ok').length;
  const liveCount = workers.filter((a) => a.status === 'working').length;
  const totalProgress = Math.round(workers.reduce((s, a) => s + a.progress, 0) / Math.max(1, workers.length));

  const winCls = (s: DeskAgent['status']) =>
    s === 'ok' ? 'hq-win ok' : s === 'working' ? 'hq-win live' : s === 'warn' ? 'hq-win warn' : s === 'fail' ? 'hq-win fail' : 'hq-win';
  const glow = (s: DeskAgent['status']) =>
    s === 'ok' ? 'glow-e' : s === 'working' ? 'glow-f' : s === 'warn' ? 'glow-a' : s === 'fail' ? 'glow-r' : '';
  const pill = (s: DeskAgent['status']) =>
    s === 'ok' ? '✅ done' : s === 'working' ? '⚙️ live' : s === 'warn' ? '⚠️ skip' : s === 'fail' ? '❌ fail' : '· idle';
  const pillColor = (s: DeskAgent['status']) =>
    s === 'ok' ? '#34d399' : s === 'working' ? '#e879f9' : s === 'warn' ? '#fbbf24' : s === 'fail' ? '#fb7185' : '#6b8199';

  const ScreenWindow = ({ a, wide }: { a: DeskAgent; wide?: boolean }) => {
    const boxRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
      const el = boxRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, [a.screen.length]);
    return (
      <div className={winCls(a.status)} style={wide ? { gridColumn: 'span 2' } : undefined}>
        <div className="hq-bar">
          <span className="hq-dot" style={{ background: '#ff5f57', color: '#ff5f57' }} />
          <span className="hq-dot" style={{ background: '#febc2e', color: '#febc2e' }} />
          <span className="hq-dot" style={{ background: '#28c840', color: '#28c840' }} />
          <span className="nm">
            {a.emoji} {a.name}
          </span>
          <span className="dev">{DEVICE_TITLE[a.device]}</span>
        </div>
        <div className="hq-body">
          {a.status === 'working' && <div className="scan" />}
          <div className="scroll" ref={boxRef}>
            {a.screen.slice(-8).map((l, idx, arr) => (
              <div key={l.i} className={`hq-ln ${lineColor(l.kind)}`}>
                {l.text}
                {idx === arr.length - 1 && a.status === 'working' && <span className="hq-caret">▊</span>}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 6px', background: 'rgba(0,0,0,.42)', borderTop: '1px solid rgba(255,255,255,.07)' }}>
          <span style={{ fontSize: 7.5, fontWeight: 900, color: pillColor(a.status) }}>{pill(a.status)}</span>
          <span style={{ marginLeft: 'auto', fontSize: 7, fontWeight: 800, color: '#8fa4b8' }}>{a.progress > 0 ? `${a.progress}%` : ''}</span>
        </div>
        <div style={{ height: 2, background: 'rgba(255,255,255,.09)' }}>
          <div
            style={{
              height: '100%',
              width: `${a.progress}%`,
              background:
                a.status === 'fail'
                  ? 'linear-gradient(90deg,#fb7185,#f43f5e)'
                  : a.status === 'warn'
                    ? 'linear-gradient(90deg,#fbbf24,#f59e0b)'
                    : a.status === 'working'
                      ? 'linear-gradient(90deg,#22d3ee,#e879f9)'
                      : 'linear-gradient(90deg,#34d399,#22d3ee)',
              boxShadow: a.status === 'working' ? '0 0 12px rgba(232,121,249,.95)' : 'none',
              transition: 'width .3s ease',
            }}
          />
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  const stats: { k: string; v: string; bars: number[]; tint: string }[] = [
    { k: 'Agents done', v: `${doneCount}/7`, bars: workers.map((a) => Math.max(0.12, a.progress / 100)), tint: '#34d399' },
    { k: 'Live now', v: String(liveCount), bars: workers.map((a) => (a.status === 'working' ? 1 : 0.15)), tint: '#e879f9' },
    { k: 'Progress', v: `${totalProgress}%`, bars: workers.map((a) => Math.max(0.1, a.progress / 100)), tint: '#22d3ee' },
    { k: 'Video', v: lastVideoMb ? lastVideoMb.toFixed(2) : '—', bars: [0.2, 0.45, 0.3, 0.7, 0.5, 0.85, 0.6], tint: '#fbbf24' },
  ];

  return (
    <div className="hq-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="hq-shell">
        {/* ── header ── */}
        <div className="hq-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="hq-title">🏢 APEX HQ · 3D FLOOR</div>
              <div className="hq-sub">
                👤 HUMANS: 1 (tum) · 🤖 AGENTS: 7 · 👑 BOSS: Head Bot {busy ? `· ${elapsed}s` : ''}
              </div>
            </div>
            <span className="hq-pill" style={{ color: busy ? '#e879f9' : '#34d399' }}>
              {busy ? 'LIVE' : 'READY'}
            </span>
            <button
              onClick={onClose}
              style={{ width: 26, height: 26, borderRadius: 99, background: 'rgba(255,255,255,.09)', border: '1px solid rgba(255,255,255,.14)', color: '#dbe7f2', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          {/* analytics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, marginTop: 7 }}>
            {stats.map((s) => (
              <div key={s.k} className="hq-stat">
                <div className="k">{s.k}</div>
                <div className="v">
                  {s.v}
                  {s.k === 'Video' && lastVideoMb ? <small> MB</small> : null}
                </div>
                <div className="hq-spark">
                  {s.bars.slice(0, 7).map((b, i) => (
                    <i
                      key={i}
                      style={{
                        height: `${Math.max(12, Math.min(100, b * 100))}%`,
                        background: `linear-gradient(180deg, ${s.tint}, ${s.tint}33)`,
                        boxShadow: `0 0 6px -1px ${s.tint}`,
                        animationDelay: `${i * 45}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* controls */}
          <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <input className="hq-input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Mission — e.g. 'Crypto India ke 3 rules'" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              <button className={`hq-chip ${view === 'screens' ? 'on' : ''}`} onClick={() => setView('screens')}>
                🖥️ LIVE SCREENS
              </button>
              <button className={`hq-chip ${view === 'floor' ? 'on' : ''}`} onClick={() => setView('floor')}>
                🗂️ FLOOR
              </button>
              {(['kino-glass', 'neon-pulse', 'brutal-flash'] as MotionStyle[]).map((s) => (
                <button key={s} className={`hq-chip ${style === s ? 'on' : ''}`} onClick={() => setStyle(s)}>
                  {s === 'kino-glass' ? '🎥' : s === 'neon-pulse' ? '⚡' : '🔥'}
                </button>
              ))}
              <button className={`hq-chip ${publish ? 'on' : ''}`} onClick={() => setPublish((v) => !v)}>
                {publish ? '📤 POST' : '💾 SAVE'}
              </button>
              <button className="hq-go" style={{ marginLeft: 'auto' }} disabled={busy} onClick={run}>
                {busy ? '⏳ HQ LIVE…' : '▶️ START HQ'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {/* 👑 boss console */}
          {boss && (
            <div className={`hq-card glow-a`} style={{ borderColor: 'rgba(251,191,36,.34)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13 }}>👑</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 900, color: '#fde68a', letterSpacing: '.03em', textShadow: '0 0 16px rgba(251,191,36,.65)' }}>
                    BOSS — COMMAND CONSOLE
                  </div>
                  <div className="hq-k">{boss.doing}</div>
                </div>
                <span className="hq-pill" style={{ color: pillColor(boss.status) }}>
                  {pill(boss.status)}
                </span>
              </div>
              <div style={{ marginTop: 6, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(251,191,36,.18)', position: 'relative', background: 'radial-gradient(120% 140% at 15% 0%, rgba(251,191,36,.10), transparent 60%), #03070d' }}>
                <div className="scroll" style={{ maxHeight: 54, overflowY: 'auto', padding: '4px 6px', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                  {boss.screen.slice(-4).map((l, idx, arr) => (
                    <div key={l.i} className={`hq-ln ${lineColor(l.kind)}`} style={{ fontSize: 7.5, lineHeight: 1.42, wordBreak: 'break-word' }}>
                      {l.text}
                      {idx === arr.length - 1 && boss.status === 'working' && <span className="hq-caret">▊</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* agent grid */}
          {view === 'screens' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {workers.map((a) => (
                  <ScreenWindow key={a.id} a={a} wide={a.id === 'render'} />
                ))}
              </div>
              <div style={{ fontSize: 7.5, fontWeight: 700, color: '#8199ad', lineHeight: 1.55 }}>
                ⚠️ Sach: har window me jo likha hai wo ASLI action ke saath likhta hai (worker call · render frame · IDB put · Graph API).
                Jahan token/worker na mile wahan <b>skip + reason</b>. {isAppleTouch() ? '🍎 iPhone: app khuli rakho.' : '🤖 Android: app khuli rakho.'}
              </div>
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {workers.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setOpenId(openId === a.id ? '' : a.id)}
                  className={`hq-card ${glow(a.status)}`}
                  style={{ textAlign: 'left', cursor: 'pointer', gridColumn: openId === a.id ? 'span 2' : undefined }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13 }}>{a.emoji}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 900, color: '#eaf4ff' }}>{a.name}</div>
                      <div style={{ fontSize: 7.5, fontWeight: 800, color: pillColor(a.status) }}>{pill(a.status)}</div>
                    </div>
                    {a.progress > 0 && a.progress < 100 && (
                      <span style={{ fontSize: 8, fontWeight: 900, color: '#f5d0fe' }}>{a.progress}%</span>
                    )}
                  </div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#c3d2e0', lineHeight: 1.4, marginTop: 3 }}>{a.doing}</div>
                  {openId === a.id && (
                    <div style={{ marginTop: 6, display: 'grid', gap: 5 }}>
                      <div className="hq-k">{a.role}</div>
                      {a.saw.length > 0 && (
                        <div style={{ borderRadius: 9, background: 'rgba(3,7,13,.9)', border: '1px solid rgba(34,211,238,.25)', padding: 5 }}>
                          <div className="hq-k" style={{ color: '#67e8f9' }}>👁️ KYA DEKHA / PADHA</div>
                          {a.saw.map((s, i) => (
                            <div key={i} style={{ fontSize: 7.5, fontWeight: 700, color: '#b9c9d8', lineHeight: 1.45, wordBreak: 'break-word' }}>{s}</div>
                          ))}
                        </div>
                      )}
                      {a.made.length > 0 && (
                        <div style={{ borderRadius: 9, background: 'rgba(3,7,13,.9)', border: '1px solid rgba(52,211,153,.25)', padding: 5 }}>
                          <div className="hq-k" style={{ color: '#6ee7b7' }}>🛠️ KYA BANAYA</div>
                          {a.made.map((s, i) => (
                            <div key={i} style={{ fontSize: 7.5, fontWeight: 700, color: '#b9c9d8', lineHeight: 1.45, wordBreak: 'break-word' }}>{s}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* feed */}
          <div className="hq-feed">
            <div className="hq-k" style={{ color: '#a78bfa', marginBottom: 3 }}>📡 LIVE FEED — BOSS ORDERS + AGENT RESULTS</div>
            {ticker.length === 0 && <div className="l" style={{ color: '#5f7488' }}>abhi kuch nahi — ▶️ START HQ dabao</div>}
            {ticker.map((l, i) => (
              <div key={i} className="l">{l}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
