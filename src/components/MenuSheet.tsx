import React, { useRef, useState, useEffect } from 'react';
import { CharacterConfig, MoodType, ThemeConfig } from '../types';
import { executePhoneAction } from '../engine/phoneBridge';
import { audio } from '../engine/audio';
import { loadElevenConfig } from '../engine/elevenlabs';
import { JarvisMemoryItem, JarvisTaskItem } from './JarvisWorkspace';
import {
  ApexMemberProfile,
  loadMembers,
  addMemberByOwner,
  removeMemberByOwner,
  isLoginGateRequired,
  setLoginGateRequired,
  updateOwnerPin,
} from '../engine/authStore';

interface MenuSheetProps {
  isOpen: boolean;
  currentUser?: ApexMemberProfile;
  onSwitchUser?: (user: ApexMemberProfile) => void;
  onLogout?: () => void;
  memories?: JarvisMemoryItem[];
  onAddMemory?: (text: string) => void;
  onDeleteMemory?: (id: string) => void;
  tasks?: JarvisTaskItem[];
  onAddTask?: (title: string) => void;
  onToggleTask?: (id: string) => void;
  onDeleteTask?: (id: string) => void;
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
  onVoiceTest: () => void;
  deepMode: boolean;
  onToggleDeep: () => void;
  onOpenYouTube: () => void;
  onOpenTradingBot?: () => void;
  onOpenElevenLabs?: () => void;
  onSpeakCustomText?: (text: string) => void;
  onSendCommand?: (text: string) => void;
  initialTab?: 'apps' | 'memory' | 'account' | 'phone' | 'voice' | 'moods' | 'settings';
  langMode: string;
  onToggleLang: () => void;
  themes: ThemeConfig[];
  currentThemeIdx: number;
  onCycleTheme: () => void;
  bgOn: boolean;
  onToggleBg: () => void;
  sfxOn: boolean;
  onToggleSfx: () => void;
  sfxVolume: number;
  onChangeSfxVolume: (val: number) => void;
  voiceVolume: number;
  onChangeVoiceVolume: (val: number) => void;
  soundOn: boolean;
  onToggleSound: () => void;
  onClose: () => void;
}

export const MenuSheet: React.FC<MenuSheetProps> = ({
  isOpen,
  currentUser,
  onSwitchUser,
  onLogout,
  memories = [],
  onAddMemory,
  onDeleteMemory,
  tasks = [],
  onAddTask,
  onToggleTask,
  onDeleteTask,
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
  onReplay,
  onVoiceTest,
  deepMode,
  onToggleDeep,
  onOpenYouTube,
  onOpenTradingBot,
  onOpenElevenLabs,
  onSpeakCustomText,
  onSendCommand,
  initialTab,
  langMode,
  onToggleLang,
  themes,
  currentThemeIdx,
  onCycleTheme,
  bgOn,
  onToggleBg,
  sfxOn,
  onToggleSfx,
  sfxVolume,
  onChangeSfxVolume,
  voiceVolume,
  onChangeVoiceVolume,
  soundOn,
  onToggleSound,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<
    'apps' | 'memory' | 'account' | 'phone' | 'voice' | 'moods' | 'settings'
  >(initialTab || 'apps');
  const [memDraft, setMemDraft] = useState('');
  const [taskDraft, setTaskDraft] = useState('');
  const [membersList, setMembersList] = useState<ApexMemberProfile[]>(() => loadMembers());
  const [memberName, setMemberName] = useState('');
  const [memberIdInput, setMemberIdInput] = useState('');
  const [memberPin, setMemberPin] = useState('');
  const [memberMsg, setMemberMsg] = useState<string | null>(null);
  const [requireLogin, setRequireLogin] = useState<boolean>(() => isLoginGateRequired());
  const [ownerIdDraft, setOwnerIdDraft] = useState<string>(() => loadMembers()[0]?.identifier || 'admin');
  const [ownerPinDraft, setOwnerPinDraft] = useState<string>(() => loadMembers()[0]?.pin || '1234');
  const [ttsInput, setTtsInput] = useState(
    'Namaste Boss! Main APEX bol raha hoon, sab systems online hain.'
  );
  const [sttText, setSttText] = useState('');
  const [sttListening, setSttListening] = useState(false);
  const [voiceEngineStatus, setVoiceEngineStatus] = useState<string>(
    '✅ Built-in Hindi/Hinglish HD Assistant Voice ACTIVE'
  );
  const sttRef = useRef<any>(null);
  const sttStreamRef = useRef<MediaStream | null>(null);
  const sttFlushRef = useRef<((force?: boolean) => void) | null>(null);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const localCfg = loadElevenConfig();
    if (localCfg.apiKey) {
      setVoiceEngineStatus('✅ ElevenLabs Direct HD Studio Voice ACTIVE');
      return;
    }
    fetch('https://apex-humanoid-v2.pradhanbibek53.workers.dev/tts-check')
      .then((r) => r.json())
      .then((d) => {
        if (d?.elevenlabsWorking) {
          setVoiceEngineStatus('✅ Cloud ElevenLabs HD Voice ACTIVE');
        } else {
          setVoiceEngineStatus('✅ Built-in Cloud Hindi/Hinglish HD Voice ACTIVE (Zero Extra Key Needed)');
        }
      })
      .catch(() => {});
  }, [isOpen]);

  const toggleMenuStt = async () => {
    if (sttListening) {
      try {
        sttRef.current?.stop();
      } catch {}
      sttFlushRef.current?.(true);
      sttFlushRef.current = null;
      if (sttStreamRef.current) {
        try {
          sttStreamRef.current.getTracks().forEach((t) => t.stop());
        } catch {}
        sttStreamRef.current = null;
      }
      audio.disconnectMicStream();
      setSttListening(false);
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR && !(window as any).ApexAndroid) {
      try {
        const rec = new SR();
        rec.lang = 'hi-IN';
        rec.continuous = true;
        rec.interimResults = true;
        rec.onstart = () => setSttListening(true);
        rec.onresult = (ev: any) => {
          let out = '';
          for (let i = 0; i < ev.results.length; i++) out += ev.results[i][0].transcript + ' ';
          setSttText(out.trim());
        };
        rec.onerror = () => setSttListening(false);
        rec.onend = () => setSttListening(false);
        sttRef.current = rec;
        rec.start();
        return;
      } catch {}
    }

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        sttStreamRef.current = stream;
        setSttListening(true);
        const flush = await audio.startLivePcmCapture(stream, {
          isMutedGate: () => false,
          onLevel: () => {},
          onUtteranceWav: async (wavBuf) => {
            try {
              const r = await fetch('https://apex-humanoid-v2.pradhanbibek53.workers.dev/stt', {
                method: 'POST',
                headers: { 'content-type': 'audio/wav' },
                body: wavBuf,
              });
              const j = await r.json();
              if (j?.text) {
                setSttText((prev) => (prev ? `${prev} ${j.text}`.trim() : String(j.text).trim()));
              }
            } catch {}
          },
        });
        sttFlushRef.current = flush;
      } catch {
        setSttListening(false);
      }
    }
  };

  if (!isOpen) return null;

  const currentCharacter = characters[currentCharIdx];
  const currentTheme = themes[currentThemeIdx];
  const isOwnerUser = !currentUser || currentUser.role === 'owner';

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(84px+env(safe-area-inset-bottom))] w-[min(500px,calc(100vw-24px))] z-30 flex flex-col rounded-3xl bg-[rgba(7,14,24,0.94)] border border-white/14 backdrop-blur-2xl shadow-[0_24px_70px_rgba(0,0,0,0.95)] overflow-hidden font-sans">
      {/* Clean Executive Navigation Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'apps' as const, label: '✨ Studio' },
            { id: 'memory' as const, label: '🧠 Memory' },
            { id: 'phone' as const, label: '📱 Phone' },
            { id: 'voice' as const, label: '🎙️ Voice' },
            { id: 'moods' as const, label: '🎭 Moods' },
            { id: 'settings' as const, label: '⚙️ System' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`cursor-pointer px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
                activeTab === t.id
                  ? 'bg-gradient-to-r from-[#00f5d4] to-[#4fd2ff] text-[#04141f]'
                  : 'text-[#8cb0c9] hover:text-white hover:bg-white/6'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="cursor-pointer text-[#8cb0c9] hover:text-white w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-xs transition-all shrink-0 ml-1"
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* TAB: AI PERSONAL MEMORY & TASKS */}
      {activeTab === 'memory' && (
        <div className="p-3.5 flex flex-col gap-3 max-h-[58vh] overflow-y-auto">
          <div className="p-3 rounded-2xl bg-[rgba(0,245,212,0.08)] border border-[rgba(0,245,212,0.28)] space-y-2">
            <div className="text-xs font-bold text-[#7efce8]">
              🧠 Personal AI Long-Term Memory ({memories.length})
            </div>
            <p className="text-[11px] text-[#9ec4dc]">
              APEX aapki baatein apne-aap yaad rakhta hai — ya yahan se direct add karein:
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!memDraft.trim()) return;
                onAddMemory?.(memDraft.trim());
                setMemDraft('');
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                value={memDraft}
                onChange={(e) => setMemDraft(e.target.value)}
                placeholder="e.g. Mera naam Rahul hai / Target Gold ₹1.40L"
                className="flex-1 rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-xs text-white placeholder-[#6889a3] focus:outline-none focus:border-[#00f5d4]"
              />
              <button
                type="submit"
                className="cursor-pointer px-3.5 py-2 rounded-xl bg-[#00f5d4] text-[#031a15] text-xs font-bold"
              >
                + Save
              </button>
            </form>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pt-1">
              {memories.length === 0 ? (
                <div className="text-[11px] text-[#6e8fa8] py-1">
                  Abhi koi saved note nahi — bolkar &ldquo;Yaad rakhna...&rdquo; ya upar + Save se add karein.
                </div>
              ) : (
                memories.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-white"
                  >
                    <span className="truncate">{m.text}</span>
                    <button
                      onClick={() => onDeleteMemory?.(m.id)}
                      className="cursor-pointer text-[#ff7b9c] hover:text-white text-xs px-1.5"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2">
            <div className="text-xs font-bold text-white">✅ Personal Tasks &amp; Reminders ({tasks.length})</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!taskDraft.trim()) return;
                onAddTask?.(taskDraft.trim());
                setTaskDraft('');
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                value={taskDraft}
                onChange={(e) => setTaskDraft(e.target.value)}
                placeholder="Naya task likhein..."
                className="flex-1 rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-xs text-white placeholder-[#6889a3] focus:outline-none focus:border-[#4fd2ff]"
              />
              <button
                type="submit"
                className="cursor-pointer px-3.5 py-2 rounded-xl bg-[#4fd2ff] text-[#03141f] text-xs font-bold"
              >
                + Add
              </button>
            </form>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs"
                >
                  <button
                    onClick={() => onToggleTask?.(t.id)}
                    className={`cursor-pointer text-left truncate flex-1 ${
                      t.done ? 'line-through text-[#6e8fa8]' : 'text-white'
                    }`}
                  >
                    {t.done ? '☑ ' : '☐ '}
                    {t.title}
                  </button>
                  <button
                    onClick={() => onDeleteTask?.(t.id)}
                    className="cursor-pointer text-[#ff7b9c] text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: LOGIN GATE, PERSONAL PRIVACY & MEMBER MANAGEMENT */}
      {activeTab === 'account' && (
        <div className="p-3.5 flex flex-col gap-3 max-h-[58vh] overflow-y-auto">
          {/* Active Session Banner */}
          <div className="p-3 rounded-2xl bg-[rgba(79,210,255,0.1)] border border-[rgba(79,210,255,0.3)] flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#7be0ff]">
                Active Logged-In Profile
              </div>
              <div className="text-sm font-bold text-white">
                {currentUser?.name || 'Admin'}{' '}
                <span className="text-[10px] font-normal text-[#00f5d4]">
                  ({isOwnerUser ? 'Personal Owner' : 'Isolated Member'})
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                onLogout?.();
              }}
              className="cursor-pointer px-3 py-1.5 rounded-xl bg-[rgba(255,107,139,0.18)] border border-[rgba(255,107,139,0.45)] text-xs font-semibold text-[#ff9ebb] hover:text-white"
            >
              Sign Out / Login Page
            </button>
          </div>

          {/* Owner Controls: Public Play Store Login Gate + Admin PIN + Add Members */}
          {isOwnerUser && (
            <>
              <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-white">
                      🔒 App Khulte Hi Login Page Maango (Public / Listing Mode)
                    </div>
                    <p className="text-[10.5px] text-[#8db2cc]">
                      Abhi Personal Use ke liye OFF hai. Jab Play Store / doston ko dein tab ON kar dein — koi aapka CoinDCX account nahi dekh payega!
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const next = !requireLogin;
                      setRequireLogin(next);
                      setLoginGateRequired(next);
                    }}
                    className={`cursor-pointer px-3.5 py-1.5 rounded-full text-[11px] font-bold shrink-0 ${
                      requireLogin
                        ? 'bg-[#00f5a0] text-[#031a12]'
                        : 'bg-white/10 text-[#9ec0d8]'
                    }`}
                  >
                    {requireLogin ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Owner Login ID & PIN Customizer */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setMembersList(updateOwnerPin(ownerIdDraft, ownerPinDraft));
                    setMemberMsg('✅ Owner Login ID & PIN saved!');
                  }}
                  className="grid grid-cols-3 gap-1.5 pt-1"
                >
                  <input
                    type="text"
                    value={ownerIdDraft}
                    onChange={(e) => setOwnerIdDraft(e.target.value)}
                    placeholder="Admin ID/Phone"
                    className="rounded-xl bg-black/40 border border-white/15 px-2.5 py-1.5 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={ownerPinDraft}
                    onChange={(e) => setOwnerPinDraft(e.target.value)}
                    placeholder="Admin PIN"
                    className="rounded-xl bg-black/40 border border-white/15 px-2.5 py-1.5 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="cursor-pointer rounded-xl bg-white/12 hover:bg-white/20 text-xs font-semibold text-white py-1.5"
                  >
                    Save Admin PIN
                  </button>
                </form>
              </div>

              {/* Add & Manage Members Section */}
              <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2.5">
                <div className="text-xs font-bold text-white">
                  👥 Add / Manage Members ({membersList.length})
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const r = addMemberByOwner(memberName, memberIdInput, memberPin);
                    if (!r.ok) {
                      setMemberMsg(`⚠️ ${r.error}`);
                      return;
                    }
                    setMembersList(r.list);
                    setMemberName('');
                    setMemberIdInput('');
                    setMemberPin('');
                    setMemberMsg('✅ Member added! Unka account 100% separate rahega.');
                  }}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-1.5"
                >
                  <input
                    type="text"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    placeholder="Member Name"
                    className="rounded-xl bg-black/40 border border-white/15 px-2.5 py-2 text-xs text-white placeholder-[#6889a3]"
                  />
                  <input
                    type="text"
                    value={memberIdInput}
                    onChange={(e) => setMemberIdInput(e.target.value)}
                    placeholder="Phone / Email / ID"
                    className="rounded-xl bg-black/40 border border-white/15 px-2.5 py-2 text-xs text-white placeholder-[#6889a3]"
                  />
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={memberPin}
                      onChange={(e) => setMemberPin(e.target.value)}
                      placeholder="PIN (1234)"
                      className="w-24 rounded-xl bg-black/40 border border-white/15 px-2.5 py-2 text-xs text-white placeholder-[#6889a3]"
                    />
                    <button
                      type="submit"
                      className="cursor-pointer flex-1 rounded-xl bg-[#00f5d4] text-[#031a15] text-xs font-bold px-3"
                    >
                      + Add
                    </button>
                  </div>
                </form>

                {memberMsg && <div className="text-[11px] text-[#7efce8]">{memberMsg}</div>}

                <div className="space-y-1.5 max-h-36 overflow-y-auto pt-1">
                  {membersList.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">
                          {m.name}{' '}
                          <span className="text-[10px] text-[#7ea4be]">({m.identifier})</span>
                        </div>
                        <div className="text-[10px] text-[#6d92ac]">
                          {m.role === 'owner'
                            ? 'Owner · Personal Wallet Linked'
                            : `Member · Isolated Personal Account · PIN: ${m.pin}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {currentUser?.id !== m.id && (
                          <button
                            onClick={() => {
                              onSwitchUser?.(m);
                              onClose();
                            }}
                            className="cursor-pointer px-2.5 py-1 rounded-lg bg-[#4fd2ff]/20 text-[#8ce2ff] text-[10.5px] font-semibold"
                          >
                            Switch
                          </button>
                        )}
                        {m.role !== 'owner' && (
                          <button
                            onClick={() => setMembersList(removeMemberByOwner(m.id))}
                            className="cursor-pointer px-2 py-1 rounded-lg bg-white/8 text-[#ff8aa6] text-[10.5px]"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 1: CLEAN CORE STUDIOS (All extra filler removed!) */}
      {activeTab === 'apps' && (
        <div className="p-3.5 flex flex-col gap-2.5 max-h-[55vh] overflow-y-auto">
          {!(window as any).ApexAndroid && (
            <a
              href="./APEX-Humanoid.apk"
              download="APEX-Humanoid-v3.9.apk"
              className="group cursor-pointer flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-[rgba(0,245,212,0.2)] to-[rgba(79,210,255,0.1)] border border-[#00f5d4]/50 hover:border-[#00f5d4] transition-all text-left no-underline"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00f5d4]/20 border border-[#00f5d4]/45 flex items-center justify-center text-lg">
                  📲
                </div>
                <div>
                  <div className="text-[13px] font-bold text-[#00f5d4]">
                    Download Android App (APEX v4.0 Vision Hologram APK)
                  </div>
                  <p className="text-[11px] text-[#cbfaf0]">
                    1-Click Direct Download · AI 21-Landmark Hand Hologram + Voice Control
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#00f5d4] text-[#031915] text-[10.5px] font-bold">
                Download ↓
              </span>
            </a>
          )}

          {onOpenTradingBot && (
            <button
              onClick={onOpenTradingBot}
              className="group cursor-pointer flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-[rgba(0,245,160,0.12)] to-white/[0.03] border border-[rgba(0,245,160,0.3)] hover:border-[#00f5a0] transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[rgba(0,245,160,0.16)] border border-[rgba(0,245,160,0.35)] flex items-center justify-center text-lg">
                  📈
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white">
                    AI Day Trader &amp; Real CoinDCX
                  </div>
                  <p className="text-[11px] text-[#8dc7b2]">
                    NIFTY 50 · BANKNIFTY · 990 Crypto · 11-Skill Analysis
                  </p>
                </div>
              </div>
              <span className="text-xs text-[#00f5a0]">→</span>
            </button>
          )}

          <button
            onClick={onOpenYouTube}
            className="group cursor-pointer flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-[rgba(79,210,255,0.12)] to-white/[0.03] border border-[rgba(79,210,255,0.28)] hover:border-[#4fd2ff] transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[rgba(79,210,255,0.16)] border border-[rgba(79,210,255,0.35)] flex items-center justify-center text-lg">
                🎬
              </div>
              <div>
                <div className="text-[13px] font-semibold text-white">
                  YouTube Autonomous Studio
                </div>
                <p className="text-[11px] text-[#92bed9]">
                  Viral Shorts AI Script · Voiceover · Video Render
                </p>
              </div>
            </div>
            <span className="text-xs text-[#4fd2ff]">→</span>
          </button>

          <button
            onClick={() => setActiveTab('voice')}
            className="group cursor-pointer flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-[rgba(155,124,255,0.14)] to-white/[0.03] border border-[rgba(155,124,255,0.3)] hover:border-[#b39aff] transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[rgba(155,124,255,0.18)] border border-[rgba(155,124,255,0.35)] flex items-center justify-center text-lg">
                🎙️
              </div>
              <div>
                <div className="text-[13px] font-semibold text-white">
                  Speech-to-Text &amp; Voice Studio
                </div>
                <p className="text-[11px] text-[#c4b5fd]">
                  Live Hindi/English Dictation · Custom TTS · ElevenLabs Voices
                </p>
              </div>
            </div>
            <span className="text-xs text-[#c4b5fd]">→</span>
          </button>
        </div>
      )}

      {/* TAB 2: DIRECT ANDROID PHONE CONTROL */}
      {activeTab === 'phone' && (
        <div className="p-3.5 space-y-2.5 max-h-[55vh] overflow-y-auto">
          <div className="rounded-xl bg-[rgba(0,245,212,0.08)] border border-[rgba(0,245,212,0.28)] px-3 py-2 text-[11px] text-[#dffef6]">
            ⚡ <b>Voice Direct Control Ready:</b> Seedha boliye — <i>"Open YouTube"</i>, <i>"YouTube par Arijit Singh chalao"</i>, <i>"Torch on karo"</i>, <i>"Volume badhao"</i>, <i>"Open WhatsApp / Camera / Maps"</i>!
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: '▶️ YouTube', run: () => executePhoneAction('LAUNCH_APP', { app: 'youtube' }) },
              { label: '💬 WhatsApp', run: () => executePhoneAction('LAUNCH_APP', { app: 'whatsapp' }) },
              { label: '📸 Instagram', run: () => executePhoneAction('LAUNCH_APP', { app: 'instagram' }) },
              { label: '📷 Camera', run: () => executePhoneAction('OPEN_CAMERA') },
              { label: '🔦 Torch ON', run: () => executePhoneAction('SET_TORCH', { torchOn: true }) },
              { label: '🌑 Torch OFF', run: () => executePhoneAction('SET_TORCH', { torchOn: false }) },
              { label: '🔊 Volume +', run: () => executePhoneAction('ADJUST_VOLUME', { volumeMode: 'up' }) },
              { label: '🔉 Volume −', run: () => executePhoneAction('ADJUST_VOLUME', { volumeMode: 'down' }) },
              { label: '🗺️ Maps', run: () => executePhoneAction('LAUNCH_APP', { app: 'maps' }) },
              { label: '🌐 Chrome', run: () => executePhoneAction('LAUNCH_APP', { app: 'chrome' }) },
              { label: '⏰ 7:00 AM Alarm', run: () => executePhoneAction('SET_ALARM', { hour: 7, minute: 0, text: 'APEX Alarm' }) },
              { label: '📶 Wi-Fi Settings', run: () => executePhoneAction('OPEN_SETTINGS', { app: 'wifi' }) },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.run}
                className="cursor-pointer p-3 rounded-2xl bg-white/5 hover:bg-white/12 border border-white/10 text-xs font-medium text-white text-center transition-all"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: LIVE STT / TTS & OPTIONAL ELEVENLABS STUDIO */}
      {activeTab === 'voice' && (
        <div className="p-3.5 space-y-3 max-h-[55vh] overflow-y-auto">
          <div className="px-3 py-2 rounded-xl bg-[rgba(0,245,160,0.09)] border border-[rgba(0,245,160,0.28)] text-[11px] text-[#b8ffe4]">
            {voiceEngineStatus}
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">🎤 Live Speech-to-Text (STT)</span>
              <button
                onClick={toggleMenuStt}
                className={`cursor-pointer px-3 py-1 rounded-full text-[10.5px] font-bold ${
                  sttListening ? 'bg-[#ff4f70] text-white' : 'bg-[#00f5a0] text-[#041a12]'
                }`}
              >
                {sttListening ? '⏹ Stop' : '🎤 Start Dictation'}
              </button>
            </div>
            <textarea
              rows={2}
              value={sttText}
              onChange={(e) => setSttText(e.target.value)}
              placeholder="Boliye — aapki aawaz live text me yahan aayegi…"
              className="w-full rounded-xl bg-black/40 border border-white/12 p-2.5 text-xs text-white outline-none resize-none"
            />
            {sttText && onSendCommand && (
              <button
                onClick={() => {
                  onSendCommand(sttText);
                  onClose();
                }}
                className="cursor-pointer px-3.5 py-1.5 rounded-full bg-[#4fd2ff] text-[#041a12] text-xs font-bold"
              >
                Ask APEX →
              </button>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white">🔊 Text-to-Speech (TTS)</span>
              <div className="flex gap-1.5">
                {onOpenElevenLabs && (
                  <button
                    onClick={onOpenElevenLabs}
                    className="cursor-pointer px-2.5 py-1 rounded-full bg-[rgba(168,85,247,0.22)] border border-[#c084fc]/50 text-[#f3e8ff] text-[10.5px] font-semibold"
                  >
                    Custom Voices
                  </button>
                )}
                {onSpeakCustomText && (
                  <button
                    onClick={() => {
                      audio.unlockSpeaker();
                      onSpeakCustomText(ttsInput);
                    }}
                    className="cursor-pointer px-3 py-1 rounded-full bg-[#4fd2ff] text-[#041a12] text-[10.5px] font-bold"
                  >
                    🔊 Speak
                  </button>
                )}
              </div>
            </div>
            <textarea
              rows={2}
              value={ttsInput}
              onChange={(e) => setTtsInput(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/12 p-2.5 text-xs text-white outline-none resize-none"
            />
          </div>
        </div>
      )}

      {/* TAB 4: MOODS */}
      {activeTab === 'moods' && (
        <div className="p-3.5 grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[55vh] overflow-y-auto">
          {[
            { mood: 'idle' as MoodType, label: '✨ Calm Idle' },
            { mood: 'happy' as MoodType, label: '😊 Happy' },
            { mood: 'excited' as MoodType, label: '⚡ Excited' },
            { mood: 'calm' as MoodType, label: '🌿 Zen' },
            { mood: 'surprised' as MoodType, label: '🌟 Amazed' },
            { mood: 'thinking' as MoodType, label: '🧠 Focus' },
            { mood: 'sad' as MoodType, label: '💧 Soft' },
            { mood: 'angry' as MoodType, label: '🔥 Intense' },
          ].map(({ mood, label }) => {
            const active = currentMood === mood;
            return (
              <button
                key={mood}
                onClick={() => onSelectMood(mood)}
                className={`cursor-pointer py-2.5 px-2 rounded-2xl text-xs font-medium border transition-all ${
                  active
                    ? 'bg-[#4fd2ff] text-[#04141f] border-[#4fd2ff] font-bold'
                    : 'bg-white/5 text-[#b5d4ea] border-white/10 hover:bg-white/12'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* TAB 5: DEDICATED SEPARATE AUDIO CONTROLS + AVATAR/SYSTEM SETTINGS */}
      {activeTab === 'settings' && (
        <div className="p-3.5 flex flex-col gap-3 max-h-[55vh] overflow-y-auto">
          {/* 1. DEDICATED SEPARATE VOICE VOLUME VS BACKGROUND FX SOUND CONTROL */}
          <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/12 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">🗣️ Assistant Voice Volume</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-[#4fd2ff]">
                  {Math.round(voiceVolume * 100)}%
                </span>
                <button
                  onClick={onVoiceTest}
                  className="cursor-pointer px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-[10px] text-white"
                >
                  Test
                </button>
              </div>
            </div>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={voiceVolume}
              onChange={(e) => onChangeVoiceVolume(parseFloat(e.target.value))}
              className="w-full accent-[#00f5d4] cursor-pointer h-1.5 rounded-lg"
            />

            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">🔉 Background FX Sound</div>
                  <div className="text-[10px] text-[#7fa4bd]">
                    UI effects &amp; ambient hum (alag se ON/OFF)
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={onToggleSfx}
                    className={`cursor-pointer px-2.5 py-1 rounded-full text-[10.5px] font-bold border transition-all ${
                      sfxOn
                        ? 'bg-[#4fd2ff] text-[#04141f] border-[#4fd2ff]'
                        : 'bg-white/6 text-[#89a8bf] border-white/12'
                    }`}
                  >
                    {sfxOn ? 'FX ON' : 'FX OFF'}
                  </button>
                  <button
                    onClick={onToggleSound}
                    className={`cursor-pointer px-2.5 py-1 rounded-full text-[10.5px] font-bold border transition-all ${
                      soundOn
                        ? 'bg-[#00f5d4] text-[#04141f] border-[#00f5d4]'
                        : 'bg-white/6 text-[#89a8bf] border-white/12'
                    }`}
                  >
                    {soundOn ? 'Hum ON' : 'Hum OFF'}
                  </button>
                </div>
              </div>

              {sfxOn && (
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] text-[#8ab0c9] shrink-0">FX Level</span>
                  <input
                    type="range"
                    min="0.05"
                    max="0.6"
                    step="0.05"
                    value={sfxVolume}
                    onChange={(e) => onChangeSfxVolume(parseFloat(e.target.value))}
                    className="flex-1 accent-[#4fd2ff] cursor-pointer h-1.5 rounded-lg"
                  />
                  <span className="text-[10.5px] font-mono text-[#bfe6ff] w-9 text-right">
                    {Math.round(sfxVolume * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 2. AVATAR, THEME & LANGUAGE */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={onCycleCharacter}
              className="cursor-pointer p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left"
            >
              <div className="text-[9px] text-[#7ea4be] uppercase">Avatar</div>
              <div className="text-xs font-semibold text-white truncate">
                {currentCharacter?.name || 'Nova'}
              </div>
            </button>

            <button
              onClick={onCycleTheme}
              className="cursor-pointer p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left"
            >
              <div className="text-[9px] text-[#7ea4be] uppercase">Theme</div>
              <div className="text-xs font-semibold text-white capitalize truncate">
                {currentTheme.name}
              </div>
            </button>

            <button
              onClick={onToggleLang}
              className="cursor-pointer p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left"
            >
              <div className="text-[9px] text-[#7ea4be] uppercase">Language</div>
              <div className="text-xs font-semibold text-white">
                {langMode === 'hi-IN' ? 'Hindi / Hinglish' : 'English'}
              </div>
            </button>
          </div>

          {/* 3. EXTRA VISUAL CONTROLS (Flat 2D photo face removed — pure 3D Humanoids only!) */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={onToggleBg}
              className="cursor-pointer py-2 rounded-xl bg-white/5 border border-white/10 text-[10.5px] text-[#c5e2f7]"
            >
              Grid: {bgOn ? 'On' : 'Off'}
            </button>
            <button
              onClick={onToggleDeep}
              className="cursor-pointer py-2 rounded-xl bg-white/5 border border-white/10 text-[10.5px] text-[#c5e2f7]"
            >
              {deepMode ? 'Deep AI' : 'Fast AI'}
            </button>
            <button
              onClick={onReplay}
              className="cursor-pointer py-2 rounded-xl bg-white/5 border border-white/10 text-[10.5px] text-[#c5e2f7]"
            >
              Replay 3D
            </button>
          </div>

          {/* 4. INVISIBLE HAND GESTURE CONTROL (Selfie camera feed stays 100% hidden!) */}
          <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white">✋ Hand Gesture Control (Hidden Sensor)</span>
              <button
                onClick={onToggleGesture}
                className={`cursor-pointer px-3 py-1 rounded-full text-[10.5px] font-bold border ${
                  gestureActive
                    ? 'bg-[#00f5a0] text-[#04141f] border-[#00f5a0]'
                    : 'bg-white/6 text-[#8cb0c9] border-white/12'
                }`}
              >
                {gestureActive ? 'ON' : 'OFF'}
              </button>
            </div>
            {gestureActive && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="text-[10px] text-[#8ab0c9]">Smoothing ({gestureSmoothing.toFixed(2)})</div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.55"
                    step="0.01"
                    value={gestureSmoothing}
                    onChange={(e) => onChangeGestureSmoothing(parseFloat(e.target.value))}
                    className="w-full accent-[#4fd2ff] h-1.5"
                  />
                </div>
                <div>
                  <div className="text-[10px] text-[#8ab0c9]">Sensitivity ({gestureSensitivity.toFixed(1)}x)</div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.5"
                    step="0.1"
                    value={gestureSensitivity}
                    onChange={(e) => onChangeGestureSensitivity(parseFloat(e.target.value))}
                    className="w-full accent-[#4fd2ff] h-1.5"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
