import React from 'react';

interface DockProps {
  poweredOn: boolean;
  menuOpen: boolean;
  isListening: boolean;
  onTogglePower: () => void;
  onToggleMenu: () => void;
  onToggleMic: () => void;
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
  onTogglePower,
  onToggleMenu,
  onToggleMic,
  onTestVoice,
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
    <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(26px+env(safe-area-inset-bottom))] z-20 flex gap-2 items-center justify-center p-2 rounded-xl bg-[rgba(6,14,21,0.65)] border border-[rgba(79,210,255,0.18)] backdrop-blur-md shadow-[0_14px_40px_-18px_rgba(0,0,0,0.9)]">
      <button
        onClick={onTogglePower}
        data-testid="power-button"
        aria-pressed={true}
        aria-label="Power switch — currently ON, tap to turn FULL OFF"
        className="cursor-pointer flex items-center gap-1.5 font-mono text-[11px] tracking-[0.14em] uppercase rounded-lg px-3.5 py-2 transition-all duration-200 border whitespace-nowrap text-[#041a12] bg-[#2ef2a4] border-[#2ef2a4] font-semibold shadow-[0_0_18px_-3px_rgba(46,242,164,0.75)] hover:brightness-110"
      >
        <PowerIcon />
        <span>ON</span>
      </button>

      {onTestVoice && (
        <button
          onClick={onTestVoice}
          aria-label="Test AI voice"
          className="cursor-pointer flex items-center gap-1.5 font-mono text-[11px] tracking-[0.14em] uppercase rounded-lg px-3 py-2 transition-all duration-200 border text-[#7fa8c2] border-transparent hover:text-[#d7f1ff] hover:bg-[rgba(79,210,255,0.07)] whitespace-nowrap"
          title="Click to hear AI Voice output"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
          <span>Voice</span>
        </button>
      )}

      <button
        onClick={onToggleMenu}
        aria-expanded={menuOpen}
        aria-label="Main menu"
        className={`cursor-pointer font-mono text-[14px] leading-none rounded-lg px-3 py-2 transition-all duration-200 border whitespace-nowrap ${
          menuOpen
            ? 'text-[#0a1620] bg-[var(--cyan,#4fd2ff)] border-[var(--cyan,#4fd2ff)] font-semibold shadow-[0_0_18px_-4px_rgba(79,210,255,0.75)]'
            : 'text-[#7fa8c2] border-transparent hover:text-[#d7f1ff] hover:bg-[rgba(79,210,255,0.07)]'
        }`}
      >
        ☰
      </button>

      <button
        onClick={onToggleMic}
        aria-pressed={isListening}
        aria-label="Live Voice Conversation"
        className={`cursor-pointer font-mono text-[11px] tracking-[0.12em] uppercase rounded-lg px-4 py-2 transition-all duration-200 border whitespace-nowrap ${
          isListening
            ? 'text-[#041a12] bg-[#00f5a0] border-[#00f5a0] font-extrabold shadow-[0_0_20px_-2px_rgba(0,245,160,0.85)] animate-pulse'
            : 'text-[#eaf9ff] bg-[rgba(79,210,255,0.16)] border-[rgba(79,210,255,0.45)] hover:bg-[rgba(79,210,255,0.28)] font-semibold'
        }`}
      >
        {isListening ? '🔴 LIVE ON' : '🎙️ LIVE VOICE'}
      </button>
    </div>
  );
};
