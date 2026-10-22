import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WebGLEngine, CHARACTERS, PORTRAIT_AVATARS, THEMES, ALL_AVATARS } from './engine/webgl';
import { audio } from './engine/audio';
import { MoodType, SentimentResult } from './types';
import { HudOverlay } from './components/HudOverlay';
import { Dock } from './components/Dock';
import { MenuSheet } from './components/MenuSheet';
import { YouTubeModal } from './components/YouTubeModal';
import { ReelModal } from './components/ReelModal';
import { AskModal } from './components/AskModal';
import { IntroGate } from './components/IntroGate';
import { Toast } from './components/Toast';
import { AudioWaveform } from './components/AudioWaveform';
import { TradingBotModal } from './components/TradingBotModal';
import { AgentCompanyModal } from './components/AgentCompanyModal';
import { JarvisWorkspace, JarvisTaskItem, JarvisMemoryItem } from './components/JarvisWorkspace';
import { useAutoTrader } from './hooks/useAutoTrader';
import { analyzeSentiment } from './engine/sentiment';

const DEVANAGARI_RE = /[\u0900-\u097F]/;

const QUICK_RESPONSES: [RegExp, string | (() => string)][] = [
  [/^(hi|hello|hey|namaste|namaskar|hii|helo)\b/i, 'Namaste. Main sun raha hoon.'],
  [/(naam kya|who are you|tum kon|tum kaun|your name)/i, 'Main Apex Humanoid hoon, aapka apna assistant.'],
  [/^(time|samay|kitne baje|what time)/i, () => 'Abhi ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' baje hain.'],
  [/(theek ho|kaise ho|how are you)/i, 'Main bilkul theek hoon. Dil ki dhadkan normal hai.'],
  [/(chief of staff|agent company|brand brain|sean purvis|colton|multi agent|company)/i, 'Chief of Staff command center ready hai. 19 sub-agents Brand Brain se connected hain.'],
  [/(trading bot|crypto|trade|algo trader|market pulse|bitcoin)/i, 'Trading bot active hai. Market sentiment excited hai, heart rate surge ho raha hai!'],
  [/(thank|shukriya|dhanyavad)/i, 'Koi baat nahi.'],
  [/(band ho|sleep|so jao|bye|good night)/i, 'Theek hai. Main yahin hoon jab zarurat ho.'],
  [/(kya kar sakte|what can you do)/i, 'Main bol sakta hoon, sun sakta hoon, trading bot chala sakta hoon, aur dil ki dhadkan ke sath pulse karta hoon.'],
];

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gestureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<WebGLEngine | null>(null);

  // UI state
  const [entered, setEntered] = useState(false);
  const [poweredOn, setPoweredOn] = useState(false);
  const poweredOnRef = useRef<boolean>(false);
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
  const [isListening, setIsListening] = useState(false);
  const [liveVoiceStage, setLiveVoiceStage] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [liveUserText, setLiveUserText] = useState<string>('');
  const [liveBotText, setLiveBotText] = useState<string>('');
  const [liveQuickInput, setLiveQuickInput] = useState<string>('');
  const [micLevel, setMicLevel] = useState<number>(0);
  const [langMode, setLangMode] = useState<'en-IN' | 'hi-IN'>('hi-IN');
  const liveSpeakingRef = useRef<boolean>(false);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const vadTimerRef = useRef<any>(null);
  const sendChunkNowRef = useRef<(() => void) | null>(null);
  const [deepMode, setDeepMode] = useState(false);
  const [bgOn, setBgOn] = useState(true);
  const [sfxOn, setSfxOn] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const [photoMode, setPhotoMode] = useState(false);

  // Modals
  const [youtubeOpen, setYoutubeOpen] = useState(() => {
    const h = window.location.hash || '';
    return h.includes('youtube') || h.includes('yt_token=');
  });
  const [askOpen, setAskOpen] = useState(false);
  const [reelOpen, setReelOpen] = useState(false);
  const [tradingBotOpen, setTradingBotOpen] = useState(false);
  const [agentCompanyOpen, setAgentCompanyOpen] = useState(false);
  const [jarvisOpen, setJarvisOpen] = useState<boolean>(true);
  const [quietMode, setQuietMode] = useState<boolean>(false);
  const quietModeRef = useRef<boolean>(false);
  quietModeRef.current = quietMode;

  const [jarvisTasks, setJarvisTasks] = useState<JarvisTaskItem[]>(() => {
    try {
      const s = JSON.parse(localStorage.getItem('jarvis_tasks') || '[]');
      return Array.isArray(s) ? s : [];
    } catch {
      return [];
    }
  });
  const [jarvisMemories, setJarvisMemories] = useState<JarvisMemoryItem[]>(() => {
    try {
      const s = JSON.parse(localStorage.getItem('jarvis_memories') || '[]');
      return Array.isArray(s) ? s : [];
    } catch {
      return [];
    }
  });
  const jarvisMemoriesRef = useRef(jarvisMemories);
  jarvisMemoriesRef.current = jarvisMemories;

  const addJarvisTask = useCallback((title: string) => {
    setJarvisTasks((prev) => {
      const next = [
        { id: `t-${Date.now()}`, title, done: false, createdAt: new Date().toLocaleTimeString('en-IN') },
        ...prev,
      ];
      localStorage.setItem('jarvis_tasks', JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleJarvisTask = useCallback((id: string) => {
    setJarvisTasks((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      localStorage.setItem('jarvis_tasks', JSON.stringify(next));
      return next;
    });
  }, []);

  const deleteJarvisTask = useCallback((id: string) => {
    setJarvisTasks((prev) => {
      const next = prev.filter((t) => t.id !== id);
      localStorage.setItem('jarvis_tasks', JSON.stringify(next));
      return next;
    });
  }, []);

  const addJarvisMemory = useCallback((text: string) => {
    setJarvisMemories((prev) => {
      const next = [
        { id: `m-${Date.now()}`, text, savedAt: new Date().toLocaleDateString('en-IN') },
        ...prev,
      ];
      localStorage.setItem('jarvis_memories', JSON.stringify(next));
      return next;
    });
  }, []);

  const deleteJarvisMemory = useCallback((id: string) => {
    setJarvisMemories((prev) => {
      const next = prev.filter((m) => m.id !== id);
      localStorage.setItem('jarvis_memories', JSON.stringify(next));
      return next;
    });
  }, []);

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
    (newMood: MoodType) => {
      audio.mood(newMood);
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
    if (engineRef.current) {
      engineRef.current.voiceTarget = 0;
    }
  }, []);

  const playServerVoice = useCallback(
    async (text: string, seq: number, onEnd?: () => void) => {
      if (!poweredOnRef.current || seq !== speechSeqRef.current) return false;
      try {
        const voiceBody = JSON.stringify({ text, voice: langMode === 'hi-IN' ? 'Puck' : 'Kore' });
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
        const arrayBuf = await res.arrayBuffer();
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
    (text: string, onEnd?: () => void) => {
      if (!poweredOnRef.current) return;
      const seq = speechSeqRef.current + 1;
      cancelAllSpeech();
      speechSeqRef.current = seq;
      setLiveBotText(text);
      // Quiet Mode (from JARVIS OS sidebar): show text response silently without speaker audio!
      if (quietModeRef.current) {
        liveSpeakingRef.current = false;
        setLiveVoiceStage(micStreamRef.current ? 'listening' : 'idle');
        onEnd?.();
        return;
      }
      liveSpeakingRef.current = true;
      audio.ensureCtx();

      if (!activeSentimentRef.current || activeSentimentRef.current === 'idle') {
        setMood('speaking');
      } else {
        audio.mood(activeSentimentRef.current);
      }

      // PRIMARY: Real ElevenLabs HD Cloud Voice over unlocked WebAudio (works 100% on Android/iOS!)
      playServerVoice(text, seq, onEnd).then((ok) => {
        if (ok || !poweredOnRef.current || seq !== speechSeqRef.current) return;
        // Offline fallback ONLY if cloud voice unreachable
        if ('speechSynthesis' in window) {
          try {
            window.speechSynthesis.resume();
            const u = new SpeechSynthesisUtterance(text);
            const voice = voiceFor(text);
            if (voice) u.voice = voice;
            u.lang = DEVANAGARI_RE.test(text) ? 'hi-IN' : langMode;
            u.rate = 0.96;
            u.onstart = () => {
              setLiveVoiceStage('speaking');
              audio.triggerVoicePulse(1.0);
            };
            u.onend = () => {
              liveSpeakingRef.current = false;
              setMood(micStreamRef.current ? 'listening' : 'idle');
              setLiveVoiceStage(micStreamRef.current ? 'listening' : 'idle');
              onEnd?.();
            };
            u.onerror = () => {
              liveSpeakingRef.current = false;
              setMood(micStreamRef.current ? 'listening' : 'idle');
              setLiveVoiceStage(micStreamRef.current ? 'listening' : 'idle');
              onEnd?.();
            };
            window.speechSynthesis.speak(u);
            return;
          } catch {}
        }
        liveSpeakingRef.current = false;
        setMood(micStreamRef.current ? 'listening' : 'idle');
        setLiveVoiceStage(micStreamRef.current ? 'listening' : 'idle');
        onEnd?.();
      });
    },
    [voiceFor, langMode, setMood, playServerVoice, cancelAllSpeech]
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
    enabled: entered && poweredOn,
    currentMood: mood,
    currentHeartRate: heartRate,
    onTriggerSentimentTrade: handleTriggerSentimentTrade,
    onTradeBurst: handleTradeBurst,
  });
  const autoTraderRef = useRef(autoTrader);
  autoTraderRef.current = autoTrader;

  const handleUtterance = useCallback(
    async (text: string) => {
      if (!text || busyRef.current) return;
      busyRef.current = true;

      // 1. Client-side zero-latency sentiment tone analysis
      const sentiment = analyzeSentiment(text);
      setSentimentInfo(sentiment);

      if (sentiment.mood !== 'neutral' && sentiment.mood !== 'idle') {
        activeSentimentRef.current = sentiment.mood;
        setMood(sentiment.mood);
        const emoji =
          sentiment.mood === 'excited'
            ? '🚀'
            : sentiment.mood === 'happy'
            ? '😊'
            : sentiment.mood === 'angry'
            ? '😡'
            : sentiment.mood === 'sad'
            ? '😢'
            : sentiment.mood === 'surprised'
            ? '😲'
            : sentiment.mood === 'calm'
            ? '😌'
            : '✨';
        const pulseNotice = sentiment.isExcited || sentiment.mood === 'excited' || sentiment.mood === 'happy' ? ' · ❤️ Heart rate surging to 135+ BPM' : '';
        toast(`${emoji} Tone detected: ${sentiment.label.toUpperCase()} (${Math.round(sentiment.score * 100)}%)${pulseNotice}`, 3400);
      } else {
        activeSentimentRef.current = null;
        setMood('thinking');
      }

      // Trading bot direct voice/text trigger
      if (/\b(open trading|open trade|trading kholo)\b/i.test(text)) {
        setTradingBotOpen(true);
        setMood('excited');
        const botReply = 'Trading terminal khol diya hai.';
        toast(botReply, 3000);
        speak(botReply, () => {
          busyRef.current = false;
        });
        return;
      }

      // 3D Printer check
      if (/\b(printer|print|3d)\b/i.test(text)) {
        try {
          const r = await fetch('/printer');
          const j = await r.json();
          const say = j.error
            ? `Printer: ${j.error}`
            : !j.configured
            ? 'No hardware printer configured. Virtual benchy simulation running.'
            : `Printer ${j.state || ''}. File ${j.file || 'none'}${
                j.progress != null ? `, ${j.progress} percent done.` : '.'
              }`;
          toast(`“${say}”`, 5000);
          speak(say, () => {
            busyRef.current = false;
          });
          return;
        } catch (e) {
          busyRef.current = false;
        }
      }

      // JARVIS Personal OS Voice/Text Commands (Tasks, Memory, Open Modules — Trading stays strictly inside AI Trading Bot!)
      const taskCmd = text.match(/(?:task\s*add\s*karo|add\s*task|remind\s*me\s*(?:to)?|yaad\s*dilana)\s*[:\-]?\s*(.+)/i);
      if (taskCmd?.[1]) {
        const t = taskCmd[1].trim();
        addJarvisTask(t);
        setLiveUserText(text);
        const reply = `Bilkul boss, "${t}" aapke Tasks me add kar diya hai.`;
        toast(`☑ ${reply}`, 3500);
        speak(reply, () => {
          busyRef.current = false;
        });
        return;
      }
      const memCmd = text.match(/(?:yaad\s*rakhna|remember\s*(?:that)?|save\s*memory)\s*[:\-]?\s*(.+)/i);
      if (memCmd?.[1]) {
        const m = memCmd[1].trim();
        addJarvisMemory(m);
        setLiveUserText(text);
        const reply = `Samajh gaya boss, Memory me save kar liya: "${m}".`;
        toast(`🧠 ${reply}`, 3500);
        speak(reply, () => {
          busyRef.current = false;
        });
        return;
      }
      if (/(youtube\s*(studio|kholo|open)|shorts\s*studio)/i.test(text)) {
        setYoutubeOpen(true);
        const reply = 'YouTube Autonomous Studio khol diya hai boss!';
        speak(reply, () => {
          busyRef.current = false;
        });
        return;
      }
      if (/(trading\s*(bot|kholo|open)|day\s*trader|chart\s*scan)/i.test(text)) {
        setTradingBotOpen(true);
        const reply = 'AI Day Trader Bot khol diya hai!';
        speak(reply, () => {
          busyRef.current = false;
        });
        return;
      }

      // Ask real live AI brain directly — pure natural human conversation (ZERO unsolicited trading chatter!)
      try {
        setLiveUserText(text);
        setLiveVoiceStage('thinking');
        const t0 = performance.now();
        const chatBody = JSON.stringify({
          text,
          voiceMode: true,
          history: chatMemRef.current,
          model: deepMode ? 'gemini-3.8-flash' : undefined,
        });
        const r = await fetch('https://apex-humanoid-v2.pradhanbibek53.workers.dev/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: chatBody,
        });
        const j = await r.json();
        const reply = j.text || 'Main sun raha hoon, boliye!';
        const ms = Math.round(performance.now() - t0);
        toast(`“${reply.slice(0, 90)}” · ${ms}ms`, 5000);
        chatMemRef.current.push({ role: 'user', text });
        chatMemRef.current.push({ role: 'model', text: reply });
        while (chatMemRef.current.length > 8) chatMemRef.current.shift();

        speak(reply, () => {
          busyRef.current = false;
        });
      } catch (err) {
        const fallback = 'Network thoda slow hai, ek baar fir boliye.';
        toast(fallback, 3000);
        speak(fallback, () => {
          busyRef.current = false;
        });
      }
    },
    [setMood, toast, speak, deepMode]
  );

  const startEars = useCallback(async () => {
    audio.ensureCtx();
    busyRef.current = false;
    liveSpeakingRef.current = false;
    setLiveUserText('');
    setLiveBotText('Haan dost, boliye — main sun raha hoon!');

    let stream: MediaStream | null = null;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        micStreamRef.current = stream;
      } catch (err) {
        toast('⚠️ Phone me Microphone permission Allow karein!');
        setIsListening(false);
        return;
      }
    } else {
      toast('⚠️ Is browser me Microphone uplabdh nahi hai');
      setIsListening(false);
      return;
    }

    setIsListening(true);
    setLiveVoiceStage('listening');
    setMood('listening');
    toast('📞 Live Call Connected — ab normal aawaz me boliye!', 3200);

    // Pure single-owner 16kHz PCM WAV capture -> Single-roundtrip /voice-turn (ZERO Android SpeechRecognition conflict!)
    const flushNow = await audio.startLivePcmCapture(stream, {
      isMutedGate: () => liveSpeakingRef.current || busyRef.current || !poweredOnRef.current,
      onLevel: (lvl) => setMicLevel(lvl),
      onUtteranceWav: async (wavBuf) => {
        if (!poweredOnRef.current || !micStreamRef.current || busyRef.current) return;
        busyRef.current = true;
        setLiveVoiceStage('thinking');
        setMood('thinking');

        // Safety watchdog: never allow busyRef to stay stuck if mobile data drops
        const watchdog = setTimeout(() => {
          busyRef.current = false;
          liveSpeakingRef.current = false;
          if (micStreamRef.current) setLiveVoiceStage('listening');
        }, 14000);

        try {
          const memSummary = jarvisMemoriesRef.current
            .slice(0, 5)
            .map((m) => m.text)
            .join('; ');
          const res = await fetch('https://apex-humanoid-v2.pradhanbibek53.workers.dev/voice-turn', {
            method: 'POST',
            headers: {
              'content-type': 'audio/wav',
              'x-voice-history': encodeURIComponent(JSON.stringify(chatMemRef.current.slice(-6))),
              'x-wallet-context': encodeURIComponent(memSummary),
            },
            body: wavBuf,
          });
          const j = await res.json();
          clearTimeout(watchdog);

          if (!j?.ok || j?.empty || !j?.heard) {
            busyRef.current = false;
            if (micStreamRef.current) {
              setLiveVoiceStage('listening');
              setMood('listening');
            }
            return;
          }

          setLiveUserText(j.heard);
          setLiveBotText(j.reply);
          toast(`🎤 "${j.heard}"`, 2600);

          if (j.action === 'ADD_TASK' && j.payload) addJarvisTask(j.payload);
          if (j.action === 'ADD_MEMORY' && j.payload) addJarvisMemory(j.payload);
          if (j.action === 'OPEN_YOUTUBE') setYoutubeOpen(true);
          if (j.action === 'OPEN_TRADING_BOT') setTradingBotOpen(true);

          chatMemRef.current.push({ role: 'user', text: j.heard });
          chatMemRef.current.push({ role: 'model', text: j.reply });
          while (chatMemRef.current.length > 8) chatMemRef.current.shift();

          // Play pre-synthesized HD voice immediately over WebAudio -> ZERO extra network wait!
          if (j.audioBase64) {
            const binStr = atob(j.audioBase64);
            const raw = new Uint8Array(binStr.length);
            for (let i = 0; i < binStr.length; i++) raw[i] = binStr.charCodeAt(i);
            const ok = await audio.playVoiceArrayBuffer(
              raw.buffer,
              () => {
                liveSpeakingRef.current = true;
                setLiveVoiceStage('speaking');
                setMood('speaking');
                if (engineRef.current) engineRef.current.voiceTarget = 1.0;
              },
              () => {
                liveSpeakingRef.current = false;
                busyRef.current = false;
                if (engineRef.current) engineRef.current.voiceTarget = 0.12;
                if (micStreamRef.current && poweredOnRef.current) {
                  setLiveVoiceStage('listening');
                  setMood('listening');
                }
              }
            );
            if (ok) return;
          }

          // Fallback TTS if audioBase64 empty
          speak(j.reply, () => {
            busyRef.current = false;
          });
        } catch (err) {
          clearTimeout(watchdog);
          busyRef.current = false;
          liveSpeakingRef.current = false;
          if (micStreamRef.current) {
            setLiveVoiceStage('listening');
            setMood('listening');
          }
        }
      },
    });

    sendChunkNowRef.current = flushNow;
    speak('Haan dost, bolo! Main sun raha hoon.', () => {
      busyRef.current = false;
      liveSpeakingRef.current = false;
      setLiveVoiceStage('listening');
      setMood('listening');
    });
  }, [toast, setMood, speak]);

  const stopEars = useCallback(() => {
    clearInterval(vadTimerRef.current);
    vadTimerRef.current = null;
    sendChunkNowRef.current = null;
    busyRef.current = false;
    liveSpeakingRef.current = false;
    setMicLevel(0);
    if (micStreamRef.current) {
      try {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      micStreamRef.current = null;
    }
    audio.disconnectMicStream();
    cancelAllSpeech();
    setIsListening(false);
    setLiveVoiceStage('idle');
    setMood('idle');
  }, [setMood, cancelAllSpeech]);

  const toggleMic = useCallback(() => {
    audio.ensureCtx();
    if (isListening) {
      stopEars();
    } else {
      startEars();
    }
  }, [isListening, startEars, stopEars]);

  // Hand gesture tracking
  const startGesture = useCallback(async () => {
    audio.ensureCtx();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
      });
      gestureStreamRef.current = stream;
      const v = document.createElement('video');
      v.srcObject = stream;
      v.muted = true;
      v.playsInline = true;
      await v.play();
      gestureVideoRef.current = v;
      setGestureActive(true);
      setMood('listening');
      toast('Hand tracking on — gesture to move head');

      const workCanvas = document.createElement('canvas');
      workCanvas.width = 80;
      workCanvas.height = 60;
      const wCtx = workCanvas.getContext('2d', { willReadFrequently: true })!;

      const loop = () => {
        if (!gestureStreamRef.current) return;
        if (v && v.readyState >= 2) {
          wCtx.drawImage(v, 0, 0, 80, 60);
          const d = wCtx.getImageData(0, 0, 80, 60).data;
          let sx = 0,
            sy = 0,
            n = 0;
          for (let y = 0; y < 60; y++) {
            for (let x = 0; x < 80; x++) {
              const i = (y * 80 + x) * 4;
              const r = d[i],
                g = d[i + 1],
                b = d[i + 2];
              const mx = Math.max(r, g, b),
                mn = Math.min(r, g, b);
              if (r > 95 && g > 40 && b > 20 && mx - mn > 18 && r > g + 8 && r > b + 8 && Math.abs(r - g) < 90) {
                sx += x;
                sy += y;
                n++;
              }
            }
          }
          if (n > 90) {
            const cx = sx / n,
              cy = sy / n;
            if (!gestureSeenRef.current) {
              gestureSeenRef.current = true;
              audio.acquire();
            }
            const px = gestureCoordsRef.current.sx;
            const py = gestureCoordsRef.current.sy;
            const smoothRate = gestureSmoothingRef.current;
            const sens = gestureSensitivityRef.current;

            gestureCoordsRef.current.sx += (cx / 80 - gestureCoordsRef.current.sx) * smoothRate;
            gestureCoordsRef.current.sy += (cy / 60 - gestureCoordsRef.current.sy) * smoothRate;

            if (engineRef.current) {
              engineRef.current.targetYaw = (gestureCoordsRef.current.sx - 0.5) * sens * 0.62;
              engineRef.current.targetPitch = (gestureCoordsRef.current.sy - 0.5) * sens * 0.26;
            }
            const velocity = Math.min(1, Math.hypot(gestureCoordsRef.current.sx - px, gestureCoordsRef.current.sy - py) * 9);
            if (velocity > 0.12) audio.tick(velocity);
          } else if (gestureSeenRef.current) {
            gestureSeenRef.current = false;
            audio.release();
          }

          if (gestureCanvasRef.current) {
            const gCtx = gestureCanvasRef.current.getContext('2d');
            if (gCtx) {
              gCtx.drawImage(v, 0, 0, 120, 90);
              gCtx.globalAlpha = 0.4;
              gCtx.strokeStyle = '#4fd2ff';
              gCtx.beginPath();
              gCtx.arc(gestureCoordsRef.current.sx * 120, gestureCoordsRef.current.sy * 90, 9, 0, Math.PI * 2);
              gCtx.stroke();
              gCtx.globalAlpha = 1;
            }
          }
        }
        gestureAnimRef.current = requestAnimationFrame(loop);
      };
      gestureAnimRef.current = requestAnimationFrame(loop);
    } catch (e: any) {
      toast('Camera blocked or unavailable');
      setGestureActive(false);
    }
  }, [setMood, toast]);

  const stopGesture = useCallback(() => {
    if (gestureAnimRef.current) cancelAnimationFrame(gestureAnimRef.current);
    if (gestureStreamRef.current) {
      gestureStreamRef.current.getTracks().forEach((t) => t.stop());
      gestureStreamRef.current = null;
    }
    gestureVideoRef.current = null;
    setGestureActive(false);
    if (gestureSeenRef.current) {
      gestureSeenRef.current = false;
      audio.release();
    }
  }, []);

  const toggleGesture = useCallback(() => {
    if (gestureActive) {
      stopGesture();
      toast('Hand tracking off');
    } else {
      startGesture();
    }
  }, [gestureActive, startGesture, stopGesture, toast]);

  // Master Power (1-click FULL ON / FULL OFF)
  const togglePower = useCallback(() => {
    if (!poweredOnRef.current) {
      poweredOnRef.current = true;
      setPoweredOn(true);
      audio.powerOn(soundOn, sfxOn);
      if (engineRef.current) {
        engineRef.current.assemble = 0;
        engineRef.current.setPaused(false);
      }
      audio.assemble();
      toast('APEX ON · Systems active', 2400);
    } else {
      // HARD FULL OFF — stop every subsystem immediately
      poweredOnRef.current = false;
      setPoweredOn(false);
      cancelAllSpeech();
      busyRef.current = false;
      activeSentimentRef.current = null;
      setSentimentInfo(null);
      if (isListening || recRef.current || micStreamRef.current) stopEars();
      if (gestureActive || gestureStreamRef.current) stopGesture();
      audio.powerOff();
      if (engineRef.current) {
        engineRef.current.setPaused(true);
      }
      setMoodState('idle');
      setFps(0);
      setMenuOpen(false);
      setYoutubeOpen(false);
      setAskOpen(false);
      setReelOpen(false);
      setTradingBotOpen(false);
      setAgentCompanyOpen(false);
      clearTimeout(toastTimerRef.current);
      setToastMessage(null);
    }
  }, [soundOn, sfxOn, gestureActive, isListening, stopGesture, stopEars, cancelAllSpeech, toast]);

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

  // Initialize WebGL engine once canvases are ready (kept alive across power toggles for instant wake)
  useEffect(() => {
    if (!canvasRef.current || !hudCanvasRef.current) return;
    try {
      const engine = new WebGLEngine(canvasRef.current, hudCanvasRef.current);
      engine.onFpsUpdate = (f, p) => {
        setFps(f);
        setPoints(p);
      };
      engine.onHeartRateUpdate = (bpm, pulse, phase, elevated) => {
        setHeartRate(bpm);
        setHeartPulse(pulse);
        setIsElevated(elevated);
      };
      engine.setPaused(true);
      engineRef.current = engine;

      return () => {
        engine.destroy();
        engineRef.current = null;
      };
    } catch (e) {
      console.error('WebGL engine startup error', e);
    }
  }, []);

  // Run GPU render loop ONLY when entered AND powered ON (0 FPS / 0% GPU when FULL OFF)
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!entered || !poweredOn) {
      engine.setPaused(true);
      setFps(0);
      return;
    }
    engine.started = true;
    engine.setPaused(false);
    let animId: number;
    const render = (time: number) => {
      if (!poweredOnRef.current) return;
      engine.frame(time);
      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [entered, poweredOn]);

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

  // Remote state poller (/state) — completely stopped when FULL OFF
  useEffect(() => {
    if (!entered || !poweredOn) return;
    let lastSeq = -1;
    const interval = setInterval(async () => {
      if (!poweredOnRef.current) return;
      try {
        const r = await fetch('/state');
        if (!r.ok || !poweredOnRef.current) return;
        const st = await r.json();
        if (lastSeq < 0) {
          lastSeq = st.seq;
          return;
        }
        if (st.seq === lastSeq) return;
        lastSeq = st.seq;

        if (st.mood) setMood(st.mood);
        if (typeof st.theme === 'number') {
          setThemeIdx(st.theme);
          if (engineRef.current) engineRef.current.themeIdx = st.theme;
        }
        if (st.say) {
          toast(`Remote · “${st.say.slice(0, 48)}”`);
          speak(st.say);
        }
      } catch (e) {}
    }, 1500);

    return () => clearInterval(interval);
  }, [entered, poweredOn, setMood, toast, speak]);

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
      if (e.key === '1') setMood('idle');
      if (e.key === '2') setMood('listening');
      if (e.key === '3') setMood('thinking');
      if (e.key === '4') setMood('speaking');
      if (e.key === ' ') {
        e.preventDefault();
        setMood('speaking');
      }
      if (e.key === 't' || e.key === 'T') cycleTheme();
      if (e.key === 'g' || e.key === 'G') toggleGesture();
      if (e.key === 'c' || e.key === 'C') cycleCharacter();
      if (e.key === 'r' || e.key === 'R') replayAssembly();
      if (e.key === 'b' || e.key === 'B') {
        setTradingBotOpen((prev) => {
          const next = !prev;
          toast(next ? 'Trading Bot Opened' : 'Trading Bot Closed', 1500);
          return next;
        });
      }
      if (e.key === 'o' || e.key === 'O') {
        setAgentCompanyOpen((prev) => {
          const next = !prev;
          toast(next ? 'Chief of Staff Company Opened' : 'Company Command Closed', 1500);
          return next;
        });
      }
      if (e.key === 'k' || e.key === 'K') {
        setBgOn((prev) => {
          const next = !prev;
          if (engineRef.current) engineRef.current.bgOn = next;
          toast(`Background ${next ? 'on' : 'off'}`);
          return next;
        });
      }
      if (e.key === 'f' || e.key === 'F') {
        setSfxOn((prev) => {
          const next = !prev;
          audio.setSfx(next);
          toast(`SFX ${next ? 'on' : 'off'}`);
          return next;
        });
      }
      if (e.key === 'Escape') setMenuOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [entered, togglePower, setMood, cycleTheme, toggleGesture, cycleCharacter, replayAssembly, toast]);

  const handleEnter = () => {
    poweredOnRef.current = true;
    setEntered(true);
    setPoweredOn(true);
    audio.powerOn(soundOn, sfxOn);
    audio.assemble();
    if (engineRef.current) {
      engineRef.current.started = true;
      engineRef.current.setPaused(false);
    }
    // Clean friendly greeting WITHOUT unsolicited trading chatter!
    clearTimeout(greetTimerRef.current);
    greetTimerRef.current = setTimeout(() => {
      if (!poweredOnRef.current) return;
      speak('Namaste! Main APEX hoon. Neeche Live Call daba kar mujhse seedha baat karo.');
    }, 400);
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-black">
      {/* 3D WebGL Canvas Layer */}
      <div className={entered && poweredOn ? 'fixed inset-0 pointer-events-none' : 'fixed inset-0 pointer-events-none invisible'}>
        <canvas ref={canvasRef} className="w-full h-full pointer-events-auto cursor-crosshair" />
        {/* w-full h-full is required: a <canvas> is a replaced element, so inset-0 alone
            keeps its intrinsic (attribute) pixel size and overflows small screens. */}
        <canvas ref={hudCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none opacity-80" />
      </div>

      {/* Pure pitch-black screen when FULL OFF */}
      {entered && !poweredOn && <div data-testid="power-off-blackout" className="fixed inset-0 z-30 bg-black" />}

      {entered && poweredOn && (
        <>
          {/* Cyberpunk Vignette & Floor Glow */}
          <div className="veil" />
          <div className="floor" />

          {/* HUD Overlay (Clean view, unobstructing humanoid) */}
          <HudOverlay
            mood={mood}
            fps={fps}
            points={points}
            gestureActive={gestureActive}
            gestureCanvasRef={gestureCanvasRef}
            showHint={showHint}
            themeAccent={THEMES[themeIdx].accent}
            sentiment={sentimentInfo}
            heartRate={heartRate}
            heartPulse={heartPulse}
            isElevated={isElevated}
          />

          {/* Visual Audio Waveform Overlay (Reacts to mic input and synthesized voice) */}
          <AudioWaveform
            mood={mood}
            isListening={isListening}
            themeAccent={THEMES[themeIdx].accent}
          />
        </>
      )}

      {/* Floating Live 2-Way Voice Call Bar when Live Voice is Active */}
      {entered && poweredOn && isListening && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(86px+env(safe-area-inset-bottom))] z-30 w-[92vw] max-w-md px-3.5 py-2.5 rounded-2xl bg-[rgba(4,14,22,0.88)] border border-[rgba(0,245,160,0.45)] backdrop-blur-xl shadow-[0_12px_36px_rgba(0,0,0,0.85)] flex flex-col gap-1.5 font-mono">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  liveVoiceStage === 'speaking'
                    ? 'bg-[#4fd2ff] animate-ping'
                    : liveVoiceStage === 'thinking'
                    ? 'bg-[#ffd13b] animate-pulse'
                    : 'bg-[#00f5a0] animate-ping'
                }`}
              />
              <span className="text-white">
                {liveVoiceStage === 'speaking'
                  ? '🔊 APEX Bol Raha Hai…'
                  : liveVoiceStage === 'thinking'
                  ? '🧠 APEX Soch Raha Hai…'
                  : '🟢 LIVE VOICE ON — Boliye…'}
              </span>
            </div>

            {liveVoiceStage === 'speaking' ? (
              <button
                onClick={() => {
                  cancelAllSpeech();
                  busyRef.current = false;
                  setLiveVoiceStage('listening');
                  setMood('listening');
                }}
                className="cursor-pointer px-2.5 py-1 rounded-lg bg-[rgba(255,79,112,0.2)] border border-[#ff4f70] text-[#ff8fa3] text-[10px] font-bold"
              >
                ⏹ Roko / Bolo
              </button>
            ) : (
              <button
                onClick={() => sendChunkNowRef.current?.()}
                className="cursor-pointer px-2.5 py-1 rounded-lg bg-[rgba(0,245,160,0.18)] border border-[#00f5a0] text-[#00f5a0] text-[10px] font-bold"
                title="Shanti na ho to bolne ke baad Bhejo dabayein"
              >
                📤 Bhejo
              </button>
            )}
          </div>

          {/* Live Real-Time Mic Audio Meter Bar so user visibly sees their voice level! */}
          <div className="w-full h-1.5 rounded-full bg-[#0a1d2c] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-[#00f5a0] to-[#4fd2ff]"
              style={{ width: `${Math.max(6, Math.min(100, Math.round(micLevel * 140)))}%` }}
            />
          </div>

          {liveUserText && (
            <div className="text-[11px] text-[#9ee8ff] truncate">
              🎤 Aap: <span className="text-white">"{liveUserText}"</span>
            </div>
          )}
          {liveBotText && (
            <div className="text-[11px] text-[#00f5a0] line-clamp-2 leading-snug">
              🤖 APEX: {liveBotText}
            </div>
          )}

          {/* Direct quick voice-reply text bar inside Call HUD as instant backup */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = liveQuickInput.trim();
              if (!q) return;
              setLiveQuickInput('');
              cancelAllSpeech();
              handleUtterance(q);
            }}
            className="flex items-center gap-1.5 pt-1"
          >
            <input
              type="text"
              value={liveQuickInput}
              onChange={(e) => setLiveQuickInput(e.target.value)}
              placeholder="Boliye ya yahan likh kar bhejein…"
              className="flex-1 bg-[#061523] border border-[rgba(79,210,255,0.28)] rounded-lg px-2.5 py-1 text-[11px] text-white placeholder-[#5e859e] focus:outline-none focus:border-[#00f5a0]"
            />
            <button
              type="submit"
              className="cursor-pointer px-2.5 py-1 rounded-lg bg-[#00f5a0] text-[#041a12] text-[10.5px] font-extrabold"
            >
              ➤
            </button>
          </form>
        </div>
      )}

      {/* Bottom Floating Dock — visible in 3D view & FULL OFF mode */}
      {entered && (!jarvisOpen || !poweredOn) && (
        <Dock
          poweredOn={poweredOn}
          menuOpen={menuOpen}
          isListening={isListening}
          autoTrading={autoTrader.autoTrading}
          onTogglePower={togglePower}
          onToggleMenu={() => {
            audio.ensureCtx();
            audio.tick(0.6);
            setMenuOpen((prev) => !prev);
          }}
          onToggleMic={toggleMic}
          onOpenJarvis={() => {
            audio.ensureCtx();
            audio.tick(0.6);
            setJarvisOpen(true);
          }}
          onOpenTrading={() => {
            audio.ensureCtx();
            audio.tick(0.6);
            setTradingBotOpen(true);
          }}
          onTestVoice={testVoice}
        />
      )}

      {/* JARVIS OS / Izem Dark Eclipse Workspace (Reel #2: "Jarvis does literally everything") */}
      {entered && poweredOn && (
        <JarvisWorkspace
          isOpen={jarvisOpen && !tradingBotOpen && !youtubeOpen && !reelOpen && !agentCompanyOpen}
          onCloseTo3D={() => setJarvisOpen(false)}
          isListening={isListening}
          voiceStage={liveVoiceStage}
          micLevel={micLevel}
          userText={liveUserText}
          botText={liveBotText}
          quietMode={quietMode}
          onToggleQuietMode={() => setQuietMode((v) => !v)}
          onToggleCall={toggleMic}
          onFlushSpeechNow={() => sendChunkNowRef.current?.()}
          onSendTextCommand={(cmd) => {
            cancelAllSpeech();
            handleUtterance(cmd);
          }}
          tasks={jarvisTasks}
          onAddTask={addJarvisTask}
          onToggleTask={toggleJarvisTask}
          onDeleteTask={deleteJarvisTask}
          memories={jarvisMemories}
          onAddMemory={addJarvisMemory}
          onDeleteMemory={deleteJarvisMemory}
          onOpenTradingBot={() => setTradingBotOpen(true)}
          onOpenYouTubeStudio={() => setYoutubeOpen(true)}
          onPowerOff={togglePower}
        />
      )}

      {entered && poweredOn && (
        <>
          {/* Slide-up Menu Drawer */}
          <MenuSheet
            isOpen={menuOpen}
            currentMood={mood}
            onSelectMood={(m) => {
              activeSentimentRef.current = null;
              setSentimentInfo(null);
              setMood(m);
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
            onOpenAsk={() => {
              setMenuOpen(false);
              setAskOpen(true);
            }}
            onVoiceTest={testVoice}
            deepMode={deepMode}
            onToggleDeep={() => {
              setDeepMode((prev) => {
                const next = !prev;
                toast(next ? 'Deep model enabled' : 'Fast flash model enabled');
                return next;
              });
            }}
            onOpenYouTube={() => {
              setMenuOpen(false);
              setYoutubeOpen(true);
            }}
            langMode={langMode}
            onToggleLang={() => {
              setLangMode((prev) => {
                const next = prev === 'en-IN' ? 'hi-IN' : 'en-IN';
                toast(`Language: ${next === 'hi-IN' ? 'Hindi' : 'English'}`);
                return next;
              });
            }}
            themes={THEMES}
            currentThemeIdx={themeIdx}
            onCycleTheme={cycleTheme}
            bgOn={bgOn}
            onToggleBg={() => {
              setBgOn((prev) => {
                const next = !prev;
                if (engineRef.current) engineRef.current.bgOn = next;
                toast(`Background ${next ? 'on' : 'off'}`);
                return next;
              });
            }}
            sfxOn={sfxOn}
            onToggleSfx={() => {
              setSfxOn((prev) => {
                const next = !prev;
                audio.setSfx(next);
                toast(`SFX ${next ? 'on' : 'off'}`);
                return next;
              });
            }}
            soundOn={soundOn}
            onToggleSound={() => {
              setSoundOn((prev) => {
                const next = !prev;
                audio.setSound(next);
                toast(`Ambient drone ${next ? 'on' : 'off'}`);
                return next;
              });
            }}
            gestureSmoothing={gestureSmoothing}
            onChangeGestureSmoothing={setGestureSmoothing}
            gestureSensitivity={gestureSensitivity}
            onChangeGestureSensitivity={setGestureSensitivity}
            onOpenReel={() => {
              setMenuOpen(false);
              setReelOpen(true);
            }}
            onOpenTradingBot={() => {
              setMenuOpen(false);
              setTradingBotOpen(true);
            }}
            onOpenAgentCompany={() => {
              setMenuOpen(false);
              setAgentCompanyOpen(true);
            }}
            onClose={() => setMenuOpen(false)}
          />

          {/* Notification Toast */}
          <Toast message={toastMessage} />

          {/* Real Money CoinDCX Trading Terminal */}
          <TradingBotModal
            isOpen={tradingBotOpen}
            onClose={() => setTradingBotOpen(false)}
            currentHeartRate={heartRate}
            pairs={autoTrader.pairs}
            selectedPairIndex={autoTrader.selectedPairIndex}
            onSelectPairIndex={autoTrader.setSelectedPairIndex}
            autoTrading={autoTrader.autoTrading}
            onToggleAutoTrading={() => autoTrader.setAutoTrading((v) => !v)}
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
            onTriggerSentimentTrade={handleTriggerSentimentTrade}
          />

          {/* YouTube Shorts & Content Studio Modal */}
          <YouTubeModal
            isOpen={youtubeOpen}
            onClose={() => setYoutubeOpen(false)}
            onToast={toast}
          />

          {/* Instagram Reel Showcase Modal */}
          <ReelModal
            isOpen={reelOpen}
            onClose={() => setReelOpen(false)}
            onSelectTopicForShorts={(suggestedTopic) => {
              setYoutubeOpen(true);
            }}
            onOpenAgentCompany={() => {
              setReelOpen(false);
              setAgentCompanyOpen(true);
            }}
            onToast={toast}
          />

          {/* Chief of Staff & Multi-Agent AI Company Command Center */}
          <AgentCompanyModal
            isOpen={agentCompanyOpen}
            onClose={() => setAgentCompanyOpen(false)}
            onSelectTopicForShorts={(suggestedTopic) => {
              setYoutubeOpen(true);
            }}
            onToast={toast}
          />

          {/* Ask Question Modal */}
          <AskModal
            isOpen={askOpen}
            onClose={() => setAskOpen(false)}
            onSubmit={handleUtterance}
          />
        </>
      )}

      {/* Initial Entry Gate */}
      {!entered && <IntroGate onEnter={handleEnter} />}
    </div>
  );
};
