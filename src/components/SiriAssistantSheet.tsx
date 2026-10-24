import React, { useEffect, useRef, useState } from 'react';
import {
  loadGeminiLiveKey,
  saveGeminiLiveKey,
  testAndConfigureGeminiApiKey,
} from '../engine/geminiLive';

export type AssistantStage = 'closed' | 'listening' | 'thinking' | 'speaking' | 'standby';

export interface PendingVoiceConfirmation {
  label: string;
  detail: string;
  onConfirm: () => void;
}

export interface LiveChatBubble {
  id: string;
  role: 'user' | 'bot';
  text: string;
  time: string;
}

interface SiriAssistantSheetProps {
  stage: AssistantStage;
  micLevel: number;
  liveTranscript: string;
  userText: string;
  botText: string;
  chatHistory?: LiveChatBubble[];
  showPanel?: boolean;
  onOpenChatPanel?: () => void;
  onSpeakMessage?: (text: string) => void;
  onClearHistory?: () => void;
  geminiLiveActive?: boolean;
  confirmedBadge?: string | null;
  pendingConfirm?: PendingVoiceConfirmation | null;
  onConfirmAction?: () => void;
  onCancelAction?: () => void;
  onGeminiKeySaved?: (key: string) => void;
  onOpenUltronShield?: () => void;
  onMaxSpeakerBoost?: () => void;
  isShareSafeGuest?: boolean;
  onToggleOwnerVault?: () => void;
  autoFollowUp: boolean;
  onToggleAutoFollowUp: () => void;
  onOrbTap: () => void;
  onSendManual: (text: string) => void;
  onClose: () => void;
}

export const SiriOrbGraphic: React.FC<{
  active?: boolean;
  stage?: AssistantStage;
  level?: number;
  size?: 'dock' | 'sheet';
}> = ({ active = false, stage = 'standby', level = 0, size = 'dock' }) => {
  const dim = size === 'dock' ? 'w-8 h-8' : 'w-12 h-12';
  const dynScale =
    stage === 'listening'
      ? 1 + Math.min(0.28, level * 0.42)
      : stage === 'speaking'
      ? 1.1
      : 1;

  return (
    <div
      className={`relative ${dim} rounded-full flex items-center justify-center select-none transition-transform duration-100`}
      style={{ transform: `scale(${dynScale})` }}
    >
      <span
        className={`absolute inset-0 rounded-full blur-[5px] opacity-90 ${
          active || stage === 'listening' || stage === 'speaking' || stage === 'thinking'
            ? 'animate-spin'
            : ''
        }`}
        style={{
          animationDuration: stage === 'thinking' ? '1.2s' : '3.2s',
          background:
            'conic-gradient(from 0deg, #00f5d4, #4fd2ff, #7b5cff, #ff4fd8, #ff9a3c, #00f5d4)',
        }}
      />
      <span
        className="relative w-[84%] h-[84%] rounded-full flex items-center justify-center overflow-hidden shadow-inner border border-white/30"
        style={{
          background:
            'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.92) 0%, rgba(79,210,255,0.85) 26%, rgba(123,92,255,0.85) 58%, rgba(20,14,46,0.96) 100%)',
        }}
      >
        <span
          className={`w-[72%] h-[42%] rounded-full blur-[3px] ${
            stage === 'speaking' || stage === 'listening' ? 'animate-pulse' : ''
          }`}
          style={{
            background:
              stage === 'thinking'
                ? 'linear-gradient(90deg, #ffd166, #ff5d8f, #7b5cff)'
                : 'linear-gradient(90deg, #00f5d4, #ffffff, #ff4fd8)',
          }}
        />
      </span>
    </div>
  );
};

export const SiriAssistantSheet: React.FC<SiriAssistantSheetProps> = ({
  stage,
  micLevel,
  liveTranscript,
  userText,
  botText,
  chatHistory = [],
  showPanel = false,
  onOpenChatPanel,
  onSpeakMessage,
  onClearHistory,
  geminiLiveActive = false,
  confirmedBadge,
  pendingConfirm,
  onConfirmAction,
  onCancelAction,
  onGeminiKeySaved,
  onOpenUltronShield,
  onMaxSpeakerBoost,
  isShareSafeGuest = true,
  onToggleOwnerVault,
  autoFollowUp,
  onToggleAutoFollowUp,
  onOrbTap,
  onSendManual,
  onClose,
}) => {
  const [showLiveKeyBox, setShowLiveKeyBox] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState<string>(() => loadGeminiLiveKey());
  const [testingKey, setTestingKey] = useState(false);
  const [keyTestStatus, setKeyTestStatus] = useState<string | null>(() => {
    const saved = loadGeminiLiveKey();
    const m = localStorage.getItem('apex.gemini_best_model');
    return saved ? `✅ Active Gemini Key Saved${m ? ` (${m})` : ''}` : null;
  });
  const [typedText, setTypedText] = useState('');
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showPanel) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory.length, showPanel, liveTranscript, botText]);

  const displayUser = liveTranscript || userText;

  const handleSaveAndTestKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = geminiKeyInput.trim();
    if (!trimmed) {
      saveGeminiLiveKey('');
      setKeyTestStatus('ℹ️ Gemini Key hata diya gaya — Free Cloud AI Active!');
      onGeminiKeySaved?.('');
      return;
    }
    setTestingKey(true);
    setKeyTestStatus('🔄 Google Server par aapka Gemini API Key LIVE Retest ho raha hai…');
    const res = await testAndConfigureGeminiApiKey(trimmed);
    setTestingKey(false);
    setKeyTestStatus(res.message);
    if (res.ok) {
      onGeminiKeySaved?.(trimmed);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-[calc(70px+env(safe-area-inset-bottom))] z-30 pointer-events-none flex flex-col items-center justify-end px-2.5">
      <div className="relative pointer-events-auto w-full max-w-[460px] rounded-2xl bg-[rgba(6,13,24,0.92)] border border-white/15 shadow-[0_14px_45px_rgba(0,0,0,0.92)] px-3 py-2.5 space-y-2 backdrop-blur-md">
        {/* Top Live Status Bar — Crystal-clear Hinglish Mic + Speaker Boost + Chat Toggle */}
        <div className="flex items-center justify-between gap-1.5 text-[11px]">
          <button
            onClick={onOrbTap}
            className="cursor-pointer flex items-center gap-2 font-bold text-left min-w-0"
          >
            <span
              className={`shrink-0 inline-block w-2.5 h-2.5 rounded-full ${
                stage === 'listening'
                  ? 'bg-[#00f5a0] animate-ping'
                  : stage === 'speaking'
                  ? 'bg-[#ffd166] animate-pulse'
                  : stage === 'thinking'
                  ? 'bg-[#38bdf8] animate-spin'
                  : 'bg-slate-400'
              }`}
            />
            <span className="text-white truncate">
              {stage === 'listening'
                ? '🟢 Google Clear Mic ON — Abhi Boliye…'
                : stage === 'thinking'
                ? '⚡ Autonomous AI Research / Thinking…'
                : stage === 'speaking'
                ? '🔊 MAX Studio Speaker Bol Raha Hai…'
                : '🎤 Tap Bolne ke liye · MYRAA + ULTRON Ready'}
            </span>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            {onMaxSpeakerBoost && (
              <button
                onClick={onMaxSpeakerBoost}
                className="cursor-pointer px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-200 font-bold text-[10px]"
                title="Force 100% Max Hardware Speaker Volume"
              >
                🔊 MAX
              </button>
            )}
            {onOpenUltronShield && (
              <button
                onClick={onOpenUltronShield}
                className="cursor-pointer px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/60 text-amber-200 font-bold text-[10px]"
                title="Open Head Bot Trading Commander"
              >
                👑 Head Bot
              </button>
            )}
            {!showPanel ? (
              <button
                onClick={onOpenChatPanel}
                className="cursor-pointer px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/50 text-sky-200 font-bold text-[10.5px]"
              >
                💬 Chat ({chatHistory.length})
              </button>
            ) : (
              <button
                onClick={onClose}
                className="cursor-pointer px-2 py-0.5 rounded-full bg-white/10 text-slate-200 font-bold text-[10.5px]"
              >
                ▾
              </button>
            )}
          </div>
        </div>

        {/* Live Voice Level Bar when Listening */}
        {stage === 'listening' && (
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00f5a0] via-[#38bdf8] to-[#00f5d4] transition-all duration-75"
              style={{ width: `${Math.max(15, Math.min(100, Math.round(micLevel * 130)))}%` }}
            />
          </div>
        )}

        {/* Confirmed Action Pill */}
        {confirmedBadge && (
          <div className="px-2.5 py-1 rounded-xl bg-[rgba(46,242,164,0.14)] border border-[rgba(46,242,164,0.4)] text-[11px] font-medium text-[#7efce8]">
            {confirmedBadge}
          </div>
        )}

        {/* Interactive Voice + Tap Confirmation Card */}
        {pendingConfirm && (
          <div className="rounded-xl bg-[rgba(255,209,102,0.12)] border border-[rgba(255,209,102,0.42)] p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#ffd166]">
                ⚡ Confirm Karein
              </span>
              <span className="text-[10px] text-[#ffe8a3]">Boliye &ldquo;Haan&rdquo; ya Tap karein</span>
            </div>
            <div className="text-xs font-semibold text-white">{pendingConfirm.label}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={onConfirmAction}
                className="cursor-pointer flex-1 py-1.5 rounded-full bg-[#2ef2a4] text-[#041a12] font-bold text-xs"
              >
                ✓ Haan, Confirm
              </button>
              <button
                onClick={onCancelAction}
                className="cursor-pointer px-3.5 py-1.5 rounded-full bg-white/10 text-[#ffd6de] font-semibold text-xs border border-white/15"
              >
                ✕ Cancel
              </button>
            </div>
          </div>
        )}

        {/* COMPACT MODE: Shows Latest Live Question + AI Reply Right on HUD! */}
        {!showPanel && (displayUser || botText) && (
          <div
            onClick={onOpenChatPanel}
            className="cursor-pointer rounded-xl bg-slate-900/80 border border-white/10 p-2 space-y-1 max-h-[20vh] overflow-y-auto"
          >
            {displayUser && (
              <div className="text-xs text-emerald-300 font-semibold leading-snug">
                🧑 You: “{displayUser}”
              </div>
            )}
            {botText && (
              <div className="flex items-start justify-between gap-2 text-[13px] text-white font-medium leading-snug">
                <span>🤖 {botText}</span>
                {onSpeakMessage && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSpeakMessage(botText);
                    }}
                    className="shrink-0 px-2 py-0.5 rounded-lg bg-white/10 text-[11px] text-amber-300"
                    title="Replay Voice"
                  >
                    🔊
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* EXPANDED FULL ONLINE LIVE AI CHAT WINDOW (Gemini Retest + Share-Safe Shield + MYRAA Auto-Research!) */}
        {showPanel && (
          <div className="pt-1.5 border-t border-white/12 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
              <button
                onClick={onToggleAutoFollowUp}
                className={`cursor-pointer px-2.5 py-1 rounded-full font-bold border ${
                  autoFollowUp
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                    : 'bg-white/5 text-slate-400 border-white/10'
                }`}
              >
                {autoFollowUp ? '🔄 Auto Baat: ON' : '🔄 Auto Baat: OFF'}
              </button>

              <div className="flex items-center gap-1">
                {onToggleOwnerVault && (
                  <button
                    onClick={onToggleOwnerVault}
                    className={`cursor-pointer px-2 py-1 rounded-full font-bold border ${
                      isShareSafeGuest
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
                        : 'bg-purple-500/25 text-purple-200 border-purple-400/50'
                    }`}
                    title="Share-Safe Privacy Mode protects all personal accounts when sharing APK!"
                  >
                    {isShareSafeGuest ? '🛡️ Share-Safe ON' : '👑 Owner Unlocked'}
                  </button>
                )}
                <button
                  onClick={() => setShowLiveKeyBox((v) => !v)}
                  className={`cursor-pointer px-2.5 py-1 rounded-full font-bold border ${
                    geminiLiveActive || loadGeminiLiveKey()
                      ? 'bg-[rgba(255,209,102,0.22)] text-[#ffd166] border-[rgba(255,209,102,0.55)]'
                      : 'bg-sky-500/15 text-sky-200 border-sky-400/40'
                  }`}
                >
                  🧪 Gemini API Key
                </button>
                {chatHistory.length > 0 && onClearHistory && (
                  <button
                    onClick={onClearHistory}
                    className="cursor-pointer px-2 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-400/30"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {showLiveKeyBox && (
              <form
                onSubmit={handleSaveAndTestKey}
                className="rounded-xl bg-slate-900/95 border border-amber-400/35 p-2.5 space-y-2"
              >
                <div className="flex items-center justify-between text-[10.5px] text-[#ffe9b3]">
                  <span>🔑 Google Gemini API Key (Private Local Storage Only!)</span>
                  <span className="font-mono text-[9.5px] text-sky-300">aistudio.google.com/apikey</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    placeholder="Paste AIzaSy... Gemini API Key here"
                    className="flex-1 bg-black/60 border border-white/20 rounded-full px-3 py-1.5 text-xs text-white font-mono"
                  />
                  <button
                    type="submit"
                    disabled={testingKey}
                    className="cursor-pointer px-3.5 py-1.5 rounded-full bg-[#ffd166] text-[#1a1200] text-xs font-black shrink-0"
                  >
                    {testingKey ? 'Testing…' : '🧪 Retest & Save'}
                  </button>
                </div>
                {keyTestStatus && (
                  <div
                    className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg ${
                      keyTestStatus.startsWith('✅')
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
                        : keyTestStatus.startsWith('❌')
                        ? 'bg-rose-500/20 text-rose-200 border border-rose-400/40'
                        : 'bg-sky-500/15 text-sky-200'
                    }`}
                  >
                    {keyTestStatus}
                  </div>
                )}
              </form>
            )}

            {/* Full Online Chat Messages Thread */}
            <div className="max-h-[32vh] overflow-y-auto space-y-2 pr-1 py-1">
              {chatHistory.length === 0 ? (
                <div className="text-center text-xs text-slate-300 py-2.5 space-y-1">
                  <div>
                    👋 <b>APEX AI v6.0 ULTRA (MYRAA + ULTRON + Auto-Research)</b> Ready!
                  </div>
                  <div className="text-[11px] text-emerald-300">
                    🛡️ <b>100% Share-Safe Mode:</b> Aapka koi personal data ya CoinDCX account share nahi hota!
                  </div>
                </div>
              ) : (
                chatHistory.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[87%] rounded-2xl px-3 py-2 text-xs leading-snug ${
                        m.role === 'user'
                          ? 'bg-emerald-500/25 border border-emerald-400/45 text-emerald-100 rounded-br-sm'
                          : 'bg-slate-800/95 border border-sky-400/30 text-white rounded-bl-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5 text-[9.5px] opacity-70">
                        <span className="font-bold">{m.role === 'user' ? '🧑 You' : '🤖 APEX AI'}</span>
                        <span>{m.time}</span>
                      </div>
                      <div className="whitespace-pre-wrap">{m.text}</div>
                      {m.role === 'bot' && onSpeakMessage && (
                        <button
                          type="button"
                          onClick={() => onSpeakMessage(m.text)}
                          className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-300 font-bold hover:underline cursor-pointer"
                        >
                          🔊 Loud Speaker Replay
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}

              {liveTranscript && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl px-3 py-1.5 text-xs bg-emerald-500/15 border border-dashed border-emerald-400 text-emerald-200 italic">
                    🎙️ Live Hearing: “{liveTranscript}”
                  </div>
                </div>
              )}
              <div ref={scrollEndRef} />
            </div>

            {/* MYRAA × ULTRON Autonomous Power Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[10.5px]">
              {[
                '👑 Head Bot: Futures aur Spot dono dekh kar jisme accha ho khud buy sell karo',
                '⚡ Futures 5x mode me trade chalu karo',
                '💰 Mera real position aur profit batao',
                '🧠 Auto research karo: Best Crypto & AI Trends',
                '🎵 Play Jailer 2 song',
                'OpenMontage mein Future AI par video bana ke save karo',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onSendManual(chip)}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-white/8 hover:bg-white/15 border border-white/12 text-sky-200 cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Online Chat Input Box + Clear Mic Button + Send Button */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const clean = typedText.trim();
                if (!clean) return;
                setTypedText('');
                onSendManual(clean);
              }}
              className="flex items-center gap-1.5"
            >
              <button
                type="button"
                onClick={onOrbTap}
                className={`cursor-pointer w-9 h-9 rounded-full flex items-center justify-center border shrink-0 ${
                  stage === 'listening'
                    ? 'bg-[#00f5a0] text-[#041a12] border-[#00f5a0]'
                    : 'bg-white/10 text-white border-white/20'
                }`}
                title="Speak via Native Clear Mic"
              >
                🎙️
              </button>
              <input
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder="Koi bhi kaam do ('Auto research...', 'Play song...')…"
                className="flex-1 bg-white/10 border border-white/20 rounded-full px-3.5 py-2 text-xs text-white placeholder-[#93b3cb] focus:outline-none focus:border-[#38bdf8]"
              />
              <button
                type="submit"
                className="cursor-pointer px-4 py-2 rounded-full text-xs font-black bg-[#38bdf8] text-[#04121c]"
              >
                Send ➤
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
