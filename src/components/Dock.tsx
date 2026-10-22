import React from 'react';

interface DockProps {
  poweredOn: boolean;
  menuOpen: boolean;
  isListening: boolean;
  autoTrading?: boolean;
  onTogglePower: () => void;
  onToggleMenu: () => void;
  onToggleMic: () => void;
  onOpenTrading?: () => void;
  onTestVoice?: () => void;
}

const PowerIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 2v10" />
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
  </svg>
);

export const Dock: React.FC<DockProps> = ({
  poweredOn,
  menuOpen,
  isListening,
  autoTrading = false,
  onTogglePower,
  onToggleMenu,
  onToggleMic,
  onOpenTrading,
}) => {
  // FULL OFF mode: pure minimal single ON/OFF power button over blackout screen
  if (!poweredOn) {
    return (
      <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(26px+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2">
        <span className="font-mono text-[9.5px] tracking-[0.28em] uppercase text-[#4a5d6b] select-none">
          APEX · FULL OFF
        </span>
        <button
          onClick={onTogglePower}
          data-testid="power-button"
          aria-pressed={false}
          aria-label="Power switch — currently OFF, tap to turn ON"
          className="cursor-pointer flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase rounded-xl px-5 py-2.5 transition-all duration-200 bg-[#0b1015] text-[#ff6b6b] border border-[rgba(255,107,107,0.35)] shadow-[0_0_24px_-8px_rgba(255,80,80,0.45)] hover:text-[#ffd6d6] hover:border-[rgba(255,107,107,0.75)] hover:bg-[#141a22] whitespace-nowrap"
        >
          <PowerIcon />
          <span>OFF</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(20px+env(safe-area-inset-bottom))] z-30 flex gap-1.5 items-center justify-center p-1.5 rounded-2xl bg-[rgba(5,13,20,0.85)] border border-[rgba(79,210,255,0.28)] backdrop-blur-md shadow-[0_14px_40px_-14px_rgba(0,0,0,0.95)] max-w-[96vw]">
      <button
        onClick={onTogglePower}
        data-testid="power-button"
        aria-pressed={true}
        aria-label="Power switch — currently ON, tap to turn FULL OFF"
        className="cursor-pointer flex items-center gap-1 font-mono text-[10.5px] tracking-[0.1em] uppercase rounded-xl px-2.5 py-2 transition-all duration-200 border whitespace-nowrap text-[#041a12] bg-[#2ef2a4] border-[#2ef2a4] font-bold shadow-[0_0_16px_-3px_rgba(46,242,164,0.75)]"
      >
        <PowerIcon />
        <span>ON</span>
      </button>

      <button
        onClick={onToggleMic}
        aria-pressed={isListening}
        aria-label="Live Voice Call"
        className={`cursor-pointer font-mono text-[11px] tracking-[0.08em] uppercase rounded-xl px-3.5 py-2 transition-all duration-200 border whitespace-nowrap ${
          isListening
            ? 'text-white bg-[#ff3b5c] border-[#ff6b84] font-extrabold shadow-[0_0_22px_-2px_rgba(255,59,92,0.85)] animate-pulse'
            : 'text-[#041a12] bg-gradient-to-r from-[#00f5a0] to-[#4fd2ff] border-[#4fd2ff] font-extrabold shadow-[0_0_20px_-4px_rgba(0,245,160,0.75)]'
        }`}
      >
        {isListening ? '🔴 END CALL' : '📞 LIVE CALL'}
      </button>

      {onOpenTrading && (
        <button
          onClick={onOpenTrading}
          aria-label="Open Real CoinDCX Trading"
          className={`cursor-pointer font-mono text-[10.5px] tracking-[0.08em] uppercase rounded-xl px-2.5 py-2 transition-all duration-200 border whitespace-nowrap flex items-center gap-1 ${
            autoTrading
              ? 'text-[#00f5a0] bg-[rgba(0,245,160,0.16)] border-[#00f5a0] font-bold'
              : 'text-[#eaf9ff] bg-[rgba(79,210,255,0.12)] border-[rgba(79,210,255,0.35)] font-semibold'
          }`}
        >
          <span>💹</span>
          <span>{autoTrading ? 'AUTO●' : 'TRADE'}</span>
        </button>
      )}

      <button
        onClick={onToggleMenu}
        aria-expanded={menuOpen}
        aria-label="Main menu"
        className={`cursor-pointer font-mono text-[14px] leading-none rounded-xl px-2.5 py-2 transition-all duration-200 border whitespace-nowrap ${
          menuOpen
            ? 'text-[#0a1620] bg-[var(--cyan,#4fd2ff)] border-[var(--cyan,#4fd2ff)] font-semibold shadow-[0_0_18px_-4px_rgba(79,210,255,0.75)]'
            : 'text-[#9fc5de] border-[rgba(79,210,255,0.2)] hover:text-[#d7f1ff] hover:bg-[rgba(79,210,255,0.1)]'
        }`}
      >
        ☰
      </button>
    </div>
  );
};
