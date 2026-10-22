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

export const Dock: React.FC<DockProps> = ({
  poweredOn,
  menuOpen,
  isListening,
  onTogglePower,
  onToggleMenu,
  onToggleMic,
  onTestVoice,
}) => {
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(26px+env(safe-area-inset-bottom))] z-20 flex gap-2 items-center justify-center p-2 rounded-xl bg-[rgba(6,14,21,0.65)] border border-[rgba(79,210,255,0.18)] backdrop-blur-md shadow-[0_14px_40px_-18px_rgba(0,0,0,0.9)]">
      <button
        onClick={onTogglePower}
        aria-pressed={poweredOn}
        aria-label="Power switch"
        className={`cursor-pointer font-mono text-[11px] tracking-[0.14em] uppercase rounded-lg px-3.5 py-2 transition-all duration-200 border whitespace-nowrap ${
          poweredOn
            ? 'text-[#0a1620] bg-[var(--cyan,#4fd2ff)] border-[var(--cyan,#4fd2ff)] font-semibold shadow-[0_0_18px_-4px_rgba(79,210,255,0.75)]'
            : 'text-[#7fa8c2] border-transparent hover:text-[#d7f1ff] hover:bg-[rgba(79,210,255,0.07)]'
        }`}
      >
        {poweredOn ? '● ON' : '○ OFF'}
      </button>

      {onTestVoice && (
        <button
          onClick={onTestVoice}
          aria-label="Test AI voice"
          className="cursor-pointer font-mono text-[11px] tracking-[0.14em] uppercase rounded-lg px-3 py-2 transition-all duration-200 border text-[#7fa8c2] border-transparent hover:text-[#d7f1ff] hover:bg-[rgba(79,210,255,0.07)] whitespace-nowrap"
          title="Click to hear AI Voice output"
        >
          🔊 Voice
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
        aria-label="Voice microphone"
        className={`cursor-pointer font-mono text-[11px] tracking-[0.14em] uppercase rounded-lg px-4 py-2 transition-all duration-200 border whitespace-nowrap ${
          isListening
            ? 'text-[#0a1620] bg-[var(--cyan,#4fd2ff)] border-[var(--cyan,#4fd2ff)] font-semibold shadow-[0_0_18px_-4px_rgba(79,210,255,0.75)] animate-pulse'
            : 'text-[#7fa8c2] border-transparent hover:text-[#d7f1ff] hover:bg-[rgba(79,210,255,0.07)]'
        }`}
      >
        ● {isListening ? 'listening…' : 'mic'}
      </button>
    </div>
  );
};
