import React, { useState, useEffect } from 'react';
import { executePhoneAction } from '../engine/phoneBridge';

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
  onCloseTo3D: () => void;
  isListening: boolean;
  voiceStage: 'idle' | 'listening' | 'thinking' | 'speaking';
  micLevel: number;
  userText: string;
  botText: string;
  quietMode: boolean;
  onToggleQuietMode: () => void;
  onToggleCall: () => void;
  onFlushSpeechNow: () => void;
  onSendTextCommand: (cmd: string) => void;
  tasks: JarvisTaskItem[];
  onAddTask: (title: string) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  memories: JarvisMemoryItem[];
  onAddMemory: (text: string) => void;
  onDeleteMemory: (id: string) => void;
  onOpenTradingBot: () => void;
  onOpenYouTubeStudio: () => void;
  onPowerOff: () => void;
}

export const JarvisWorkspace: React.FC<JarvisWorkspaceProps> = ({
  isOpen,
  onCloseTo3D,
  isListening,
  voiceStage,
  micLevel,
  userText,
  botText,
  quietMode,
  onToggleQuietMode,
  onToggleCall,
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
  onOpenYouTubeStudio,
  onPowerOff,
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'apps' | 'tasks' | 'memory' | 'skills'>('home');
  const [cmdInput, setCmdInput] = useState('');
  const [newTaskInput, setNewTaskInput] = useState('');
  const [newMemInput, setNewMemInput] = useState('');
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, [isOpen]);

  if (!isOpen) return null;

  const orbScale =
    voiceStage === 'speaking'
      ? 1.09
      : isListening
      ? 1 + Math.min(0.24, micLevel * 0.42)
      : 1.0;

  const statusLabel = !isListening
    ? 'standing by'
    : voiceStage === 'speaking'
    ? 'speaking'
    : voiceStage === 'thinking'
    ? 'thinking…'
    : 'listening';

  const statusDotColor = !isListening
    ? '#9ca3af'
    : voiceStage === 'speaking'
    ? '#60a5fa'
    : voiceStage === 'thinking'
    ? '#fbbf24'
    : '#34d399';

  const navItems: { id: 'home' | 'apps' | 'tasks' | 'memory' | 'skills'; icon: string; label: string; badge?: number }[] = [
    { id: 'home', icon: '◉', label: 'Home' },
    { id: 'apps', icon: '📱', label: 'Phone Apps' },
    { id: 'tasks', icon: '☑', label: 'Tasks', badge: tasks.filter((t) => !t.done).length || undefined },
    { id: 'memory', icon: '🧠', label: 'Memory', badge: memories.length || undefined },
    { id: 'skills', icon: '⚡', label: 'Skills' },
  ];

  return (
    <div className="fixed inset-0 z-40 bg-[#05070a] text-[#e5e9f0] flex flex-col md:flex-row font-sans select-none overflow-hidden">
      {/* Left Sidebar (Desktop) / Top Compact Nav (Mobile) — Izem / APEX OS Aesthetic */}
      <aside className="w-full md:w-56 bg-[#080b10] border-b md:border-b-0 md:border-r border-[rgba(255,255,255,0.08)] flex flex-col justify-between px-3 py-2.5 md:p-4 shrink-0">
        <div className="space-y-3">
          {/* Top Brand + Power + 3D Switch */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_#fff]" />
              <span className="text-xs font-bold tracking-[0.2em] uppercase text-white">APEX OS</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={onCloseTo3D}
                className="px-2 py-1 rounded-lg bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] border border-[rgba(255,255,255,0.12)] text-[10px] font-semibold text-[#cbd5e1] cursor-pointer"
                title="Switch to 3D Particle Avatar"
              >
                🧬 3D View
              </button>
              <button
                onClick={onPowerOff}
                className="px-2 py-1 rounded-lg bg-[rgba(239,68,68,0.14)] hover:bg-[rgba(239,68,68,0.25)] border border-[rgba(239,68,68,0.35)] text-[10px] font-bold text-[#fca5a5] cursor-pointer"
                title="Master Full Power OFF"
              >
                ⏻ OFF
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex md:flex-col gap-1 overflow-x-auto pb-0.5 md:pb-0">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[rgba(255,255,255,0.11)] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]'
                      : 'text-[#8b95a5] hover:text-white hover:bg-[rgba(255,255,255,0.04)]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[11px]">{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  {item.badge ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[9.5px] bg-[rgba(255,255,255,0.14)] text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar Controls — Exact "Quiet mode" toggle from @izemdesk Reel! */}
        <div className="hidden md:flex flex-col gap-2.5 pt-3 border-t border-[rgba(255,255,255,0.07)]">
          <button
            onClick={onOpenTradingBot}
            className="w-full py-2 px-3 rounded-xl bg-[rgba(255,148,77,0.12)] hover:bg-[rgba(255,148,77,0.2)] border border-[rgba(255,148,77,0.35)] text-[#ffb877] text-[11px] font-bold flex items-center justify-between cursor-pointer"
          >
            <span>🧡 AI Day Trader</span>
            <span>11 Skills →</span>
          </button>

          <div className="flex items-center justify-between px-1 py-1 text-xs text-[#9aa4b2]">
            <span>Quiet mode</span>
            <button
              onClick={onToggleQuietMode}
              aria-pressed={quietMode}
              className={`w-9 h-5 rounded-full transition-all cursor-pointer p-0.5 ${
                quietMode ? 'bg-white' : 'bg-[#1f2633]'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full transition-transform ${
                  quietMode ? 'translate-x-4 bg-black' : 'translate-x-0 bg-[#9aa4b2]'
                }`}
              />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Stage */}
      <main className="flex-1 relative flex flex-col justify-between p-4 sm:p-6 overflow-y-auto">
        {/* Top Bar with Status Pill (exact top-right "• standing by" look!) */}
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-[#7c8798] font-medium">
            {activeTab === 'home' ? 'Voice Core' : activeTab.toUpperCase()}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleQuietMode}
              className="md:hidden px-2.5 py-1 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-[10.5px] text-[#9aa4b2] cursor-pointer"
            >
              {quietMode ? '🔇 Quiet ON' : '🔊 Voice ON'}
            </button>

            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-[11px] text-[#d8dee9]">
              <span
                className="w-2 h-2 rounded-full transition-colors"
                style={{ backgroundColor: statusDotColor, boxShadow: `0 0 10px ${statusDotColor}` }}
              />
              <span>{statusLabel}</span>
            </div>
          </div>
        </div>

        {/* TAB 1: HOME — THE ICONIC GLOWING DARK ECLIPSE ORB */}
        {activeTab === 'home' && (
          <div className="flex-1 flex flex-col items-center justify-center py-6 gap-7">
            <button
              onClick={onToggleCall}
              aria-label="Toggle JARVIS Live Voice"
              className="relative group flex items-center justify-center cursor-pointer focus:outline-none"
            >
              {/* Soft Ambient Outer Corona */}
              <div
                className="w-56 h-56 sm:w-64 sm:h-64 rounded-full transition-transform duration-150"
                style={{
                  transform: `scale(${orbScale})`,
                  background:
                    voiceStage === 'speaking'
                      ? 'radial-gradient(circle, rgba(96,165,250,0.22) 45%, rgba(255,255,255,0.03) 68%, transparent 76%)'
                      : isListening
                      ? 'radial-gradient(circle, rgba(52,211,153,0.18) 45%, rgba(255,255,255,0.03) 68%, transparent 76%)'
                      : 'radial-gradient(circle, rgba(255,255,255,0.08) 46%, transparent 72%)',
                }}
              />

              {/* Luminous Thin Eclipse Ring + Pitch-Dark Sphere Inside (Exact Izem Look!) */}
              <div
                className="absolute w-40 h-40 sm:w-48 sm:h-48 rounded-full transition-transform duration-100 flex items-center justify-center"
                style={{
                  transform: `scale(${orbScale})`,
                  background: 'radial-gradient(circle at 32% 28%, #1a1f29 0%, #07090d 58%, #020305 100%)',
                  boxShadow:
                    voiceStage === 'speaking'
                      ? '0 0 38px rgba(147,197,253,0.65), inset -6px -6px 22px rgba(255,255,255,0.28), 0 0 2px 1.5px rgba(255,255,255,0.88)'
                      : isListening
                      ? '0 0 34px rgba(110,231,183,0.5), inset -5px -5px 18px rgba(255,255,255,0.22), 0 0 2px 1.5px rgba(255,255,255,0.82)'
                      : '0 0 28px rgba(255,255,255,0.16), inset -4px -5px 16px rgba(255,255,255,0.16), 0 0 1.5px 1.2px rgba(255,255,255,0.68)',
                }}
              >
                <span className="text-[10.5px] tracking-[0.22em] uppercase text-[rgba(255,255,255,0.5)] group-hover:text-white transition-colors">
                  {isListening ? 'TAP TO END' : 'TAP TO TALK'}
                </span>
              </div>
            </button>

            {/* Live Subtitles & Instant Send Trigger */}
            <div className="w-full max-w-lg text-center space-y-2 min-h-[64px] px-2">
              {userText && (
                <div className="text-xs text-[#94a3b8]">
                  You: <span className="text-white">"{userText}"</span>
                </div>
              )}
              <div className="text-sm sm:text-base text-[#f1f5f9] font-normal leading-relaxed">
                {botText || 'Tap the orb & speak — "WhatsApp kholo", "Instagram kholo", "Subah 7 baje alarm lagao", or talk naturally!'}
              </div>

              {/* 1-Tap Quick Phone Actions Bar right on Home */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                <button
                  onClick={onOpenTradingBot}
                  className="px-2.5 py-1 rounded-full bg-[rgba(255,148,77,0.16)] border border-[rgba(255,148,77,0.45)] text-[#ffc288] text-[10.5px] font-bold cursor-pointer"
                >
                  🧡 990-Chart AI Trader
                </button>
                <button
                  onClick={() => executePhoneAction('LAUNCH_APP', { app: 'whatsapp' })}
                  className="px-2.5 py-1 rounded-full bg-[rgba(34,197,94,0.14)] border border-[rgba(34,197,94,0.4)] text-[#86efac] text-[10.5px] font-semibold cursor-pointer"
                >
                  💬 WhatsApp
                </button>
                <button
                  onClick={() => executePhoneAction('LAUNCH_APP', { app: 'instagram' })}
                  className="px-2.5 py-1 rounded-full bg-[rgba(236,72,153,0.14)] border border-[rgba(236,72,153,0.4)] text-[#f9a8d4] text-[10.5px] font-semibold cursor-pointer"
                >
                  📸 Instagram
                </button>
                <button
                  onClick={() => executePhoneAction('LAUNCH_APP', { app: 'youtube' })}
                  className="px-2.5 py-1 rounded-full bg-[rgba(239,68,68,0.14)] border border-[rgba(239,68,68,0.4)] text-[#fca5a5] text-[10.5px] font-semibold cursor-pointer"
                >
                  ▶️ YouTube
                </button>
              </div>

              {isListening && voiceStage === 'listening' && (
                <button
                  onClick={onFlushSpeechNow}
                  className="mt-1 px-3 py-1 rounded-full bg-[rgba(52,211,153,0.14)] border border-[rgba(52,211,153,0.4)] text-[#6ee7b7] text-[10.5px] font-semibold cursor-pointer"
                >
                  📤 Send Spoken Audio Now
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ANDROID PHONE APPS, CALL & ALARM LAUNCHER */}
        {activeTab === 'apps' && (
          <div className="flex-1 max-w-2xl w-full mx-auto py-3 space-y-3">
            <div className="p-3.5 rounded-2xl bg-[#0b0f17] border border-[rgba(255,255,255,0.09)] flex items-center justify-between">
              <div>
                <div className="text-base font-bold text-white">📱 Android Voice App &amp; System Control</div>
                <div className="text-[11px] text-[#94a3b8]">
                  Bol kar ya tap karke kholein: "WhatsApp kholo", "Instagram kholo", "Subah 6:30 ka alarm lagao", "Call 98765…"
                </div>
              </div>
              <div className="text-right text-xs text-[#cbd5e1] font-mono">
                {clock.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { label: '💬 WhatsApp', run: () => executePhoneAction('LAUNCH_APP', { app: 'whatsapp' }) },
                { label: '📸 Instagram', run: () => executePhoneAction('LAUNCH_APP', { app: 'instagram' }) },
                { label: '▶️ YouTube App', run: () => executePhoneAction('LAUNCH_APP', { app: 'youtube' }) },
                { label: '⏰ Set 7:00 AM Alarm', run: () => executePhoneAction('SET_ALARM', { hour: 7, minute: 0, text: 'APEX Morning Alarm' }) },
                { label: '✈️ Telegram', run: () => executePhoneAction('LAUNCH_APP', { app: 'telegram' }) },
                { label: '🗺️ Google Maps', run: () => executePhoneAction('LAUNCH_APP', { app: 'maps' }) },
                { label: '🎵 Spotify', run: () => executePhoneAction('LAUNCH_APP', { app: 'spotify' }) },
                { label: '⚙️ Wi-Fi Settings', run: () => executePhoneAction('OPEN_SETTINGS', { app: 'wifi' }) },
              ].map((b) => (
                <button
                  key={b.label}
                  onClick={b.run}
                  className="p-3.5 rounded-2xl bg-[#0b0f17] hover:bg-[#141b29] border border-[rgba(255,255,255,0.1)] text-xs font-semibold text-white text-center cursor-pointer transition-all"
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={onOpenTradingBot}
                className="py-3 px-4 rounded-2xl bg-[rgba(255,148,77,0.14)] border border-[rgba(255,148,77,0.45)] text-[#ffc288] text-xs font-extrabold text-left cursor-pointer"
              >
                🧡 Open 990-Chart AI Day Trader (CoinDCX) →
              </button>
              <button
                onClick={onOpenYouTubeStudio}
                className="py-3 px-4 rounded-2xl bg-[rgba(239,68,68,0.14)] border border-[rgba(239,68,68,0.45)] text-[#fca5a5] text-xs font-extrabold text-left cursor-pointer"
              >
                🎬 Open Autonomous YouTube Studio →
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: TASKS */}
        {activeTab === 'tasks' && (
          <div className="flex-1 max-w-xl w-full mx-auto py-4 space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTaskInput.trim()) return;
                onAddTask(newTaskInput.trim());
                setNewTaskInput('');
              }}
              className="flex gap-2"
            >
              <input
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
                placeholder='Add a task (or say "Task add karo…")'
                className="flex-1 bg-[#0b0f17] border border-[rgba(255,255,255,0.12)] rounded-xl px-3.5 py-2 text-xs text-white"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-white text-black text-xs font-bold cursor-pointer"
              >
                + Add
              </button>
            </form>

            <div className="space-y-2">
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#64748b]">
                  No tasks yet. Tell JARVIS: "Task add karo sham 6 baje video post karna hai"
                </div>
              ) : (
                tasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#0b0f17] border border-[rgba(255,255,255,0.08)]"
                  >
                    <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                      <input type="checkbox" checked={t.done} onChange={() => onToggleTask(t.id)} />
                      <span className={t.done ? 'line-through text-[#64748b]' : 'text-white'}>{t.title}</span>
                    </label>
                    <button
                      onClick={() => onDeleteTask(t.id)}
                      className="text-[11px] text-[#ef4444] hover:underline cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: MEMORY */}
        {activeTab === 'memory' && (
          <div className="flex-1 max-w-xl w-full mx-auto py-4 space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newMemInput.trim()) return;
                onAddMemory(newMemInput.trim());
                setNewMemInput('');
              }}
              className="flex gap-2"
            >
              <input
                value={newMemInput}
                onChange={(e) => setNewMemInput(e.target.value)}
                placeholder='Save personal memory (or say "Yaad rakhna…")'
                className="flex-1 bg-[#0b0f17] border border-[rgba(255,255,255,0.12)] rounded-xl px-3.5 py-2 text-xs text-white"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-white text-black text-xs font-bold cursor-pointer"
              >
                Save
              </button>
            </form>

            <div className="space-y-2">
              {memories.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#64748b]">
                  JARVIS remembers anything you tell it — try saying: "Yaad rakhna mujhe tech news pasand hai"
                </div>
              ) : (
                memories.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#0b0f17] border border-[rgba(255,255,255,0.08)] text-xs"
                  >
                    <span className="text-[#e2e8f0]">🧠 {m.text}</span>
                    <button
                      onClick={() => onDeleteMemory(m.id)}
                      className="text-[11px] text-[#ef4444] cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5: SKILLS */}
        {activeTab === 'skills' && (
          <div className="flex-1 max-w-2xl w-full mx-auto py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                title: '🧡 11-Skill AI Day Trader (Separate Bot)',
                desc: 'Scans 500+ CoinDCX charts · Plans Entry/Stop/Target · 10,000× Time-Machine Win Odds',
                action: onOpenTradingBot,
              },
              {
                title: '🎬 Autonomous YouTube Shorts Studio',
                desc: 'Viral topic research + Hinglish script + ElevenLabs HD voice + direct YouTube upload',
                action: onOpenYouTubeStudio,
              },
              {
                title: '🌐 Live News & Web Search by Voice',
                desc: 'Ask JARVIS "Aaj ki latest AI news batao" for instant real-time web headlines',
                action: () => {
                  setActiveTab('home');
                  onSendTextCommand('Aaj ki top tech aur India news short me batao');
                },
              },
              {
                title: '🧬 3D Interactive Humanoid Engine',
                desc: 'Switch anytime to 60fps WebGL particle avatar with camera hand-gesture tracking',
                action: onCloseTo3D,
              },
            ].map((s) => (
              <button
                key={s.title}
                onClick={s.action}
                className="p-4 rounded-2xl bg-[#0b0f17] hover:bg-[#111724] border border-[rgba(255,255,255,0.1)] text-left space-y-1 transition-all cursor-pointer"
              >
                <div className="text-xs font-bold text-white">{s.title}</div>
                <div className="text-[11px] text-[#94a3b8] leading-snug">{s.desc}</div>
              </button>
            ))}
          </div>
        )}

        {/* Universal Bottom JARVIS Prompt Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!cmdInput.trim()) return;
            onSendTextCommand(cmdInput.trim());
            setCmdInput('');
          }}
          className="w-full max-w-xl mx-auto flex items-center gap-2 pt-2"
        >
          <input
            type="text"
            value={cmdInput}
            onChange={(e) => setCmdInput(e.target.value)}
            placeholder="Ask JARVIS anything — tasks, memory, live news, ideas…"
            className="flex-1 bg-[#0b0f17] border border-[rgba(255,255,255,0.12)] rounded-2xl px-4 py-2.5 text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-white"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-2xl bg-white text-black text-xs font-bold hover:opacity-90 cursor-pointer"
          >
            Send
          </button>
        </form>
      </main>
    </div>
  );
};
