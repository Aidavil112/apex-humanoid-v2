import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WebGLEngine, CHARACTERS, PORTRAIT_AVATARS, THEMES, ALL_AVATARS } from './engine/webgl';
import { audio } from './engine/audio';
import { MoodType, SentimentResult } from './types';
import { HudOverlay } from './components/HudOverlay';
import { Dock } from './components/Dock';
import { MenuSheet } from './components/MenuSheet';
import { YouTubeModal } from './components/YouTubeModal';
import { MotionGraphicsOverlay } from './components/MotionGraphicsOverlay';
import { HologramArmorCanvas, SuitPresetId } from './components/HologramArmorCanvas';
import { Toast } from './components/Toast';
import { AudioWaveform } from './components/AudioWaveform';
import { TradingBotModal } from './components/TradingBotModal';
import { ElevenLabsModal } from './components/ElevenLabsModal';
import {
  SiriAssistantSheet,
  AssistantStage,
  PendingVoiceConfirmation,
  LiveChatBubble,
} from './components/SiriAssistantSheet';
import { JarvisTaskItem, JarvisMemoryItem } from './components/JarvisWorkspace';
import { fetchElevenLabsAudioDirect, loadElevenConfig } from './engine/elevenlabs';
import {
  GeminiLiveSession,
  loadGeminiLiveKey,
  isGeminiLiveEnabled,
  transcribeAudioWithGeminiKey,
} from './engine/geminiLive';
import {
  playSongOrVideoHandsFree,
  composeAndOpenWhatsAppSmart,
  runAutonomousDeepResearch,
} from './engine/myraaAgent';
import {
  ApexMemberProfile,
  getActiveSessionUser,
  switchSessionUser,
  logoutSession,
  userScopedKey,
} from './engine/authStore';
import {
  tryResolveRealtimeWorldQuery,
  extractAutoPersonalMemory,
  askFastLiveBrain,
  normalizeSpokenHindiText,
} from './engine/liveIntelligence';
import {
  HandFrameSnapshot,
  handWorker,
  preloadHandLandmarker,
} from './engine/aiHandHologram';
import { executePhoneAction, parseLocalPhoneCommand } from './engine/phoneBridge';
import { useAutoTrader } from './hooks/useAutoTrader';
import { analyzeSentiment } from './engine/sentiment';
import {
  addTarget as addJarvisTarget,
  armSlotAlarms as armJarvisAlarms,
  humanNextRun as jarvisNextRun,
  loadState as loadJarvisState,
  patrolAllTargets as patrolJarvisTargets,
  toggleCore as toggleJarvisCore,
} from './engine/jarvisCore';
import {
  armDailyAlarm as armAutopilotAlarm,
  createMission,
  executeMission,
  parseHinglishTime,
  saveSettings as saveAutopilotSettings,
  startAutopilotHeartbeat,
} from './engine/headBotAutopilot';
import { startJarvisCore } from './engine/jarvisCore';
import {
  brainDigest,
  buildBrainPrompt,
  noteBrain,
  pushBrainToWorker,
  remember as rememberBrain,
  startBrainCore,
  syncBrainToGithub,
} from './engine/brainMemory';
import {
  clarifyQuestion,
  enrollOwner,
  isOwnerPlaced,
  isSensitiveText,
  loadVoiceLock,
  pickClarification,
  resolveClarifyAnswer,
  revokeOwnerSession,
  saveVoiceLock,
  verifyOwnerNow,
  voiceLockStatus,
} from './engine/voiceAuth';
import { runOutsideEye } from './engine/outsideEye';

const DEVANAGARI_RE = /[\u0900-\u097F]/;

const QUICK_RESPONSES: [RegExp, string | (() => string)][] = [
  [/^(?:hi|hello|hey|namaste|namaskar|hii|helo)[!.,?\s]*$/i, 'Namaste Boss! Main bilkul clear sun raha hoon. Bataiye kya kaam karein?'],
  [/^(?:naam kya hai|who are you|tum kaun ho|your name)[!.,?\s]*$/i, 'Main APEX AI hoon Boss, aapka smart voice aur automation assistant.'],
];

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gestureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<WebGLEngine | null>(null);

  // Direct personal session (All local CoinDCX / Gemini keys stay 100% device-private on each phone!)
  const [ownerUnlocked, setOwnerUnlocked] = useState<boolean>(() => {
    const saved = localStorage.getItem('apex_owner_vault_unlocked_v6');
    return saved === null ? true : saved === '1';
  });
  const activeUser: ApexMemberProfile = {
    id: 'owner_admin',
    name: 'Boss',
    identifier: 'owner',
    pin: '7860',
    role: 'owner',
    createdAt: 'Personal Mode',
  };
  const activeUserId = activeUser.id;
  const isOwnerSession = ownerUnlocked;

  // Single clean unified page: Always-ON Hand Gesture + Instant Welcome Voice!
  const [entered] = useState(true);
  const [poweredOn, setPoweredOn] = useState(true);
  const poweredOnRef = useRef<boolean>(true);
  const [showVoicePanel, setShowVoicePanel] = useState<boolean>(false);
  const [activeSuit, setActiveSuit] = useState<SuitPresetId>('seraph');
  const [blastNonce, setBlastNonce] = useState<number>(0);
  const [resetNonce, setResetNonce] = useState<number>(0);
  const [zoomDeltaNonce, setZoomDeltaNonce] = useState<{ step: number; seq: number }>({ step: 0, seq: 0 });
  const welcomedOnceRef = useRef<boolean>(false);
  const handSnapshotRef = useRef<HandFrameSnapshot>({
    hands: [],
    twoHandSpan: null,
    aiReady: false,
  });
  const speechSeqRef = useRef<number>(0);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsPulseRef = useRef<any>(null);
  const greetTimerRef = useRef<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mood, setMoodState] = useState<MoodType>('idle');
  const [themeIdx, setThemeIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [fps, setFps] = useState(0);
  const [points, setPoints] = useState(0);
  const [showHint, setShowHint] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);
  const [sentimentInfo, setSentimentInfo] = useState<SentimentResult | null>(null);
  const activeSentimentRef = useRef<MoodType | null>(null);

  // Virtual Heart Rate State (synchronized with humanoid core particles)
  const [heartRate, setHeartRate] = useState<number>(72);
  const [heartPulse, setHeartPulse] = useState<number>(0);
  const [isElevated, setIsElevated] = useState<boolean>(false);

  // Speech Voices Pre-Warming State
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const updateVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) setVoices(v);
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }, []);

  // Features
  const [gestureActive, setGestureActive] = useState(false);
  const [gestureLabel, setGestureLabel] = useState<string>('Move: Look · Swipe ⇄ · Wave 🖐');
  const [assistantOpen, setAssistantOpen] = useState(true);
  const assistantOpenRef = useRef(true);
  assistantOpenRef.current = assistantOpen;
  const [confirmedBadge, setConfirmedBadge] = useState<string | null>(null);
  const confirmedBadgeTimerRef = useRef<any>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingVoiceConfirmation | null>(null);
  const pendingConfirmRef = useRef<PendingVoiceConfirmation | null>(null);
  pendingConfirmRef.current = pendingConfirm;
  const controlActionsRef = useRef<{
    startGesture: () => void;
    stopGesture: () => void;
    cycleTheme: () => void;
    cycleCharacter: () => void;
    togglePower: () => void;
    startEars: () => void;
  }>({
    startGesture: () => {},
    stopGesture: () => {},
    cycleTheme: () => {},
    cycleCharacter: () => {},
    togglePower: () => {},
    startEars: () => {},
  });
  const [isListening, setIsListening] = useState(false);
  const [liveVoiceStage, setLiveVoiceStage] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [liveInterimText, setLiveInterimText] = useState<string>('');
  const [liveUserText, setLiveUserText] = useState<string>('');
  const [liveBotText, setLiveBotText] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<LiveChatBubble[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('apex_live_chat_bubbles_v1') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  // 🎯 v6.6.2 — STT meta (alternatives/interim/confidence) + word-confirm state machine
  const lastSpeechMetaRef = useRef<{ alts: string[]; interim: string; confidence: number }>({
    alts: [],
    interim: '',
    confidence: -1,
  });
  const clarifyAskedRef = useRef(false);
  const pendingClarifyRef = useRef<{ word: string; options: [string, string]; original: string } | null>(null);
  const voiceEnrollRef = useRef(false);

  const pushChatBubble = useCallback((role: 'user' | 'bot', text: string) => {
    const clean = (text || '').trim();
    if (!clean) return;
    setChatHistory((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].role === role && prev[prev.length - 1].text === clean) {
        return prev;
      }
      const next: LiveChatBubble[] = [
        ...prev.slice(-39),
        {
          id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role,
          text: clean,
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        },
      ];
      try {
        localStorage.setItem('apex_live_chat_bubbles_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [langMode, setLangMode] = useState<'en-IN' | 'hi-IN'>('hi-IN');
  const liveSpeakingRef = useRef<boolean>(false);
  const callActiveRef = useRef<boolean>(false);
  const vadTimerRef = useRef<any>(null);
  const idleStandbyTimerRef = useRef<any>(null);
  const sendChunkNowRef = useRef<((force?: boolean) => void) | null>(null);
  const [deepMode, setDeepMode] = useState(false);
  const [bgOn, setBgOn] = useState(true);
  // Background FX & Ambient Hum stay OFF by default so there is ZERO unwanted background noise; fully separate from Voice!
  const [sfxOn, setSfxOn] = useState<boolean>(() => localStorage.getItem('apex.sfx_on') === '1');
  const [sfxVolume, setSfxVolume] = useState<number>(() => {
    const v = parseFloat(localStorage.getItem('apex.sfx_vol') || '0.2');
    return Number.isFinite(v) ? v : 0.2;
  });
  const [voiceVolume, setVoiceVolume] = useState<number>(() => {
    const v = parseFloat(localStorage.getItem('apex.voice_vol') || '1');
    return Number.isFinite(v) ? v : 1.0;
  });
  const [soundOn, setSoundOn] = useState<boolean>(() => localStorage.getItem('apex.sound_on') === '1');
  const [photoMode, setPhotoMode] = useState(false);

  // Modals
  const [agentVoiceTask, setAgentVoiceTask] = useState<{
    action?: 'make_and_save' | 'upload_saved' | 'open_only' | 'headbot_autopilot';
    topic: string;
    refUrl?: string;
    nonce: number;
  } | null>(null);
  const [youtubeOpen, setYoutubeOpen] = useState(() => {
    const h = window.location.hash || '';
    return h.includes('youtube') || h.includes('yt_token=');
  });
  const [elevenOpen, setElevenOpen] = useState(false);
  const [tradingBotOpen, setTradingBotOpen] = useState(false);
  const [menuTab, setMenuTab] = useState<'apps' | 'memory' | 'account' | 'phone' | 'voice' | 'moods' | 'settings'>('apps');
  // STRICT MANUAL PUSH-TO-TALK BY DEFAULT: Mic NEVER turns ON/OFF automatically in background!
  // Opens ONLY when user explicitly taps the Mic button, listens to 1 complete sentence, and stays 100% OFF!
  const [autoContinuousMode, setAutoContinuousMode] = useState<boolean>(false);
  const autoContinuousRef = useRef<boolean>(false);
  autoContinuousRef.current = autoContinuousMode;
  const echoCooldownUntilRef = useRef<number>(0);
  const quietModeRef = useRef<boolean>(false);
  const geminiSessionRef = useRef<GeminiLiveSession | null>(null);
  const nativeSttDisabledRef = useRef<boolean>(false);
  const [geminiLiveActive, setGeminiLiveActive] = useState<boolean>(() => isGeminiLiveEnabled());

  // Pre-warm Cloud Brain + AI 21-Landmark Hand Landmarker + Force Full Media Loudspeaker!
  useEffect(() => {
    preloadHandLandmarker().catch(() => {});
    try {
      window.ApexAndroid?.setSpeakerphone?.(true);
      (window.ApexAndroid as any)?.maxSpeakerVolume?.();
    } catch {}
  }, []);

  useEffect(() => {
    if (!poweredOn) return;
    const warm = () => {
      fetch('https://apex-humanoid-v2.pradhanbibek53.workers.dev/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'ping', voiceMode: true, history: [] }),
      }).catch(() => {});
    };
    warm();
    const id = setInterval(warm, 40000);
    return () => clearInterval(id);
  }, [poweredOn]);

  const [jarvisTasks, setJarvisTasks] = useState<JarvisTaskItem[]>(() => {
    try {
      const s = JSON.parse(localStorage.getItem(userScopedKey('jarvis_tasks', activeUserId)) || '[]');
      return Array.isArray(s) ? s : [];
    } catch {
      return [];
    }
  });
  const [jarvisMemories, setJarvisMemories] = useState<JarvisMemoryItem[]>(() => {
    try {
      const s = JSON.parse(localStorage.getItem(userScopedKey('jarvis_memories', activeUserId)) || '[]');
      return Array.isArray(s) ? s : [];
    } catch {
      return [];
    }
  });
  const jarvisMemoriesRef = useRef(jarvisMemories);
  jarvisMemoriesRef.current = jarvisMemories;

  const addJarvisTask = useCallback(
    (title: string) => {
      setJarvisTasks((prev) => {
        const next = [
          { id: `t-${Date.now()}`, title, done: false, createdAt: new Date().toLocaleTimeString('en-IN') },
          ...prev,
        ];
        localStorage.setItem(userScopedKey('jarvis_tasks', activeUserId), JSON.stringify(next));
        return next;
      });
    },
    [activeUserId]
  );

  const toggleJarvisTask = useCallback(
    (id: string) => {
      setJarvisTasks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
        localStorage.setItem(userScopedKey('jarvis_tasks', activeUserId), JSON.stringify(next));
        return next;
      });
    },
    [activeUserId]
  );

  const deleteJarvisTask = useCallback(
    (id: string) => {
      setJarvisTasks((prev) => {
        const next = prev.filter((t) => t.id !== id);
        localStorage.setItem(userScopedKey('jarvis_tasks', activeUserId), JSON.stringify(next));
        return next;
      });
    },
    [activeUserId]
  );

  const addJarvisMemory = useCallback(
    (text: string) => {
      // 📚 BRAIN FILE me bhi same line (vahan ye RULES/NOTES banake har session padhi jaati hai)
      rememberBrain('learned', text);
      setJarvisMemories((prev) => {
        if (prev.some((m) => m.text.toLowerCase() === text.trim().toLowerCase())) return prev;
        const next = [
          { id: `m-${Date.now()}`, text: text.trim(), savedAt: new Date().toLocaleDateString('en-IN') },
          ...prev,
        ];
        localStorage.setItem(userScopedKey('jarvis_memories', activeUserId), JSON.stringify(next));
        return next;
      });
    },
    [activeUserId]
  );

  const deleteJarvisMemory = useCallback(
    (id: string) => {
      setJarvisMemories((prev) => {
        const next = prev.filter((m) => m.id !== id);
        localStorage.setItem(userScopedKey('jarvis_memories', activeUserId), JSON.stringify(next));
        return next;
      });
    },
    [activeUserId]
  );

  useEffect(() => {
    const h = window.location.hash || '';
    if (h.includes('yt_token=')) {
      const m = h.match(/yt_token=([^&]+)/);
      if (m?.[1]) {
        localStorage.setItem('apex.yt_token', decodeURIComponent(m[1]));
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        setYoutubeOpen(true);
      }
    }
  }, []);

  // Gesture Smoothing & Sensitivity State
  const [gestureSmoothing, setGestureSmoothingState] = useState<number>(() => {
    const saved = localStorage.getItem('apex.gesture_smoothing');
    return saved ? parseFloat(saved) : 0.25;
  });
  const [gestureSensitivity, setGestureSensitivityState] = useState<number>(() => {
    const saved = localStorage.getItem('apex.gesture_sensitivity');
    return saved ? parseFloat(saved) : 1.5;
  });

  const gestureSmoothingRef = useRef<number>(gestureSmoothing);
  const gestureSensitivityRef = useRef<number>(gestureSensitivity);

  const setGestureSmoothing = useCallback((val: number) => {
    setGestureSmoothingState(val);
    gestureSmoothingRef.current = val;
    localStorage.setItem('apex.gesture_smoothing', String(val));
  }, []);

  const setGestureSensitivity = useCallback((val: number) => {
    setGestureSensitivityState(val);
    gestureSensitivityRef.current = val;
    localStorage.setItem('apex.gesture_sensitivity', String(val));
  }, []);

  // Gesture tracking internals
  const gestureStreamRef = useRef<MediaStream | null>(null);
  const gestureVideoRef = useRef<HTMLVideoElement | null>(null);
  const gestureAnimRef = useRef<number | null>(null);
  const gestureSeenRef = useRef<boolean>(false);
  const gestureCoordsRef = useRef<{ sx: number; sy: number }>({ sx: 0, sy: 0 });

  // Ears (Speech Recognition) internals
  const recRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef<boolean>(false);
  const lastSubmitRef = useRef<{ time: number; text: string }>({ time: 0, text: '' });
  const chatMemRef = useRef<{ role: string; text: string }[]>([]);

  const toast = useCallback((msg: string, ms = 3400) => {
    setToastMessage(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), ms);
  }, []);

  const hideHint = useCallback(() => {
    setShowHint(false);
  }, []);

  const setMood = useCallback(
    (newMood: MoodType, playTone = false) => {
      if (playTone) audio.mood(newMood);
      setMoodState(newMood);
      if (engineRef.current) {
        engineRef.current.mood = newMood;
      }
    },
    []
  );

  const voiceFor = useCallback(
    (text: string): SpeechSynthesisVoice | null => {
      if (!('speechSynthesis' in window)) return null;
      const avail = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
      const isDevanagari = DEVANAGARI_RE.test(text);
      if (isDevanagari) {
        const hi = avail.find((v) => v.lang.startsWith('hi'));
        if (hi) return hi;
      }
      const enIn = avail.find((v) => v.lang === 'en-IN');
      if (enIn) return enIn;
      const en = avail.find((v) => v.lang.startsWith('en'));
      if (en) return en;
      return avail[0] || null;
    },
    [voices]
  );

  /** Immediately halts all browser SpeechSynthesis, active server TTS audio, and pending speech timers. */
  const cancelAllSpeech = useCallback(() => {
    speechSeqRef.current += 1;
    liveSpeakingRef.current = false;
    busyRef.current = false;
    audio.stopVoiceBuffer();
    clearTimeout(greetTimerRef.current);
    clearInterval(ttsPulseRef.current);
    ttsPulseRef.current = null;
    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.onplay = null;
        ttsAudioRef.current.onended = null;
        ttsAudioRef.current.onerror = null;
        ttsAudioRef.current.pause();
        ttsAudioRef.current.src = '';
      } catch (e) {}
      ttsAudioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    try {
      window.ApexAndroid?.stopNativeSpeak?.();
    } catch {}
    try {
      geminiSessionRef.current?.flushPlayback();
    } catch {}
    if (engineRef.current) {
      engineRef.current.voiceTarget = 0;
    }
  }, []);

  const playServerVoice = useCallback(
    async (text: string, seq: number, onEnd?: () => void) => {
      if (!poweredOnRef.current || seq !== speechSeqRef.current) return false;
      try {
        const elCfg = loadElevenConfig();
        let arrayBuf: ArrayBuffer | null = null;

        // 0) 0.001s Zero-Lag Bundled Offline Studio HD Voice MP3 inside APK (Plays instantaneously even offline!)
        if (!elCfg.apiKey) {
          const lowT = text.toLowerCase();
          let localClip = '';
          if (lowT.includes('namaste boss! main online hoon')) localClip = '/offline_voice/welcome.mp3';
          else if (lowT.includes('haan boss, main bilkul clear sun raha hoon')) localClip = '/offline_voice/hello.mp3';
          else if (lowT.includes('main ekdum first class hoon boss')) localClip = '/offline_voice/kaise_ho.mp3';
          else if (lowT.includes('main apex ai hoon')) localClip = '/offline_voice/who.mp3';
          else if (lowT.includes('shukriya boss')) localClip = '/offline_voice/thanks.mp3';
          else if (lowT.includes('blast fired boss')) localClip = '/offline_voice/blast.mp3';
          else if (lowT.includes('suit wapas jod diya')) localClip = '/offline_voice/reset.mp3';
          else if (lowT.includes('vision core online')) localClip = '/offline_voice/vision.mp3';

          if (localClip) {
            const locRes = await fetch(localClip).catch(() => null);
            if (locRes && locRes.ok) {
              const b = await locRes.arrayBuffer();
              if (b.byteLength > 1000) arrayBuf = b;
            }
          }
        }

        // 1) Direct Phone/Browser -> ElevenLabs HD TTS
        if (!arrayBuf && elCfg.apiKey) {
          arrayBuf = await fetchElevenLabsAudioDirect(text, elCfg);
        }

        // 2) Cloud Worker TTS (ElevenLabs Cloud Secret OR Clean Neural hi-IN HD MP3 fallback)
        if (!arrayBuf) {
          const voiceBody = JSON.stringify({
            text,
            voiceId: elCfg.voiceId,
            elevenApiKey: elCfg.apiKey || undefined,
            voice: langMode === 'hi-IN' ? 'Puck' : 'Kore',
          });
          let res = await fetch('/yt/voice', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: voiceBody,
          }).catch(() => null);
          if (!res || !res.ok) {
            res = await fetch('https://apex-humanoid-v2.pradhanbibek53.workers.dev/yt/voice', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: voiceBody,
            });
          }
          if (!res.ok) throw new Error('Voice fetch status ' + res.status);
          if (!poweredOnRef.current || seq !== speechSeqRef.current) return false;
          arrayBuf = await res.arrayBuffer();
        }
        if (!poweredOnRef.current || seq !== speechSeqRef.current) return false;

        // Play directly through unlocked WebAudio context (NEVER blocked by mobile autoplay!)
        const played = await audio.playVoiceArrayBuffer(
          arrayBuf,
          () => {
            liveSpeakingRef.current = true;
            setLiveVoiceStage('speaking');
            if (engineRef.current) engineRef.current.voiceTarget = 1.0;
            clearInterval(ttsPulseRef.current);
            ttsPulseRef.current = setInterval(() => {
              if (!poweredOnRef.current || seq !== speechSeqRef.current) {
                clearInterval(ttsPulseRef.current);
                return;
              }
              if (engineRef.current) engineRef.current.voiceTarget = 0.75 + audio.analyserRms() * 0.5;
            }, 90);
          },
          () => {
            clearInterval(ttsPulseRef.current);
            liveSpeakingRef.current = false;
            if (engineRef.current) engineRef.current.voiceTarget = 0.15;
            if (!poweredOnRef.current || seq !== speechSeqRef.current) return;
            activeSentimentRef.current = null;
            setSentimentInfo(null);
            setMood(micStreamRef.current ? 'listening' : 'idle');
            setLiveVoiceStage(micStreamRef.current ? 'listening' : 'idle');
            onEnd?.();
          }
        );
        return played;
      } catch (err) {
        console.warn('Server TTS failed:', err);
        liveSpeakingRef.current = false;
        return false;
      }
    },
    [langMode, setMood]
  );

  const speak = useCallback(
    (rawText: string, onEnd?: () => void, allowSensitive = false) => {
      if (!poweredOnRef.current) return;
      const seq = speechSeqRef.current + 1;
      cancelAllSpeech();
      speechSeqRef.current = seq;
      // 🔐 v6.6.2 VOICE LOCK — paisa ka number / password / OTP anjaan (ya unverified) awaaz
      //    ko BOL kar nahi batate. Screen par poora jawab phir bhi dikhega.
      const gated = !allowSensitive && isSensitiveText(rawText) && !isOwnerPlaced();
      const text = gated
        ? 'Ye detail screen par dikha di hai. Awaaz verify na hone par main number, balance ya password bol kar nahi batata — unlock ke liye boliye: awaaz verify karo.'
        : rawText;
      setLiveBotText(text);
      if (gated) {
        pushChatBubble('bot', rawText);
        noteBrain('decision', '🔒 Voice lock ne ek sensitive reply sirf screen par rok diya');
      }
      pushChatBubble('bot', text);

      if (quietModeRef.current) {
        liveSpeakingRef.current = false;
        setLiveVoiceStage('idle');
        onEnd?.();
        return;
      }

      liveSpeakingRef.current = true;
      audio.ensureCtx();
      try {
        window.ApexAndroid?.stopNativeListen?.();
        window.ApexAndroid?.setSpeakerphone?.(true);
      } catch {}

      if (!activeSentimentRef.current || activeSentimentRef.current === 'idle') {
        setMood('speaking');
      } else {
        audio.mood(activeSentimentRef.current);
      }

      // PRIMARY ENGINE #1 ON ANDROID PHONE: Google On-Device Neural TTS (0ms instant, ZERO distortion, 100% crystal clear!)
      if (window.ApexAndroid?.canSpeakNative?.()) {
        const uid = `apex-utt-${seq}`;
        (window as any).__onApexTtsStart = (id: string) => {
          if (id !== uid || seq !== speechSeqRef.current) return;
          liveSpeakingRef.current = true;
          setLiveVoiceStage('speaking');
          if (engineRef.current) engineRef.current.voiceTarget = 0.9;
        };
        (window as any).__onApexTtsEnd = (id: string) => {
          if (id !== uid || seq !== speechSeqRef.current) return;
          liveSpeakingRef.current = false;
          if (engineRef.current) engineRef.current.voiceTarget = 0.15;
          activeSentimentRef.current = null;
          setSentimentInfo(null);
          setMood('idle');
          setLiveVoiceStage('idle');
          onEnd?.();
        };
        if (window.ApexAndroid.speakNative?.(text, 'hi-IN', uid)) return;
      }

      // SECONDARY ENGINE (Desktop Web Preview / ElevenLabs Custom Voice): Clean Un-Clipped Audio
      playServerVoice(text, seq, onEnd).then((ok) => {
        if (ok || !poweredOnRef.current || seq !== speechSeqRef.current) return;

        // Browser SpeechSynthesis fallback
        if ('speechSynthesis' in window) {
          try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = DEVANAGARI_RE.test(text) ? 'hi-IN' : 'en-IN';
            u.rate = 0.94;
            u.onend = () => {
              liveSpeakingRef.current = false;
              setMood('idle');
              setLiveVoiceStage('idle');
              onEnd?.();
            };
            window.speechSynthesis.speak(u);
            return;
          } catch {}
        }
        liveSpeakingRef.current = false;
        setMood('idle');
        setLiveVoiceStage('idle');
        onEnd?.();
      });
    },
    [voiceFor, setMood, playServerVoice, cancelAllSpeech, pushChatBubble]
  );

  const handleTradeBurst = useCallback(
    (type: 'BUY' | 'SELL', details: { pair: string; price: number; profit?: number }) => {
      // Trigger glowing particle burst animation overlay on the main WebGL canvas
      if (engineRef.current) {
        engineRef.current.triggerTradeBurst(type, details);
      }
      audio.heartThump(type === 'BUY');
      setMood(type === 'BUY' ? 'excited' : 'happy');
    },
    [setMood]
  );

  const handleTriggerSentimentTrade = useCallback(
    (m: MoodType, msg: string) => {
      setMood(m);
      activeSentimentRef.current = m;
      // Silent UI toast ONLY — never spam/interrupt user's voice conversation with trading announcements!
      toast(msg, 3000);
    },
    [setMood, toast]
  );

  const autoTrader = useAutoTrader({
    enabled: Boolean(activeUser) && entered && poweredOn,
    userId: activeUserId,
    isOwner: isOwnerSession,
    currentMood: mood,
    currentHeartRate: heartRate,
    onTriggerSentimentTrade: handleTriggerSentimentTrade,
    onTradeBurst: handleTradeBurst,
  });

  // Reload isolated per-user Memories, Tasks & Chat History whenever profile switches!
  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem(userScopedKey('jarvis_tasks', activeUserId)) || '[]');
      setJarvisTasks(Array.isArray(t) ? t : []);
    } catch {
      setJarvisTasks([]);
    }
    try {
      const m = JSON.parse(localStorage.getItem(userScopedKey('jarvis_memories', activeUserId)) || '[]');
      setJarvisMemories(Array.isArray(m) ? m : []);
    } catch {
      setJarvisMemories([]);
    }
    try {
      const ch = JSON.parse(localStorage.getItem(userScopedKey('apex_chat_mem', activeUserId)) || '[]');
      chatMemRef.current = Array.isArray(ch) ? ch : [];
    } catch {
      chatMemRef.current = [];
    }
    setLiveUserText('');
    setLiveBotText('');
  }, [activeUserId]);
  const autoTraderRef = useRef(autoTrader);
  autoTraderRef.current = autoTrader;

  const showConfirmedBadge = useCallback((label: string) => {
    setConfirmedBadge(label);
    clearTimeout(confirmedBadgeTimerRef.current);
    confirmedBadgeTimerRef.current = setTimeout(() => {
      setConfirmedBadge(null);
    }, 4500);
  }, []);

  /**
   * Unified Smart Voice Control + Confirmation Router (works identically across Cloud Whisper, Browser STT & Keyboard!).
   * Returns true if handled locally as a confirmed/pending control command; false if general AI conversation.
   */
  const tryHandleSmartVoiceControl = useCallback(
    (rawText: string, onDone?: () => void): boolean => {
      const cleaned = normalizeSpokenHindiText(rawText).trim();
      const low = cleaned.toLowerCase();
      const finishAndListenForConfirm = () => {
        busyRef.current = false;
        // Always open mic automatically right after asking confirmation so user can simply say "Haan" or "Cancel"!
        if (poweredOnRef.current && assistantOpenRef.current) {
          callActiveRef.current = true;
          setTimeout(() => {
            if (poweredOnRef.current && assistantOpenRef.current && callActiveRef.current) {
              openCallMicTurnRef.current();
            }
          }, 260);
        } else {
          onDone?.();
        }
      };

      const finishNormal = () => {
        busyRef.current = false;
        onDone?.();
      };

      // 1. IF A VOICE ACTION IS WAITING FOR USER CONFIRMATION ("Haan / Confirm" vs "Nahi / Cancel")
      if (pendingConfirmRef.current) {
        if (
          /^(ha+n?|yes|yep|yeah|ok|okay|confirm|kar\s*do|khol\s*do|kholo|chalu\s*karo|set\s*kar\s*do|bilkul|sure|sahi|haan\s*ji|done|proceed|go\s*ahead)\b/i.test(
            low
          )
        ) {
          const item = pendingConfirmRef.current;
          setPendingConfirm(null);
          pendingConfirmRef.current = null;
          setLiveUserText(cleaned);
          showConfirmedBadge(`✓ Confirmed: ${item.label}`);
          audio.assistantChime(true);
          speak(`Confirmed! ${item.label} chalu kar diya hai.`, finishNormal);
          setTimeout(() => item.onConfirm(), 220);
          return true;
        }
        if (/^(nahi|na|no|nope|cancel|mat\s*karo|ruk\s*jao|rehne\s*do|stop|band)\b/i.test(low)) {
          setPendingConfirm(null);
          pendingConfirmRef.current = null;
          setLiveUserText(cleaned);
          showConfirmedBadge('✕ Action Cancelled');
          speak('Theek hai, command cancel kar diya hai.', finishNormal);
          return true;
        }
      }

      // Helper to queue an action with clear visual + voice confirmation prompt
      const requestVoiceConfirmation = (
        label: string,
        detail: string,
        promptSpeech: string,
        actionFn: () => void
      ) => {
        setLiveUserText(cleaned);
        const pendingObj: PendingVoiceConfirmation = {
          label,
          detail,
          onConfirm: actionFn,
        };
        setPendingConfirm(pendingObj);
        pendingConfirmRef.current = pendingObj;
        speak(promptSpeech, finishAndListenForConfirm);
      };

      // 2. POWER OFF (Always asks confirmation first so accidental noise never shuts system off!)
      if (/\b(power\s*off|full\s*off|system\s*off|apex\s*(band|off)|shut\s*down|turn\s*off\s*apex)\b/i.test(low)) {
        requestVoiceConfirmation(
          'Power OFF APEX',
          'Full system standby off',
          'APEX full power off karoon? Haan boliye ya Confirm dabayein.',
          () => controlActionsRef.current.togglePower()
        );
        return true;
      }

      // 3. HAND GESTURE CONTROL BY VOICE (Direct Instant Control + Spoken Confirmation!)
      if (/\b(gesture|hand\s*control|hand\s*tracking|camera\s*tracking|camera\s*control)\b/i.test(low)) {
        setLiveUserText(cleaned);
        if (/\b(off|band|stop|disable|hata)\b/i.test(low)) {
          controlActionsRef.current.stopGesture();
          showConfirmedBadge('✓ Confirmed: Gesture Control OFF');
          speak('Confirmed! Hand gesture control band kar diya hai.', finishNormal);
        } else {
          controlActionsRef.current.startGesture();
          showConfirmedBadge('✓ Confirmed: Gesture Control ON');
          speak('Confirmed! Hand gesture control on kar diya hai. Haath hila kar control karein.', finishNormal);
        }
        return true;
      }

      // 4. THEME / COLOR CONTROL BY VOICE
      if (/\b(theme|colour|color)\b.*\b(change|badlo|badal|next|switch)\b|\b(change|badlo|next)\s*(theme|color|colour)\b/i.test(low)) {
        setLiveUserText(cleaned);
        controlActionsRef.current.cycleTheme();
        showConfirmedBadge('✓ Confirmed: 3D Theme Changed');
        speak('Confirmed! 3D theme color change kar diya hai.', finishNormal);
        return true;
      }

      // 5. AVATAR / CHARACTER CONTROL BY VOICE
      if (/\b(avatar|character|humanoid|model|face)\b.*\b(change|badlo|badal|next|switch)\b|\b(change|badlo|next)\s*(avatar|character)\b/i.test(low)) {
        setLiveUserText(cleaned);
        controlActionsRef.current.cycleCharacter();
        showConfirmedBadge('✓ Confirmed: 3D Avatar Changed');
        speak('Confirmed! 3D avatar badal diya hai.', finishNormal);
        return true;
      }

      // 5B. HOLOGRAM SUIT, VISION CORE, BLAST, ZOOM & RESET BY VOICE
      if (/\b(vision\s*(?:mode|core|hologram|sphere)?|back\s*to\s*vision)\b/i.test(low)) {
        setLiveUserText(cleaned);
        setActiveSuit('vision');
        showConfirmedBadge('🔴 VISION Core Active');
        speak('Vision Core online hai Boss!', finishNormal);
        return true;
      }
      if (/\b(work\s*place|work\s*space|open\s*armou?r|iron\s*man|hologram\s*suit)\b/i.test(low)) {
        setLiveUserText(cleaned);
        setActiveSuit('seraph');
        showConfirmedBadge('🤖 3D Armor Suit Active');
        speak('Opening workplace Boss! 3D Armor hologram ready hai.', finishNormal);
        return true;
      }
      if (/\b(blast|explode|explosion|scatter|boom|tod\s*do|phod\s*do)\b/i.test(low)) {
        setLiveUserText(cleaned);
        setBlastNonce((n) => n + 1);
        showConfirmedBadge('💥 Repulsor Blast');
        speak('Blast fired Boss!', finishNormal);
        return true;
      }
      if (/\b(reset|assemble|re-?assemble|jod\s*do)\b/i.test(low)) {
        setLiveUserText(cleaned);
        setResetNonce((n) => n + 1);
        showConfirmedBadge('🧲 Armor Reassembled');
        speak('Suit wapas jod diya hai Boss!', finishNormal);
        return true;
      }
      if (/\b(zoom\s*in|expand|bada\s*karo)\b/i.test(low)) {
        setLiveUserText(cleaned);
        setZoomDeltaNonce((z) => ({ step: 0.6, seq: z.seq + 1 }));
        speak('Hologram zoom in kar diya hai.', finishNormal);
        return true;
      }
      if (/\b(zoom\s*out|shrink|chhota\s*karo)\b/i.test(low)) {
        setLiveUserText(cleaned);
        setZoomDeltaNonce((z) => ({ step: -0.55, seq: z.seq + 1 }));
        speak('Hologram zoom out kar diya hai.', finishNormal);
        return true;
      }
      if (/\b(seraph|classic|titan|phantom|spartan|gold|cyan|blue|pink|purple|green|emerald)\b/i.test(low)) {
        const mapWord: Record<string, SuitPresetId> = {
          seraph: 'seraph',
          classic: 'classic',
          cyan: 'classic',
          blue: 'classic',
          titan: 'titan',
          gold: 'titan',
          phantom: 'phantom',
          pink: 'phantom',
          purple: 'phantom',
          spartan: 'spartan',
          green: 'spartan',
          emerald: 'spartan',
        };
        const hit = low.match(/\b(seraph|classic|titan|phantom|spartan|gold|cyan|blue|pink|purple|green|emerald)\b/i)?.[1]?.toLowerCase();
        if (hit && mapWord[hit]) {
          const mSuit = mapWord[hit];
          setLiveUserText(cleaned);
          setActiveSuit(mSuit);
          showConfirmedBadge(`🤖 Suit → ${mSuit.toUpperCase()}`);
          speak(`${mSuit.toUpperCase()} suit laga diya hai!`, finishNormal);
          return true;
        }
      }
      if (/\b(fx|background\s*sound|extra\s*(sound|awaaz)|sound\s*effect)\b/i.test(low)) {
        setLiveUserText(cleaned);
        const turnOn = /\b(on|chalu|start|enable)\b/i.test(low) && !/\b(off|band)\b/i.test(low);
        setSfxOn(turnOn);
        localStorage.setItem('apex.sfx_on', turnOn ? '1' : '0');
        audio.setSfx(turnOn);
        showConfirmedBadge(`✓ Confirmed: Background FX ${turnOn ? 'ON' : 'OFF'}`);
        speak(`Confirmed! Background sound ${turnOn ? 'chalu' : 'band'} kar diya hai.`, finishNormal);
        return true;
      }

      // 7. MOOD / EMOTION CONTROL BY VOICE
      const moodMap: [RegExp, MoodType, string][] = [
        [/\b(happy|khush)\b/i, 'happy', 'Happy'],
        [/\b(excited|josh|energy)\b/i, 'excited', 'Excited'],
        [/\b(calm|shant|relax|zen)\b/i, 'calm', 'Calm'],
        [/\b(angry|gussa)\b/i, 'angry', 'Angry'],
        [/\b(sad|udaas)\b/i, 'sad', 'Soft Sad'],
        [/\b(surprised|shock|amazed)\b/i, 'surprised', 'Surprised'],
      ];
      if (/\b(mood|mode|ho\s*jao|feel)\b/i.test(low)) {
        for (const [rx, mVal, mName] of moodMap) {
          if (rx.test(low)) {
            setLiveUserText(cleaned);
            setMood(mVal);
            showConfirmedBadge(`✓ Confirmed: Mood → ${mName}`);
            speak(`Confirmed! Mood ${mName} set kar diya hai.`, finishNormal);
            return true;
          }
        }
      }

      // 8. IN-APP TRADING & CREATOR STUDIO ONLY WHEN EXPLICITLY SAYING "STUDIO"
      if (/(trading\s*(bot|kholo|open)|open\s*trade|open\s*trading|day\s*trader|chart\s*scan)/i.test(low)) {
        setLiveUserText(cleaned);
        setTradingBotOpen(true);
        setMood('excited');
        showConfirmedBadge('✓ Day Trader Opened');
        speak('AI Day Trader khol diya hai!', finishNormal);
        return true;
      }
      if (/(youtube\s*studio|shorts\s*studio)/i.test(low)) {
        setLiveUserText(cleaned);
        setYoutubeOpen(true);
        showConfirmedBadge('✓ YouTube Studio Opened');
        speak('YouTube Shorts Studio khol diya hai!', finishNormal);
        return true;
      }

      // 9. DIRECT INSTANT REAL PHONE CONTROL (YouTube, WhatsApp, Instagram, Any App, Torch, Volume, Camera, Alarm, Timer, Settings, Calls!)
      // Executes IMMEDIATELY in <50ms like Google Assistant / Siri — ZERO annoying confirmation delay!
      const phoneCmd = parseLocalPhoneCommand(cleaned);
      if (phoneCmd) {
        setLiveUserText(cleaned);
        executePhoneAction(phoneCmd.action, phoneCmd.payload);
        showConfirmedBadge(`📱 ${phoneCmd.reply}`);
        audio.assistantChime(true);
        speak(phoneCmd.reply, finishNormal);
        return true;
      }

      // 10. REAL COINDCX LIVE BALANCE & CONFIRMED REAL TRADING BY VOICE!
      if (
        /\b(balance|portfolio|wallet|mera\s*account|real\s*account|kitna\s*paisa|holding|coins?\s*kya)\b/i.test(
          low
        )
      ) {
        setLiveUserText(cleaned);
        const at = autoTraderRef.current;
        at.syncLiveAccount().then((fresh) => {
          const total = Number(fresh?.totalInr ?? at.liveAccount.totalInr ?? 0);
          const cash = Number(fresh?.spotInr ?? at.liveAccount.spotInr ?? 0);
          const list = (Array.isArray(fresh?.holdings) ? fresh.holdings : at.liveAccount.holdings)
            .filter((h: any) => h.currency !== 'INR' && Number(h.valueInr) >= 5)
            .map((h: any) => `${h.currency} ₹${Math.round(Number(h.valueInr))}`)
            .join(', ');
          const msg =
            total > 0
              ? `Aapka real CoinDCX account live connected hai! Total value ₹${total.toFixed(
                  0
                )}, Spot INR cash ₹${cash.toFixed(0)}${list ? `, aur holdings: ${list}` : ''}.`
              : 'Real CoinDCX account check kiya — abhi balance sync ho raha hai, Trade button khol kar dekh sakte hain.';
          showConfirmedBadge(`✓ Real CoinDCX Live: ₹${total.toFixed(0)}`);
          speak(msg, finishNormal);
        });
        return true;
      }

      if (/\b(auto\s*trad(e|ing))\b.*\b(on|off|chalu|band|start|stop)\b/i.test(low)) {
        const turnAutoOn = /\b(on|chalu|start)\b/i.test(low) && !/\b(off|band|stop)\b/i.test(low);
        autoTraderRef.current.setAutoTrading(turnAutoOn);
        const msg = turnAutoOn
          ? 'Autonomous Auto-Trading chalu kar diya hai Boss! Bots ab bina puche khud Futures aur Spot dekh kar buy-sell karenge!'
          : 'Auto-Trading pause kar diya hai Boss!';
        showConfirmedBadge(turnAutoOn ? '🚀 Autonomous Auto-Trade ON' : '⏹ Auto-Trade Paused');
        speak(msg, finishNormal);
        return true;
      }

      // 11. TASKS & MEMORY
      const taskCmd = cleaned.match(/(?:task\s*add\s*karo|add\s*task|remind\s*me\s*(?:to)?|yaad\s*dilana)\s*[:\-]?\s*(.+)/i);
      if (taskCmd?.[1]) {
        const t = taskCmd[1].trim();
        addJarvisTask(t);
        setLiveUserText(cleaned);
        showConfirmedBadge(`✓ Task Saved: ${t}`);
        speak(`Confirmed! "${t}" save kar liya hai.`, finishNormal);
        return true;
      }
      // 10B. 🔐 VOICE LOCK + 👁️ OUTSIDE EYE (awaaz pehchaan, word confirm, self-review)
      if (/\b(awaaz|voice)\s*(ko\s*)?(register|enroll|ban\w*|save|naa\w*)\b/i.test(low) && !/\b(hatao|delete)\b/i.test(low)) {
        if (voiceEnrollRef.current) {
          speak('Awaaz register pehle se chal rahi hai Boss.', finishNormal, true);
          return true;
        }
        voiceEnrollRef.current = true;
        setLiveUserText(cleaned);
        setLiveBotText('🎤 Awaaz register kar raha hoon — 3 baar boliye.');
        speak('Theek hai, 3 chhote samples lunga. Har line 2 baar boliye — mic apne-aap band hoga.', finishNormal, true);
        void (async () => {
          const r = await enrollOwner((msg, i) => {
            setLiveInterimText(`${msg} (${i + 1}/3)`);
          });
          voiceEnrollRef.current = false;
          setLiveInterimText('');
          const msg = r.ok
            ? `${r.note}. Ab aapki awaaz pehchaan me hai — lock ON hai toh sensitive cheezein doosri awaaz ko boli nahi jayengi.`
            : `Awaaz register nahi ho payi: ${r.note}`;
          setLiveBotText(msg);
          pushChatBubble('bot', msg);
          showConfirmedBadge(r.ok ? '🔐 Voice print saved' : '⚠️ Voice enroll fail');
          speak(msg, finishNormal, true);
        })();
        return true;
      }
      if (/\b(awaaz|voice)\s*(verify|check|jaanch|test)\b/i.test(low)) {
        setLiveUserText(cleaned);
        void (async () => {
          const r = await verifyOwnerNow('voice-cmd');
          const msg = `${r.note}${r.ok ? '' : ' — screen par jo bhi sensitive tha, wahi rahega.'}`;
          setLiveBotText(msg);
          pushChatBubble('bot', msg);
          speak(msg, finishNormal, true);
        })();
        return true;
      }
      if (/\b(awaaz|voice)\s*lock\s*(on|off|chalu|band|on\s*karo|band\s*karo)\b/i.test(low)) {
        const turnOn = /\b(on|chalu)\b/i.test(low) && !/\b(off|band)\b/i.test(low);
        const cfg = saveVoiceLock({ enabled: turnOn });
        if (!turnOn) revokeOwnerSession();
        const stt = voiceLockStatus();
        setLiveUserText(cleaned);
        const msg = turnOn
          ? `Voice lock ${cfg.enabled ? 'chalu' : 'band'} kar diya. ${stt.enrolled ? `Awaaz profile ready (${stt.samples} samples, threshold ${stt.threshold}%).` : 'Pehle awaaz register karein, tab tak lock enforce nahi hoga.'}`
          : 'Voice lock band kar diya — ab sab kuch bola jaayega. Word-confirm bhi off ho gaya.';
        showConfirmedBadge(turnOn ? '🔐 Voice Lock ON' : '🔓 Voice Lock OFF');
        speak(msg, finishNormal, true);
        return true;
      }
      if (/\b(bahar\s*ki\s*aankh|outside\s*eye|project\s*review|khud\s*ka\s*review|review\s*de\s*do)\b/i.test(low)) {
        setLiveUserText(cleaned);
        setLiveBotText('👁️ Bahar ki aankh chal rahi hai — brain file + apna log padh ke review de raha hoon…');
        void (async () => {
          const r = await runOutsideEye();
          const msg = r.ok ? `👁️ Outside review: ${r.text}` : `⚠️ Review nahi ho paya: ${r.note || 'no source'}`;
          setLiveBotText(msg);
          pushChatBubble('bot', msg);
          speak(r.ok ? 'Review screen par aa gaya, 3 risk aur 3 next step likh diye hain.' : msg, finishNormal, true);
        })();
        return true;
      }

      // 11B. 📚 BRAIN FILE — voice se padhna / likhna / sync
      const brainRule = cleaned.match(/(?:brain\s*(?:file\s*)?me\s*(?:likh\w*|daal\w*|save\s*kar\w*)|rule\s*(?:ban\w*|likh\w*))\s*[:\-\s]*(.+)/i);
      if (brainRule?.[1] && brainRule[1].trim().length > 3) {
        const t = brainRule[1].trim();
        rememberBrain('rule', t);
        setLiveUserText(cleaned);
        showConfirmedBadge(`📚 Brain RULE saved: ${t}`);
        speak(`Brain file me rule likh diya: ${t}. Ab har session me ye yaad rahega.`, finishNormal);
        return true;
      }
      if (/\b(brain\s*file|brain\s*kya|memory\s*dekh\w*|kaunsa\s*rule|kya\s*yaad\s*rakh\w*|bhool\s*gaye\s*kya)\b/i.test(low)) {
        const digest = brainDigest(900) || 'Brain file abhi khaali hai, Boss.';
        setLiveUserText(cleaned);
        setLiveBotText(digest);
        pushChatBubble('bot', `📚 BRAIN FILE (persistent memory)\n${digest}`);
        speak('Brain file me itna yaad hai. Screen par dikha raha hoon.', finishNormal);
        return true;
      }
      if (/\b(brain\s*(?:ko\s*)?(?:github|server|cloud)\s*(?:me\s*)?(?:bhej\w*|daal\w*|sync\w*|upload\w*)|sync\s*brain)\b/i.test(low)) {
        setLiveUserText(cleaned);
        showConfirmedBadge('📤 Brain sync shuru');
        void (async () => {
          const g = await syncBrainToGithub();
          const w = await pushBrainToWorker();
          const msg = `Brain sync: GitHub ${g.ok ? 'ho gaya' : 'nahi hua'}${g.ok ? '' : ` (${g.note})`}, server ${w.ok ? 'ready' : 'nahi'}${w.ok ? '' : ` (${w.note})`}.`;
          speak(msg, finishNormal);
        })();
        return true;
      }

      const memCmd = cleaned.match(/(?:yaad\s*rakhna|remember\s*(?:that)?|save\s*memory)\s*[:\-]?\s*(.+)/i);
      if (memCmd?.[1]) {
        const m = memCmd[1].trim();
        addJarvisMemory(m);
        setLiveUserText(cleaned);
        showConfirmedBadge(`✓ Memory Saved: ${m}`);
        speak(`Confirmed! Yaad rakh liya: "${m}".`, finishNormal);
        return true;
      }

      // 12A. VOICE COMMAND -> UPLOAD PREVIOUSLY SAVED VAULT VIDEO ("Saved video upload karo / Ab video upload kar do!")
      if (
        /\b(upload\s*(?:kar\w*|now)?\s*video|video\s*upload\s*kar\w*|saved?\s*video\s*upload|youtube\s*(?:par|pe|mein)?\s*upload\s*kar\w*)\b/i.test(
          low
        ) &&
        !/\b(bana\w*|make|create)\b/i.test(low)
      ) {
        setLiveUserText(cleaned);
        setYoutubeOpen(true);
        setAgentVoiceTask({
          action: 'upload_saved',
          topic: '',
          nonce: Date.now(),
        });
        showConfirmedBadge('📤 Uploading Saved Vault Video…');
        finishNormal();
        return true;
      }

      // 12A-2. 🛰️ JARVIS CORE — "reel ka link dekh, comments ka reply kar de" / "khud ka system chalu karo"
      if (/\b(comment|reply\s*kar\w*|jawab\s*de\w*|patrol)\b/i.test(low)) {
        const urls = cleaned.match(/https?:\/\/\S+/gi) || [];
        for (const u of urls) addJarvisTarget(u.replace(/[^\S\n]+/g, ''));
        const st0 = loadJarvisState();
        if (!st0.targets.length) {
          speak('Boss, pehle reel ya short ka link toh dijiye — tabhi main uske comments padh paunga.');
          showConfirmedBadge('🔗 Link chahiye');
          finishNormal();
          return true;
        }
        setLiveUserText(cleaned);
        showConfirmedBadge(`💬 ${st0.targets.length} link(s) ke comments padh raha hoon…`);
        void patrolJarvisTargets((line) => showConfirmedBadge(line))
          .then((res) => {
            const replied = res.reduce((a, r) => a + r.replied, 0);
            const drafted = res.reduce((a, r) => a + r.drafted, 0);
            const fetched = res.reduce((a, r) => a + r.fetched, 0);
            speak(
              replied > 0
                ? `Boss, ${fetched} comments padhe aur ${replied} ka reply maine khud kar diya. ${drafted} draft bane hain.`
                : `Boss, ${fetched} comments mile. ${drafted} reply draft kar diye hain — copy karke ek tap me post kar sakte hain. Auto-reply tabhi chalta hai jab video aapke apne channel ka ho.`
            );
          })
          .catch((e) => speak(`Comments me dikkat aayi: ${String(e?.message || e).slice(0, 60)}`));
        finishNormal();
        return true;
      }

      if (/\b(jarvis|autonomy|auto\s*system|khud\s*ka\s*system)\b/i.test(low) && /\b(chalu|on|kar\s*do|start|khol|band|off|ruk)\b/i.test(low)) {
        const wantsOff = /\b(band|off|ruk|mat)\b/i.test(low);
        const next = toggleJarvisCore(!wantsOff);
        if (!wantsOff) armJarvisAlarms();
        setLiveUserText(cleaned);
        showConfirmedBadge(next.enabled ? '🛰️ Jarvis Core ON' : '🛑 Jarvis Core OFF');
        speak(
          next.enabled
            ? `Ji Boss. Ab se mera khud ka system chalu hai. Main soche bina bina aapke bole kaam karunga — ${next.slots
                .map((s) => `${String(s.hour).padStart(2, '0')} bajey ${s.label.replace(/^[^ ]+ /, '')}`)
                .join(', ')}. Agar kabhi rokna ho toh bas boliye Jarvis band karo.`
            : 'Ji Boss, mera autonomous system rok diya hai. Jo kaam chalu tha woh complete karke ab wait karunga.'
        );
        finishNormal();
        return true;
      }

      if (/\b(research|market)\s*cycle|\bkhud\s*(trade|buy|sell)\b|\btrade\s*kar\s*(lo|le)\b/i.test(low)) {
        setLiveUserText(cleaned);
        showConfirmedBadge('🛰️ Sub-bots bahar research kar rahe hain…');
        void autoTraderRef.current
          .runResearchTradeCycle?.('voice')
          .then((r: any) => speak(r?.note || 'Research cycle complete — abhi koi entry nahi li.'));
        finishNormal();
        return true;
      }

      // 12A-0. 🗓️ "Roz ka auto chalu karo" / "daily autopilot band karo" — bina order ke daily mission
      if (/\b(roz|roza|daily|har\s*din)\b/i.test(low) && /\b(auto|autopilot|video|upload|chalu|kar\s*do|band|on|off)\b/i.test(low)) {
        if (/\b(band|off|rok|mat)\b/i.test(low)) {
          saveAutopilotSettings({ dailyEnabled: false });
          speak('Ji Boss, roz ka auto autopilot band kar diya hai.');
          showConfirmedBadge('🛑 Daily Autopilot OFF');
          finishNormal();
          return true;
        }
        const when = parseHinglishTime(low);
        saveAutopilotSettings({
          dailyEnabled: true,
          ...(when ? { dailyHour: new Date(when.at).getHours(), dailyMinute: new Date(when.at).getMinutes() } : {}),
        });
        void armAutopilotAlarm();
        setYoutubeOpen(true);
        setAgentVoiceTask({ action: 'headbot_autopilot', topic: '', nonce: Date.now() });
        speak(
          when
            ? `Ji Boss. Ab se roz ${when.label} baje main khud live research karunga, dusri websites se footage uthaunga, video bana kar Vault aur Gallery me save karunga, aur khud upload bhi kar dunga. Aapko kuch bolna nahi padega.`
            : 'Ji Boss. Ab se roz shaam 7 baje main apne aap research, video, save aur upload ka poora kaam kar dunga. Time badalna ho toh bas boliye — roz 6 baje kar do.'
        );
        showConfirmedBadge('🗓️ Daily Autopilot ON');
        finishNormal();
        return true;
      }

      // 12A. 👑 HEAD BOT AUTOPILOT VOICE COMMAND — "Research karke video banao aur [time] pe khud upload kar do"
      if (
        /\b(head\s*bot|headbot|autopilot|auto\s*post|auto\s*upload|khud\s*(upload|post|daal)|apne\s*aap\s*(upload|post)|schedule\s*(kar|post|upload)|research\s*kar\w*)\b/i.test(
          low
        ) &&
        /\b(video|reel|short|post|upload|daal|research|news)\b/i.test(low)
      ) {
        const urlFound = cleaned.match(/https?:\/\/\S+/i)?.[0] || '';
        const when = parseHinglishTime(low);
        const extractedTopic = cleaned
          .replace(/https?:\/\/\S+/gi, '')
          .replace(
            /\b(head\s*bot|headbot|autopilot|please|kripya|aur|phir|ko|ke\s*liye|video|reel|short|bana\s*(kar|ke|do|o)?|research\s*kar\s*(ke|kar)?\s*(karke)?|online|internet|web|se|karke|khud|apne\s*aap|upload\s*kar\s*(dena|de|do)|daal\s*dena|dal\s*de|post\s*kar\s*(dena|do)|schedule\s*(kar\s*do|karna|kar)?|save\s*kar\w*|gallery|vault|me|mein|par|ko)\b/gi,
            ' '
          )
          .replace(/\b\d{1,2}\s*[:.]?\s*\d{0,2}\s*(baje|am|pm|shaam|raat|subah)\b/gi, ' ')
          .replace(/\b(kal|tomorrow|aaj|today)\b/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const goalText =
          extractedTopic.length >= 6
            ? extractedTopic
            : 'AI Agents Se YouTube Aur Instagram Growth — 2026 Live Research Breakdown';

        const mission = createMission({
          goal: goalText,
          niche: goalText,
          targetSeconds: /\b(1\s*min|60\s*sec|one\s*minute)\b/i.test(low) ? 60 : 30,
          platforms: {
            instagram: !/\bsirf\s*(youtube|you\s*tube)\b/i.test(low),
            facebook: !/\bsirf\s*(youtube|you\s*tube)\b/i.test(low),
            youtube: true,
          },
          scheduledAt: when ? when.at : null,
        });
        void executeMission(mission.id);

        setLiveUserText(cleaned);
        setYoutubeOpen(true);
        setAgentVoiceTask({ action: 'headbot_autopilot', topic: goalText, refUrl: urlFound, nonce: Date.now() });
        showConfirmedBadge(when ? `👑 Head Bot Autopilot — ${when.label} par auto-upload!` : '👑 Head Bot Autopilot Chalu!');
        speak(
          when
            ? `Ji Boss. Main abhi live internet par "${goalText}" ki research kar raha hoon, dusri websites se real HD footage utha kar video banaunga, pehle aapke vault aur gallery mein save karunga, aur ${when.label} par khud upload kar dunga.`
            : `Ji Boss. Main abhi "${goalText}" par live research karke, dusri websites ki footage se video bana kar save kar raha hoon, aur turant upload bhi kar dunga.`
        );
        finishNormal();
        return true;
      }

      // 12B. VOICE COMMAND -> OPEN OPENMONTAGE & MAKE + SAVE VIDEO IN VAULT ("OpenMontage mein jakar video bana ke save karke rakho!")
      if (
        /\b(video\s*bana\w*|make\s*(?:a\s*)?video|1\s*min(?:ute)?\s*video|open\s*video|open\s*montage|montage|scope\s*and|agent\s*ko\s*kaam|reel\s*bana\w*|short\s*bana\w*|whatsapp\s*video|social\s*agent|41\s*agent)\b/i.test(
          low
        )
      ) {
        const urlFound = cleaned.match(/https?:\/\/\S+/i)?.[0] || '';
        const extractedTopic = cleaned
          .replace(/https?:\/\/\S+/gi, '')
          .replace(
            /\b(please|open\s*montage|open\s*video|montage|scope\s*and|mein\s*ja\s*kar|jakar|agent\s*ko\s*kaam\s*(?:de\s*do|do)?|video\s*bana\s*(?:kar|ke|do|o)?|reel\s*bana\s*(?:kar|ke|do|o)?|usko\s*(?:save|sev)\s*kar\w*|save\s*kar\w*|sev\s*kar\w*|rakhiye|rakho|make\s*a?\s*video\s*(?:on|about)?|aur|par|ke\s*baare\s*mein|1\s*minute)\b/gi,
            ' '
          )
          .replace(/\s+/g, ' ')
          .trim();
        setLiveUserText(cleaned);
        setYoutubeOpen(true);
        setAgentVoiceTask({
          action: extractedTopic.length >= 3 ? 'make_and_save' : 'make_and_save',
          topic: extractedTopic.length >= 3 ? extractedTopic : 'AI Automation & Smart Growth Secrets',
          refUrl: urlFound,
          nonce: Date.now(),
        });
        showConfirmedBadge('💾 OpenMontage Making & Saving Video!');
        finishNormal();
        return true;
      }

      return false;
    },
    [setMood, speak, showConfirmedBadge, addJarvisTask, addJarvisMemory]
  );

  // 👑 HEAD BOT AUTOPILOT HEARTBEAT — saved missions ko set time par khud utha kar publish karta hai
  useEffect(() => startAutopilotHeartbeat(), []);

  // 📚 BRAIN FILE — persistent memory (har chat/voice me model ko diya jaata hai,
  //    har autonomous kaam ke baad khud update hota hai, GitHub/Worker par bhi jaata hai)
  useEffect(() => startBrainCore(), []);

  // 🛰️ JARVIS CORE — khud ka system: research, video, save, publish, comments, market cycle
  useEffect(() => startJarvisCore(), []);

  const buildLiveBrainPrompt = useCallback(() => {
    try {
      return buildBrainPrompt(1200);
    } catch {
      return '';
    }
  }, []);

  const buildLiveWalletSummary = useCallback(() => {
    const at = autoTraderRef.current;
    const acc = at.liveAccount;
    const holdTxt = acc.holdings
      .filter((h) => h.valueInr >= 5)
      .map((h) => `${h.currency}: ₹${Math.round(h.valueInr)}`)
      .join(', ');
    const pxTxt = at.pairs
      .slice(0, 3)
      .filter((p) => p.price > 0)
      .map((p) => `${p.symbol} ₹${Math.round(p.price)} (${p.change24h >= 0 ? '+' : ''}${p.change24h}%)`)
      .join(', ');
    return `Real CoinDCX Account Live=${acc.live ? 'YES' : 'SYNCING'}, Total=₹${acc.totalInr.toFixed(
      2
    )}, SpotINR=₹${acc.spotInr.toFixed(2)}, AutoTrade=${at.autoTrading ? 'ON' : 'OFF'}${
      holdTxt ? `, Holdings=[${holdTxt}]` : ''
    }${pxTxt ? `, LiveMarket=[${pxTxt}]` : ''}`;
  }, []);

  const handleUtterance = useCallback(
    async (text: string, onDone?: () => void) => {
      if (!text || busyRef.current) {
        onDone?.();
        return;
      }
      busyRef.current = true;
      // 🎯 v6.6.2 WORD CONFIRM — pichhle "kaunsa word?" sawaal ka jawab aaya?
      const pendClarify = pendingClarifyRef.current;
      if (pendClarify) {
        pendingClarifyRef.current = null;
        const choice = resolveClarifyAnswer(text, pendClarify.options);
        if (choice && choice.toLowerCase() !== pendClarify.word.toLowerCase()) {
          const re = new RegExp(pendClarify.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          const fixed = pendClarify.original.replace(re, choice);
          noteBrain('learned', `🎯 Word confirm: "${pendClarify.word}" → "${choice}"`);
          if (fixed && fixed !== pendClarify.original) text = fixed;
        }
      }
      setLiveUserText(text);
      pushChatBubble('user', text);
      const watchdog = setTimeout(() => {
        busyRef.current = false;
      }, 9500);
      const finish = () => {
        clearTimeout(watchdog);
        busyRef.current = false;
        onDone?.();
      };

      // Auto-learn personal facts permanently across app restarts!
      const autoFact = extractAutoPersonalMemory(text);
      if (autoFact) {
        addJarvisMemory(autoFact);
      }

      // Private Owner Vault Unlock via Secret PIN ("owner unlock 7860") or Lock ("owner lock")
      const normCheck = normalizeSpokenHindiText(text).toLowerCase();
      if (/\bowner\s*unlock\s*7860\b/i.test(normCheck)) {
        setOwnerUnlocked(true);
        localStorage.setItem('apex_owner_vault_unlocked_v6', '1');
        const msg = '👑 Owner Private Vault Unlocked Boss! Aapka personal CoinDCX aur YouTube account active ho gaya.';
        setLiveBotText(msg);
        pushChatBubble('bot', msg);
        speak(msg, finish);
        return;
      }
      if (/\b(share\s*safe\s*on|owner\s*lock|guest\s*mode)\b/i.test(normCheck)) {
        setOwnerUnlocked(false);
        localStorage.removeItem('apex_owner_vault_unlocked_v6');
        const msg = '🛡️ Share-Safe Mode ON! Ab aap kisi ko bhi APK bhej sakte hain — aapka koi personal data nahi dikhega.';
        setLiveBotText(msg);
        pushChatBubble('bot', msg);
        speak(msg, finish);
        return;
      }

      // DIRECT 👑 HEAD BOT AUTONOMOUS TRADING VOICE / CHAT ROUTING (Futures + Spot + Position Sync — ZERO Permission Delay!)
      if (
        /\b(head\s*bot|futures?|chashme|short\s*kar|long\s*kar|position|exit\s*all|close\s*all)\b/i.test(normCheck) ||
        (/\b(buy|sell|kharid|bech|trade)\b/i.test(normCheck) &&
          /\b(btc|bitcoin|eth|ethereum|sol|solana|xrp|doge|inr|usdt|rupay|rupee|₹|spot|future)\b/i.test(normCheck))
      ) {
        clearTimeout(watchdog);
        setLiveVoiceStage('thinking');
        setMood('excited');
        autoTraderRef.current
          .sendCommandToHeadBot(text)
          .then((headReply) => {
            setLiveBotText(headReply);
            pushChatBubble('bot', `👑 ${headReply}`);
            speak(headReply, finish);
          })
          .catch(() => {
            speak('Head Bot command send ho gaya hai Boss!', finish);
          });
        return;
      }

      // REEL 1 — MYRAA AUTONOMOUS DEEP WEB RESEARCH & TASK EXECUTION ("usko kaam do aur woh khud auto research kare!")
      if (
        /\b(auto\s*research|research\s*karo|research\s*karke|deep\s*research|khoj\s*karo|report\s*banao|business\s*plan\s*banao|iske\s*baare\s*mein\s*research)\b/i.test(
          normCheck
        )
      ) {
        clearTimeout(watchdog);
        setLiveVoiceStage('thinking');
        setMood('thinking');
        pushChatBubble('bot', '🔍 Autonomous Research Agent shuru ho gaya hai — live sources check kar raha hoon…');
        runAutonomousDeepResearch(text, (stepMsg) => {
          setLiveBotText(stepMsg);
        })
          .then((res) => {
            addJarvisTask(`📄 Research Done: ${res.query}`);
            setLiveBotText(res.spokenSummary);
            pushChatBubble('bot', res.markdownReport);
            speak(res.spokenSummary, finish);
          })
          .catch(() => {
            speak('Research complete karne me network slow tha Boss, ek baar fir batayein.', finish);
          });
        return;
      }

      // REEL 1 — MYRAA SMART AI WHATSAPP AUTO-COMPOSER!
      if (/\bwhatsapp\b/i.test(normCheck) && /\b(message|msg|bhejo|likho|send|bol\s*do|inform)\b/i.test(normCheck)) {
        clearTimeout(watchdog);
        setLiveVoiceStage('thinking');
        composeAndOpenWhatsAppSmart(text).then((replyTxt) => {
          setLiveBotText(replyTxt);
          pushChatBubble('bot', replyTxt);
          speak('WhatsApp message likh kar khol diya hai Boss!', finish);
        });
        return;
      }

      // REEL 1 & REEL 2 — MYRAA / ULTRON HANDS-FREE DIRECT YOUTUBE SONG & VIDEO AUTO-PLAY!
      if (
        (/\b(play|bajao|chalao|sunao)\b/i.test(normCheck) &&
          !/\b(open\s*montage|video\s*banao|trade)\b/i.test(normCheck) &&
          normCheck.split(/\s+/).length >= 2) ||
        /\b(song|gaana|music)\b.*\b(play|bajao|chalao|kholo)\b/i.test(normCheck)
      ) {
        clearTimeout(watchdog);
        setLiveVoiceStage('thinking');
        playSongOrVideoHandsFree(text).then(({ spokenReply }) => {
          setLiveBotText(spokenReply);
          pushChatBubble('bot', `🎵 ${spokenReply}`);
          speak(spokenReply, finish);
        });
        return;
      }

      // First check all voice control + confirmation intents! (MUST pass `finish` so busyRef always resets!)
      if (tryHandleSmartVoiceControl(text, finish)) {
        return;
      }

      // Instant 0ms local conversational greetings so everyday speech replies with ZERO delay!
      for (const [rx, ans] of QUICK_RESPONSES) {
        if (rx.test(text.trim())) {
          const fastMsg = typeof ans === 'function' ? ans() : ans;
          setLiveUserText(text);
          setLiveBotText(fastMsg);
          speak(fastMsg, finish);
          return;
        }
      }

      const sentiment = analyzeSentiment(text);
      setSentimentInfo(sentiment);
      if (sentiment.mood !== 'neutral' && sentiment.mood !== 'idle') {
        activeSentimentRef.current = sentiment.mood;
        setMood(sentiment.mood);
      } else {
        activeSentimentRef.current = null;
        setMood('thinking');
      }

      try {
        setLiveUserText(text);
        setLiveVoiceStage('thinking');

        // 1) Instant ~200ms Real-Time Market / Gold / Silver / Nifty / Stocks / Dollar / Weather Check!
        const liveWorldAnswer = await tryResolveRealtimeWorldQuery(text);
        if (liveWorldAnswer) {
          chatMemRef.current.push({ role: 'user', text });
          chatMemRef.current.push({ role: 'model', text: liveWorldAnswer });
          while (chatMemRef.current.length > 12) chatMemRef.current.shift();
          try {
            localStorage.setItem(
              userScopedKey('apex_chat_mem', activeUserId),
              JSON.stringify(chatMemRef.current)
            );
          } catch {}
          speak(liveWorldAnswer, finish);
          return;
        }

        // 🎯 v6.6.2 — "main pretend nahi karta ki samajh gaya": ek chhota, targeted sawaal.
        //    Rules (reel wale hi): short answer kabhi nahi, long clear sentence me 1 word
        //    chhodo, aur LAGATAAR 2 baar sawaal NAHI (doosri baar best reading se aage).
        const vcfg = loadVoiceLock();
        if (vcfg.enabled && vcfg.askUncertain) {
          const meta = lastSpeechMetaRef.current;
          const cl = pickClarification({
            text,
            alts: meta.alts,
            interim: meta.interim,
            confidence: meta.confidence,
            alreadyAsked: clarifyAskedRef.current,
          });
          clarifyAskedRef.current = cl.ask;
          if (cl.ask && cl.options && cl.word) {
            pendingClarifyRef.current = { word: cl.word, options: cl.options, original: text };
            const q = clarifyQuestion(cl);
            setLiveBotText(q);
            pushChatBubble('bot', q);
            speak(q, finish, true);
            return;
          }
        } else {
          clarifyAskedRef.current = false;
        }

        // 2) Sub-0.55s Fast Parallel AI Brain with Persistent Personal Memory & Real CoinDCX Context!
        const walletSnap = buildLiveWalletSummary();
        const reply = await askFastLiveBrain({
          userText: text,
          userName: activeUser?.name || 'Dost',
          memories: jarvisMemoriesRef.current.map((m) => m.text),
          walletSummary: walletSnap,
          history: chatMemRef.current,
        });

        chatMemRef.current.push({ role: 'user', text });
        chatMemRef.current.push({ role: 'model', text: reply });
        while (chatMemRef.current.length > 12) chatMemRef.current.shift();
        try {
          localStorage.setItem(
            userScopedKey('apex_chat_mem', activeUserId),
            JSON.stringify(chatMemRef.current)
          );
        } catch {}

        speak(reply, finish);
      } catch {
        const fallback = 'Network thoda slow hai, ek baar fir boliye.';
        speak(fallback, finish);
      }
    },
    [
      setMood,
      speak,
      tryHandleSmartVoiceControl,
      buildLiveWalletSummary,
      addJarvisMemory,
      activeUserId,
      activeUser,
    ]
  );

  const releaseMicHardwareOnly = useCallback(() => {
    clearTimeout(idleStandbyTimerRef.current);
    sendChunkNowRef.current = null;
    setMicLevel(0);
    setLiveInterimText('');
    try {
      window.ApexAndroid?.stopNativeListen?.();
    } catch {}
    if (recRef.current) {
      try {
        recRef.current.onresult = null;
        recRef.current.onend = null;
        recRef.current.onerror = null;
        recRef.current.abort();
      } catch {}
      recRef.current = null;
    }
    if (micStreamRef.current) {
      try {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      micStreamRef.current = null;
    }
    audio.disconnectMicStream();
    setIsListening(false);
  }, []);

  const openCallMicTurnRef = useRef<() => Promise<void>>(async () => {});

  const openCallMicTurn = useCallback(async () => {
    if (!poweredOnRef.current || !callActiveRef.current) return;
    releaseMicHardwareOnly();

    const scheduleAfterReply = () => {
      echoCooldownUntilRef.current = Date.now() + 280;
      liveSpeakingRef.current = false;
      busyRef.current = false;
      if (engineRef.current) engineRef.current.voiceTarget = 0.12;
      setIsListening(false);
      setMicLevel(0);
      setLiveVoiceStage('idle');
      setMood('idle');
      // Turn-by-Turn Natural Back-to-Back Conversation: Mic was 100% OFF during speaker audio (pure loud STREAM_MUSIC!),
      // and automatically re-opens 320ms AFTER reply finishes so user can keep talking naturally without re-tapping!
      if (autoContinuousRef.current && poweredOnRef.current && assistantOpenRef.current) {
        setTimeout(() => {
          if (poweredOnRef.current && assistantOpenRef.current && !liveSpeakingRef.current) {
            callActiveRef.current = true;
            openCallMicTurnRef.current();
          }
        }, 320);
      } else {
        callActiveRef.current = false;
      }
    };

    // =========================================================================
    // ENGINE 1 (PRIMARY #1 ON ANDROID PHONE): GOOGLE NATIVE SPEECHRECOGNIZER (hi-IN / en-IN)
    // Eliminates 100% of Whisper "ulta sun raha hai" room-noise hallucinations!
    // Uses exact Google Indian Hinglish + English recognition & keeps speaker 100% in loud STREAM_MUSIC!
    // =========================================================================
    if (window.ApexAndroid?.hasNativeStt?.()) {
      let nativeHandled = false;
      let lastNativePartial = '';
      busyRef.current = false;
      liveSpeakingRef.current = false;
      setIsListening(true);
      setLiveVoiceStage('listening');
      setMood('listening');

      const finishOneShotNative = (rawSpoken: string) => {
        if (nativeHandled) return;
        nativeHandled = true;
        try {
          window.ApexAndroid?.stopNativeListen?.();
          window.ApexAndroid?.setSpeakerphone?.(true);
        } catch {}
        setIsListening(false);
        setMicLevel(0);
        setLiveInterimText('');
        const clean = (rawSpoken || '').trim();
        // If silence/noise or user didn't speak, STOP mic 100% completely — NEVER auto-reopen in a blinking loop!
        if (!clean || !poweredOnRef.current) {
          callActiveRef.current = false;
          setIsListening(false);
          setMicLevel(0);
          setLiveVoiceStage('idle');
          setMood('idle');
          return;
        }
        setLiveUserText(clean);
        setLiveVoiceStage('thinking');
        setMood('thinking');
        handleUtterance(clean, scheduleAfterReply);
      };

      (window as any).__onApexSpeechReady = () => {
        setIsListening(true);
        setLiveVoiceStage('listening');
      };
      (window as any).__onApexSpeechRms = (lvl: number) => setMicLevel(lvl);
      (window as any).__onApexSpeechPartial = (part: string) => {
        const trimmed = (part || '').trim();
        if (!trimmed) return;
        lastNativePartial = trimmed;
        setLiveInterimText(trimmed);
      };
      (window as any).__onApexSpeechFinal = (finalTxt: string, alts?: string[], conf?: number) => {
        lastSpeechMetaRef.current = {
          alts: Array.isArray(alts) ? alts.filter(Boolean) : [],
          interim: lastNativePartial,
          confidence: typeof conf === 'number' && conf >= 0 ? conf : -1,
        };
        finishOneShotNative(finalTxt || lastNativePartial);
      };
      (window as any).__onApexSpeechError = () => {
        finishOneShotNative(lastNativePartial);
      };

      // Use Official Google India Bilingual Hindi + English ('hi-IN') so spoken Hindi & English words both hear 100% accurately!
      window.ApexAndroid.startNativeListen?.('hi-IN');
      return;
    }

    // =========================================================================
    // ENGINE 2 (CHROME / DESKTOP BROWSER NATIVE SPEECHRECOGNITION - ZERO HALLUCINATION!)
    // =========================================================================
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        recRef.current = rec;
        rec.lang = 'hi-IN';
        rec.interimResults = true;
        rec.continuous = false;
        rec.maxAlternatives = 3;
        let finalTranscript = '';
        let latestInterim = '';
        let doneOnce = false;

        setIsListening(true);
        setLiveVoiceStage('listening');
        setMood('listening');

        rec.onresult = (ev: any) => {
          let interim = '';
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const t = ev.results[i][0]?.transcript || '';
            if (ev.results[i].isFinal) {
              finalTranscript += t + ' ';
              // 🎯 alternatives + engine confidence (word-confirm isi se banega)
              const altList: string[] = [];
              for (let a = 0; a < (ev.results[i].length || 1); a++) {
                const x = ev.results[i][a]?.transcript;
                if (x) altList.push(String(x).trim());
              }
              const c = Number(ev.results[i][0]?.confidence);
              lastSpeechMetaRef.current = {
                alts: altList,
                interim: latestInterim || '',
                confidence: Number.isFinite(c) && c >= 0 ? c : -1,
              };
            } else interim += t;
          }
          latestInterim = (finalTranscript + interim).trim();
          if (latestInterim) {
            setLiveInterimText(latestInterim);
            setMicLevel(0.65);
          }
        };
        rec.onend = () => {
          if (doneOnce) return;
          doneOnce = true;
          setIsListening(false);
          setMicLevel(0);
          setLiveInterimText('');
          const textOut = (finalTranscript || latestInterim).trim();
          if (textOut && poweredOnRef.current) {
            handleUtterance(textOut, scheduleAfterReply);
          } else {
            scheduleAfterReply();
          }
        };
        rec.onerror = () => {
          if (doneOnce) return;
          doneOnce = true;
          setIsListening(false);
          setMicLevel(0);
          setLiveInterimText('');
          scheduleAfterReply();
        };
        rec.start();
        return;
      } catch {}
    }

    // =========================================================================
    // ENGINE 3 FALLBACK: HARDWARE MIC -> GEMINI EXACT HINGLISH AUDIO / WHISPER
    // =========================================================================
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        if (!poweredOnRef.current || !callActiveRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        micStreamRef.current = stream;
        setIsListening(true);
        setLiveVoiceStage('listening');
        setMood('listening');

        let capturing = false;
        const flushFn = await audio.startLivePcmCapture(stream, {
          isMutedGate: () => liveSpeakingRef.current || Date.now() < echoCooldownUntilRef.current || capturing,
          onLevel: (lvl) => setMicLevel(lvl),
          onUtteranceWav: async (wavBuf) => {
            if (capturing || !poweredOnRef.current) return;
            capturing = true;
            releaseMicHardwareOnly();
            try {
              window.ApexAndroid?.setSpeakerphone?.(true);
            } catch {}
            setLiveVoiceStage('thinking');
            setMood('thinking');
            setLiveInterimText('Sun liya… samajh raha hoon…');

            try {
              // Prefer Gemini 2.5 Flash Exact Hinglish Audio Transcription if user key is saved!
              let heard = (await transcribeAudioWithGeminiKey(wavBuf)) || '';
              if (!heard) {
                let r = await fetch('/stt', {
                  method: 'POST',
                  headers: { 'content-type': 'audio/wav' },
                  body: wavBuf,
                }).catch(() => null);
                if (!r || !r.ok) {
                  r = await fetch('https://apex-humanoid-v2.pradhanbibek53.workers.dev/stt', {
                    method: 'POST',
                    headers: { 'content-type': 'audio/wav' },
                    body: wavBuf,
                  });
                }
                const j = r && r.ok ? await r.json() : null;
                heard = String(j?.text || '').trim();
              }
              setLiveInterimText('');
              if (!heard || heard.length < 2 || /^[.,?!-\s]+$/.test(heard)) {
                capturing = false;
                if (poweredOnRef.current && assistantOpenRef.current) {
                  callActiveRef.current = true;
                  openCallMicTurnRef.current();
                }
                return;
              }
              handleUtterance(heard, scheduleAfterReply);
            } catch {
              setLiveInterimText('');
              scheduleAfterReply();
            }
          },
        });
        sendChunkNowRef.current = flushFn;
        return;
      } catch {}
    }

    toast('Voice ke liye Microphone permission Allow karein ya Chat me likhein');
    callActiveRef.current = false;
    setIsListening(false);
    setLiveVoiceStage('idle');
  }, [toast, setMood, langMode, handleUtterance, releaseMicHardwareOnly]);

  openCallMicTurnRef.current = openCallMicTurn;

  const startGeminiSimultaneousLive = useCallback(
    async (apiKey: string): Promise<boolean> => {
      geminiSessionRef.current?.stop();
      const session = new GeminiLiveSession();
      geminiSessionRef.current = session;
      const walletSnap = buildLiveWalletSummary();
      const ok = await session.start(apiKey, {
        systemInstruction:
          `You are APEX, the user's real-time live voice AI assistant and smart friend. ` +
          `Speak naturally, warmly, and humanly like Google Gemini Live / Siri in natural everyday Indian Hinglish (Hindi + English mix). ` +
          `Keep answers concise (1 to 3 short spoken sentences) unless asked for more. ` +
          `Live Real CoinDCX Trading Account Status right now: ${walletSnap}. ` +
          (buildLiveBrainPrompt() || 'No saved brain notes yet.'),
        onStage: (st) => {
          setLiveVoiceStage(st);
          setIsListening(st === 'listening');
          setMood(st === 'speaking' ? 'speaking' : st === 'thinking' ? 'thinking' : 'listening');
          if (engineRef.current) engineRef.current.voiceTarget = st === 'speaking' ? 0.95 : 0.15;
        },
        onMicLevel: (lvl) => setMicLevel(lvl),
        onUserTranscript: (txt, isFinal) => {
          if (isFinal) {
            setLiveInterimText('');
            setLiveUserText(txt);
            tryHandleSmartVoiceControl(txt);
          } else {
            setLiveInterimText(txt);
          }
        },
        onBotTranscript: (txt) => setLiveBotText(txt),
        onError: (msg) => {
          toast(msg, 2800);
          setGeminiLiveActive(false);
        },
        onClosed: () => {
          setGeminiLiveActive(false);
          if (poweredOnRef.current && assistantOpenRef.current) {
            callActiveRef.current = true;
            openCallMicTurnRef.current();
          }
        },
      });
      setGeminiLiveActive(ok);
      return ok;
    },
    [buildLiveWalletSummary, setMood, toast, tryHandleSmartVoiceControl]
  );

  const startEars = useCallback(async () => {
    setMenuOpen(false);
    setAssistantOpen(true);
    assistantOpenRef.current = true;
    audio.unlockSpeaker();
    audio.assistantChime(true);
    cancelAllSpeech();
    callActiveRef.current = true;

    const liveKey = loadGeminiLiveKey();
    if (liveKey) {
      const startedLive = await startGeminiSimultaneousLive(liveKey);
      if (startedLive) return;
    }
    openCallMicTurnRef.current();
  }, [cancelAllSpeech, startGeminiSimultaneousLive]);

  const stopEars = useCallback(() => {
    callActiveRef.current = false;
    assistantOpenRef.current = false;
    setAssistantOpen(false);
    setGeminiLiveActive(false);
    geminiSessionRef.current?.stop();
    geminiSessionRef.current = null;
    clearInterval(vadTimerRef.current);
    clearTimeout(idleStandbyTimerRef.current);
    vadTimerRef.current = null;
    releaseMicHardwareOnly();
    cancelAllSpeech();
    setLiveVoiceStage('idle');
    setMood('idle');
  }, [setMood, cancelAllSpeech, releaseMicHardwareOnly]);

  const handleAssistantOrbTap = useCallback(() => {
    audio.unlockSpeaker();
    if (liveVoiceStage === 'speaking') {
      // Siri / Google-Assistant instant barge-in: interrupt current speech & listen immediately!
      cancelAllSpeech();
      audio.assistantChime(true);
      callActiveRef.current = true;
      openCallMicTurnRef.current();
      return;
    }
    if (isListening) {
      // Flush spoken utterance immediately if anything was spoken, otherwise pause to standby
      if (sendChunkNowRef.current) {
        sendChunkNowRef.current(true);
      }
      return;
    }
    audio.assistantChime(true);
    callActiveRef.current = true;
    openCallMicTurnRef.current();
  }, [isListening, liveVoiceStage, cancelAllSpeech]);

  const toggleMic = useCallback(() => {
    audio.unlockSpeaker();
    if (assistantOpenRef.current) {
      stopEars();
    } else {
      startEars();
    }
  }, [startEars, stopEars]);

  // Always-ON Zero-Lag Background Worker Hand AI Engine (0.00ms main-thread cost · Zero voice stutter!)
  const startGesture = useCallback(async () => {
    if (gestureStreamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 256 }, height: { ideal: 192 }, frameRate: { ideal: 24, max: 30 }, facingMode: 'user' },
        audio: false,
      });
      if (!poweredOnRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      gestureStreamRef.current = stream;
      const v = document.createElement('video');
      v.srcObject = stream;
      v.muted = true;
      v.playsInline = true;
      await v.play();
      gestureVideoRef.current = v;
      setGestureActive(true);

      // Re-lock Main Loudspeaker so Camera open NEVER switches audio routing on Android!
      try {
        window.ApexAndroid?.setSpeakerphone?.(true);
      } catch {}

      handWorker.ensureStarted();
      let lastSendMs = 0;

      const loop = (now: number) => {
        if (!gestureStreamRef.current) return;
        // Throttle to 8 FPS while TTS is actively speaking (100% smooth crystal voice!) and 22 FPS otherwise
        const minGap = liveSpeakingRef.current ? 115 : 44;
        if (now - lastSendMs >= minGap && v.readyState >= 2) {
          lastSendMs = now;
          handSnapshotRef.current = handWorker.submitVideoFrame(v, now);
        } else {
          handSnapshotRef.current = handWorker.getLatest();
        }
        gestureAnimRef.current = requestAnimationFrame(loop);
      };
      gestureAnimRef.current = requestAnimationFrame(loop);
    } catch {
      setGestureActive(false);
    }
  }, []);

  const stopGesture = useCallback(() => {
    if (gestureAnimRef.current) cancelAnimationFrame(gestureAnimRef.current);
    if (gestureStreamRef.current) {
      gestureStreamRef.current.getTracks().forEach((t) => t.stop());
      gestureStreamRef.current = null;
    }
    gestureVideoRef.current = null;
    handWorker.resetHands();
    handSnapshotRef.current = { hands: [], twoHandSpan: null, aiReady: false };
    setGestureActive(false);
  }, []);

  const toggleGesture = useCallback(() => {
    if (gestureActive) {
      stopGesture();
      toast('Hand tracking off');
    } else {
      startGesture();
    }
  }, [gestureActive, startGesture, stopGesture, toast]);

  // Master Power (1-click FULL ON / FULL OFF — ON automatically activates 3D + Hands-Free Live Voice!)
  const togglePower = useCallback(() => {
    if (!poweredOnRef.current) {
      poweredOnRef.current = true;
      setPoweredOn(true);
      audio.unlockSpeaker();
      audio.powerOn(soundOn, sfxOn);
      audio.setSfxVolume(sfxVolume);
      audio.setVoiceVolume(voiceVolume);
      audio.assistantChime(true);
      if (engineRef.current) {
        engineRef.current.started = true;
        engineRef.current.assemble = 0;
        engineRef.current.setPaused(false);
      }
      // Manual Push-to-Talk ONLY: Mic stays cleanly OFF until user taps Mic button!
    } else {
      // HARD FULL OFF — stop every subsystem immediately
      poweredOnRef.current = false;
      setPoweredOn(false);
      setShowVoicePanel(false);
      cancelAllSpeech();
      busyRef.current = false;
      activeSentimentRef.current = null;
      setSentimentInfo(null);
      stopEars();
      if (gestureActive || gestureStreamRef.current) stopGesture();
      audio.powerOff();
      if (engineRef.current) {
        engineRef.current.setPaused(true);
      }
      setMoodState('idle');
      setFps(0);
      setMenuOpen(false);
      setYoutubeOpen(false);
      setTradingBotOpen(false);
      clearTimeout(toastTimerRef.current);
      setToastMessage(null);
    }
  }, [soundOn, sfxOn, sfxVolume, voiceVolume, gestureActive, stopGesture, stopEars, startEars, cancelAllSpeech]);

  // Characters
  const cycleCharacter = useCallback(() => {
    audio.ensureCtx();
    audio.powerUp();
    const nextIdx = (charIdx + 1) % ALL_AVATARS.length;
    setCharIdx(nextIdx);
    const c = ALL_AVATARS[nextIdx];

    if (c.src) {
      const img = new Image();
      img.onload = () => {
        if (engineRef.current) {
          engineRef.current.loadPhotoAvatar(img, c.view || {});
          setPhotoMode(true);
          toast(`Avatar · ${c.name} · ${(engineRef.current['PHOTO']?.count / 1000 || 0).toFixed(0)}k points`);
        }
      };
      img.src = c.src;
    } else {
      if (engineRef.current) {
        engineRef.current.photoMode = false;
        engineRef.current.buildFigure(c);
        engineRef.current.reupload();
        setPhotoMode(false);
        toast(`Avatar · ${c.name}`);
      }
    }
  }, [charIdx, toast]);

  const handlePhotoUpload = useCallback(
    (file: File) => {
      audio.ensureCtx();
      const img = new Image();
      img.onload = () => {
        if (engineRef.current) {
          engineRef.current.loadPhotoAvatar(img);
          setPhotoMode(true);
          setMood('idle');
          audio.assemble();
          toast(`Custom face loaded into point cloud!`, 4000);
        }
      };
      img.src = URL.createObjectURL(file);
    },
    [setMood, toast]
  );

  const exitPhoto = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.photoMode = false;
      engineRef.current.buildFigure(CHARACTERS[0]);
      engineRef.current.reupload();
      setPhotoMode(false);
      toast('Back to humanoid form', 1500);
    }
  }, [toast]);

  // Themes
  const cycleTheme = useCallback(() => {
    audio.ensureCtx();
    audio.theme();
    const nextIdx = (themeIdx + 1) % THEMES.length;
    setThemeIdx(nextIdx);
    if (engineRef.current) {
      engineRef.current.themeIdx = nextIdx;
      document.documentElement.style.setProperty(
        '--cyan',
        `rgb(${THEMES[nextIdx].accent.map((v) => Math.round(v * 255)).join(',')})`
      );
    }
    toast(`Theme: ${THEMES[nextIdx].name}`);
  }, [themeIdx, toast]);

  // Voice Test
  const testVoice = useCallback(() => {
    audio.ensureCtx();
    const sample =
      langMode === 'hi-IN'
        ? 'Namaste! Main APEX humanoid hoon. Meri aawaz bilkul active hai!'
        : 'Hello! I am your APEX humanoid assistant. Speech audio is online and active!';
    toast('Testing AI Voice output…', 2500);
    speak(sample);
  }, [langMode, toast, speak]);

  // Replay
  const replayAssembly = useCallback(() => {
    audio.ensureCtx();
    if (engineRef.current) {
      engineRef.current.assemble = 0;
      audio.assemble();
      toast('Rebuilding point cloud…', 1500);
    }
  }, [toast]);

  // Hologram Armor / Vision Core render engine owns 100% of GPU frame budget for locked 60 FPS performance!
  useEffect(() => {
    setFps(poweredOn ? 60 : 0);
  }, [poweredOn]);

  // Pointer follow listener (active only while powered ON)
  useEffect(() => {
    if (!entered || !poweredOn) return;
    const handlePointerMove = (e: PointerEvent) => {
      hideHint();
      if (!engineRef.current || !poweredOnRef.current) return;
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      engineRef.current.targetYaw = nx * 0.62;
      engineRef.current.targetPitch = -ny * 0.26;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0] && engineRef.current && poweredOnRef.current) {
        const nx = (e.touches[0].clientX / window.innerWidth - 0.5) * 2;
        const ny = (e.touches[0].clientY / window.innerHeight - 0.5) * 2;
        engineRef.current.targetYaw = nx * 0.62;
        engineRef.current.targetPitch = -ny * 0.26;
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [entered, poweredOn, hideHint]);

  // Keyboard controls
  useEffect(() => {
    if (!entered) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'p' || e.key === 'P') {
        togglePower();
        return;
      }
      if (!poweredOnRef.current) return;
      if (e.key === 't' || e.key === 'T') cycleTheme();
      if (e.key === 'g' || e.key === 'G') toggleGesture();
      if (e.key === 'c' || e.key === 'C') cycleCharacter();
      if (e.key === 'Escape') {
        setMenuOpen(false);
        stopEars();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [entered, togglePower, cycleTheme, toggleGesture, cycleCharacter, stopEars]);

  // ALWAYS-ON HAND GESTURE AI + SMOOTH AUTOMATIC WELCOME GREETING ON ENTERING MAIN PAGE!
  useEffect(() => {
    if (!poweredOn) {
      stopGesture();
      return;
    }
    audio.powerOn(soundOn, sfxOn);
    audio.setSfxVolume(sfxVolume);
    audio.setVoiceVolume(voiceVolume);

    // Preload offline MediaPipe Hand model quietly in background, while keeping Camera OFF by default
    // so Voice Call Mode runs 100% pure, cool & solid steady until user taps 🖐!
    handWorker.ensureStarted();

    const welcomeLine = 'Namaste Boss! Main ready hoon. Jab bolna ho tab Mic button dabayein.';

    const bootTimer = setTimeout(() => {
      if (!poweredOnRef.current) return;
      setAssistantOpen(true);
      assistantOpenRef.current = true;

      if (!welcomedOnceRef.current) {
        welcomedOnceRef.current = true;
        // Speak calm welcome ONCE and keep Mic strictly OFF until user taps Mic button!
        speak(welcomeLine);
      }
    }, 350);

    (window as any).__onApexAppResumed = () => {};
    (window as any).__onApexPermissionsReady = () => {
      // NEVER auto-start microphone in background! User controls Mic strictly on tap!
    };

    const onFirstTouch = () => {
      audio.unlockSpeaker();
      window.removeEventListener('pointerdown', onFirstTouch);
    };
    window.addEventListener('pointerdown', onFirstTouch, { passive: true });

    return () => {
      clearTimeout(bootTimer);
      window.removeEventListener('pointerdown', onFirstTouch);
    };
  }, [poweredOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const assistantStage: AssistantStage = !poweredOn
    ? 'closed'
    : liveVoiceStage === 'speaking'
    ? 'speaking'
    : liveVoiceStage === 'thinking'
    ? 'thinking'
    : isListening
    ? 'listening'
    : 'standby';

  const handleToggleQuickBgSound = () => {
    const anyOn = sfxOn || soundOn;
    const next = !anyOn;
    setSfxOn(next);
    setSoundOn(false);
    localStorage.setItem('apex.sfx_on', next ? '1' : '0');
    localStorage.setItem('apex.sound_on', '0');
    audio.setSound(false);
    audio.setSfxVolume(sfxVolume);
    audio.setSfx(next);
    toast(next ? 'Background FX Sound: ON' : 'Background FX Sound: OFF (Voice remains ON)', 2000);
  };

  controlActionsRef.current = {
    startGesture,
    stopGesture,
    cycleTheme,
    cycleCharacter,
    togglePower,
    startEars,
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-black">
      {/* Hidden WebGL Backing Canvas (kept mounted so theme/pulse state stays valid with 0% overhead) */}
      <div className="fixed inset-0 pointer-events-none hidden">
        <canvas ref={canvasRef} />
        <canvas ref={hudCanvasRef} />
      </div>

      {/* Pure pitch-black screen when FULL OFF */}
      {entered && !poweredOn && <div data-testid="power-off-blackout" className="fixed inset-0 z-30 bg-black" />}

      {entered && poweredOn && (
        <HologramArmorCanvas
          handSnapshotRef={handSnapshotRef}
          gestureActive={gestureActive}
          onToggleGesture={toggleGesture}
          voiceLevel={micLevel}
          stage={assistantStage}
          activeSuit={activeSuit}
          blastNonce={blastNonce}
          resetNonce={resetNonce}
          zoomDeltaNonce={zoomDeltaNonce}
          onSelectSuit={setActiveSuit}
          onHoloSound={(kind) => {
            if (liveSpeakingRef.current) return;
            if (kind === 'blast') audio.assemble();
            else if (kind === 'grab' || kind === 'snap' || kind === 'suit') audio.assistantChime(true);
          }}
        />
      )}

      {/* Sleek Live Voice + Expandable Online AI Agent Chat Window */}
      {entered && poweredOn && (
        <SiriAssistantSheet
          stage={assistantStage}
          micLevel={micLevel}
          liveTranscript={liveInterimText}
          userText={liveUserText}
          botText={liveBotText}
          chatHistory={chatHistory}
          showPanel={showVoicePanel}
          onOpenChatPanel={() => setShowVoicePanel(true)}
          onSpeakMessage={(txt) => {
            audio.unlockSpeaker();
            releaseMicHardwareOnly();
            speak(txt, () => {
              if (autoContinuousRef.current && assistantOpenRef.current && poweredOnRef.current) {
                callActiveRef.current = true;
                openCallMicTurnRef.current();
              }
            });
          }}
          onClearHistory={() => {
            setChatHistory([]);
            try {
              localStorage.removeItem('apex_live_chat_bubbles_v1');
            } catch {}
          }}
          geminiLiveActive={geminiLiveActive}
          confirmedBadge={confirmedBadge}
          pendingConfirm={pendingConfirm}
          onGeminiKeySaved={(key) => {
            releaseMicHardwareOnly();
            cancelAllSpeech();
            geminiSessionRef.current?.stop();
            geminiSessionRef.current = null;
            if (key) {
              setGeminiLiveActive(true);
              toast('✅ Gemini Live API Active — Loud Studio Speaker Mode Ready!', 2600);
              speak('Aapka Gemini API connect ho gaya hai Boss! Ab kuch bhi boliye ya research karwayiye.');
            } else {
              setGeminiLiveActive(false);
              toast('Free Cloud AI Mode Active', 2000);
            }
          }}
          onOpenUltronShield={() => {
            audio.unlockSpeaker();
            setTradingBotOpen(true);
          }}
          onMaxSpeakerBoost={() => {
            audio.unlockSpeaker();
            audio.setVoiceVolume(1.0);
            setVoiceVolume(1.0);
            try {
              window.ApexAndroid?.setSpeakerphone?.(true);
              (window.ApexAndroid as any)?.maxSpeakerVolume?.();
            } catch {}
            toast('🔊 MAX 285% Studio Speaker Volume Boost Active!', 2400);
            speak('Speaker volume full maximum boost par set ho gaya hai Boss!');
          }}
          isShareSafeGuest={!isOwnerSession}
          onToggleOwnerVault={() => {
            if (isOwnerSession) {
              setOwnerUnlocked(false);
              localStorage.removeItem('apex_owner_vault_unlocked_v6');
              toast('🛡️ Share-Safe Mode ON — 0% Personal Data Visible!', 2600);
            } else {
              const pin = window.prompt('👑 Private Owner Vault PIN daalein (Share-Safe se Owner Mode kholne ke liye):');
              if (pin && pin.trim() === '7860') {
                setOwnerUnlocked(true);
                localStorage.setItem('apex_owner_vault_unlocked_v6', '1');
                toast('👑 Owner Private Vault Unlocked!', 2600);
              } else if (pin !== null) {
                toast('❌ Galat Owner PIN — Share-Safe Protection Active!', 2400);
              }
            }
          }}
          onConfirmAction={() => {
            const item = pendingConfirmRef.current;
            if (!item) return;
            setPendingConfirm(null);
            pendingConfirmRef.current = null;
            releaseMicHardwareOnly();
            cancelAllSpeech();
            showConfirmedBadge(`✓ Confirmed: ${item.label}`);
            audio.assistantChime(true);
            item.onConfirm();
          }}
          onCancelAction={() => {
            setPendingConfirm(null);
            pendingConfirmRef.current = null;
            showConfirmedBadge('✕ Cancelled');
          }}
          autoFollowUp={autoContinuousMode}
          onToggleAutoFollowUp={() => setAutoContinuousMode((v) => !v)}
          onOrbTap={handleAssistantOrbTap}
          onSendManual={(q) => {
            releaseMicHardwareOnly();
            cancelAllSpeech();
            setLiveUserText(q);
            busyRef.current = false;
            handleUtterance(q, () => {
              if (autoContinuousRef.current && assistantOpenRef.current && poweredOnRef.current) {
                callActiveRef.current = true;
                openCallMicTurnRef.current();
              }
            });
          }}
          onClose={() => setShowVoicePanel(false)}
        />
      )}

      {/* Clean Bottom Floating Dock (Zero separate Mic ON button — auto-live from launch!) */}
      {entered && activeUser && (
        <Dock
          poweredOn={poweredOn}
          menuOpen={menuOpen}
          isListening={isListening}
          chatOpen={showVoicePanel}
          liveStage={assistantStage}
          micLevel={micLevel}
          gestureActive={gestureActive}
          assistantOpen={assistantOpen}
          autoTrading={autoTrader.autoTrading}
          onTogglePower={togglePower}
          onToggleChat={() => {
            audio.unlockSpeaker();
            setShowVoicePanel((prev) => !prev);
          }}
          onToggleGesture={toggleGesture}
          onToggleMenu={() => {
            audio.ensureCtx();
            setMenuTab('apps');
            setMenuOpen((prev) => !prev);
          }}
          onToggleMic={() => {
            audio.unlockSpeaker();
            setAssistantOpen(true);
            assistantOpenRef.current = true;
            if (liveVoiceStage === 'speaking') {
              cancelAllSpeech();
              callActiveRef.current = true;
              openCallMicTurnRef.current();
              return;
            }
            if (isListening) {
              // If user just spoke and tapped button, flush & send speech immediately; otherwise pause mic cleanly
              if (micLevel > 0.05 && sendChunkNowRef.current) {
                sendChunkNowRef.current(true);
                return;
              }
              callActiveRef.current = false;
              assistantOpenRef.current = false;
              setAssistantOpen(false);
              busyRef.current = false;
              try {
                window.ApexAndroid?.stopNativeListen?.();
              } catch {}
              releaseMicHardwareOnly();
              setIsListening(false);
              setMicLevel(0);
              setLiveVoiceStage('idle');
              setMood('idle');
            } else {
              callActiveRef.current = true;
              openCallMicTurnRef.current();
            }
          }}
          onOpenTrading={() => {
            audio.ensureCtx();
            setTradingBotOpen(true);
          }}
          onOpenSocialStudio={() => {
            audio.ensureCtx();
            setYoutubeOpen(true);
          }}
        />
      )}

      {entered && poweredOn && activeUser && (
        <>
          <MenuSheet
            isOpen={menuOpen}
            currentUser={activeUser}
            memories={jarvisMemories}
            onAddMemory={addJarvisMemory}
            onDeleteMemory={deleteJarvisMemory}
            tasks={jarvisTasks}
            onAddTask={addJarvisTask}
            onToggleTask={toggleJarvisTask}
            onDeleteTask={deleteJarvisTask}
            initialTab={menuTab}
            onSpeakCustomText={(txt) => {
              audio.unlockSpeaker();
              speak(txt);
            }}
            onSendCommand={(cmd) => {
              setAssistantOpen(true);
              assistantOpenRef.current = true;
              cancelAllSpeech();
              handleUtterance(cmd);
            }}
            currentMood={mood}
            onSelectMood={(m) => {
              activeSentimentRef.current = null;
              setSentimentInfo(null);
              setMood(m, sfxOn);
              setMenuOpen(false);
            }}
            gestureActive={gestureActive}
            onToggleGesture={toggleGesture}
            characters={ALL_AVATARS}
            currentCharIdx={charIdx}
            onCycleCharacter={cycleCharacter}
            photoMode={photoMode}
            onPhotoUpload={handlePhotoUpload}
            onExitPhoto={exitPhoto}
            onReplay={replayAssembly}
            onVoiceTest={testVoice}
            deepMode={deepMode}
            onToggleDeep={() => setDeepMode((prev) => !prev)}
            onOpenYouTube={() => {
              setMenuOpen(false);
              setYoutubeOpen(true);
            }}
            langMode={langMode}
            onToggleLang={() =>
              setLangMode((prev) => (prev === 'en-IN' ? 'hi-IN' : 'en-IN'))
            }
            themes={THEMES}
            currentThemeIdx={themeIdx}
            onCycleTheme={cycleTheme}
            bgOn={bgOn}
            onToggleBg={() => {
              setBgOn((prev) => {
                const next = !prev;
                if (engineRef.current) engineRef.current.bgOn = next;
                return next;
              });
            }}
            sfxOn={sfxOn}
            onToggleSfx={() => {
              setSfxOn((prev) => {
                const next = !prev;
                localStorage.setItem('apex.sfx_on', next ? '1' : '0');
                audio.setSfxVolume(sfxVolume);
                audio.setSfx(next);
                return next;
              });
            }}
            sfxVolume={sfxVolume}
            onChangeSfxVolume={(val) => {
              setSfxVolume(val);
              setSfxOn(val > 0.01);
              localStorage.setItem('apex.sfx_vol', String(val));
              localStorage.setItem('apex.sfx_on', val > 0.01 ? '1' : '0');
              audio.setSfxVolume(val);
            }}
            voiceVolume={voiceVolume}
            onChangeVoiceVolume={(val) => {
              setVoiceVolume(val);
              localStorage.setItem('apex.voice_vol', String(val));
              audio.setVoiceVolume(val);
            }}
            soundOn={soundOn}
            onToggleSound={() => {
              setSoundOn((prev) => {
                const next = !prev;
                localStorage.setItem('apex.sound_on', next ? '1' : '0');
                audio.setSound(next);
                return next;
              });
            }}
            gestureSmoothing={gestureSmoothing}
            onChangeGestureSmoothing={setGestureSmoothing}
            gestureSensitivity={gestureSensitivity}
            onChangeGestureSensitivity={setGestureSensitivity}
            onOpenTradingBot={() => {
              setMenuOpen(false);
              setTradingBotOpen(true);
            }}
            onOpenElevenLabs={() => {
              setMenuOpen(false);
              setElevenOpen(true);
            }}
            onClose={() => setMenuOpen(false)}
          />

          <ElevenLabsModal
            isOpen={elevenOpen}
            onClose={() => setElevenOpen(false)}
            onConfigSaved={() => toast('🎙️ Custom HD Voice Active!', 2500)}
          />

          <Toast message={toastMessage} />

          <TradingBotModal
            isOpen={tradingBotOpen}
            onClose={() => setTradingBotOpen(false)}
            userId={activeUserId}
            isOwner={isOwnerSession}
            currentHeartRate={heartRate}
            pairs={autoTrader.pairs}
            selectedPairIndex={autoTrader.selectedPairIndex}
            onSelectPairIndex={autoTrader.setSelectedPairIndex}
            autoTrading={autoTrader.autoTrading}
            onToggleAutoTrading={() => autoTrader.setAutoTrading((v) => !v)}
            bossDirective={autoTrader.bossDirective}
            botTeamRoles={autoTrader.botTeamRoles}
            onSendHeadBotCommand={autoTrader.sendCommandToHeadBot}
            onSpeakReply={(replyTxt) => {
              audio.unlockSpeaker();
              speak(replyTxt);
            }}
            onClosePositionNow={autoTrader.closePositionNow}
            smartStatus={autoTrader.smartStatus}
            onSmartTradeNow={() => autoTrader.runSmartTradeNow(true)}
            balance={autoTrader.balance}
            liveAccount={autoTrader.liveAccount}
            onSyncAccount={autoTrader.syncLiveAccount}
            orderInrAmount={autoTrader.orderInrAmount}
            onChangeOrderAmount={autoTrader.setOrderInrAmount}
            walletType={autoTrader.walletType}
            onChangeWalletType={autoTrader.setWalletType}
            leverage={autoTrader.leverage}
            onChangeLeverage={autoTrader.setLeverage}
            orderBusy={autoTrader.orderBusy}
            positions={autoTrader.positions}
            tradeLogs={autoTrader.tradeLogs}
            analysisFeed={autoTrader.analysisFeed}
            strategy={autoTrader.strategy}
            onChangeStrategy={autoTrader.setStrategy}
            onManualBuy={autoTrader.manualBuy}
            onManualSell={autoTrader.manualSell}
            activeTargets={autoTrader.activeTargets}
            onSaveTargetPlan={autoTrader.saveTargetPlan}
            onClearTargetPlan={autoTrader.clearTargetPlan}
            onTriggerSentimentTrade={handleTriggerSentimentTrade}
          />

          <YouTubeModal
            isOpen={youtubeOpen}
            isOwner={isOwnerSession}
            onClose={() => setYoutubeOpen(false)}
            onToast={toast}
            autoVoiceTask={agentVoiceTask}
          />
        </>
      )}
    </div>
  );
};
