import React, { useState, useRef, useEffect } from 'react';
import { hubFetch } from '../engine/api';
import {
  BacklotStageId,
  MontageScene,
  ProducedMontageVideo,
  runOpenMontageProduction,
  shareMontageVideoToWhatsApp,
  uint8ToBase64,
} from '../engine/openMontageEngine';
import {
  SavedVaultVideo,
  saveVideoToVault,
  listVaultVideos,
  deleteVaultVideo,
  uploadSavedVaultVideoToYouTube,
} from '../engine/videoVaultDb';
import { HeadBotAutopilotPanel } from './HeadBotAutopilotPanel';
import { JarvisAutonomyPanel } from './JarvisAutonomyPanel';

interface RadarBubble {
  id: string;
  name: string;
  handle: string;
  initials: string;
  color: string;
  platform: 'IG' | 'RD' | 'WA' | 'YT';
  comment: string;
  score: number;
  isBuyer: boolean;
  angleDeg: number;
  radiusPct: number;
  phone: string;
  budget: string;
  timeline: string;
}

const DEFAULT_BUBBLES: RadarBubble[] = [
  {
    id: 'b1',
    name: 'Daniel Chen',
    handle: '@daniel.chen',
    initials: 'DC',
    color: '#2563eb',
    platform: 'IG',
    comment: 'Is this still available? Ready budget ₹1.2 Cr, want tour this weekend.',
    score: 92,
    isBuyer: true,
    angleDeg: -62,
    radiusPct: 37,
    phone: '+919876543210',
    budget: '₹1.2 Cr',
    timeline: '60 days',
  },
  {
    id: 'b2',
    name: 'Priya Shah',
    handle: '@priya.shah',
    initials: 'PS',
    color: '#059669',
    platform: 'WA',
    comment: 'Pre-approved buyer here, share location & Saturday morning slot.',
    score: 88,
    isBuyer: true,
    angleDeg: 138,
    radiusPct: 39,
    phone: '+919811223344',
    budget: '₹95 Lakhs',
    timeline: '30 days',
  },
  {
    id: 'b3',
    name: 'u/kyle_r',
    handle: 'u/kyle_r',
    initials: 'KR',
    color: '#ea580c',
    platform: 'RD',
    comment: 'Need 4 beds / prime unit near metro, moving in 60 days.',
    score: 90,
    isBuyer: true,
    angleDeg: 54,
    radiusPct: 40,
    phone: '+919900112233',
    budget: '₹1.35 Cr',
    timeline: '60 days',
  },
  {
    id: 'b4',
    name: 'u/lena_h',
    handle: 'u/lena_h',
    initials: 'LH',
    color: '#7c3aed',
    platform: 'RD',
    comment: 'Serious investor looking for ready unit with rental yield.',
    score: 85,
    isBuyer: true,
    angleDeg: -22,
    radiusPct: 38,
    phone: '+919822334455',
    budget: '₹80 Lakhs',
    timeline: '45 days',
  },
  {
    id: 'b5',
    name: 'sam.k',
    handle: '@sam.k',
    initials: 'SK',
    color: '#64748b',
    platform: 'IG',
    comment: 'Nice song and transition bro 🔥',
    score: 14,
    isBuyer: false,
    angleDeg: 192,
    radiusPct: 33,
    phone: '',
    budget: '-',
    timeline: '-',
  },
  {
    id: 'b6',
    name: 'u/dan_9',
    handle: 'u/dan_9',
    initials: 'D9',
    color: '#94a3b8',
    platform: 'RD',
    comment: 'Just window shopping architecture photos lol',
    score: 11,
    isBuyer: false,
    angleDeg: 12,
    radiusPct: 35,
    phone: '',
    budget: '-',
    timeline: '-',
  },
];

const DEPT_BOXES = [
  { code: '01', flow: 'Flow A', title: 'MARKET RESEARCH', lead: '5 Agents', badges: ['🔍', '📊', '📍', '📈'], desc: 'Buyer search trends & viral hooks' },
  { code: '02', flow: 'Flow A→B', title: 'CONTENT ENGINE', lead: '6 Agents', badges: ['📷', '✳️', '🎬', '🔊'], desc: 'Photos → Claude script → 9:16 video' },
  { code: '03', flow: 'Flow B', title: 'CONTENT STUDIO', lead: '5 Agents', badges: ['📝', '🎨', '✂️', '🗂️'], desc: 'Captions, hooks & brand templates' },
  { code: '04', flow: 'Flow B', title: 'PUBLISHING', lead: '5 Agents', badges: ['📸', '🎵', '▶️', '💼'], desc: 'Auto-posts IG, YT Shorts & FB' },
  { code: '05', flow: 'Flow C', title: 'LEAD INTELLIGENCE', lead: '6 Agents', badges: ['💬', '🤖', '🎯', '⚡'], desc: 'Reads DMs/Reddit & scores buyers' },
  { code: '06', flow: 'Flow C', title: 'BOOKING & CALL', lead: '5 Agents', badges: ['📞', '🎙️', '📅', '✅'], desc: '<60s voice call & calendar booking' },
  { code: '07', flow: 'Flow D', title: 'FOLLOW-UP & NURTURE', lead: '5 Agents', badges: ['📲', '🔁', '💌', '🔔'], desc: 'WhatsApp follow-up till closing' },
  { code: '08', flow: 'Flow E', title: 'REVIEWS & REFERRALS', lead: '4 Agents', badges: ['⭐', '🏆', '🎁', '🤝'], desc: '5-star reviews & referral engine' },
];

function speakLoud(text: string) {
  try {
    const bridge = (window as any).ApexAndroid;
    if (bridge?.speakNative) {
      bridge.speakNative(text, 'hi-IN', `reel_${Date.now()}`);
      return;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'hi-IN';
      u.rate = 1.03;
      window.speechSynthesis.speak(u);
    }
  } catch {}
}

export const AgentTeamPanel: React.FC<{
  onToast: (msg: string) => void;
  autoVoiceTask?: { action?: 'make_and_save' | 'upload_saved' | 'open_only' | 'headbot_autopilot'; topic: string; refUrl?: string; nonce: number } | null;
}> = ({ onToast, autoVoiceTask }) => {
  const [stage, setStage] = useState<'openvideo' | 'autopilot' | 'jarvis' | 'map' | 'engine' | 'leads' | 'booking' | 'morning'>('openvideo');
  const [autoTourRunning, setAutoTourRunning] = useState(false);

  // OpenMontage Autonomous Video Agent ("OpenMontage khol kar video bana kar SAVE rakho — jab time aaye tab Upload karunga!")
  const [omTopic, setOmTopic] = useState('AI Agents Se Automatic Business Growth Kaise Karein');
  const [omRefLink, setOmRefLink] = useState('');
  const [omDuration, setOmDuration] = useState<30 | 60>(30);
  const [omAutoWhatsApp, setOmAutoWhatsApp] = useState(false);
  const [omAutoYouTube, setOmAutoYouTube] = useState(false);
  const [omStage, setOmStage] = useState<BacklotStageId>('idle');
  const [omProgress, setOmProgress] = useState(0);
  const [omLog, setOmLog] = useState('Ready — Topic bolein ya likhein: Video ban kar Vault + Gallery mein SAVE rahega!');
  const [omScenes, setOmScenes] = useState<MontageScene[]>([]);
  const [omVideo, setOmVideo] = useState<ProducedMontageVideo | null>(null);
  const [omVoiceListening, setOmVoiceListening] = useState(false);
  const [vaultVideos, setVaultVideos] = useState<(SavedVaultVideo & { previewUrl: string })[]>([]);
  const [uploadingVaultId, setUploadingVaultId] = useState<string | null>(null);
  const omBusyRef = useRef(false);

  const refreshVault = async () => {
    const items = await listVaultVideos();
    setVaultVideos(
      items.map((it) => ({
        ...it,
        previewUrl: URL.createObjectURL(it.blob),
      }))
    );
  };

  useEffect(() => {
    refreshVault();
  }, []);

  // Optional Scheduled Auto-Upload Watcher (checks every 15s if any saved video reached its scheduled upload time!)
  useEffect(() => {
    const timer = setInterval(async () => {
      const now = Date.now();
      const due = vaultVideos.find((v) => v.scheduledAt && v.scheduledAt <= now && !v.uploadedYoutubeUrl);
      if (due && !uploadingVaultId) {
        handleManualUploadVaultItem(due);
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [vaultVideos, uploadingVaultId]);

  const handleManualUploadVaultItem = async (item: SavedVaultVideo) => {
    setUploadingVaultId(item.id);
    onToast(`📤 Uploading "${item.title}" to YouTube Shorts…`);
    speakLoud(`Boss, aapka saved video "${item.title}" ab YouTube par upload ho raha hai!`);
    try {
      const url = await uploadSavedVaultVideoToYouTube(item, 'public');
      await refreshVault();
      onToast(`✅ Uploaded Live on YouTube: ${url}`);
      speakLoud('Mubarak ho Boss! Aapka saved video YouTube Shorts par live upload ho chuka hai!');
    } catch (err: any) {
      onToast(`⚠️ ${err?.message || 'Connect YouTube token first in 🤖 YT AUTO tab'}`);
    } finally {
      setUploadingVaultId(null);
    }
  };

  const handleShareBlobToPlatform = async (
    blob: Blob,
    fileName: string,
    mimeType: string,
    title: string,
    baseCaption: string,
    platform: 'instagram' | 'facebook' | 'youtube' | 'gallery'
  ) => {
    const raw = new Uint8Array(await blob.arrayBuffer());
    const b64 = uint8ToBase64(raw);
    const bridge = (window as any).ApexAndroid;

    const platformCaption =
      platform === 'instagram'
        ? `${title} 🔥✨\n\n${baseCaption}\n\n#reelsindia #instagramreels #viralvideos #trendingreels #explorepage #ai`
        : platform === 'facebook'
        ? `📢 ${title}\n\n${baseCaption}\n\n👍 Follow & Share karein aise aur videos ke liye! #FacebookReels #ViralVideo #India`
        : `${title} #Shorts #YouTubeShorts\n\n${baseCaption}`;

    try {
      await navigator.clipboard?.writeText(platformCaption);
    } catch {}

    if (platform === 'gallery') {
      if (bridge?.saveVideoToGalleryOnly) {
        bridge.saveVideoToGalleryOnly(b64, fileName, mimeType);
        onToast('💾 Video safely Phone Gallery (Movies/APEX_AI) mein SAVE ho gaya — kisi ko send nahi hua!');
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      onToast('💾 Video safely aapke device mein save ho gaya!');
      return;
    }

    if (bridge?.shareVideoToPlatform) {
      bridge.shareVideoToPlatform(b64, fileName, mimeType, platformCaption, platform);
      const label =
        platform === 'instagram' ? '📸 Instagram' : platform === 'facebook' ? '📘 Facebook' : '▶️ YouTube';
      onToast(`${label} khul raha hai — Caption clipboard me copy ho chuka hai!`);
      return;
    }

    const file = new File([blob], fileName, { type: mimeType });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title, text: platformCaption, files: [file] });
      return;
    }

    const webFallback =
      platform === 'instagram'
        ? 'https://www.instagram.com/'
        : platform === 'facebook'
        ? 'https://www.facebook.com/reels/create/'
        : 'https://studio.youtube.com/';
    window.open(webFallback, '_blank');
    onToast(`📋 Caption copy ho gaya! Video select karke post karein.`);
  };

  // Shared Topic / Channel / Social Campaign State (Save-First — NO unsolicited client send!)
  const [listingTitle, setListingTitle] = useState('AI Smart Growth & Viral Reels Studio');
  const [clientPhone, setClientPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [clientName, setClientName] = useState('Creator');
  const [selectedMotionIdx, setSelectedMotionIdx] = useState<number>(0);

  // Content Engine Real Motion Video State
  const [photos, setPhotos] = useState<string[]>([]);
  const [genPct, setGenPct] = useState(100);
  const [scriptText, setScriptText] = useState(
    'Hook: Dekhiye kaise AI har roz Instagram Reels, Facebook Page aur YouTube Shorts ke liye HD motion videos aur viral captions taiyar karke Vault me save rakhta hai!'
  );
  const [videoApproved, setVideoApproved] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  // Lead Radar State (40s -> 48s)
  const [bubbles, setBubbles] = useState<RadarBubble[]>(DEFAULT_BUBBLES);
  const [activeFeedIdx, setActiveFeedIdx] = useState(0);
  const [scoredMode, setScoredMode] = useState(true);
  const [newCommentText, setNewCommentText] = useState('');

  // 60s Voice Qualifier Call State (56s -> 64s)
  const [callStep, setCallStep] = useState<0 | 1 | 2 | 3 | 4>(4);
  const [callTimer, setCallTimer] = useState(58);
  const [liveTranscript, setLiveTranscript] = useState<{ ai: string; user: string }>({
    ai: 'Are you pre-approved?',
    user: 'Yes, pre-approved — ready within 60 days!',
  });

  // Growth Director Live Traces (72s -> 76s)
  const [traces, setTraces] = useState(1284);

  // Rotate live comment banner ONLY when Lead Radar screen is visible (0% CPU wakeup otherwise!)
  useEffect(() => {
    if (stage !== 'leads') return;
    const id = setInterval(() => {
      setActiveFeedIdx((i) => (i + 1) % bubbles.length);
    }, 3200);
    return () => clearInterval(id);
  }, [stage, bubbles.length]);

  const startAgentVideoMission = async (overrideTopic?: string, overrideLink?: string) => {
    if (omBusyRef.current) return;
    omBusyRef.current = true;
    setStage('openvideo');
    const chosenTopic = (overrideTopic ?? omTopic).trim() || 'Future AI & Automation';
    const chosenLink = (overrideLink ?? omRefLink).trim();
    if (overrideTopic) setOmTopic(chosenTopic);
    if (overrideLink) setOmRefLink(chosenLink);

    speakLoud(
      `Boss, 41-Agent Group ne "${chosenTopic}" ka kaam shuru kar diya hai! Link check karke script, HD visuals aur Hindi voiceover jod kar video taiyaar kar raha hoon.`
    );

    try {
      const produced = await runOpenMontageProduction({
        topic: chosenTopic,
        referenceUrl: chosenLink,
        targetSeconds: omDuration,
        autoUploadYouTube: omAutoYouTube,
        onStage: (st, line, pct, scList) => {
          setOmStage(st);
          setOmLog(line);
          setOmProgress(pct);
          if (scList) setOmScenes([...scList]);
        },
      });
      setOmVideo(produced);

      // DOUBLE PERMANENT SAVE: 1) Permanent In-App IndexedDB Vault + 2) Phone Gallery Movies/APEX_AI!
      const vaultEntry: SavedVaultVideo = {
        id: `vid_${Date.now()}`,
        createdAt: Date.now(),
        title: produced.title,
        caption: produced.caption,
        fileName: produced.fileName,
        mimeType: produced.mimeType,
        durationSec: produced.durationSec,
        sizeBytes: produced.blob.size,
        blob: produced.blob,
        uploadedYoutubeUrl: produced.youtubeUrl || null,
      };
      await saveVideoToVault(vaultEntry);
      await refreshVault();

      try {
        (window as any).ApexAndroid?.saveVideoToGallery?.(
          produced.base64,
          produced.fileName,
          produced.mimeType
        );
      } catch {}

      onToast('💾 Video + Hindi Voiceover SAVED in Vault & Phone Gallery! Upload jab aap chahein!');
      speakLoud(
        'Boss, aapka AI video voiceover ke saath ban kar Vault aur Gallery dono jagah save ho chuka hai! Jab aapka time aaye tab Upload daba kar ya bol kar upload kar sakte hain.'
      );
      if (omAutoWhatsApp) {
        setTimeout(() => {
          shareMontageVideoToWhatsApp(produced, true).catch(() => {});
        }, 650);
      }
    } catch (e: any) {
      setOmStage('error');
      setOmLog(`❌ Error: ${e?.message || 'Production interrupted'}`);
    } finally {
      omBusyRef.current = false;
    }
  };

  // Auto-run whenever Main Screen Voice Assistant sends OpenMontage Create+Save OR Upload-Saved task!
  const lastHandledNonceRef = useRef<number>(0);
  useEffect(() => {
    if (autoVoiceTask && autoVoiceTask.nonce !== lastHandledNonceRef.current) {
      lastHandledNonceRef.current = autoVoiceTask.nonce;
      if (autoVoiceTask.action === 'headbot_autopilot') {
        setStage('autopilot');
        speakLoud(
          'Head Bot Autopilot chalu kar diya hai Boss. Main ab live internet par research karunga, dusri websites se real HD footage uthaunga, video bana kar Vault aur Gallery mein save kar dunga, aur aapke bataye samay par use khud upload bhi kar dunga.'
        );
        return;
      }
      setStage('openvideo');
      if (autoVoiceTask.action === 'open_only') {
        speakLoud('OpenMontage Studio khol diya hai Boss! Topic boliye, main video bana kar save kar dunga.');
      } else if (autoVoiceTask.action === 'upload_saved') {
        listVaultVideos().then((list) => {
          const target = list.find((v) => !v.uploadedYoutubeUrl) || list[0];
          if (target) {
            handleManualUploadVaultItem(target);
          } else {
            onToast('⚠️ Abhi Vault mein koi saved video nahi hai — pehle 1 video banayein!');
            speakLoud('Boss, abhi Vault mein koi saved video nahi hai, pehle topic bol kar video banwa lijiye.');
          }
        });
      } else {
        startAgentVideoMission(autoVoiceTask.topic, autoVoiceTask.refUrl);
      }
    }
  }, [autoVoiceTask]);

  // Dictate Topic / Task by Voice right inside Studio card!
  const dictateTaskByVoice = () => {
    const bridge = (window as any).ApexAndroid;
    if (bridge?.hasNativeStt?.()) {
      setOmVoiceListening(true);
      let gotText = '';
      let done = false;
      const commit = (txt: string) => {
        if (done) return;
        done = true;
        setOmVoiceListening(false);
        try {
          bridge.stopNativeListen();
        } catch {}
        const clean = (txt || '').trim();
        if (clean) {
          setOmTopic(clean);
          startAgentVideoMission(clean, omRefLink);
        }
      };
      (window as any).__onApexSpeechPartial = (p: string) => {
        gotText = p || gotText;
      };
      (window as any).__onApexSpeechFinal = (f: string) => commit(f || gotText);
      (window as any).__onApexSpeechEnd = () => setTimeout(() => commit(gotText), 120);
      (window as any).__onApexSpeechError = () => commit(gotText);
      bridge.startNativeListen('hi-IN');
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const r = new SR();
      r.lang = 'hi-IN';
      setOmVoiceListening(true);
      r.onresult = (ev: any) => {
        const spoken = String(ev.results?.[0]?.[0]?.transcript || '').trim();
        setOmVoiceListening(false);
        if (spoken) {
          setOmTopic(spoken);
          startAgentVideoMission(spoken, omRefLink);
        }
      };
      r.onerror = () => setOmVoiceListening(false);
      r.onend = () => setOmVoiceListening(false);
      r.start();
    } else {
      onToast('Mic not supported in this browser — type topic & tap Launch!');
    }
  };

  // Animated Content Engine 0% -> 100% pipeline simulation + real AI script fetch
  const runContentEngine = async () => {
    setStage('engine');
    setVideoApproved(false);
    setGenPct(12);
    const timer = setInterval(() => {
      setGenPct((p) => (p >= 96 ? 96 : p + 14));
    }, 260);
    try {
      const r = await hubFetch('/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: `Write a crisp 2-sentence viral Instagram Reel walkthrough voiceover hook for "${listingTitle}" ending with a call-to-action to comment INFO for instant 60-second booking.`,
          history: [],
        }),
      });
      const j = await r.json();
      if (j?.reply) setScriptText(String(j.reply).trim());
    } catch {}
    clearInterval(timer);
    setGenPct(100);
    onToast('🎬 9:16 AI Video + Voiceover Ready — Waiting for YOUR Approval!');
  };

  // Animated 60-Second Voice Call Qualification Sequence (Exact 56s -> 60s -> 64s of Reel!)
  const runLiveVoiceCallDemo = () => {
    setStage('booking');
    setCallStep(0);
    setCallTimer(12);
    setLiveTranscript({ ai: 'Calling buyer back in <60s…', user: 'Ringing…' });
    speakLoud(
      `Hello ${clientName}! Main AI Growth Assistant bol raha hoon ${listingTitle} ke liye. Aapka budget 1.2 Crore, bank pre-approval Yes, aur 60 days timeline confirm ho gaya hai. Saturday 11 AM showing calendar par book kar di gayi hai!`
    );

    setTimeout(() => {
      setCallStep(1);
      setCallTimer(24);
      setLiveTranscript({ ai: 'What is your budget?', user: 'Around ₹1.2 Cr ($1.2M)' });
    }, 1400);

    setTimeout(() => {
      setCallStep(2);
      setCallTimer(41);
      setLiveTranscript({ ai: 'What is your timeline to move?', user: 'Within 60 days.' });
    }, 2900);

    setTimeout(() => {
      setCallStep(3);
      setCallTimer(52);
      setLiveTranscript({ ai: 'Are you pre-approved?', user: 'Yes, with my bank!' });
    }, 4400);

    setTimeout(() => {
      setCallStep(4);
      setCallTimer(58);
      onToast('✅ Buyer Qualified & Sat 11:00 Slot Booked on Calendar!');
    }, 5800);
  };

  // Auto-Play Entire 5-Screen Reel Walkthrough Automatically!
  const playFullReelDemo = () => {
    if (autoTourRunning) return;
    setAutoTourRunning(true);
    setStage('map');
    speakLoud(
      'Yeh 41 AI Agents ki poori automated social media aur sales team hai: Content Engine video banata hai, Jev Radar asli buyers dhoondhta hai, aur Voice Agent 60 second mein call karke booking confirm karta hai!'
    );
    setTimeout(() => {
      runContentEngine();
    }, 3200);
    setTimeout(() => {
      setVideoApproved(true);
      setStage('leads');
      setScoredMode(false);
      setTimeout(() => setScoredMode(true), 1500);
    }, 7000);
    setTimeout(() => {
      runLiveVoiceCallDemo();
    }, 11200);
    setTimeout(() => {
      setStage('morning');
      setAutoTourRunning(false);
    }, 18000);
  };

  const sendWhatsAppDirect = (phoneRaw: string, msg: string) => {
    const clean = phoneRaw.replace(/[^0-9]/g, '');
    const target = clean ? (clean.length === 10 ? `91${clean}` : clean) : '';
    const url = target
      ? `https://wa.me/${target}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    onToast('📲 WhatsApp opened with ready AI pitch & booking link!');
  };

  const addCustomInquiryToRadar = () => {
    if (!newCommentText.trim()) return;
    const isReal = /buy|price|budget|tour|visit|interested|ready|crore|lakh|slot|book|number|call|chahiye|rate/i.test(
      newCommentText
    );
    const sc = isReal ? Math.floor(89 + Math.random() * 9) : Math.floor(10 + Math.random() * 14);
    const added: RadarBubble = {
      id: `custom_${Date.now()}`,
      name: clientName || 'New Lead',
      handle: whatsappNumber || '@new_lead',
      initials: (clientName || 'NL').slice(0, 2).toUpperCase(),
      color: isReal ? '#16a34a' : '#64748b',
      platform: 'WA',
      comment: newCommentText.trim(),
      score: sc,
      isBuyer: isReal,
      angleDeg: Math.floor(Math.random() * 320 - 160),
      radiusPct: 36,
      phone: whatsappNumber,
      budget: isReal ? 'Verified Buyer' : '-',
      timeline: isReal ? '30 days' : '-',
    };
    setBubbles((prev) => [added, ...prev]);
    setNewCommentText('');
    setScoredMode(true);
    onToast(isReal ? `🟢 Real Buyer Scored ${sc}!` : `⚪ Browser Filtered (${sc})`);
  };

  const realBuyers = bubbles.filter((b) => b.isBuyer);
  const browsers = bubbles.filter((b) => !b.isBuyer);
  const currentBanner = bubbles[activeFeedIdx % bubbles.length];

  return (
    <div className="rounded-2xl bg-[#f8fafc] text-[#0f172a] p-3.5 sm:p-4 shadow-2xl border border-white/40 font-sans space-y-3.5">
      {/* INLINE CSS KEYFRAMES FOR RADAR BEAM & CIRCUIT PULSES */}
      <style>{`
        @keyframes apexRadarSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes apexDashFlow {
          to { stroke-dashoffset: -28; }
        }
      `}</style>

      {/* TOP REEL BRAND BAR: Claude · ElevenLabs · Jev · Higgsfield + ▶ Play Full Reel Demo */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-[#fde8e0] text-[#c2410c] font-black text-[11px]">✳ Claude</span>
            <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-bold text-[11px]">||ElevenLabs</span>
            <span className="px-2 py-0.5 rounded-md bg-[#f5d0fe] text-[#86198f] font-black text-[11px]">◈ Jev AI</span>
            <span className="px-2 py-0.5 rounded-md bg-[#d9f99d] text-[#365314] font-black text-[11px]">〰 Studio 9:16</span>
          </div>
          <div className="text-sm sm:text-base font-black text-slate-900 mt-1 tracking-tight">
            41-Agent AI Social Media &amp; Sales Team
          </div>
        </div>

        <button
          onClick={playFullReelDemo}
          className="px-3.5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs cursor-pointer shadow-md flex items-center gap-1.5"
        >
          <span>{autoTourRunning ? '⚡ Playing Live Reel Flow…' : '▶ Auto-Play Like Reel'}</span>
        </button>
      </div>

      {/* SOCIAL PLATFORM PILL SWITCHER (Save-First + Instagram + Facebook + YouTube Studio!) */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-1.5 rounded-full bg-slate-200/75">
        {[
          { id: 'openvideo', dot: '#ec4899', label: '🎬 AI Video (IG · FB · YT)' },
          { id: 'autopilot', dot: '#f59e0b', label: '👑 Head Bot Autopilot' },
          { id: 'jarvis', dot: '#22d3ee', label: '🛰️ Jarvis Core (khud chalne wala)' },
          { id: 'engine', dot: '#84cc16', label: '🎞️ Motion Studio' },
          { id: 'map', dot: '#ea580c', label: '41-Agent Blueprint' },
          { id: 'leads', dot: '#d946ef', label: 'Lead Intelligence' },
          { id: 'booking', dot: '#10b981', label: 'AI Voice Agent' },
          { id: 'morning', dot: '#2563eb', label: 'Growth Analytics' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setStage(t.id as any)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 ${
              stage === t.id
                ? 'bg-slate-950 text-white shadow-md scale-[1.01]'
                : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: t.dot }} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* INSTAGRAM + FACEBOOK + YOUTUBE SAVE-FIRST CREATOR HUB (Replaces Client WhatsApp Send Box!) */}
      <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 font-black text-[10.5px]">
              💾 SAVE-FIRST LOCK ON (Auto-Send OFF)
            </span>
            <span className="text-[11px] font-semibold text-slate-600">
              Pehle Vault + Gallery mein safe save rakhein — jab chahein tab Instagram, Facebook ya YouTube par post karein!
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
          <input
            value={listingTitle}
            onChange={(e) => {
              setListingTitle(e.target.value);
              setOmTopic(e.target.value);
            }}
            placeholder="Apna Video Topic / Channel Name likhein…"
            className="sm:col-span-8 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
          />
          <button
            onClick={() => startAgentVideoMission(listingTitle, omRefLink)}
            className="sm:col-span-4 py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xs cursor-pointer text-center"
          >
            💾 Video Banakar Save Rakho
          </button>
        </div>

        {/* 3 DEDICATED SOCIAL PLATFORM CARDS: INSTAGRAM · FACEBOOK · YOUTUBE */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* 1. INSTAGRAM REELS */}
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-pink-50 via-purple-50 to-amber-50 border border-pink-300 flex flex-col justify-between gap-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-pink-800">📸 Instagram Reels</span>
                <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-pink-200/80 text-pink-950">9:16 HD</span>
              </div>
              <p className="text-[10.5px] text-slate-700 mt-1 line-clamp-2">
                {listingTitle} 🔥✨ #reelsindia #instagramreels #trendingreels #viral
              </p>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={async () => {
                  const cap = `${listingTitle} 🔥✨\n\n${scriptText}\n\n#reelsindia #instagramreels #trendingreels #viralvideo #explorepage`;
                  try { await navigator.clipboard?.writeText(cap); } catch {}
                  onToast('📋 Instagram Reel Caption + Hashtags Copy Ho Gaya!');
                }}
                className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-pink-300 text-pink-900 font-extrabold text-[10.5px] cursor-pointer"
              >
                📋 Copy Caption
              </button>
              <button
                onClick={() => {
                  if (omVideo) {
                    handleShareBlobToPlatform(omVideo.blob, omVideo.fileName, omVideo.mimeType, omVideo.title, omVideo.caption, 'instagram');
                  } else if (vaultVideos[0]) {
                    handleShareBlobToPlatform(vaultVideos[0].blob, vaultVideos[0].fileName, vaultVideos[0].mimeType, vaultVideos[0].title, vaultVideos[0].caption, 'instagram');
                  } else {
                    window.open('https://www.instagram.com/', '_blank');
                    onToast('📸 Instagram khol diya gaya hai!');
                  }
                }}
                className="flex-1 py-1.5 px-2 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black text-[10.5px] cursor-pointer"
              >
                📸 Instagram
              </button>
            </div>
          </div>

          {/* 2. FACEBOOK REELS & PAGE */}
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-300 flex flex-col justify-between gap-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-blue-900">📘 Facebook Video</span>
                <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-blue-200/80 text-blue-950">Reels + Page</span>
              </div>
              <p className="text-[10.5px] text-slate-700 mt-1 line-clamp-2">
                📢 {listingTitle} — Like, Share &amp; Follow karein! #FacebookReels #ViralVideo
              </p>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={async () => {
                  const cap = `📢 ${listingTitle}\n\n${scriptText}\n\n👍 Follow & Share karein! #FacebookReels #ViralVideo #India`;
                  try { await navigator.clipboard?.writeText(cap); } catch {}
                  onToast('📋 Facebook Post Description Copy Ho Gaya!');
                }}
                className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-blue-300 text-blue-900 font-extrabold text-[10.5px] cursor-pointer"
              >
                📋 Copy Post
              </button>
              <button
                onClick={() => {
                  if (omVideo) {
                    handleShareBlobToPlatform(omVideo.blob, omVideo.fileName, omVideo.mimeType, omVideo.title, omVideo.caption, 'facebook');
                  } else if (vaultVideos[0]) {
                    handleShareBlobToPlatform(vaultVideos[0].blob, vaultVideos[0].fileName, vaultVideos[0].mimeType, vaultVideos[0].title, vaultVideos[0].caption, 'facebook');
                  } else {
                    window.open('https://m.facebook.com/', '_blank');
                    onToast('📘 Facebook khol diya gaya hai!');
                  }
                }}
                className="flex-1 py-1.5 px-2 rounded-lg bg-[#1877F2] text-white font-black text-[10.5px] cursor-pointer"
              >
                📘 Facebook
              </button>
            </div>
          </div>

          {/* 3. YOUTUBE SHORTS & STUDIO */}
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-50 to-orange-50 border border-red-300 flex flex-col justify-between gap-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-red-900">▶️ YouTube Shorts</span>
                <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-red-200/80 text-red-950">SEO Ready</span>
              </div>
              <p className="text-[10.5px] text-slate-700 mt-1 line-clamp-2">
                {listingTitle} #Shorts #YouTubeShorts #ViralShorts
              </p>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={async () => {
                  const cap = `${listingTitle} #Shorts #YouTubeShorts\n\n${scriptText}`;
                  try { await navigator.clipboard?.writeText(cap); } catch {}
                  onToast('📋 YouTube SEO Title + Tags Copy Ho Gaya!');
                }}
                className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-red-300 text-red-900 font-extrabold text-[10.5px] cursor-pointer"
              >
                📋 Copy SEO
              </button>
              <button
                onClick={() => {
                  if (vaultVideos[0]) {
                    handleManualUploadVaultItem(vaultVideos[0]);
                  } else if (omVideo) {
                    handleShareBlobToPlatform(omVideo.blob, omVideo.fileName, omVideo.mimeType, omVideo.title, omVideo.caption, 'youtube');
                  } else {
                    window.open('https://studio.youtube.com/', '_blank');
                    onToast('▶️ YouTube Studio khol diya gaya hai!');
                  }
                }}
                className="flex-1 py-1.5 px-2 rounded-lg bg-red-600 text-white font-black text-[10.5px] cursor-pointer"
              >
                ▶️ YouTube
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SCREEN -1: 👑 HEAD BOT AUTOPILOT (Live Research → Dusri Site → Video → 💾 Save → ⏰ Auto-Upload) */}
      {/* ===================================================================== */}
      {stage === 'jarvis' && <JarvisAutonomyPanel onToast={onToast} />}

      {stage === 'autopilot' && <HeadBotAutopilotPanel onToast={onToast} />}

      {/* ===================================================================== */}
      {/* SCREEN 0: OPENMONTAGE × 41-AGENT FREE 1-MINUTE AI VIDEO PRODUCER      */}
      {/* ("Bol Kar Agent Ko Kaam Do -> Check Link -> Make Video -> WhatsApp!") */}
      {/* ===================================================================== */}
      {stage === 'openvideo' && (
        <div className="p-3.5 rounded-2xl bg-[#0d111a] text-white border border-slate-800 space-y-3 shadow-xl">
          {/* Header Banner with Monty Clapper Badge + OpenMontage Repo Link */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-400 flex items-center justify-center text-xl">
                🎬
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs sm:text-sm font-black text-white">
                    OpenMontage Free 1-Minute AI Video Agent
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white text-[9.5px] font-black">
                    ₹0 OPEN-SOURCE
                  </span>
                </div>
                <div className="text-[10.5px] text-slate-300">
                  Bol kar ya Reference Link de kar Agent Group se video banwayein → YouTube Upload + Direct WhatsApp Video!
                </div>
              </div>
            </div>

            <a
              href="https://github.com/calesthio/OpenMontage"
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-orange-300 text-[10px] font-bold"
            >
              🔗 OpenMontage Repo ↗
            </a>
          </div>

          {/* Step 1: Speak Task OR Enter Topic + Reference Check Link */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                value={omTopic}
                onChange={(e) => setOmTopic(e.target.value)}
                placeholder="Topic bolein ya likhein (e.g. Luxury Villa Tour / AI Trading Secrets)"
                className="flex-1 bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
              />
              <button
                onClick={dictateTaskByVoice}
                className={`px-3 py-2 rounded-xl font-extrabold text-xs cursor-pointer shrink-0 ${
                  omVoiceListening
                    ? 'bg-emerald-400 text-slate-950 animate-pulse'
                    : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                }`}
              >
                {omVoiceListening ? '🎙️ Sun raha hai…' : '🎤 Bol Kar Kaam Dein'}
              </button>
            </div>

            <input
              value={omRefLink}
              onChange={(e) => setOmRefLink(e.target.value)}
              placeholder="🔗 Optional Check Link (Paste YouTube / Reel / Product / Website URL — Agent khud check karega!)"
              className="w-full bg-slate-900 border border-orange-400/35 rounded-xl px-3 py-2 text-xs text-orange-100 font-mono"
            />
          </div>

          {/* Duration + Save-First Guarantee */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setOmDuration(30)}
                className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer border ${
                  omDuration === 30 ? 'bg-white text-slate-950 border-white' : 'bg-slate-900 text-slate-300 border-white/15'
                }`}
              >
                ⚡ 30s IG / FB / YT Reel
              </button>
              <button
                onClick={() => setOmDuration(60)}
                className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer border ${
                  omDuration === 60 ? 'bg-orange-500 text-white border-orange-400' : 'bg-slate-900 text-slate-300 border-white/15'
                }`}
              >
                🎬 Full 1-Min (60s) Video
              </button>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold">
                💾 Default: Save in Vault Only (No Auto-Send!)
              </span>
            </div>
          </div>

          {/* Primary Launch & Save Button */}
          <button
            onClick={() => startAgentVideoMission()}
            disabled={omStage !== 'idle' && omStage !== 'done' && omStage !== 'error'}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 via-pink-500 to-emerald-500 hover:brightness-110 text-white font-black text-xs sm:text-sm cursor-pointer shadow-lg disabled:opacity-60"
          >
            {omStage !== 'idle' && omStage !== 'done' && omStage !== 'error'
              ? `⚡ Video Ban Raha Hai (${omProgress}%) — ${omLog}`
              : '💾 Make Video & Save in Vault (Jab Time Aaye Tab Upload Karein!)'}
          </button>

          {/* THE BACKLOT LIVING STORYBOARD (Exact Reel 085s Live Stage Pipeline!) */}
          <div className="p-3 rounded-xl bg-black/60 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-[10.5px] font-bold">
              <span className="text-orange-300">🎞️ THE BACKLOT LIVING STORYBOARD</span>
              <span className="font-mono text-emerald-400">{omProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-400 to-emerald-400 transition-all duration-300"
                style={{ width: `${omProgress}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-200 font-mono truncate">{omLog}</div>

            {omScenes.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                {omScenes.map((sc) => (
                  <div key={sc.index} className="p-2 rounded-lg bg-slate-900/90 border border-white/10">
                    <div className="text-[9px] font-black" style={{ color: sc.accentHex }}>
                      {sc.tag} · {Math.round(sc.durationSec)}s
                    </div>
                    <div className="text-[10px] font-bold text-white truncate mt-0.5">{sc.headline}</div>
                    <div className="text-[9px] text-slate-400 line-clamp-2 mt-0.5">{sc.narration}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PLAYABLE GENERATED VIDEO + 1-TAP ACTUAL WHATSAPP VIDEO SHARE & SAVE */}
          {omVideo && (
            <div className="p-3 rounded-2xl bg-emerald-950/60 border-2 border-emerald-400 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-black text-emerald-300">
                    ✅ VIDEO READY WITH HINDI VOICEOVER ({omVideo.durationSec}s)
                  </div>
                  <div className="text-xs font-bold text-white">{omVideo.title}</div>
                  {omVideo.youtubeUrl && (
                    <a
                      href={omVideo.youtubeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-sky-300 underline font-bold"
                    >
                      ▶️ Live on YouTube: {omVideo.youtubeUrl} ↗
                    </a>
                  )}
                </div>
              </div>

              <video
                src={omVideo.url}
                controls
                playsInline
                className="w-full max-h-[300px] rounded-xl bg-black border border-white/15 mx-auto"
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => handleShareBlobToPlatform(omVideo.blob, omVideo.fileName, omVideo.mimeType, omVideo.title, omVideo.caption, 'gallery')}
                  className="py-2.5 px-2 rounded-xl bg-white text-slate-950 font-black text-xs cursor-pointer"
                >
                  💾 Save Gallery
                </button>
                <button
                  onClick={() => handleShareBlobToPlatform(omVideo.blob, omVideo.fileName, omVideo.mimeType, omVideo.title, omVideo.caption, 'instagram')}
                  className="py-2.5 px-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black text-xs cursor-pointer"
                >
                  📸 Instagram
                </button>
                <button
                  onClick={() => handleShareBlobToPlatform(omVideo.blob, omVideo.fileName, omVideo.mimeType, omVideo.title, omVideo.caption, 'facebook')}
                  className="py-2.5 px-2 rounded-xl bg-[#1877F2] text-white font-black text-xs cursor-pointer"
                >
                  📘 Facebook
                </button>
                <button
                  onClick={() => handleShareBlobToPlatform(omVideo.blob, omVideo.fileName, omVideo.mimeType, omVideo.title, omVideo.caption, 'youtube')}
                  className="py-2.5 px-2 rounded-xl bg-red-600 text-white font-black text-xs cursor-pointer"
                >
                  ▶️ YouTube
                </button>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* PERMANENT SAVED VIDEOS VAULT ("Save karke rakhiye -> Jab time aaye Upload karein!") */}
          {/* =================================================================== */}
          <div className="p-3 rounded-2xl bg-slate-950/90 border border-amber-400/35 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-black text-amber-300">
                💾 SAVED VIDEOS VAULT ({vaultVideos.length}) — Jab Chahein Tab Upload Karein!
              </div>
              <span className="text-[10px] text-slate-400">App band karne ke baad bhi save rahega</span>
            </div>

            {vaultVideos.length === 0 ? (
              <div className="text-[11px] text-slate-400 py-2">
                Abhi Vault mein koi saved video nahi hai — upar Topic bol kar ya likh kar <b>Make Video &amp; Save</b> dabayein!
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {vaultVideos.map((v) => (
                  <div
                    key={v.id}
                    className="p-2.5 rounded-xl bg-slate-900 border border-white/12 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-extrabold text-white">{v.title}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {new Date(v.createdAt).toLocaleString()} · {v.durationSec}s · {(v.sizeBytes / 1024).toFixed(0)} KB
                        </div>
                        {v.uploadedYoutubeUrl && (
                          <a
                            href={v.uploadedYoutubeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10.5px] text-emerald-400 font-bold underline"
                          >
                            ✅ Live on YouTube: {v.uploadedYoutubeUrl} ↗
                          </a>
                        )}
                      </div>

                      <button
                        onClick={async () => {
                          await deleteVaultVideo(v.id);
                          await refreshVault();
                          onToast('🗑️ Removed from Vault');
                        }}
                        className="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-[10px] font-bold cursor-pointer"
                      >
                        🗑️ Delete
                      </button>
                    </div>

                    <video
                      src={v.previewUrl}
                      controls
                      playsInline
                      className="w-full max-h-[210px] rounded-lg bg-black border border-white/10"
                    />

                    {/* Save-First + 1-Tap Post to Instagram / Facebook / YouTube Whenever Ready! */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-0.5">
                      <button
                        onClick={() => handleShareBlobToPlatform(v.blob, v.fileName, v.mimeType, v.title, v.caption, 'gallery')}
                        className="py-2 px-2 rounded-xl bg-white text-slate-950 font-black text-[11px] cursor-pointer"
                      >
                        💾 Gallery Save
                      </button>

                      <button
                        onClick={() => handleShareBlobToPlatform(v.blob, v.fileName, v.mimeType, v.title, v.caption, 'instagram')}
                        className="py-2 px-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black text-[11px] cursor-pointer"
                      >
                        📸 Instagram
                      </button>

                      <button
                        onClick={() => handleShareBlobToPlatform(v.blob, v.fileName, v.mimeType, v.title, v.caption, 'facebook')}
                        className="py-2 px-2 rounded-xl bg-[#1877F2] text-white font-black text-[11px] cursor-pointer"
                      >
                        📘 Facebook
                      </button>

                      <button
                        disabled={uploadingVaultId === v.id}
                        onClick={() => handleManualUploadVaultItem(v)}
                        className="py-2 px-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-[11px] cursor-pointer disabled:opacity-50"
                      >
                        {uploadingVaultId === v.id ? '⏳ Uploading…' : '▶️ YouTube'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN 1: FULL 41-AGENT CIRCUIT ARCHITECTURE DIAGRAM (Reel 00s & 76s) */}
      {/* ===================================================================== */}
      {stage === 'map' && (
        <div className="space-y-3">
          {/* Top Sources -> 3 Live Databases -> 41 AI Agents Core (Reel Frame 04s!) */}
          <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5">
            <div className="grid grid-cols-6 gap-1.5 text-center text-[10px] font-bold text-slate-700">
              {['🏠 MLS', '📸 Instagram', '🎵 TikTok', '🤖 Reddit', '📅 Calendly', '📘 Facebook'].map((src) => (
                <div key={src} className="py-1.5 px-1 rounded-xl bg-slate-50 border border-slate-200 truncate">
                  {src}
                </div>
              ))}
            </div>

            {/* Animated SVG Routing Lines */}
            <svg viewBox="0 0 600 34" className="w-full h-7 overflow-visible">
              <path
                d="M50 2 L50 17 L130 17 L130 32 M150 2 L150 17 L130 17 M250 2 L250 17 L300 17 L300 32 M350 2 L350 17 L300 17 M450 2 L450 17 L470 17 L470 32 M550 2 L550 17 L470 17"
                fill="none"
                stroke="#6366f1"
                strokeWidth="2"
                strokeDasharray="6 6"
                style={{ animation: 'apexDashFlow 1.2s linear infinite' }}
              />
            </svg>

            {/* 3 Databases Row (listings.db · buyers.db · showings.db — Exact Frame 04s!) */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-[11px] font-black text-blue-900">🗄️ listings.db</div>
                <div className="text-[10px] text-blue-700 font-semibold">11 active listings</div>
              </div>
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-[11px] font-black text-emerald-900">🟢 buyers.db</div>
                <div className="text-[10px] text-emerald-700 font-semibold">{realBuyers.length + 25} scored buyers</div>
              </div>
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-[11px] font-black text-amber-900">📅 showings.db</div>
                <div className="text-[10px] text-amber-700 font-semibold">6 booked showings</div>
              </div>
            </div>

            {/* THE BRAIN — Growth Director Box (Exact Frame 12s & 68s!) */}
            <div className="p-3 rounded-2xl bg-slate-900 text-white border-2 border-indigo-400/50 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-orange-500/25 border border-orange-400 flex items-center justify-center text-base">
                    🧠
                  </span>
                  <div>
                    <div className="text-xs font-black tracking-wide">03 · THE BRAIN — GROWTH DIRECTOR</div>
                    <div className="text-[10px] text-slate-300">
                      Claude writes · Jev decides · ElevenLabs talks · <b className="text-emerald-400">You just approve ✓</b>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 text-[10px] font-extrabold">
                  <span className="px-2 py-0.5 rounded-full bg-white text-slate-900">1 Director</span>
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/30 text-sky-200">8 Leads</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200">32 Specialists</span>
                </div>
              </div>
            </div>

            {/* 8 DEPARTMENT CIRCUIT BOXES WITH ANIMATED CONNECTOR WIRES (Exact Frame 20s!) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {DEPT_BOXES.map((d) => (
                <div
                  key={d.code}
                  onClick={() => {
                    if (d.code === '02' || d.code === '03') setStage('engine');
                    else if (d.code === '05') setStage('leads');
                    else if (d.code === '06') setStage('booking');
                    else setStage('morning');
                  }}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-300 cursor-pointer transition-all shadow-2xs"
                >
                  <div className="flex items-center justify-between text-[9.5px] font-black text-indigo-700">
                    <span>{d.flow}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white">{d.lead}</span>
                  </div>
                  <div className="text-[10.5px] font-black text-slate-900 mt-1">{d.title}</div>
                  <div className="flex gap-1 my-1.5">
                    {d.badges.map((ic, k) => (
                      <span
                        key={k}
                        className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs shadow-2xs"
                      >
                        {ic}
                      </span>
                    ))}
                  </div>
                  <div className="text-[9.5px] text-slate-600 leading-tight">{d.desc}</div>
                </div>
              ))}
            </div>

            {/* Bottom CLI Terminal + Live Sparkline Card + This Week Funnel (Exact Frame 76s!) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
              <div className="sm:col-span-7 p-3 rounded-2xl bg-[#0b0f19] text-emerald-400 font-mono text-[10px] space-y-0.5 shadow-inner">
                <div className="flex gap-1.5 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </div>
                <div className="text-white">$ claude --team growth</div>
                <div>✓ 1 director · 8 leads · 32 specialists</div>
                <div className="text-slate-300">• content &nbsp;: 3 jobs running ({listingTitle})</div>
                <div className="text-emerald-400">• leads &nbsp;&nbsp;&nbsp;: {realBuyers.length} real buyers scored</div>
                <div className="text-sky-300">• booking &nbsp;: Sat 11:00 showing confirmed</div>
              </div>

              <div className="sm:col-span-5 p-3 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                  <span>⚡ Agent log</span>
                  <span className="text-emerald-600 font-extrabold">0 errors</span>
                </div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {traces.toLocaleString()} <span className="text-xs font-normal text-slate-500">traces</span>
                </div>
                <svg viewBox="0 0 180 32" className="w-full h-7">
                  <path
                    d="M2 26 Q35 24, 58 20 T115 13 T178 4"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="text-[10px] text-slate-500 font-semibold">This week: 14 Videos → 17 Buyers → 4 Showings → 1 Offer</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN 2: CONTENT ENGINE NODE FLOW + 9:16 VIDEO + APPROVAL (28s–32s)  */}
      {/* ===================================================================== */}
      {stage === 'engine' && (
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3.5">
          {/* 6-Node Real Motion Video + Save-First + IG/FB/YT Pipeline */}
          <div className="grid grid-cols-6 gap-1 text-center items-center py-2 px-1 bg-slate-50 rounded-2xl border border-slate-200">
            {[
              { icon: '🎞️', sub: 'HD Clips', done: true },
              { icon: '✳', sub: 'AI Script', done: true },
              { icon: '🎬', sub: genPct < 100 ? `${genPct}%` : '9:16 Video', done: genPct >= 100 },
              { icon: '🔊', sub: 'Voiceover', done: genPct >= 100 },
              { icon: '💾', sub: 'Vault Save', done: true },
              { icon: '🚀', sub: 'IG·FB·YT', done: videoApproved },
            ].map((n, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1 relative">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shadow-xs border ${
                    n.done
                      ? 'bg-[#d9f99d] border-[#65a30d] text-slate-900'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  {n.icon}
                </div>
                <span className="text-[9.5px] font-bold text-slate-700">{n.sub}</span>
              </div>
            ))}
          </div>

          {/* Left REAL Moving HD Video Stack -> Center AI Generator -> Right 9:16 Live Video + Save-First Card */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            <div className="sm:col-span-4 space-y-2">
              <div className="text-[11px] font-extrabold text-slate-800 px-1">
                🎞️ Select Real Moving HD Video Scene:
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-1 gap-2">
                {[0, 1, 2].map((clipIdx) => (
                  <button
                    key={clipIdx}
                    onClick={() => setSelectedMotionIdx(clipIdx)}
                    className={`relative h-16 rounded-xl overflow-hidden border-2 cursor-pointer text-left ${
                      selectedMotionIdx === clipIdx ? 'border-pink-600 shadow-md' : 'border-slate-300'
                    }`}
                  >
                    <video
                      src={`/motion_videos/clip_${clipIdx}.webm`}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-white text-[9px] font-bold">
                      🎬 HD Clip #{clipIdx + 1}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-3 flex flex-col items-center justify-center gap-2 py-2">
              <button
                onClick={runContentEngine}
                className="px-3 py-1.5 rounded-full bg-[#ecfccb] border border-[#84cc16] text-[#365314] font-black text-[11px] cursor-pointer shadow-sm"
              >
                {genPct < 100 ? `Generating ${genPct}%…` : '⚡ Generate New AI Script'}
              </button>
              <button
                onClick={() => {
                  setStage('openvideo');
                  startAgentVideoMission(listingTitle, omRefLink);
                }}
                className="px-3 py-1.5 rounded-full bg-slate-950 text-white font-black text-[11px] cursor-pointer shadow-sm"
              >
                💾 Render &amp; Save Video
              </button>
            </div>

            {/* REAL 9:16 MOVING VIDEO PREVIEW + SAVE-FIRST APPROVAL CARD */}
            <div className="sm:col-span-5 space-y-2.5">
              <div className="p-3 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 text-white border-2 border-[#84cc16] relative overflow-hidden space-y-2">
                <video
                  key={selectedMotionIdx}
                  src={`/motion_videos/clip_${selectedMotionIdx}.webm`}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-36 object-cover rounded-xl border border-white/15"
                />
                <span className="inline-block px-2 py-0.5 rounded-full bg-[#d9f99d] text-slate-950 font-black text-[9.5px]">
                  9:16 HD Reel · Instagram · Facebook · YouTube
                </span>
                <div className="text-xs font-extrabold">{listingTitle}</div>
                <p className="text-[11px] text-slate-200 leading-snug">"{scriptText}"</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => speakLoud(scriptText)}
                    className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[10.5px] font-bold cursor-pointer"
                  >
                    🔊 Suniye Script
                  </button>
                  <button
                    onClick={() => {
                      setVideoApproved(true);
                      onToast('💾 Saved & Ready — Jab chahein Instagram, Facebook ya YouTube par post karein!');
                    }}
                    className={`px-3 py-1 rounded-full text-[10.5px] font-black cursor-pointer ${
                      videoApproved ? 'bg-emerald-400 text-slate-950' : 'bg-amber-400 text-slate-950'
                    }`}
                  >
                    {videoApproved ? '💾 Saved Ready ✓' : '💾 Approve & Save ✓'}
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-emerald-900">💾 Vault Safe Mode · IG · FB · YT</div>
                  <div className="text-xs font-black text-slate-900">Abhi send nahi hoga — aapki marzi par post hoga!</div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white font-extrabold text-[10px]">
                  Safe ✓
                </span>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#0b0f19] text-emerald-400 font-mono text-[10.5px]">
            $ apex-studio render --platforms instagram,facebook,youtube --mode save-first-vault
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN 3: SPINNING CONIC RADAR — REAL BUYERS vs BROWSERS (40s–48s!)   */}
      {/* ===================================================================== */}
      {stage === 'leads' && (
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3">
          {/* Live Incoming Social Comment Pill Banner at Top (Exact Frame 40s & 44s!) */}
          <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0"
                style={{ background: currentBanner.color }}
              >
                {currentBanner.initials}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-slate-900 truncate">{currentBanner.name}</div>
                <div className="text-[11px] text-slate-600 truncate">{currentBanner.comment}</div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-fuchsia-100 text-fuchsia-900 font-black text-[10.5px] shrink-0">
              {currentBanner.platform} · Score {currentBanner.score}
            </span>
          </div>

          {/* ACTUAL SPINNING RADAR CIRCLE WITH FLOATING BUYER PILLS (Exact Frame 44s & 48s!) */}
          <div className="relative w-[270px] h-[270px] sm:w-[295px] sm:h-[295px] mx-auto rounded-full border border-slate-200 bg-slate-50/70 flex items-center justify-center overflow-hidden shadow-inner">
            {/* Rotating Pink/Violet Radar Sweep Beam */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background:
                  'conic-gradient(from 0deg, rgba(217,70,239,0.28) 0deg, rgba(217,70,239,0.06) 55deg, transparent 70deg)',
                animation: 'apexRadarSpin 3.6s linear infinite',
              }}
            />
            {/* Concentric Inner Radar Rings */}
            <div className="w-[195px] h-[195px] rounded-full border border-dashed border-slate-300 absolute pointer-events-none" />
            <div className="w-[115px] h-[115px] rounded-full border border-slate-300 absolute pointer-events-none" />

            {/* Center Core Badge ("Jev AI LIVE" — Frame 48s!) */}
            <button
              onClick={() => setScoredMode((v) => !v)}
              className="relative z-10 w-16 h-16 rounded-full bg-fuchsia-600 text-white font-black text-[10px] flex flex-col items-center justify-center shadow-[0_0_24px_rgba(217,70,239,0.65)] cursor-pointer"
            >
              <span className="text-sm">◈ Jev</span>
              <span className="px-1.5 rounded bg-rose-500 text-[8.5px]">LIVE</span>
            </button>

            {/* Floating Scored Buyer / Browser Pills Around Radar */}
            {bubbles.slice(0, 6).map((b) => {
              const rad = (b.angleDeg * Math.PI) / 180;
              const x = 50 + Math.cos(rad) * b.radiusPct;
              const y = 50 + Math.sin(rad) * b.radiusPct;
              return (
                <button
                  key={b.id}
                  onClick={() => {
                    setClientName(b.name);
                    if (b.phone) setWhatsappNumber(b.phone);
                    setStage('booking');
                    runLiveVoiceCallDemo();
                  }}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  className={`-translate-x-1/2 -translate-y-1/2 absolute z-10 px-2 py-0.5 rounded-full text-[9.5px] font-extrabold shadow-md border flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    b.isBuyer
                      ? 'bg-white border-emerald-500 text-slate-900'
                      : 'bg-white/80 border-slate-300 text-slate-500'
                  }`}
                >
                  <span>{b.name}</span>
                  {scoredMode && (
                    <span
                      className={`px-1 rounded-full text-[8.5px] font-black ${
                        b.isBuyer ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {b.score}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Paste Any Live Comment / DM to Test Radar Live */}
          <div className="flex gap-2">
            <input
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder='Test any comment/DM e.g. "Ready budget 1Cr, book visit Saturday"'
              className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900"
            />
            <button
              onClick={addCustomInquiryToRadar}
              className="px-3 py-1.5 rounded-xl bg-fuchsia-600 text-white font-extrabold text-xs cursor-pointer"
            >
              Scan DM
            </button>
          </div>

          {/* Bottom Split Boxes: Green "Real buyers" vs Grey "Browsers" (Exact Frame 48s!) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-3 rounded-2xl bg-emerald-50 border-2 border-emerald-400 space-y-2">
              <div className="text-xs font-black text-emerald-900">
                Real buyers ({realBuyers.length}) — Instant Reply + Link
              </div>
              {realBuyers.map((b) => (
                <div key={b.id} className="p-2 rounded-xl bg-white border border-emerald-200 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900 truncate">
                      {b.name} <span className="text-emerald-600">({b.score})</span>
                    </div>
                    <div className="text-[10px] text-slate-600 truncate">{b.comment}</div>
                  </div>
                  <button
                    onClick={() =>
                      sendWhatsAppDirect(
                        b.phone,
                        `Hi ${b.name}! 👋 Saw your inquiry on *${listingTitle}*. Tap to pick your private showing time this weekend!`
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-[#16a34a] text-white font-extrabold text-[10px] shrink-0 cursor-pointer"
                  >
                    📲 Send
                  </button>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-2xl bg-slate-100 border border-slate-200 space-y-2">
              <div className="text-xs font-bold text-slate-600">Browsers ({browsers.length}) — Filtered Out</div>
              {browsers.map((b) => (
                <div key={b.id} className="p-2 rounded-xl bg-white/80 border border-slate-200">
                  <div className="text-xs font-semibold text-slate-500">
                    {b.name} ({b.score})
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{b.comment}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN 4: 60s iPHONE VOICE CALL + GREEN CHECKS + CALENDAR (56s–64s!)  */}
      {/* ===================================================================== */}
      {stage === 'booking' && (
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3.5">
          {/* Top Phone Number Trigger Bar (Exact Frame 56s!) */}
          <div className="max-w-md mx-auto p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex-1">
              <div className="text-[10px] text-slate-500 font-bold">Buyer phone number (60s AI Callback)</div>
              <input
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full bg-transparent text-sm font-black text-slate-900 focus:outline-none"
              />
            </div>
            <button
              onClick={runLiveVoiceCallDemo}
              className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs cursor-pointer shadow-sm"
            >
              🔊 Call Now
            </button>
          </div>

          {/* Center Dynamic-Island iPhone Framed by 4 Green Checkmark Qualification Cards (Exact Frame 64s!) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            <div className="sm:col-span-4 space-y-2.5">
              <div
                className={`p-3 rounded-2xl border-2 transition-all ${
                  callStep >= 1 ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span>Budget</span>
                  {callStep >= 1 && <span className="text-emerald-600 font-black">✓</span>}
                </div>
                <div className="text-lg font-black text-slate-900 mt-0.5">{callStep >= 1 ? '₹1.2 Cr' : '—'}</div>
              </div>

              <div
                className={`p-3 rounded-2xl border-2 transition-all ${
                  callStep >= 3 ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span>Pre-approved</span>
                  {callStep >= 3 && <span className="text-emerald-600 font-black">✓</span>}
                </div>
                <div className="text-lg font-black text-slate-900 mt-0.5">{callStep >= 3 ? 'Yes' : '—'}</div>
              </div>
            </div>

            {/* REALISTIC DYNAMIC-ISLAND iPHONE CALL SCREEN */}
            <div className="sm:col-span-4">
              <div className="max-w-[235px] mx-auto rounded-[34px] bg-[#090d16] text-white p-3.5 border-[4px] border-slate-800 shadow-2xl space-y-2.5 text-center">
                <div className="w-16 h-4 rounded-full bg-black mx-auto border border-white/10" />
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 mx-auto flex items-center justify-center font-black text-sm">
                  {(clientName || 'DC').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-black">{clientName}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{clientPhone}</div>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9.5px] font-bold">
                    Connected · 0:{String(callTimer).padStart(2, '0')}
                  </span>
                </div>

                {/* Live Voice Waveform Bars */}
                <div className="flex items-center justify-center gap-1 h-8">
                  {[10, 22, 30, 16, 28, 32, 18, 26, 14, 24, 12].map((h, idx) => (
                    <span
                      key={idx}
                      style={{ height: `${h}px` }}
                      className="w-1 rounded-full bg-emerald-400 inline-block animate-pulse"
                    />
                  ))}
                </div>

                {/* Live Two-Way Captions Inside Phone Screen (Exact Frame 64s!) */}
                <div className="space-y-1.5 text-left text-[10px]">
                  <div className="p-2 rounded-xl bg-white/10 text-slate-200">{liveTranscript.ai}</div>
                  <div className="p-2 rounded-xl bg-sky-500 text-white font-bold ml-4">{liveTranscript.user}</div>
                </div>
              </div>
            </div>

            <div className="sm:col-span-4 space-y-2.5">
              <div className="p-3 rounded-2xl bg-emerald-50 border-2 border-emerald-500">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span>Speed to lead</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[9.5px] font-black">
                    58s ✓
                  </span>
                </div>
                <div className="text-sm font-black text-emerald-800 mt-1">Under 60s SLA limit</div>
              </div>

              <div
                className={`p-3 rounded-2xl border-2 transition-all ${
                  callStep >= 2 ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span>Timeline</span>
                  {callStep >= 2 && <span className="text-emerald-600 font-black">✓</span>}
                </div>
                <div className="text-lg font-black text-slate-900 mt-0.5">{callStep >= 2 ? '60 days' : '—'}</div>
              </div>
            </div>
          </div>

          {/* Weekly Calendar Strip Auto-Highlighting Booked Slot (Exact Bottom of Frame 64s!) */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs font-extrabold text-slate-800">
              <span>📅 Automated Calendar Booking</span>
              <span className="text-emerald-700">Sat 11:00 AM · {clientName} ✓</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5 text-center text-[10px]">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat 24'].map((day, i) => (
                <div
                  key={day}
                  className={`p-2 rounded-xl border ${
                    i === 5 ? 'bg-emerald-500 text-white border-emerald-600 font-black shadow-sm' : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <div>{day}</div>
                  <div className="mt-1 text-[9.5px]">{i === 5 ? `11:00 ${clientName.split(' ')[0]}` : 'Open'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN 5: iPHONE MORNING 1-PAGE SUMMARY SCREEN (Exact Frame 80s!)     */}
      {/* ===================================================================== */}
      {stage === 'morning' && (
        <div className="py-2">
          <div className="max-w-[300px] mx-auto rounded-[38px] bg-white p-4 border-[6px] border-slate-900 shadow-2xl space-y-3">
            <div className="w-20 h-4 rounded-full bg-slate-900 mx-auto" />
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                  AI
                </span>
                <div>
                  <div className="text-sm font-black text-slate-900">Good morning, Boss</div>
                  <div className="text-[10px] text-slate-500">Daily 41-Agent Summary</div>
                </div>
              </div>
              <button
                onClick={() =>
                  speakLoud(
                    `Good morning Boss! Is hafte 48 point 2 thousand views, 17 buyers jinmein ${realBuyers.length} real verified buyers hain, 4 booked showings aur ${clientName} ki taraf se 1 solid offer ready hai!`
                  )
                }
                className="px-2.5 py-1 rounded-full bg-slate-900 text-white text-[10px] font-bold cursor-pointer"
              >
                🔊 Speak
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500">Views</div>
                <div className="text-xl font-black text-slate-900">48.2K</div>
                <div className="text-[10px] font-bold text-emerald-600">+12%</div>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500">Buyers</div>
                <div className="text-xl font-black text-slate-900">17</div>
                <div className="text-[10px] font-bold text-emerald-600">{realBuyers.length} real</div>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500">Showings</div>
                <div className="text-xl font-black text-slate-900">4</div>
                <div className="text-[10px] font-bold text-emerald-600">booked</div>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500">Offers</div>
                <div className="text-xl font-black text-rose-600">1</div>
                <div className="text-[10px] font-semibold text-rose-600">{clientName}</div>
              </div>
            </div>

            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div className="text-[10px] text-slate-500">Today</div>
              <div className="font-black text-slate-900">Sat 11:00 · {clientName}</div>
              <div className="text-[10px] text-slate-500">{listingTitle} · pre-approved</div>
            </div>

            <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-orange-800 font-semibold">Waiting for you</div>
                <div className="text-xs font-black text-orange-950">2 videos</div>
              </div>
              <button
                onClick={() => {
                  setVideoApproved(true);
                  onToast('✅ Both videos approved!');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-orange-600 text-white font-black text-xs cursor-pointer"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
