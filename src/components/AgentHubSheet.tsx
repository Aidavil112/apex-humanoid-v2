import { isAppleTouch } from '../engine/iosAutopilot';

/**
 * 🧩 AGENTS LAUNCHER — 3 alag-alag cheezein ek jagah se kholne ke liye.
 * Tap karo → apni alag screen khulti hai (ek me merge nahi kiya, warna user ko phir
 * "kahan gaya mera bot" wala confusion hota hai).
 */
export function AgentHubSheet({
  isOpen,
  onClose,
  onOpenBotStudio,
  onOpenWorkflow,
  onOpenTrading,
  onOpenDesk,
  onOpenRealDesk,
  botCount,
  wfCount,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOpenBotStudio: () => void;
  onOpenWorkflow: () => void;
  onOpenTrading: () => void;
  onOpenDesk: () => void;
  onOpenRealDesk: () => void;
  botCount: number;
  wfCount: number;
}) {
  if (!isOpen) return null;

  const Item = ({
    emoji,
    title,
    sub,
    badge,
    gradient,
    onClick,
  }: {
    emoji: string;
    title: string;
    sub: string;
    badge: string;
    gradient: string;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border border-white/12 p-3 bg-gradient-to-r ${gradient} cursor-pointer active:scale-[0.99] transition-transform`}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-xl">{emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black text-white">{title}</div>
          <div className="text-[8.5px] font-bold text-slate-300/90 leading-snug">{sub}</div>
        </div>
        <span className="px-2 py-1 rounded-lg bg-black/30 text-[8.5px] font-black text-white/85 shrink-0">{badge}</span>
      </div>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[75] bg-black/75 backdrop-blur-sm flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl border-t border-white/15 bg-[#070e18] p-3 pb-[calc(14px+env(safe-area-inset-bottom))] space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-black text-fuchsia-200">🧩 AGENTS</div>
            <div className="text-[8.5px] font-bold text-slate-400">teen alag screens — jo chahiye wahi kholo</div>
          </div>
          <button onClick={onClose} className="cursor-pointer w-7 h-7 rounded-full bg-white/10 text-white/80 text-xs font-black">
            ✕
          </button>
        </div>

        <Item
          emoji="🤖"
          title="BOT STUDIO"
          sub="Apne chhote bots — research → render → save → publish, ek tap me"
          badge={`${botCount} bots`}
          gradient="from-fuchsia-500/20 to-indigo-500/10"
          onClick={onOpenBotStudio}
        />
        <Item
          emoji="🕸️"
          title="WORKFLOW AI AGENT"
          sub="Steps ki poori chain + fallback branch + live node status"
          badge={`${wfCount} flows`}
          gradient="from-cyan-500/20 to-emerald-500/10"
          onClick={onOpenWorkflow}
        />
        <Item
          emoji="🏢"
          title="AGENT DESK (live floor)"
          sub="7 agents ek-ek karke — kaun kya padh raha, kya bana raha, saaf dikhta hai"
          badge="LIVE"
          gradient="from-fuchsia-500/20 to-purple-500/10"
          onClick={onOpenDesk}
        />
        <Item
          emoji="💹"
          title="REAL DESK (asli paisa)"
          sub="CoinDCX real balance + real order · safety caps + kill switch (purana bot waisa hi)"
          badge="₹ LIVE"
          gradient="from-rose-500/20 to-orange-500/10"
          onClick={onOpenRealDesk}
        />
        <Item
          emoji="📈"
          title="TRADING BOT (CoinDCX)"
          sub="Real trading desk — pairs, auto ON/OFF, boss directive (yahi se khulta hai)"
          badge="live"
          gradient="from-emerald-500/20 to-lime-500/10"
          onClick={onOpenTrading}
        />

        <div className="text-[8px] font-bold text-slate-500 leading-snug">
          {isAppleTouch()
            ? '🍎 iPhone: teeno app ke andar chalte hain — app band = ruk jayenge (Apple limit).'
            : '🤖 Android: app ke andar chalte hain; scheduled publish ke liye native alarm Jarvis card me hai.'}
        </div>
      </div>
    </div>
  );
}
