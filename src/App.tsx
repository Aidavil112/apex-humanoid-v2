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
  const [langMode, setLangMode] = useState<'en-IN' | 'hi-IN'>('en-IN');
  const [deepMode, setDeepMode] = useState(false);
  const [bgOn, setBgOn] = useState(true);
  const [sfxOn, setSfxOn] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const [photoMode, setPhotoMode] = useState(false);

  // Modals
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [reelOpen, setReelOpen] = useState(false);
  const [tradingBotOpen, setTradingBotOpen] = useState(false);
  const [agentCompanyOpen, setAgentCompanyOpen] = useState(false);

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
        const res = await fetch('/yt/voice', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text, voice: langMode === 'hi-IN' ? 'Puck' : 'Kore' }),
        });
        if (!res.ok) throw new Error('Voice fetch status ' + res.status);
        if (!poweredOnRef.current || seq !== speechSeqRef.current) return false;
        const blob = await res.blob();
        if (!poweredOnRef.current || seq !== speechSeqRef.current) return false;
        const url = URL.createObjectURL(blob);
        const audioEl = new Audio(url);
        ttsAudioRef.current = audioEl;

        audioEl.onplay = () => {
          if (!poweredOnRef.current || seq !== speechSeqRef.current) {
            audioEl.pause();
            return;
          }
          audio.ensureCtx();
          if (engineRef.current) engineRef.current.voiceTarget = 1.0;
          clearInterval(ttsPulseRef.current);
          ttsPulseRef.current = setInterval(() => {
            if (!poweredOnRef.current || seq !== speechSeqRef.current) {
              clearInterval(ttsPulseRef.current);
              return;
            }
            audio.triggerVoicePulse(0.9);
            if (engineRef.current) engineRef.current.voiceTarget = 0.8 + Math.random() * 0.4;
          }, 120);
        };

        audioEl.onended = () => {
          clearInterval(ttsPulseRef.current);
          if (ttsAudioRef.current === audioEl) ttsAudioRef.current = null;
          if (engineRef.current) engineRef.current.voiceTarget = 0.15;
          URL.revokeObjectURL(url);
          if (!poweredOnRef.current || seq !== speechSeqRef.current) return;
          activeSentimentRef.current = null;
          setSentimentInfo(null);
          setMood('idle');
          onEnd?.();
        };

        audioEl.onerror = () => {
          clearInterval(ttsPulseRef.current);
          if (ttsAudioRef.current === audioEl) ttsAudioRef.current = null;
          URL.revokeObjectURL(url);
          if (engineRef.current) engineRef.current.voiceTarget = 0.15;
          if (!poweredOnRef.current || seq !== speechSeqRef.current) return;
          activeSentimentRef.current = null;
          setSentimentInfo(null);
          setMood('idle');
        };

        await audioEl.play();
        return true;
      } catch (err) {
        console.warn('Server TTS failed:', err);
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
      audio.ensureCtx();

      if (!activeSentimentRef.current || activeSentimentRef.current === 'idle') {
        setMood('speaking');
      } else {
        audio.mood(activeSentimentRef.current);
      }

      if ('speechSynthesis' in window) {
        try {
          window.speechSynthesis.resume();
        } catch (e) {}

        const u = new SpeechSynthesisUtterance(text);
        const voice = voiceFor(text);
        if (voice) u.voice = voice;
        u.lang = DEVANAGARI_RE.test(text) ? 'hi-IN' : langMode;
        u.rate = langMode === 'hi-IN' ? 0.94 : 0.98;
        u.pitch = 0.92;
        u.volume = 1;

        let spoke = false;

        u.onstart = () => {
          if (!poweredOnRef.current || seq !== speechSeqRef.current) {
            window.speechSynthesis.cancel();
            return;
          }
          spoke = true;
          audio.ensureCtx();
          audio.triggerVoicePulse(1.0);
        };

        u.onboundary = () => {
          if (!poweredOnRef.current || seq !== speechSeqRef.current) return;
          if (engineRef.current) {
            engineRef.current.voiceTarget = 1.0;
          }
          audio.triggerVoicePulse(0.85);
        };

        u.onend = () => {
          if (!poweredOnRef.current || seq !== speechSeqRef.current) return;
          if (engineRef.current) {
            engineRef.current.voiceTarget = 0.15;
          }
          setTimeout(() => {
            if (!poweredOnRef.current || seq !== speechSeqRef.current) return;
            activeSentimentRef.current = null;
            setSentimentInfo(null);
            setMood('idle');
            onEnd?.();
          }, 300);
        };

        u.onerror = async () => {
          if (!poweredOnRef.current || seq !== speechSeqRef.current) return;
          console.warn('Web speech error, falling back to server TTS');
          const ok = await playServerVoice(text, seq, onEnd);
          if (!ok && poweredOnRef.current && seq === speechSeqRef.current) {
            activeSentimentRef.current = null;
            setSentimentInfo(null);
            setMood('idle');
          }
        };

        window.speechSynthesis.speak(u);

        // Fallback if browser SpeechSynthesis gets stuck without firing onstart
        setTimeout(async () => {
          if (!poweredOnRef.current || seq !== speechSeqRef.current) return;
          if (!spoke && !window.speechSynthesis.speaking) {
            const ok = await playServerVoice(text, seq, onEnd);
            if (!ok && poweredOnRef.current && seq === speechSeqRef.current) {
              setMood('idle');
            }
          }
        }, 600);
      } else {
        playServerVoice(text, seq, onEnd);
      }
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
      toast(msg, 3500);
      audio.heartThump(true);
      speak(msg);
    },
    [setMood, toast, speak]
  );

  const autoTrader = useAutoTrader({
    enabled: entered && poweredOn,
    currentMood: mood,
    currentHeartRate: heartRate,
    onTriggerSentimentTrade: handleTriggerSentimentTrade,
    onTradeBurst: handleTradeBurst,
  });

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
      if (/\b(trading bot|crypto bot|algo bot|open bot|trade bot|trading)\b/i.test(text)) {
        setTradingBotOpen(true);
        setMood('excited');
        const botReply = 'Opening Algorithmic Trading Bot. Core particles synchronized with virtual heart rate and market pulse.';
        toast(botReply, 4000);
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

      // Quick offline/instant responses
      for (const [re, out] of QUICK_RESPONSES) {
        if (re.test(text.trim())) {
          const reply = typeof out === 'function' ? out() : out;
          toast(`“${reply}”`, 3500);
          speak(reply, () => {
            busyRef.current = false;
          });
          return;
        }
      }

      // Ask brain from server
      try {
        const t0 = performance.now();
        const r = await fetch('/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            text,
            history: chatMemRef.current,
            model: deepMode ? 'gemini-3.8-flash' : undefined,
          }),
        });
        const j = await r.json();
        const reply = j.text || 'I hear you, standing by.';
        const ms = Math.round(performance.now() - t0);
        toast(`“${reply.slice(0, 90)}” · ${ms}ms`, 5000);
        chatMemRef.current.push({ role: 'user', text });
        chatMemRef.current.push({ role: 'model', text: reply });
        while (chatMemRef.current.length > 8) chatMemRef.current.shift();

        speak(reply, () => {
          busyRef.current = false;
        });
      } catch (err) {
        const fallback = 'Systems active, brain offline.';
        toast(fallback, 3000);
        speak(fallback, () => {
          busyRef.current = false;
        });
      }
    },
    [setMood, toast, speak, deepMode]
  );

  const startEars = useCallback(() => {
    audio.ensureCtx();

    // Stream mic input into audio engine analyser for live visual waveform
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          micStreamRef.current = stream;
          audio.connectMicStream(stream);
        })
        .catch((err) => {
          console.warn('Microphone stream access not granted for waveform', err);
        });
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast('SpeechRecognition not supported in this browser.');
      return;
    }
    try {
      const r = new SR();
      r.lang = langMode;
      r.interimResults = true;
      r.continuous = true;
      r.maxAlternatives = 1;

      r.onresult = (e: any) => {
        let finalTxt = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalTxt += t;
        }
        if (finalTxt.trim()) {
          const now = Date.now();
          if (now - lastSubmitRef.current.time > 1200 || finalTxt !== lastSubmitRef.current.text) {
            lastSubmitRef.current = { time: now, text: finalTxt };
            toast(`Heard: “${finalTxt}”`, 2500);
            handleUtterance(finalTxt);
          }
        }
      };

      r.onerror = (ev: any) => {
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          toast('Microphone access blocked.');
          setIsListening(false);
        }
      };

      r.onend = () => {
        if (recRef.current) {
          try {
            r.start();
          } catch (e) {}
        }
      };

      recRef.current = r;
      r.start();
      setIsListening(true);
      setMood('listening');
      toast('Listening — speak anytime');
    } catch (e) {
      toast('Could not start microphone');
    }
  }, [langMode, toast, setMood, handleUtterance]);

  const stopEars = useCallback(() => {
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch (e) {}
      recRef.current = null;
    }
    if (micStreamRef.current) {
      try {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      micStreamRef.current = null;
    }
    audio.disconnectMicStream();
    setIsListening(false);
    setMood('idle');
  }, [setMood]);

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
    // Greet user on enter (cancelled immediately if user switches OFF)
    clearTimeout(greetTimerRef.current);
    greetTimerRef.current = setTimeout(() => {
      if (!poweredOnRef.current) return;
      speak('Namaste! Main APEX humanoid hoon. Ask me anything or open the trading bot.');
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

      {/* Bottom Floating Dock — stays visible both ON & FULL OFF as the master power switch */}
      {entered && (
        <Dock
          poweredOn={poweredOn}
          menuOpen={menuOpen}
          isListening={isListening}
          onTogglePower={togglePower}
          onToggleMenu={() => {
            audio.ensureCtx();
            audio.tick(0.6);
            setMenuOpen((prev) => !prev);
          }}
          onToggleMic={toggleMic}
          onTestVoice={testVoice}
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

          {/* Autonomous AI Trading Bot Modal (Auto-Trade & Auto-Analysis) */}
          <TradingBotModal
            isOpen={tradingBotOpen}
            onClose={() => setTradingBotOpen(false)}
            currentHeartRate={heartRate}
            pairs={autoTrader.pairs}
            selectedPairIndex={autoTrader.selectedPairIndex}
            onSelectPairIndex={autoTrader.setSelectedPairIndex}
            autoTrading={autoTrader.autoTrading}
            onToggleAutoTrading={() => autoTrader.setAutoTrading((v) => !v)}
            balance={autoTrader.balance}
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
