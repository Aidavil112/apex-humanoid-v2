import React, { useRef, useState } from 'react';
import { CharacterConfig, MoodType, ThemeConfig } from '../types';

interface MenuSheetProps {
  isOpen: boolean;
  currentMood: MoodType;
  onSelectMood: (m: MoodType) => void;
  gestureActive: boolean;
  onToggleGesture: () => void;
  gestureSmoothing: number;
  onChangeGestureSmoothing: (val: number) => void;
  gestureSensitivity: number;
  onChangeGestureSensitivity: (val: number) => void;
  characters: CharacterConfig[];
  currentCharIdx: number;
  onCycleCharacter: () => void;
  photoMode: boolean;
  onPhotoUpload: (file: File) => void;
  onExitPhoto: () => void;
  onReplay: () => void;
  onOpenAsk: () => void;
  onVoiceTest: () => void;
  deepMode: boolean;
  onToggleDeep: () => void;
  onOpenYouTube: () => void;
  onOpenReel: () => void;
  onOpenTradingBot?: () => void;
  onOpenAgentCompany?: () => void;
  langMode: string;
  onToggleLang: () => void;
  themes: ThemeConfig[];
  currentThemeIdx: number;
  onCycleTheme: () => void;
  bgOn: boolean;
  onToggleBg: () => void;
  sfxOn: boolean;
  onToggleSfx: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
  onClose: () => void;
}

export const MenuSheet: React.FC<MenuSheetProps> = ({
  isOpen,
  currentMood,
  onSelectMood,
  gestureActive,
  onToggleGesture,
  gestureSmoothing,
  onChangeGestureSmoothing,
  gestureSensitivity,
  onChangeGestureSensitivity,
  characters,
  currentCharIdx,
  onCycleCharacter,
  photoMode,
  onPhotoUpload,
  onExitPhoto,
  onReplay,
  onOpenAsk,
  onVoiceTest,
  deepMode,
  onToggleDeep,
  onOpenYouTube,
  onOpenReel,
  onOpenTradingBot,
  onOpenAgentCompany,
  langMode,
  onToggleLang,
  themes,
  currentThemeIdx,
  onCycleTheme,
  bgOn,
  onToggleBg,
  sfxOn,
  onToggleSfx,
  soundOn,
  onToggleSound,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'apps' | 'moods' | 'settings'>('apps');

  if (!isOpen) return null;

  const currentCharacter = characters[currentCharIdx];
  const currentTheme = themes[currentThemeIdx];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onPhotoUpload(file);
    }
  };

  const handleFaceClick = () => {
    if (photoMode) {
      onExitPhoto();
    } else {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(90px+env(safe-area-inset-bottom))] w-[min(540px,calc(100vw-28px))] z-30 flex flex-col rounded-2xl bg-[rgba(5,13,20,0.96)] border border-[rgba(79,210,255,0.24)] backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.95)] overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top Header & Tab Switcher (Decluttered, modern navigation) */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2.5 border-b border-[rgba(79,210,255,0.12)] bg-[rgba(4,10,16,0.6)]">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[rgba(10,22,34,0.7)] border border-[rgba(79,210,255,0.12)]">
          <button
            onClick={() => setActiveTab('apps')}
            className={`cursor-pointer px-3 py-1.5 rounded-lg text-[10.5px] font-mono tracking-wider uppercase transition-all duration-150 ${
              activeTab === 'apps'
                ? 'bg-[var(--cyan,#4fd2ff)] text-[#06121c] font-bold shadow-[0_0_12px_rgba(79,210,255,0.5)]'
                : 'text-[#7da5bf] hover:text-[#d7f1ff] hover:bg-[rgba(79,210,255,0.06)]'
            }`}
          >
            🚀 Apps
          </button>
          <button
            onClick={() => setActiveTab('moods')}
            className={`cursor-pointer px-3 py-1.5 rounded-lg text-[10.5px] font-mono tracking-wider uppercase transition-all duration-150 ${
              activeTab === 'moods'
                ? 'bg-[var(--cyan,#4fd2ff)] text-[#06121c] font-bold shadow-[0_0_12px_rgba(79,210,255,0.5)]'
                : 'text-[#7da5bf] hover:text-[#d7f1ff] hover:bg-[rgba(79,210,255,0.06)]'
            }`}
          >
            🎭 Moods
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`cursor-pointer px-3 py-1.5 rounded-lg text-[10.5px] font-mono tracking-wider uppercase transition-all duration-150 ${
              activeTab === 'settings'
                ? 'bg-[var(--cyan,#4fd2ff)] text-[#06121c] font-bold shadow-[0_0_12px_rgba(79,210,255,0.5)]'
                : 'text-[#7da5bf] hover:text-[#d7f1ff] hover:bg-[rgba(79,210,255,0.06)]'
            }`}
          >
            ⚙️ System
          </button>
        </div>

        <button
          onClick={onClose}
          className="cursor-pointer text-[#7da5bf] hover:text-[#ff6b6b] hover:bg-[rgba(255,107,107,0.1)] w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all border border-transparent hover:border-[rgba(255,107,107,0.3)]"
          title="Close menu"
        >
          ✕
        </button>
      </div>

      {/* Tab 1: Studio Apps & Autotrading */}
      {activeTab === 'apps' && (
        <div className="p-3 sm:p-3.5 flex flex-col gap-2 max-h-[55vh] overflow-y-auto">
          {onOpenTradingBot && (
            <button
              onClick={onOpenTradingBot}
              className="group cursor-pointer flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-[rgba(0,245,160,0.12)] to-[rgba(6,18,28,0.7)] border border-[rgba(0,245,160,0.35)] hover:border-[rgba(0,245,160,0.7)] hover:bg-[rgba(0,245,160,0.18)] transition-all text-left shadow-[0_0_14px_rgba(0,245,160,0.1)]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[rgba(0,245,160,0.16)] border border-[rgba(0,245,160,0.4)] flex items-center justify-center text-lg">
                  📈
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[13px] text-[#e0fff3] tracking-wide">
                      CoinDCX Real Money Trading
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[rgba(0,245,160,0.25)] text-[#00f5a0] font-bold tracking-wider">
                      LIVE MONEY
                    </span>
                  </div>
                  <p className="text-[11px] text-[#78c7ab] leading-snug">
                    100% Real CoinDCX Spot + Futures Balance &amp; Live BUY/SELL Execution
                  </p>
                </div>
              </div>
              <span className="text-xs text-[#00f5a0] group-hover:translate-x-1 transition-transform">
                →
              </span>
            </button>
          )}

          {onOpenAgentCompany && (
            <button
              onClick={onOpenAgentCompany}
              className="group cursor-pointer flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-[rgba(255,100,34,0.12)] to-[rgba(6,18,28,0.7)] border border-[rgba(255,100,34,0.35)] hover:border-[rgba(255,100,34,0.7)] hover:bg-[rgba(255,100,34,0.18)] transition-all text-left shadow-[0_0_14px_rgba(255,100,34,0.1)]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[rgba(255,100,34,0.16)] border border-[rgba(255,100,34,0.4)] flex items-center justify-center text-lg">
                  🏢
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[13px] text-[#fff0e6] tracking-wide">
                      Chief of Staff & Agents
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[rgba(255,100,34,0.25)] text-[#ff803b] font-bold tracking-wider">
                      COMMAND CENTER
                    </span>
                  </div>
                  <p className="text-[11px] text-[#cca590] leading-snug">
                    Autonomous multi-agent corporate execution & task dispatch
                  </p>
                </div>
              </div>
              <span className="text-xs text-[#ff803b] group-hover:translate-x-1 transition-transform">
                →
              </span>
            </button>
          )}

          {!window.location.search.includes('app=apk') && (
            <a
              href="https://aidavil112.github.io/apex-humanoid-v2/APEX-Humanoid.apk"
              download="APEX-Humanoid.apk"
              className="group cursor-pointer flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-[rgba(79,210,255,0.16)] to-[rgba(0,245,160,0.1)] border border-[rgba(79,210,255,0.45)] hover:border-[#00f5a0] transition-all text-left no-underline"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[rgba(79,210,255,0.2)] border border-[#4fd2ff] flex items-center justify-center text-lg">
                  📲
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[13px] text-white tracking-wide">
                      Download Android App (APK)
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[rgba(0,245,160,0.25)] text-[#00f5a0] font-bold">
                      v2.0 APK
                    </span>
                  </div>
                  <p className="text-[11px] text-[#9ecbe3] leading-snug">
                    1-Tap Install Fullscreen App · Live Voice + CoinDCX + YouTube
                  </p>
                </div>
              </div>
              <span className="text-xs text-[#00f5a0] font-bold">⬇ APK</span>
            </a>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onOpenReel}
              className="cursor-pointer flex flex-col p-2.5 rounded-xl bg-[rgba(225,48,108,0.1)] border border-[rgba(225,48,108,0.28)] hover:border-[rgba(225,48,108,0.6)] hover:bg-[rgba(225,48,108,0.16)] transition-all text-left"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-base">📸</span>
                <span className="text-[9px] font-mono text-[#ff80ab]">REEL</span>
              </div>
              <span className="text-[12px] font-semibold text-[#ffe0ec]">IG Reel Studio</span>
              <span className="text-[10px] text-[#cfa5b7] line-clamp-1">Visual reel player & audio sync</span>
            </button>

            <button
              onClick={onOpenYouTube}
              className="cursor-pointer flex flex-col p-2.5 rounded-xl bg-[rgba(46,168,201,0.1)] border border-[rgba(46,168,201,0.28)] hover:border-[rgba(46,168,201,0.6)] hover:bg-[rgba(46,168,201,0.16)] transition-all text-left"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-base">🎬</span>
                <span className="text-[9px] font-mono text-[#7fd4ff]">STREAM</span>
              </div>
              <span className="text-[12px] font-semibold text-[#dcf4ff]">YouTube Studio</span>
              <span className="text-[10px] text-[#91bfd4] line-clamp-1">Video stream & live feed</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onOpenAsk}
              className="cursor-pointer flex items-center gap-2.5 p-2.5 rounded-xl bg-[rgba(79,210,255,0.06)] border border-[rgba(79,210,255,0.16)] hover:border-[rgba(79,210,255,0.4)] hover:bg-[rgba(79,210,255,0.12)] transition-all text-left"
            >
              <span className="text-base">⌨️</span>
              <div>
                <div className="text-[11.5px] font-semibold text-[#bfe6ff]">Terminal Ask</div>
                <div className="text-[9.5px] text-[#719ab2]">Direct query terminal</div>
              </div>
            </button>

            <button
              onClick={onVoiceTest}
              className="cursor-pointer flex items-center gap-2.5 p-2.5 rounded-xl bg-[rgba(79,210,255,0.06)] border border-[rgba(79,210,255,0.16)] hover:border-[rgba(79,210,255,0.4)] hover:bg-[rgba(79,210,255,0.12)] transition-all text-left"
            >
              <span className="text-base">🔊</span>
              <div>
                <div className="text-[11.5px] font-semibold text-[#bfe6ff]">Voice Diagnostic</div>
                <div className="text-[9.5px] text-[#719ab2]">Test speech output</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Moods & Emotional Sentiment */}
      {activeTab === 'moods' && (
        <div className="p-3.5 flex flex-col gap-3 max-h-[55vh] overflow-y-auto">
          {/* Core Behavioral State */}
          <div>
            <div className="text-[9.5px] font-mono tracking-widest text-[#5c88a4] uppercase mb-1.5 flex items-center gap-1.5">
              <span>●</span> SYSTEM BEHAVIORAL STATE
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {(['idle', 'listening', 'thinking', 'speaking'] as MoodType[]).map((m) => (
                <button
                  key={m}
                  onClick={() => onSelectMood(m)}
                  className={`cursor-pointer font-mono text-[10px] tracking-wider uppercase rounded-xl py-2 px-1 text-center transition-all duration-150 border ${
                    currentMood === m
                      ? 'text-[#06121c] bg-[var(--cyan,#4fd2ff)] border-[var(--cyan,#4fd2ff)] font-bold shadow-[0_0_12px_rgba(79,210,255,0.6)]'
                      : 'text-[#7fa8c2] border-[rgba(79,210,255,0.12)] bg-[rgba(7,18,28,0.5)] hover:text-[#d7f1ff] hover:bg-[rgba(79,210,255,0.08)]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Emotional Sentiments */}
          <div>
            <div className="text-[9.5px] font-mono tracking-widest text-[#5c88a4] uppercase mb-1.5 flex items-center gap-1.5">
              <span>●</span> EMOTIONAL SENTIMENT DYNAMICS
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {[
                { mood: 'happy' as MoodType, label: '😊 Happy', color: '#ffd13b' },
                { mood: 'excited' as MoodType, label: '⚡ Excited', color: '#ff7a18' },
                { mood: 'calm' as MoodType, label: '🌿 Calm', color: '#29f0aa' },
                { mood: 'surprised' as MoodType, label: '✨ Surprised', color: '#f04aff' },
                { mood: 'angry' as MoodType, label: '🔥 Angry', color: '#ff3322' },
                { mood: 'sad' as MoodType, label: '💧 Sad', color: '#5b82ff' },
                { mood: 'neutral' as MoodType, label: '💠 Neutral', color: '#b0d6f5' },
              ].map(({ mood, label, color }) => {
                const isActive = currentMood === mood;
                return (
                  <button
                    key={mood}
                    onClick={() => onSelectMood(mood)}
                    style={{
                      borderColor: isActive ? color : 'rgba(79,210,255,0.12)',
                      backgroundColor: isActive ? color : 'rgba(6,18,28,0.5)',
                      color: isActive ? '#050c12' : '#8ab2cc',
                      boxShadow: isActive ? `0 0 12px ${color}88` : 'none',
                    }}
                    className={`cursor-pointer text-[10.5px] tracking-wide font-medium rounded-xl py-2 px-2 text-center transition-all duration-150 border hover:scale-[1.02] ${
                      isActive ? 'font-bold' : 'hover:text-[#ffffff]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-[10px] text-[#557e99] leading-relaxed p-2.5 rounded-xl bg-[rgba(6,16,24,0.5)] border border-[rgba(79,210,255,0.08)]">
            💡 Selecting an emotion dynamically modulates Apex heart rate (60–138 BPM), core particle dispersion, and auto-trader market conviction.
          </div>
        </div>
      )}

      {/* Tab 3: System Settings & Avatar Controls */}
      {activeTab === 'settings' && (
        <div className="p-3.5 flex flex-col gap-3 max-h-[55vh] overflow-y-auto">
          {/* Avatar & Aesthetics */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onCycleCharacter}
              className="cursor-pointer flex items-center justify-between p-2.5 rounded-xl bg-[rgba(79,210,255,0.06)] border border-[rgba(79,210,255,0.16)] hover:border-[rgba(79,210,255,0.4)] text-left transition-all"
            >
              <div>
                <div className="text-[9px] font-mono text-[#527d96] uppercase">AVATAR MESH</div>
                <div className="text-[12px] font-semibold text-[#bfe6ff]">
                  ◈ {currentCharacter?.name || 'Nova'}
                </div>
              </div>
              <span className="text-xs text-[#527d96]">↻</span>
            </button>

            <button
              onClick={onCycleTheme}
              className="cursor-pointer flex items-center justify-between p-2.5 rounded-xl bg-[rgba(79,210,255,0.06)] border border-[rgba(79,210,255,0.16)] hover:border-[rgba(79,210,255,0.4)] text-left transition-all"
            >
              <div>
                <div className="text-[9px] font-mono text-[#527d96] uppercase">THEME COLOR</div>
                <div className="text-[12px] font-semibold text-[#bfe6ff] capitalize">
                  ◐ {currentTheme.name}
                </div>
              </div>
              <span className="text-xs text-[#527d96]">↻</span>
            </button>
          </div>

          {/* Language & Deep Reasoning & Custom Face */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={onToggleLang}
              className="cursor-pointer p-2.5 rounded-xl bg-[rgba(79,210,255,0.06)] border border-[rgba(79,210,255,0.16)] hover:border-[rgba(79,210,255,0.4)] text-center transition-all"
            >
              <div className="text-[9px] font-mono text-[#527d96] uppercase">LANGUAGE</div>
              <div className="text-[11.5px] font-semibold text-[#bfe6ff]">
                {langMode === 'hi-IN' ? 'अ Hindi' : 'A English'}
              </div>
            </button>

            <button
              onClick={onToggleDeep}
              className={`cursor-pointer p-2.5 rounded-xl border transition-all text-center ${
                deepMode
                  ? 'bg-[rgba(79,210,255,0.16)] border-[rgba(79,210,255,0.5)] text-[#bfe6ff]'
                  : 'bg-[rgba(79,210,255,0.06)] border-[rgba(79,210,255,0.16)] text-[#729bb2]'
              }`}
            >
              <div className="text-[9px] font-mono text-[#527d96] uppercase">MODEL</div>
              <div className="text-[11.5px] font-semibold">
                {deepMode ? '🧠 Deep Think' : '⚡ Fast Flash'}
              </div>
            </button>

            <button
              onClick={handleFaceClick}
              className={`cursor-pointer p-2.5 rounded-xl border transition-all text-center ${
                photoMode
                  ? 'bg-[rgba(79,210,255,0.16)] border-[rgba(79,210,255,0.5)] text-[#bfe6ff]'
                  : 'bg-[rgba(79,210,255,0.06)] border-[rgba(79,210,255,0.16)] text-[#729bb2]'
              }`}
            >
              <div className="text-[9px] font-mono text-[#527d96] uppercase">PHOTO FACE</div>
              <div className="text-[11.5px] font-semibold">
                {photoMode ? '◉ Active Face' : '+ Upload'}
              </div>
            </button>
          </div>

          {/* Hand Tracking Toggle & Sliders */}
          <div className="p-3 rounded-xl bg-[rgba(6,16,24,0.6)] border border-[rgba(79,210,255,0.14)] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">✋</span>
                <span className="text-[11.5px] font-semibold text-[#bfe6ff]">
                  Hand Gesture Gaze Control
                </span>
              </div>
              <button
                onClick={onToggleGesture}
                className={`cursor-pointer px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all border ${
                  gestureActive
                    ? 'bg-[rgba(0,245,160,0.2)] text-[#00f5a0] border-[rgba(0,245,160,0.4)]'
                    : 'bg-[rgba(79,210,255,0.06)] text-[#658ea4] border-[rgba(79,210,255,0.1)]'
                }`}
              >
                {gestureActive ? 'ACTIVE 🟢' : 'DISABLED'}
              </button>
            </div>

            {gestureActive && (
              <div className="flex flex-col gap-2 pt-1 border-t border-[rgba(79,210,255,0.08)]">
                <div className="flex items-center justify-between text-[10px] text-[#6d96b0]">
                  <span>Movement Smoothing:</span>
                  <span className="text-[#bfe6ff] font-mono">{gestureSmoothing.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.55"
                  step="0.01"
                  value={gestureSmoothing}
                  onChange={(e) => onChangeGestureSmoothing(parseFloat(e.target.value))}
                  className="accent-[#4fd2ff] cursor-pointer h-1.5 bg-[#0a1e2b] rounded-lg"
                />

                <div className="flex items-center justify-between text-[10px] text-[#6d96b0]">
                  <span>Gaze Sensitivity:</span>
                  <span className="text-[#bfe6ff] font-mono">{gestureSensitivity.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.5"
                  step="0.1"
                  value={gestureSensitivity}
                  onChange={(e) => onChangeGestureSensitivity(parseFloat(e.target.value))}
                  className="accent-[#4fd2ff] cursor-pointer h-1.5 bg-[#0a1e2b] rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Audio & Grid Switches */}
          <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-[rgba(79,210,255,0.08)]">
            <button
              onClick={onToggleBg}
              className={`cursor-pointer font-mono text-[9.5px] uppercase py-1.5 rounded-lg border transition-all ${
                bgOn
                  ? 'bg-[rgba(79,210,255,0.15)] text-[#bfe6ff] border-[rgba(79,210,255,0.35)]'
                  : 'text-[#4c728a] border-[rgba(79,210,255,0.08)]'
              }`}
            >
              ◧ Grid {bgOn ? 'On' : 'Off'}
            </button>
            <button
              onClick={onToggleSfx}
              className={`cursor-pointer font-mono text-[9.5px] uppercase py-1.5 rounded-lg border transition-all ${
                sfxOn
                  ? 'bg-[rgba(79,210,255,0.15)] text-[#bfe6ff] border-[rgba(79,210,255,0.35)]'
                  : 'text-[#4c728a] border-[rgba(79,210,255,0.08)]'
              }`}
            >
              ♪ SFX {sfxOn ? 'On' : 'Off'}
            </button>
            <button
              onClick={onToggleSound}
              className={`cursor-pointer font-mono text-[9.5px] uppercase py-1.5 rounded-lg border transition-all ${
                soundOn
                  ? 'bg-[rgba(79,210,255,0.15)] text-[#bfe6ff] border-[rgba(79,210,255,0.35)]'
                  : 'text-[#4c728a] border-[rgba(79,210,255,0.08)]'
              }`}
            >
              🔊 Drone {soundOn ? 'On' : 'Off'}
            </button>
            <button
              onClick={onReplay}
              className="cursor-pointer font-mono text-[9.5px] uppercase py-1.5 rounded-lg border border-[rgba(79,210,255,0.1)] text-[#6591ab] hover:text-[#bfe6ff] hover:bg-[rgba(79,210,255,0.06)] transition-all"
            >
              ↺ Replay
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
