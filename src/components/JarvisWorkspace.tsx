import React, { useState, useEffect, useRef } from 'react';
import { executePhoneAction } from '../engine/phoneBridge';
import { DayTraderSkillsPanel } from './DayTraderSkillsPanel';
import {
  ELEVEN_VOICE_PRESETS,
  ElevenLabsConfig,
  cleanElevenKey,
  loadElevenConfig,
  saveElevenConfig,
  testAndVerifyElevenKey,
} from '../engine/elevenlabs';
import { audio } from '../engine/audio';

export interface JarvisTaskItem {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
}

export interface JarvisMemoryItem {
  id: string;
  text: string;
  savedAt: string;
}

interface JarvisWorkspaceProps {
  isOpen: boolean;
  hologramOverlayMode?: boolean;
  onToggleHologramMode?: () => void;
  onCloseTo3D?: () => void;
  isListening: boolean;
  autoContinuousMode?: boolean;
  onToggleContinuousMode?: () => void;
  voiceStage: 'idle' | 'listening' | 'thinking' | 'speaking';
  micLevel: number;
  userText: string;
  botText: string;
  quietMode: boolean;
  onToggleQuietMode: () => void;
  onToggleCall: () => void;
  onStopSpeaking?: () => void;
  onSpeakCustomText?: (text: string) => void;
  onFlushSpeechNow?: () => void;
  onSendTextCommand: (text: string) => void;
  tasks: JarvisTaskItem[];
  onAddTask: (title: string) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  memories: JarvisMemoryItem[];
  onAddMemory: (fact: string) => void;
  onDeleteMemory: (id: string) => void;
  onOpenTradingBot: () => void;
  realInrBalance?: number;
  orderBusy?: boolean;
  onApproveSetup?: (symbol: string) => void | Promise<void>;
  onOpenYouTubeStudio: () => void;
  onOpenElevenLabs?: () => void;
  onPowerOff: () => void;
}

export const JarvisWorkspace: React.FC<JarvisWorkspaceProps> = ({
  isOpen,
  hologramOverlayMode = false,
  onToggleHologramMode,
  isListening,
  autoContinuousMode = false,
  onToggleContinuousMode,
  voiceStage,
  micLevel,
  userText,
  botText,
  quietMode,
  onToggleQuietMode,
  onToggleCall,
  onStopSpeaking,
  onSpeakCustomText,
  onFlushSpeechNow,
  onSendTextCommand,
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  memories,
  onAddMemory,
  onDeleteMemory,
  onOpenTradingBot,
  realInrBalance = 0,
  orderBusy = false,
  onApproveSetup,
  onOpenYouTubeStudio,
  onPowerOff,
}) => {
  const [activeTab, setActiveTab] = useState<'core' | 'trader' | 'voice' | 'control'>('core');
  const [cmdInput, setCmdInput] = useState('');
  const [newTask, setNewTask] = useState('');
  const [newMem, setNewMem] = useState('');

  // Dedicated Speech-to-Text (STT) & Text-to-Speech (TTS) Studio states
  const [ttsText, setTtsText] = useState(
    'Good evening Sir. All J.A.R.V.I.S. voice, phone control, and trading systems are online.'
  );
  const [sttLiveTranscript, setSttLiveTranscript] = useState('');
  const [sttDictating, setSttDictating] = useState(false);
  const sttRecRef = useRef<any>(null);

  // Embedded ElevenLabs HD Voice state
  const initEl = loadElevenConfig();
  const [elKey, setElKey] = useState(initEl.apiKey);
  const [elVoiceId, setElVoiceId] = useState(initEl.voiceId);
  const [elModel, setElModel] = useState<'eleven_flash_v2_5' | 'eleven_multilingual_v2'>(initEl.modelId);
  const [elStatus, setElStatus] = useState(
    initEl.apiKey ? 'ElevenLabs Studio HD Active' : 'Cloud Neural Hindi/English HD Active (Free · Zero Key)'
  );
  const [elBusy, setElBusy] = useState(false);

  useEffect(() => {
    return () => {
      try {
        sttRecRef.current?.stop();
      } catch {}
    };
  }, []);

  if (!isOpen) return null;

  // Toggle standalone live Speech-to-Text dictation (fills input box OR STT pad in real time!)
  const toggleSttDictation = (intoCommandBar = false) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (sttDictating) {
      try {
        sttRecRef.current?.stop();
      } catch {}
      setSttDictating(false);
      return;
    }
    if (!SR) {
      // Fallback: trigger main PCM + Whisper voice turn directly
      onToggleCall();
      return;
    }
    try {
      const rec = new SR();
      rec.lang = 'hi-IN';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onstart = () => setSttDictating(true);
      rec.onresult = (ev: any) => {
        let full = '';
        for (let i = 0; i < ev.results.length; i++) {
          full += ev.results[i][0].transcript + ' ';
        }
        const clean = full.trim();
        if (intoCommandBar) {
          setCmdInput(clean);
        } else {
          setSttLiveTranscript(clean);
        }
      };
      rec.onerror = () => setSttDictating(false);
      rec.onend = () => setSttDictating(false);
      sttRecRef.current = rec;
      rec.start();
    } catch {
      onToggleCall();
    }
  };

  const handleSaveElevenLabs = async () => {
    setElBusy(true);
    audio.ensureCtx();
    const cleaned = cleanElevenKey(elKey);
    const cfg: ElevenLabsConfig = {
      apiKey: cleaned,
      voiceId: elVoiceId.trim() || 'JBFqnCBsd6RMkjVDRZzb',
      modelId: elModel,
      stability: 0.42,
      similarityBoost: 0.78,
    };
    saveElevenConfig(cfg);
    if (!cleaned) {
      setElStatus('Cloud Neural Hindi/English HD Active (Free Mode)');
      setElBusy(false);
      return;
    }
    const res = await testAndVerifyElevenKey(cleaned, cfg.voiceId);
    setElStatus(res.message);
    if (res.ok && res.audio) {
      await audio.playVoiceArrayBuffer(res.audio);
    }
    setElBusy(false);
  };

  const statusText =
    voiceStage === 'speaking'
      ? 'SPEAKING'
      : voiceStage === 'thinking'
      ? 'PROCESSING'
      : isListening
      ? 'LISTENING'
      : 'STANDING BY';

  const statusDot =
    voiceStage === 'speaking'
      ? 'bg-[#38bdf8] shadow-[0_0_10px_#38bdf8]'
      : voiceStage === 'thinking'
      ? 'bg-[#f59e0b] shadow-[0_0_10px_#f59e0b]'
      : isListening
      ? 'bg-[#10b981] shadow-[0_0_10px_#10b981]'
      : 'bg-[#94a3b8]';

  const orbScale =
    voiceStage === 'speaking'
      ? 1.07
      : isListening
      ? 1 + Math.min(0.14, micLevel * 0.2)
      : 1;

  return (
    <div
      className={`fixed inset-0 z-40 flex flex-col font-sans select-none overflow-hidden transition-colors duration-300 ${
        hologramOverlayMode
          ? 'bg-[rgba(4,7,12,0.34)] pointer-events-none'
          : 'bg-[#04060a] text-[#e2e8f0]'
      }`}
    >
      {/* ==================== TOP EXECUTIVE PRECISION HEADER ==================== */}
      <header className="pointer-events-auto h-14 px-4 flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] bg-[rgba(5,8,13,0.88)] backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[#38bdf8] shadow-[0_0_12px_#38bdf8]" />
          <div className="flex flex-col">
            <span className="text-[12px] font-bold tracking-[0.26em] text-white leading-none">
              J.A.R.V.I.S.
            </span>
            <span className="text-[9px] font-mono tracking-[0.16em] text-[#64748b] mt-0.5">
              LIVEKIT VOICE OS · v3.0
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Telemetry Pill */}
          <div className="px-2.5 py-1 rounded-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.09)] flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
            <span className="text-[9.5px] font-mono tracking-[0.14em] text-[#cbd5e1]">
              {statusText}
            </span>
          </div>

          {/* Inline 3D Hologram Core Toggle (Unified inside SAME OS!) */}
          {onToggleHologramMode && activeTab === 'core' && (
            <button
              onClick={onToggleHologramMode}
              title="Toggle 3D Hologram / Minimal Eclipse Core"
              className={`px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider border transition-all cursor-pointer ${
                hologramOverlayMode
                  ? 'bg-[rgba(56,189,248,0.2)] border-[#38bdf8] text-[#e0f2fe]'
                  : 'bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.1)] text-[#94a3b8] hover:text-white'
              }`}
            >
              {hologramOverlayMode ? 'ORB' : '3D'}
            </button>
          )}

          {/* Single Master Power OFF Button */}
          <button
            onClick={onPowerOff}
            title="Master System Shutdown"
            className="px-2.5 py-1 rounded-full bg-[rgba(239,68,68,0.12)] hover:bg-[rgba(239,68,68,0.24)] border border-[rgba(239,68,68,0.35)] text-[#fca5a5] text-[10px] font-mono tracking-wider cursor-pointer"
          >
            ⏻ OFF
          </button>
        </div>
      </header>

      {/* ==================== MAIN UNIFIED WORKSPACE BODY ==================== */}
      <main className="flex-1 flex flex-col justify-between overflow-y-auto px-4 pt-3 pb-2">
        {/* ---------- TAB 1: UNIFIED J.A.R.V.I.S. VOICE CORE ---------- */}
        {activeTab === 'core' && (
          <div className="flex-1 flex flex-col items-center justify-between max-w-xl w-full mx-auto py-1">
            {/* Mode Switch Bar: Single-Turn (Zero Self-Talk!) vs LiveKit Auto + Mute Speaker */}
            <div className="pointer-events-auto flex items-center gap-1.5 p-1 rounded-full bg-[rgba(12,17,26,0.9)] border border-[rgba(255,255,255,0.08)]">
              <button
                onClick={() => {
                  if (autoContinuousMode) onToggleContinuousMode?.();
                }}
                className={`px-3 py-1 rounded-full text-[10px] font-mono tracking-wider transition-all cursor-pointer ${
                  !autoContinuousMode
                    ? 'bg-white text-[#04060a] font-bold shadow-sm'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                TAP TO SPEAK
              </button>
              <button
                onClick={() => {
                  if (!autoContinuousMode) onToggleContinuousMode?.();
                }}
                className={`px-3 py-1 rounded-full text-[10px] font-mono tracking-wider transition-all cursor-pointer ${
                  autoContinuousMode
                    ? 'bg-[#38bdf8] text-[#04060a] font-bold shadow-[0_0_12px_rgba(56,189,248,0.4)]'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                LIVEKIT AUTO
              </button>
              <button
                onClick={onToggleQuietMode}
                title="Mute / Unmute TTS Voice Output"
                className={`px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider transition-all cursor-pointer ${
                  quietMode
                    ? 'bg-[rgba(245,158,11,0.2)] text-[#fcd34d]'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                {quietMode ? 'MUTED' : 'TTS ON'}
              </button>
            </div>

            {/* Center Stage: Either Precision Eclipse Reactor Orb OR Transparent Window to Interactive 3D Core */}
            {hologramOverlayMode ? (
              <div className="flex-1 flex items-end justify-center pb-3 pointer-events-none">
                <button
                  onClick={onToggleCall}
                  className={`pointer-events-auto px-6 py-2.5 rounded-full font-mono text-xs tracking-[0.2em] uppercase backdrop-blur-xl border transition-all cursor-pointer ${
                    isListening
                      ? 'bg-[rgba(16,185,129,0.22)] border-[#10b981] text-[#a7f3d0] shadow-[0_0_24px_rgba(16,185,129,0.35)]'
                      : 'bg-[rgba(8,13,22,0.85)] border-[rgba(56,189,248,0.45)] text-white shadow-[0_0_24px_rgba(56,189,248,0.2)]'
                  }`}
                >
                  {isListening ? '● LISTENING — TAP TO SEND' : '◉ SPEAK TO J.A.R.V.I.S.'}
                </button>
              </div>
            ) : (
              <div className="my-auto flex flex-col items-center py-3 pointer-events-auto">
                <div className="relative flex items-center justify-center">
                  {/* Ambient Precision Halo */}
                  <div
                    style={{
                      transform: `scale(${orbScale})`,
                      boxShadow:
                        voiceStage === 'speaking'
                          ? '0 0 85px 16px rgba(56,189,248,0.38), inset 0 0 36px rgba(255,255,255,0.24)'
                          : isListening
                          ? '0 0 75px 14px rgba(16,185,129,0.34), inset 0 0 30px rgba(16,185,129,0.2)'
                          : '0 0 60px 8px rgba(255,255,255,0.09), inset 0 0 22px rgba(56,189,248,0.14)',
                    }}
                    className="w-48 h-48 sm:w-56 sm:h-56 rounded-full transition-all duration-150 flex items-center justify-center border border-[rgba(255,255,255,0.2)] bg-[#060910]"
                  >
                    <button
                      onClick={() => {
                        if (voiceStage === 'speaking' && onStopSpeaking) {
                          onStopSpeaking();
                        } else {
                          onToggleCall();
                        }
                      }}
                      className="w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-gradient-to-b from-[#0b101b] via-[#05070c] to-[#020306] border border-[rgba(255,255,255,0.12)] flex flex-col items-center justify-center gap-2.5 cursor-pointer relative overflow-hidden group"
                    >
                      {/* Live 17-Bar Acoustic Spectrum */}
                      <div className="flex items-center justify-center gap-[3px] h-7">
                        {Array.from({ length: 17 }).map((_, idx) => {
                          const dist = Math.abs(idx - 8) / 8;
                          const energy =
                            voiceStage === 'speaking'
                              ? 0.65
                              : isListening
                              ? Math.max(0.12, micLevel)
                              : 0.08;
                          const h = Math.max(3, Math.round((1 - dist * 0.68) * energy * 28));
                          return (
                            <span
                              key={idx}
                              style={{ height: `${h}px` }}
                              className={`w-[2px] rounded-full transition-all duration-75 ${
                                voiceStage === 'speaking'
                                  ? 'bg-[#38bdf8]'
                                  : isListening
                                  ? 'bg-[#10b981]'
                                  : 'bg-[rgba(255,255,255,0.28)]'
                              }`}
                            />
                          );
                        })}
                      </div>

                      <span className="text-[10px] font-mono tracking-[0.26em] uppercase text-[#cbd5e1] group-hover:text-white">
                        {voiceStage === 'speaking'
                          ? 'TAP TO STOP'
                          : isListening
                          ? 'LISTENING'
                          : 'TAP TO SPEAK'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Live STT & TTS Executive Telemetry Panel */}
            <div className="pointer-events-auto w-full space-y-2.5">
              <div className="p-3.5 rounded-2xl bg-[rgba(10,14,22,0.92)] border border-[rgba(255,255,255,0.08)] backdrop-blur-xl space-y-2">
                {userText ? (
                  <div className="flex items-baseline justify-between gap-2 border-b border-[rgba(255,255,255,0.06)] pb-1.5">
                    <span className="text-[11px] font-mono text-[#64748b] shrink-0">STT · YOU</span>
                    <p className="text-xs text-[#cbd5e1] text-right truncate flex-1">{userText}</p>
                  </div>
                ) : null}

                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 flex-1">
                    <span className="text-[9.5px] font-mono tracking-[0.16em] text-[#38bdf8] block">
                      J.A.R.V.I.S. RESPONSE
                    </span>
                    <p className="text-[13.5px] text-[#f1f5f9] leading-relaxed font-normal">
                      {botText || 'Good evening, Sir. Tap the core or type below — WhatsApp, Alarms, News, Tasks, or 990-Chart Market Intelligence.'}
                    </p>
                  </div>

                  {/* Instant Stop OR Replay TTS Control */}
                  <div className="flex items-center gap-1 shrink-0 pt-1">
                    {voiceStage === 'speaking' && onStopSpeaking ? (
                      <button
                        onClick={onStopSpeaking}
                        className="px-2.5 py-1 rounded-lg bg-[rgba(239,68,68,0.16)] border border-[rgba(239,68,68,0.4)] text-[#fca5a5] text-[10px] font-mono cursor-pointer"
                      >
                        STOP
                      </button>
                    ) : botText && onSpeakCustomText ? (
                      <button
                        onClick={() => onSpeakCustomText(botText)}
                        title="Replay Text-to-Speech"
                        className="px-2.5 py-1 rounded-lg bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] border border-[rgba(255,255,255,0.1)] text-[#cbd5e1] text-[10px] font-mono cursor-pointer"
                      >
                        SPEAK
                      </button>
                    ) : null}

                    {isListening && voiceStage === 'listening' && onFlushSpeechNow && (
                      <button
                        onClick={onFlushSpeechNow}
                        className="px-2.5 py-1 rounded-lg bg-[rgba(16,185,129,0.18)] border border-[rgba(16,185,129,0.4)] text-[#6ee7b7] text-[10px] font-mono cursor-pointer"
                      >
                        SEND
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Unified Command + Live STT Dictation Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = cmdInput.trim();
                  if (!v) return;
                  onSendTextCommand(v);
                  setCmdInput('');
                }}
                className="flex items-center gap-2 bg-[#0a0f18] border border-[rgba(255,255,255,0.11)] rounded-2xl p-1.5"
              >
                <button
                  type="button"
                  onClick={() => toggleSttDictation(true)}
                  title="Live Speech-to-Text Dictation"
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-mono shrink-0 cursor-pointer transition-all ${
                    sttDictating
                      ? 'bg-[#10b981] text-[#04060a] font-bold animate-pulse'
                      : 'bg-[rgba(255,255,255,0.06)] text-[#cbd5e1] hover:bg-[rgba(255,255,255,0.12)]'
                  }`}
                >
                  STT
                </button>
                <input
                  value={cmdInput}
                  onChange={(e) => setCmdInput(e.target.value)}
                  placeholder="Command J.A.R.V.I.S. — Open WhatsApp, 7 AM alarm, news..."
                  className="flex-1 bg-transparent px-2 py-2 text-xs sm:text-sm text-white placeholder-[#64748b] outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-white hover:bg-[#e2e8f0] text-[#04060a] text-xs font-bold tracking-wide cursor-pointer shrink-0"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ---------- TAB 2: DEDICATED STT + TTS + ELEVENLABS VOICE STUDIO ---------- */}
        {activeTab === 'voice' && (
          <div className="pointer-events-auto max-w-xl w-full mx-auto space-y-3 py-1">
            {/* 1. Speech-to-Text (Live STT) Module */}
            <div className="p-4 rounded-2xl bg-[#090d15] border border-[rgba(255,255,255,0.09)] space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold tracking-wider uppercase text-white">
                    Speech-to-Text (Live STT Engine)
                  </div>
                  <div className="text-[11px] text-[#64748b]">
                    Real-time Hindi, Hinglish &amp; English speech transcription
                  </div>
                </div>
                <button
                  onClick={() => toggleSttDictation(false)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    sttDictating
                      ? 'bg-[#ef4444] text-white'
                      : 'bg-[#10b981] text-[#04060a]'
                  }`}
                >
                  {sttDictating ? 'Stop Mic' : 'Start Live STT'}
                </button>
              </div>
              <textarea
                rows={2}
                value={sttLiveTranscript}
                onChange={(e) => setSttLiveTranscript(e.target.value)}
                placeholder="Tap 'Start Live STT' and speak — your words appear live here..."
                className="w-full rounded-xl bg-[#05080d] border border-[rgba(255,255,255,0.08)] p-3 text-xs text-white placeholder-[#475569] outline-none resize-none"
              />
              {sttLiveTranscript && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onSendTextCommand(sttLiveTranscript);
                      setActiveTab('core');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white text-[#04060a] text-[11px] font-bold cursor-pointer"
                  >
                    Ask J.A.R.V.I.S. This →
                  </button>
                  <button
                    onClick={() => setSttLiveTranscript('')}
                    className="px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.06)] text-[#94a3b8] text-[11px] cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* 2. Text-to-Speech (Instant TTS) Synthesizer */}
            <div className="p-4 rounded-2xl bg-[#090d15] border border-[rgba(255,255,255,0.09)] space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold tracking-wider uppercase text-white">
                    Text-to-Speech (Neural &amp; ElevenLabs TTS)
                  </div>
                  <div className="text-[11px] text-[#64748b]">{elStatus}</div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onSpeakCustomText?.(ttsText)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#38bdf8] text-[#04060a] text-xs font-bold cursor-pointer"
                  >
                    Speak Text
                  </button>
                  {voiceStage === 'speaking' && onStopSpeaking && (
                    <button
                      onClick={onStopSpeaking}
                      className="px-3 py-1.5 rounded-xl bg-[rgba(239,68,68,0.2)] text-[#fca5a5] text-xs font-bold cursor-pointer"
                    >
                      Stop
                    </button>
                  )}
                </div>
              </div>
              <textarea
                rows={2}
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value)}
                placeholder="Type any Hindi or English sentence to speak aloud..."
                className="w-full rounded-xl bg-[#05080d] border border-[rgba(255,255,255,0.08)] p-3 text-xs text-white outline-none resize-none"
              />
            </div>

            {/* 3. Integrated ElevenLabs HD Voice Configuration */}
            <div className="p-4 rounded-2xl bg-[#090d15] border border-[rgba(255,255,255,0.09)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider uppercase text-white">
                  ElevenLabs Studio Voice Upgrade
                </span>
                <a
                  href="https://elevenlabs.io/app/settings/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-mono text-[#38bdf8] underline"
                >
                  Get API Key →
                </a>
              </div>

              <input
                type="password"
                value={elKey}
                onChange={(e) => setElKey(e.target.value)}
                placeholder="Paste ElevenLabs API Key (sk_... with Text-to-Speech enabled)"
                className="w-full px-3 py-2.5 rounded-xl bg-[#05080d] border border-[rgba(255,255,255,0.1)] text-xs font-mono text-white outline-none focus:border-[#38bdf8]"
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {ELEVEN_VOICE_PRESETS.slice(0, 8).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setElVoiceId(v.id)}
                    className={`p-2 rounded-xl text-left border cursor-pointer transition-all ${
                      elVoiceId === v.id
                        ? 'bg-[rgba(56,189,248,0.16)] border-[#38bdf8] text-white'
                        : 'bg-[#05080d] border-[rgba(255,255,255,0.07)] text-[#94a3b8]'
                    }`}
                  >
                    <div className="text-[11px] font-bold truncate">{v.name.replace(' (APEX Default)', '')}</div>
                    <div className="text-[9.5px] text-[#64748b]">{v.gender}</div>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setElModel(elModel === 'eleven_flash_v2_5' ? 'eleven_multilingual_v2' : 'eleven_flash_v2_5')}
                  className="px-3 py-2.5 rounded-xl bg-[#05080d] border border-[rgba(255,255,255,0.1)] text-[10.5px] font-mono text-[#cbd5e1] cursor-pointer"
                >
                  {elModel === 'eleven_flash_v2_5' ? 'Model: Flash v2.5 (Fast)' : 'Model: Multilingual v2'}
                </button>
                <button
                  onClick={handleSaveElevenLabs}
                  disabled={elBusy}
                  className="flex-1 py-2.5 rounded-xl bg-white text-[#04060a] text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {elBusy ? 'Verifying...' : 'Save & Test ElevenLabs Voice'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------- TAB 3: UNIFIED PHONE CONTROL, TASKS & MEMORY ---------- */}
        {activeTab === 'control' && (
          <div className="pointer-events-auto max-w-xl w-full mx-auto space-y-3 py-1">
            {/* Clean Sleek Monochrome Device Launcher Grid */}
            <div className="p-4 rounded-2xl bg-[#090d15] border border-[rgba(255,255,255,0.09)] space-y-2.5">
              <div className="text-xs font-bold tracking-wider uppercase text-white">
                Android Device &amp; App Bridge
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { name: 'WhatsApp', sub: 'Messenger', run: () => executePhoneAction('LAUNCH_APP', { app: 'whatsapp' }) },
                  { name: 'Instagram', sub: 'Social', run: () => executePhoneAction('LAUNCH_APP', { app: 'instagram' }) },
                  { name: 'YouTube', sub: 'Video', run: () => executePhoneAction('LAUNCH_APP', { app: 'youtube' }) },
                  { name: '07:00 Alarm', sub: 'System Clock', run: () => executePhoneAction('SET_ALARM', { hour: 7, minute: 0, text: 'JARVIS Alarm' }) },
                  { name: 'Telegram', sub: 'Comms', run: () => executePhoneAction('LAUNCH_APP', { app: 'telegram' }) },
                  { name: 'Google Maps', sub: 'Navigation', run: () => executePhoneAction('LAUNCH_APP', { app: 'maps' }) },
                  { name: 'Spotify', sub: 'Audio', run: () => executePhoneAction('LAUNCH_APP', { app: 'spotify' }) },
                  { name: 'Wi-Fi Settings', sub: 'Android OS', run: () => executePhoneAction('OPEN_SETTINGS', { app: 'wifi' }) },
                ].map((item) => (
                  <button
                    key={item.name}
                    onClick={item.run}
                    className="p-3 rounded-xl bg-[#05080d] hover:bg-[#0e1522] border border-[rgba(255,255,255,0.08)] text-left transition-all cursor-pointer"
                  >
                    <div className="text-xs font-semibold text-white">{item.name}</div>
                    <div className="text-[10px] font-mono text-[#64748b] mt-0.5">{item.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Unified Tasks + Persistent Memory */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#090d15] border border-[rgba(255,255,255,0.09)] space-y-2">
                <div className="text-xs font-bold tracking-wider uppercase text-white">
                  Tasks ({tasks.filter((t) => !t.done).length})
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newTask.trim()) return;
                    onAddTask(newTask.trim());
                    setNewTask('');
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    placeholder="Add task..."
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#05080d] border border-[rgba(255,255,255,0.08)] text-xs text-white outline-none"
                  />
                  <button type="submit" className="px-3 py-1.5 rounded-lg bg-white text-[#04060a] text-xs font-bold cursor-pointer">
                    +
                  </button>
                </form>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {tasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#05080d] text-xs">
                      <span
                        onClick={() => onToggleTask(t.id)}
                        className={`cursor-pointer truncate flex-1 ${t.done ? 'line-through text-[#475569]' : 'text-[#e2e8f0]'}`}
                      >
                        {t.title}
                      </span>
                      <button onClick={() => onDeleteTask(t.id)} className="text-[#64748b] hover:text-white ml-2 cursor-pointer">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#090d15] border border-[rgba(255,255,255,0.09)] space-y-2">
                <div className="text-xs font-bold tracking-wider uppercase text-white">
                  Memory Vault ({memories.length})
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newMem.trim()) return;
                    onAddMemory(newMem.trim());
                    setNewMem('');
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    value={newMem}
                    onChange={(e) => setNewMem(e.target.value)}
                    placeholder="Store personal note..."
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#05080d] border border-[rgba(255,255,255,0.08)] text-xs text-white outline-none"
                  />
                  <button type="submit" className="px-3 py-1.5 rounded-lg bg-[#38bdf8] text-[#04060a] text-xs font-bold cursor-pointer">
                    Save
                  </button>
                </form>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {memories.map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#05080d] text-xs">
                      <span className="truncate flex-1 text-[#cbd5e1]">{m.text}</span>
                      <button onClick={() => onDeleteMemory(m.id)} className="text-[#64748b] hover:text-white ml-2 cursor-pointer">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------- TAB 4: EMBEDDED 1:1 REEL DAY TRADER SKILL (11 CLAUDE SKILLS + 10,000 REPLAYS!) ---------- */}
        {activeTab === 'trader' && (
          <div className="pointer-events-auto max-w-2xl w-full mx-auto py-1">
            <DayTraderSkillsPanel
              realInrBalance={realInrBalance}
              orderBusy={orderBusy}
              onApproveSetup={onApproveSetup}
              onOpenRawWallet={onOpenTradingBot}
            />
          </div>
        )}
      </main>

      {/* ==================== UNIFIED 5-TAB PRECISION BOTTOM DOCK (ZERO OVERFLOW!) ==================== */}
      <nav className="pointer-events-auto shrink-0 border-t border-[rgba(255,255,255,0.08)] bg-[rgba(5,8,13,0.95)] backdrop-blur-xl px-2 pt-1.5 pb-[max(8px,env(safe-area-inset-bottom))]">
        <div className="max-w-xl mx-auto grid grid-cols-5 gap-1">
          {[
            { id: 'core', label: 'CORE', sub: 'Voice OS', onClick: () => setActiveTab('core'), active: activeTab === 'core' },
            { id: 'trader', label: 'DAY TRADER', sub: '11 Skills', onClick: () => setActiveTab('trader'), active: activeTab === 'trader' },
            { id: 'voice', label: 'STT / TTS', sub: 'Voices', onClick: () => setActiveTab('voice'), active: activeTab === 'voice' },
            { id: 'control', label: 'CONTROL', sub: 'Phone & OS', onClick: () => setActiveTab('control'), active: activeTab === 'control' },
            { id: 'studio', label: 'STUDIO', sub: 'YouTube AI', onClick: onOpenYouTubeStudio, active: false },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={tab.onClick}
              className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                tab.active
                  ? 'bg-[rgba(56,189,248,0.14)] border border-[rgba(56,189,248,0.4)] text-white'
                  : 'border border-transparent text-[#64748b] hover:text-[#cbd5e1]'
              }`}
            >
              <span className="text-[10.5px] font-bold tracking-[0.12em]">{tab.label}</span>
              <span className="text-[8.5px] font-mono opacity-75 mt-0.5">{tab.sub}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};
