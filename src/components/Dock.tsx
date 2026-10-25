import React from 'react';
import { AssistantStage } from './SiriAssistantSheet';

interface DockProps {
  poweredOn: boolean;
  menuOpen: boolean;
  isListening: boolean;
  chatOpen?: boolean;
  unreadCount?: number;
  callActive?: boolean;
  liveStage?: AssistantStage;
  micLevel?: number;
  gestureActive?: boolean;
  assistantOpen?: boolean;
  autoTrading?: boolean;
  onTogglePower: () => void;
  onToggleChat?: () => void;
  onToggleGesture?: () => void;
  onToggleMenu: () => void;
  onToggleMic: () => void;
  onOpenTrading?: () => void;
  onOpenSocialStudio?: () => void;
  onOpenCore?: () => void;
  coreOpen?: boolean;
}

const PowerIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.3"
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
  chatOpen = false,
  liveStage = 'standby',
  micLevel = 0,
  gestureActive = false,
  autoTrading = false,
  onTogglePower,
  onToggleChat,
  onToggleGesture,
  onToggleMenu,
  onToggleMic,
  onOpenTrading,
  onOpenSocialStudio,
  onOpenCore,
  coreOpen = false,
}) => {
  if (!poweredOn) {
    return (
      <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(28px+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2.5">
        <span className="font-mono text-[10px] tracking-[0.28em] uppercase text-[#566b7a] select-none">
          APEX · FULL OFF
        </span>
        <button
          onClick={onTogglePower}
          data-testid="power-button"
          aria-pressed={false}
          aria-label="Turn APEX ON"
          className="cursor-pointer flex items-center gap-2.5 font-sans text-xs font-semibold tracking-[0.16em] uppercase rounded-full px-6 py-3 transition-all duration-200 bg-[#0d141c] text-[#ff758f] border border-[rgba(255,117,143,0.4)] shadow-[0_0_28px_-8px_rgba(255,90,120,0.45)] hover:text-white hover:border-[#ff758f]"
        >
          <PowerIcon />
          <span>Power On</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(12px+env(safe-area-inset-bottom))] z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#070e18]/95 border border-white/14 shadow-[0_14px_38px_rgba(0,0,0,0.92)] max-w-[97vw]">
      {/* 1. Single Master Power ON / OFF */}
      <button
        onClick={onTogglePower}
        data-testid="power-button"
        aria-pressed={true}
        title="Full Power ON / OFF"
        className="cursor-pointer w-9 h-9 rounded-full flex items-center justify-center text-[#041a12] bg-[#2ef2a4] shadow-[0_0_14px_rgba(46,242,164,0.5)] hover:scale-105 active:scale-95 transition-all shrink-0"
      >
        <PowerIcon />
      </button>

      {/* 2. Live Voice Button with Visible Moving Sound Level Bar */}
      <button
        onClick={onToggleMic}
        aria-label="Live Voice Conversation"
        className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border shrink-0 ${
          isListening
            ? 'bg-[#00f5a0]/25 text-[#00f5a0] border-[#00f5a0] shadow-[0_0_14px_rgba(0,245,160,0.4)]'
            : liveStage === 'speaking'
            ? 'bg-[#ffd166]/22 text-[#ffd166] border-[#ffd166]'
            : liveStage === 'thinking'
            ? 'bg-sky-500/25 text-sky-300 border-sky-400'
            : 'bg-white/[0.08] hover:bg-white/[0.15] text-white border-white/20'
        }`}
      >
        <span>{isListening ? '🎙️' : liveStage === 'speaking' ? '🔊' : liveStage === 'thinking' ? '⚡' : '🎤'}</span>
        <span>
          {isListening
            ? 'Sun raha hai…'
            : liveStage === 'speaking'
            ? 'Bol raha hai…'
            : liveStage === 'thinking'
            ? 'Jawab…'
            : 'Boliye'}
        </span>
        {isListening && (
          <span className="inline-flex items-end gap-[2px] h-3.5 ml-0.5">
            {[0.45, 1, 0.7].map((mult, idx) => (
              <span
                key={idx}
                className="w-[2.5px] rounded-full bg-[#00f5a0] transition-all duration-75"
                style={{ height: `${Math.max(4, Math.min(14, 4 + micLevel * 14 * mult))}px` }}
              />
            ))}
          </span>
        )}
      </button>

      {/* 3. Live Online AI Agent Chat Toggle Button (Shows Full Conversation History + Type & Speak!) */}
      {onToggleChat && (
        <button
          onClick={onToggleChat}
          aria-label="Open Online Live AI Chat"
          title="Online AI Chat History & Live Text/Voice Chat"
          className={`cursor-pointer px-2.5 h-9 rounded-full text-xs font-bold flex items-center gap-1 transition-all border shrink-0 ${
            chatOpen
              ? 'bg-[#38bdf8] text-[#04121c] border-[#38bdf8] shadow-[0_0_14px_rgba(56,189,248,0.5)]'
              : 'bg-sky-500/15 hover:bg-sky-500/25 border-sky-400/45 text-sky-200'
          }`}
        >
          <span>💬</span>
          <span className="hidden xs:inline sm:inline">Chat</span>
        </button>
      )}

      {/* 4. 1-Tap 3D Hand Gesture Toggle */}
      {onToggleGesture && (
        <button
          onClick={onToggleGesture}
          aria-label="Toggle 3D Hand Gesture"
          title="3D Hand Gesture ON / OFF"
          className={`cursor-pointer w-9 h-9 rounded-full text-sm flex items-center justify-center transition-all border shrink-0 ${
            gestureActive
              ? 'bg-[#00f5d4]/22 border-[#00f5d4] text-[#00f5d4] shadow-[0_0_12px_rgba(0,245,212,0.4)]'
              : 'bg-white/[0.04] hover:bg-white/10 border-white/10 text-white/70'
          }`}
        >
          🖐
        </button>
      )}

      {/* 5. 1-Tap Real CoinDCX Trading Bot */}
      {onOpenTrading && (
        <button
          onClick={onOpenTrading}
          aria-label="Open Real Trading Bot"
          title="Real CoinDCX Trading Bot & Target Scanner"
          className={`cursor-pointer w-9 h-9 rounded-full text-sm flex items-center justify-center transition-all border shrink-0 ${
            autoTrading
              ? 'bg-[rgba(0,245,160,0.18)] border-[#00f5a0] text-[#00f5a0]'
              : 'bg-white/[0.04] hover:bg-white/10 border-white/10 text-white/80'
          }`}
        >
          📈
        </button>
      )}

      {/* 5b. 🛰️ 1-Tap APEX CORE — Jarvis build/self-check, 📁 ALL VIDEOS, 🎬 Motion
          Forge, 🏢 Company Mode, 🪣 R2, ⚡ Smooth mode (v6.6.10: pehle ye panel
          4 tap door tha, isliye user ko naye features dikhte hi nahi the) */}
      {onOpenCore && (
        <button
          onClick={onOpenCore}
          aria-label="APEX Core panel"
          title="🛰️ APEX Core — videos, Motion Forge, self-check, smooth mode"
          className={`cursor-pointer w-9 h-9 rounded-full text-sm flex items-center justify-center transition-all border shrink-0 ${
            coreOpen ? 'bg-[rgba(34,211,238,0.22)] border-[#22d3ee] text-[#22d3ee]' : 'bg-white/[0.04] hover:bg-white/10 border-white/10 text-white/85'
          }`}
        >
          🛰️
        </button>
      )}

      {/* 6. 1-Tap 41-Agent Social Team & OpenMontage Video Studio */}
      {onOpenSocialStudio && (
        <button
          onClick={onOpenSocialStudio}
          aria-label="Open 41-Agent AI Social Studio"
          title="41-Agent AI Social Team & OpenMontage Video Studio"
          className="cursor-pointer w-9 h-9 rounded-full text-sm flex items-center justify-center transition-all border shrink-0 bg-[#00f5a0]/14 hover:bg-[#00f5a0]/25 border-[#00f5a0]/45 text-white"
        >
          🤖
        </button>
      )}

      {/* 7. Settings & More Options */}
      <button
        onClick={onToggleMenu}
        aria-label="More Options"
        className={`cursor-pointer w-9 h-9 rounded-full text-sm font-bold flex items-center justify-center transition-all border shrink-0 ${
          menuOpen
            ? 'text-[#04121c] bg-[#4fd2ff] border-[#4fd2ff]'
            : 'text-white/65 bg-white/[0.04] hover:text-white hover:bg-white/10 border-white/10'
        }`}
      >
        ☰
      </button>
    </div>
  );
};
