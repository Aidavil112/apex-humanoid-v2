import React, { useState, useRef, useEffect } from 'react';
import { YtPlan, ContentPlan, TopicResearch, WorkflowJob, WorkflowStep } from '../types';

interface YouTubeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}

const DEFAULT_NICHES = [
  'Future AI & Robotics',
  'Quantum Computing Secrets',
  'Brain-Computer Interfaces',
  'Deep Space Mysteries',
  'Autonomous Coding Agents',
  'Biohacking & Longevity',
];

export const YouTubeModal: React.FC<YouTubeModalProps> = ({ isOpen, onClose, onToast }) => {
  const [tab, setTab] = useState<'autopilot' | 'research' | 'video' | 'content' | 'history'>('autopilot');
  const [niche, setNiche] = useState('Future AI & Robotics');
  const [topic, setTopic] = useState('');
  const [lang, setLang] = useState('hi');
  const [scenesCount, setScenesCount] = useState(6);
  const [privacyStatus, setPrivacyStatus] = useState<'public' | 'unlisted' | 'private'>('public');
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('apex.yt_token') || '');

  // Workflow Agent State
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStep>('idle');
  const [workflowProgress, setWorkflowProgress] = useState(0);
  const [workflowLogs, setWorkflowLogs] = useState<string[]>([]);
  const [researchedTopics, setResearchedTopics] = useState<TopicResearch[]>([]);
  const [selectedTopicResearch, setSelectedTopicResearch] = useState<TopicResearch | null>(null);

  // Active production artifacts
  const [plan, setPlan] = useState<YtPlan | null>(null);
  const [contentPlan, setContentPlan] = useState<ContentPlan | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [lastUploadedLink, setLastUploadedLink] = useState<string | null>(null);

  // Queue of historical jobs
  const [jobHistory, setJobHistory] = useState<WorkflowJob[]>(() => {
    try {
      const saved = localStorage.getItem('apex.workflow_jobs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    localStorage.setItem('apex.yt_token', accessToken);
  }, [accessToken]);

  useEffect(() => {
    try {
      localStorage.setItem('apex.workflow_jobs', JSON.stringify(jobHistory.slice(-10)));
    } catch (e) {}
  }, [jobHistory]);

  if (!isOpen) return null;

  const addLog = (msg: string) => {
    setWorkflowLogs((prev) => [...prev, msg]);
  };

  const W = 1080;
  const H = 1920;

  const drawFrame = (
    cx: CanvasRenderingContext2D,
    t: number,
    total: number,
    caption: string,
    sub: string
  ) => {
    const g = cx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#04121b');
    g.addColorStop(0.55, '#061a26');
    g.addColorStop(1, '#020a10');
    cx.fillStyle = g;
    cx.fillRect(0, 0, W, H);

    // Halo rings
    const cxr = W / 2,
      cyr = H * 0.4;
    for (let i = 3; i >= 1; i--) {
      cx.beginPath();
      cx.strokeStyle = `rgba(70,200,255,${0.05 + 0.05 * Math.sin(t * 2 + i)})`;
      cx.lineWidth = 3;
      cx.arc(cxr, cyr, 240 + i * 70 + 14 * Math.sin(t * 1.6 + i), 0, Math.PI * 2);
      cx.stroke();
    }

    // Dynamic glowing particles
    for (let i = 0; i < 90; i++) {
      const a = i * 2.399 + t * 0.25;
      const r = 120 + (i % 9) * 34;
      const x = cxr + Math.cos(a) * r;
      const y = cyr + Math.sin(a * 1.2) * r * 0.72;
      cx.fillStyle = `rgba(140,230,255,${0.25 + 0.55 * Math.abs(Math.sin(t + i))})`;
      cx.beginPath();
      cx.arc(x, y, 2.4, 0, Math.PI * 2);
      cx.fill();
    }

    cx.textAlign = 'center';

    // Caption
    cx.fillStyle = '#eaf9ff';
    cx.font = '800 86px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    const words = String(caption || '').split(' ');
    let line = '';
    let y = H * 0.62;
    const lines: string[] = [];
    words.forEach((w) => {
      const test = line ? line + ' ' + w : w;
      if (cx.measureText(test).width > W * 0.84) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    lines.slice(0, 4).forEach((L) => {
      cx.fillText(L, W / 2, y, W * 0.86);
      y += 100;
    });

    // Subtitle / narration
    if (sub) {
      cx.font = '400 40px system-ui,sans-serif';
      cx.fillStyle = 'rgba(150,225,255,.72)';
      cx.fillText(String(sub).slice(0, 70), W / 2, H * 0.86, W * 0.84);
    }

    // Progress bar
    cx.fillStyle = 'rgba(255,255,255,.10)';
    cx.fillRect(0, H - 12, W, 12);
    cx.fillStyle = '#2ea8c9';
    cx.fillRect(0, H - 12, W * Math.min(1, t / Math.max(total, 1)), 12);

    // Brand tag
    cx.fillStyle = 'rgba(120,210,240,.55)';
    cx.font = '700 30px ui-monospace,monospace';
    cx.textAlign = 'left';
    cx.fillText('APEX HUMANOID', 48, 86);
  };

  const generateThumbnail = (planData: YtPlan): string => {
    const c = document.createElement('canvas');
    c.width = 1280;
    c.height = 720;
    const cx = c.getContext('2d')!;
    const g = cx.createLinearGradient(0, 0, 1280, 720);
    g.addColorStop(0, '#051622');
    g.addColorStop(1, '#0a3040');
    cx.fillStyle = g;
    cx.fillRect(0, 0, 1280, 720);

    for (let i = 0; i < 60; i++) {
      cx.fillStyle = `rgba(120,220,255,${0.12 + 0.5 * Math.random()})`;
      cx.beginPath();
      cx.arc(Math.random() * 1280, Math.random() * 720, 2.2, 0, 7);
      cx.fill();
    }

    cx.textAlign = 'center';
    cx.fillStyle = '#eaf9ff';
    cx.font = '900 92px system-ui,-apple-system,Roboto,sans-serif';
    const t = String(planData.thumbnailText || planData.title || 'APEX').toUpperCase();
    const ws = t.split(' ');
    let line = '';
    let y = 300;
    const lines: string[] = [];
    ws.forEach((w) => {
      const test = line ? line + ' ' + w : w;
      if (cx.measureText(test).width > 1120) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    lines.slice(0, 3).forEach((L) => {
      cx.fillText(L, 640, y, 1140);
      y += 104;
    });

    cx.font = '700 34px ui-monospace,monospace';
    cx.fillStyle = 'rgba(140,225,255,.8)';
    cx.fillText('APEX HUMANOID', 640, 640);

    return c.toDataURL('image/png');
  };

  // 1. Topic Research
  const performResearch = async (targetNiche: string): Promise<TopicResearch[]> => {
    addLog(`🔍 Researching viral trends in "${targetNiche}"…`);
    setWorkflowStatus('researching');
    setWorkflowProgress(15);

    const r = await fetch('/agent/research', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ niche: targetNiche }),
    });
    const j = await r.json();
    const list: TopicResearch[] = j.topics || [];
    setResearchedTopics(list);
    addLog(`✓ Uncovered ${list.length} high-potential viral topics`);
    return list;
  };

  // 2. Script Formulation
  const formulateScript = async (targetTopic: string): Promise<YtPlan> => {
    addLog(`✍ Scripting multi-scene storyboard for "${targetTopic}"…`);
    setWorkflowStatus('scripting');
    setWorkflowProgress(35);

    const pr = await fetch('/yt/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic: targetTopic, lang, scenes: scenesCount }),
    });
    const planData: YtPlan = await pr.json();
    if (!planData.scenes || !planData.scenes.length) throw new Error('Script generation failed');
    setPlan(planData);
    addLog(`✓ Storyboard ready: ${planData.scenes.length} scenes. Title: "${planData.title}"`);
    return planData;
  };

  // 3. Audio & Video Render
  const produceVideo = async (planData: YtPlan): Promise<{ blob: Blob; url: string; thumb: string }> => {
    addLog(`🎙 Synthesizing voices for ${planData.scenes.length} scenes…`);
    setWorkflowStatus('voicing');
    setWorkflowProgress(50);

    const voices: (ArrayBuffer | null)[] = [];
    for (let i = 0; i < planData.scenes.length; i++) {
      const txt = String(planData.scenes[i].narration || planData.scenes[i].caption || planData.title)
        .trim()
        .slice(0, 400);
      let ok = false;
      for (let retry = 0; retry < 2 && !ok; retry++) {
        try {
          const vr = await fetch('/yt/voice', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: txt }),
          });
          if (vr.ok) {
            voices.push(await vr.arrayBuffer());
            ok = true;
          } else {
            await new Promise((r) => setTimeout(r, 800));
          }
        } catch (e) {}
      }
      if (!ok) {
        voices.push(null);
      } else {
        addLog(`  • Voice scene ${i + 1}/${planData.scenes.length} synthesized`);
      }
    }

    addLog(`🎬 Composing particle canvas and recording video…`);
    setWorkflowStatus('rendering');
    setWorkflowProgress(70);

    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ac = new AC();
    await ac.resume();

    const decoded: AudioBuffer[] = [];
    for (const ab of voices) {
      if (!ab) {
        decoded.push(ac.createBuffer(1, Math.floor(ac.sampleRate * 1.6), ac.sampleRate));
        continue;
      }
      try {
        decoded.push(await ac.decodeAudioData(ab.slice(0)));
      } catch (e) {
        decoded.push(ac.createBuffer(1, Math.floor(ac.sampleRate * 1.6), ac.sampleRate));
      }
    }

    const gap = 0.35;
    let total = 0;
    const starts = decoded.map((b) => {
      const at = total;
      total += b.duration + gap;
      return at;
    });
    total += 0.6;

    const dest = ac.createMediaStreamDestination();
    const master = ac.createGain();
    master.gain.value = 1.0;
    master.connect(dest);

    const cv = previewCanvasRef.current;
    if (!cv) throw new Error('Preview canvas unavailable');
    cv.width = W;
    cv.height = H;
    const cx = cv.getContext('2d')!;
    drawFrame(cx, 0, total, planData.scenes[0].caption, planData.title);

    const stream = (cv as any).captureStream ? (cv as any).captureStream(30) : null;
    if (!stream) throw new Error('Canvas recording stream not supported');
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

    const mimeCandidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];
    const mime = mimeCandidates.find((m) => (window as any).MediaRecorder && MediaRecorder.isTypeSupported(m));
    if (!mime) throw new Error('MediaRecorder format unsupported');

    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4000000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };

    const done = new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
    });
    rec.start(1000);

    const t0 = ac.currentTime + 0.15;
    decoded.forEach((buf, i) => {
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.connect(master);
      src.start(t0 + starts[i]);
    });

    await new Promise<void>((resolve) => {
      const started = performance.now();
      const tick = () => {
        const t = (performance.now() - started) / 1000;
        let idx = 0;
        for (let i = 0; i < starts.length; i++) {
          if (t >= starts[i]) idx = i;
        }
        if (t >= total) {
          rec.stop();
          resolve();
          return;
        }
        const sc = planData.scenes[idx] || { caption: '', narration: '' };
        drawFrame(cx, t, total, sc.caption, sc.narration);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await done;

    const blob = new Blob(chunks, { type: mime });
    const url = URL.createObjectURL(blob);
    const thumb = generateThumbnail(planData);

    setVideoBlob(blob);
    setVideoUrl(url);
    setThumbUrl(thumb);
    addLog(`✓ Video rendering finished (${(blob.size / 1048576).toFixed(1)} MB)`);
    return { blob, url, thumb };
  };

  // 4. Upload to YouTube Workflow
  const uploadToYouTube = async (blob: Blob, planData: YtPlan): Promise<{ youtubeUrl: string; videoId: string }> => {
    addLog(`🚀 Uploading to YouTube (${privacyStatus})…`);
    setWorkflowStatus('uploading');
    setWorkflowProgress(90);

    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    const videoBase64 = await base64Promise;

    const res = await fetch('/yt/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: planData.title,
        description: `${planData.description}\n\nProduced by APEX Autonomous Video Agent\n#shorts #ai`,
        tags: planData.tags,
        privacyStatus,
        videoBase64,
        accessToken: accessToken.trim(),
      }),
    });

    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'YouTube upload failed');

    const ytUrl = j.youtubeUrl || `https://www.youtube.com/shorts/${j.videoId}`;
    setLastUploadedLink(ytUrl);
    addLog(`🎉 Published to YouTube: ${ytUrl}`);
    return { youtubeUrl: ytUrl, videoId: j.videoId };
  };

  // Full Auto-Pilot Master Agent Loop
  const runAutoPilot = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setWorkflowLogs([]);
    setVideoUrl(null);
    setThumbUrl(null);
    setLastUploadedLink(null);

    const jobId = 'job_' + Date.now();
    const activeNiche = niche.trim() || 'Future AI & Robotics';

    addLog(`========================================`);
    addLog(`🤖 APEX AUTONOMOUS YOUTUBE AGENT LAUNCHED`);
    addLog(`Niche: "${activeNiche}"`);
    addLog(`========================================`);

    const newJob: WorkflowJob = {
      id: jobId,
      timestamp: Date.now(),
      niche: activeNiche,
      topic: '',
      status: 'researching',
      progress: 10,
      privacyStatus,
    };
    setJobHistory((prev) => [newJob, ...prev]);

    try {
      // 1. Topic Research
      const topics = await performResearch(activeNiche);
      const chosen = topics[0] || {
        id: 'tech-trend',
        title: activeNiche + ' in 2026',
        category: 'Tech',
        hook: 'Watch this before it changes everything.',
        summary: 'Deep breakdown of viral technology.',
        angle: 'Curiosity interrupt',
        viralPotential: 95,
        searchKeywords: ['tech', 'ai'],
        facts: ['Exponential growth'],
        targetAudience: 'Tech audience',
        whyTrending: 'Recent news wave',
      };
      setSelectedTopicResearch(chosen);
      setTopic(chosen.title);
      addLog(`🎯 Auto-selected highest viral score topic: "${chosen.title}" (${chosen.viralPotential}% potential)`);

      // 2. Script
      const planData = await formulateScript(chosen.title);

      // 3. Video Render
      const { blob, url, thumb } = await produceVideo(planData);

      // 4. YouTube Upload
      const ytResult = await uploadToYouTube(blob, planData);

      setWorkflowStatus('completed');
      setWorkflowProgress(100);
      addLog(`✨ Full auto-pilot pipeline finished successfully!`);
      onToast('Video generated & published to YouTube queue!');

      // Update history record
      setJobHistory((prev) =>
        prev.map((item) =>
          item.id === jobId
            ? {
                ...item,
                topic: chosen.title,
                status: 'completed',
                progress: 100,
                research: chosen,
                plan: planData,
                videoUrl: url,
                thumbUrl: thumb,
                youtubeId: ytResult.videoId,
                youtubeUrl: ytResult.youtubeUrl,
              }
            : item
        )
      );
    } catch (e: any) {
      setWorkflowStatus('error');
      addLog(`❌ Agent workflow stopped: ${e.message}`);
      onToast(`Agent error: ${e.message}`);
      setJobHistory((prev) =>
        prev.map((item) => (item.id === jobId ? { ...item, status: 'error', error: e.message } : item))
      );
    } finally {
      busyRef.current = false;
    }
  };

  const handleShareDirect = async () => {
    if (!videoBlob || !plan) return;
    const fileName = `${(plan.title || 'apex-short').replace(/[^\w\u0900-\u097F -]/g, '').slice(0, 46) || 'apex-short'}.webm`;
    const file = new File([videoBlob], fileName, { type: videoBlob.type });

    try {
      await navigator.clipboard.writeText(
        `${plan.title}\n\n${plan.description}\n\n${(plan.tags || []).map((t) => '#' + t).join(' ')}`
      );
      onToast('Title & description copied!');
    } catch (e) {}

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: plan.title, text: plan.title });
      } catch (e) {}
    } else {
      onToast('Native file sharing not supported, please click Download.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#04090eee] backdrop-blur-md overflow-y-auto font-mono text-[#d8f2ff]">
      <div className="w-full max-w-[680px] bg-[#07131d] border border-[rgba(79,210,255,0.28)] rounded-2xl p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.95)] max-h-[92vh] overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[rgba(79,210,255,0.14)] mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[#4fd2ff] text-base">⚡</span>
            <div>
              <div className="text-[13px] tracking-[0.22em] text-[#7fd4ff] font-semibold uppercase">
                YOUTUBE WORKFLOW AI AGENT
              </div>
              <div className="text-[10px] text-[#55829e] tracking-wider">
                Autonomous Topic Research · Scripting · Video Synthesis · YouTube Publisher
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer bg-[#0d1a24] text-[#9fe8ff] border border-[#1d3a4d] rounded-lg px-3 py-1.5 text-xs hover:bg-[#142838] transition-colors"
          >
            ✕ close
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-5 gap-1.5 mb-4 p-1 bg-[#050c12] rounded-xl border border-[rgba(79,210,255,0.1)] text-[10px] sm:text-[11px]">
          <button
            onClick={() => setTab('autopilot')}
            className={`cursor-pointer py-2 rounded-lg font-semibold tracking-wider transition-colors ${
              tab === 'autopilot'
                ? 'bg-gradient-to-r from-[#15465c] to-[#1a6d8f] text-[#c9f2ff] shadow-sm'
                : 'text-[#6c9cb7] hover:text-[#c9f2ff]'
            }`}
          >
            🤖 AUTOPILOT
          </button>
          <button
            onClick={() => setTab('research')}
            className={`cursor-pointer py-2 rounded-lg font-semibold tracking-wider transition-colors ${
              tab === 'research'
                ? 'bg-gradient-to-r from-[#15465c] to-[#1a6d8f] text-[#c9f2ff]'
                : 'text-[#6c9cb7] hover:text-[#c9f2ff]'
            }`}
          >
            🔍 RESEARCH
          </button>
          <button
            onClick={() => setTab('video')}
            className={`cursor-pointer py-2 rounded-lg font-semibold tracking-wider transition-colors ${
              tab === 'video'
                ? 'bg-gradient-to-r from-[#15465c] to-[#1a6d8f] text-[#c9f2ff]'
                : 'text-[#6c9cb7] hover:text-[#c9f2ff]'
            }`}
          >
            🎬 STUDIO
          </button>
          <button
            onClick={() => setTab('content')}
            className={`cursor-pointer py-2 rounded-lg font-semibold tracking-wider transition-colors ${
              tab === 'content'
                ? 'bg-gradient-to-r from-[#15465c] to-[#1a6d8f] text-[#c9f2ff]'
                : 'text-[#6c9cb7] hover:text-[#c9f2ff]'
            }`}
          >
            📝 PACK
          </button>
          <button
            onClick={() => setTab('history')}
            className={`cursor-pointer py-2 rounded-lg font-semibold tracking-wider transition-colors ${
              tab === 'history'
                ? 'bg-gradient-to-r from-[#15465c] to-[#1a6d8f] text-[#c9f2ff]'
                : 'text-[#6c9cb7] hover:text-[#c9f2ff]'
            }`}
          >
            📊 QUEUE ({jobHistory.length})
          </button>
        </div>

        {/* 1. AUTOPILOT AGENT VIEW */}
        {tab === 'autopilot' && (
          <div className="flex flex-col gap-4">
            {/* YouTube OAuth Connection Banner */}
            <div className="p-3.5 rounded-xl bg-[rgba(10,24,34,0.85)] border border-[rgba(79,210,255,0.25)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{accessToken ? '🟢' : '🔴'}</span>
                  <span className="text-xs font-bold text-[#eaf9ff]">
                    YouTube Channel Status: {accessToken ? 'Connected for Auto-Upload' : 'OAuth Token Needed for Direct Upload'}
                  </span>
                </div>
                <div className="text-[10px] text-[#6393b0] mt-0.5">
                  Scopes Provisioned: <code className="text-[#4fd2ff]">youtube.upload</code>, <code className="text-[#4fd2ff]">youtube.readonly</code>
                </div>
              </div>

              {!accessToken ? (
                <div className="flex gap-2 w-full sm:w-auto">
                  <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="Paste OAuth Token..."
                    className="bg-[#050c12] border border-[#1d3a4d] rounded-lg px-2.5 py-1.5 text-xs text-[#d8f2ff] w-full sm:w-40 focus:outline-none focus:border-[#4fd2ff]"
                  />
                  <button
                    onClick={() => {
                      if (accessToken.trim()) onToast('YouTube OAuth Token Saved!');
                      else onToast('Please enter your Google OAuth token');
                    }}
                    className="cursor-pointer whitespace-nowrap px-3 py-1.5 bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-xs rounded-lg shadow-sm"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAccessToken('');
                    onToast('YouTube Access Token Disconnected');
                  }}
                  className="cursor-pointer text-[10.5px] text-[#ff6b6b] underline hover:text-[#ff8f8f]"
                >
                  Disconnect Token
                </button>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[rgba(10,24,34,0.7)] border border-[rgba(79,210,255,0.2)]">
              <div className="text-xs text-[#a5d8f0] font-semibold mb-2 flex items-center justify-between">
                <span>Select Target Niche for AI Agent:</span>
                <span className="text-[10px] text-[#4fd2ff] font-normal">Auto-researches viral angles</span>
              </div>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {DEFAULT_NICHES.map((n) => (
                  <button
                    key={n}
                    onClick={() => setNiche(n)}
                    className={`cursor-pointer text-[10.5px] px-2.5 py-1 rounded-lg border transition-all ${
                      niche === n
                        ? 'bg-[rgba(79,210,255,0.22)] border-[var(--cyan,#4fd2ff)] text-[#c9f2ff] font-semibold'
                        : 'border-[#173042] bg-[#081219] text-[#749eb7] hover:border-[#2d556d]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Or custom niche: e.g. Autonomous AI Agents & Silicon Startups"
                className="w-full bg-[#050c12] border border-[#1d3a4d] rounded-xl p-2.5 text-xs text-[#eaf9ff] focus:outline-none focus:border-[#4fd2ff]"
              />
            </div>

            {/* Production Settings Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-[#081219] border border-[#173042]">
                <label className="text-[10px] uppercase text-[#5a86a1] block mb-1">Voiceover Language</label>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="w-full bg-[#050c12] border border-[#1d3a4d] rounded-lg p-2 text-xs text-[#d8f2ff] focus:outline-none"
                >
                  <option value="hi">Hindi (Conversational)</option>
                  <option value="en">English (Energetic)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-[#081219] border border-[#173042]">
                <label className="text-[10px] uppercase text-[#5a86a1] block mb-1">Duration & Scenes</label>
                <select
                  value={scenesCount}
                  onChange={(e) => setScenesCount(parseInt(e.target.value, 10))}
                  className="w-full bg-[#050c12] border border-[#1d3a4d] rounded-lg p-2 text-xs text-[#d8f2ff] focus:outline-none"
                >
                  <option value={5}>5 Scenes (~20s Fast Hook)</option>
                  <option value={6}>6 Scenes (~26s Viral Pace)</option>
                  <option value={8}>8 Scenes (~34s Deep Dive)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-[#081219] border border-[#173042]">
                <label className="text-[10px] uppercase text-[#5a86a1] block mb-1">YouTube Privacy</label>
                <select
                  value={privacyStatus}
                  onChange={(e) => setPrivacyStatus(e.target.value as any)}
                  className="w-full bg-[#050c12] border border-[#1d3a4d] rounded-lg p-2 text-xs text-[#d8f2ff] focus:outline-none"
                >
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
              </div>
            </div>

            {/* Big Launch Button */}
            <button
              onClick={runAutoPilot}
              disabled={busyRef.current}
              className="w-full cursor-pointer bg-gradient-to-r from-[#176282] via-[#248aa6] to-[#4fd2ff] text-[#03151f] py-4 rounded-xl font-bold text-sm tracking-widest uppercase hover:brightness-110 transition-all shadow-[0_0_24px_rgba(79,210,255,0.3)] disabled:opacity-50"
            >
              {busyRef.current
                ? `⏳ RUNNING: ${workflowStatus.toUpperCase()} (${workflowProgress}%)`
                : '🚀 LAUNCH FULL AUTO-PILOT WORKFLOW'}
            </button>

            {/* Workflow Progress Bar */}
            {busyRef.current && (
              <div className="w-full bg-[#050c12] h-2 rounded-full overflow-hidden border border-[#173042]">
                <div
                  className="bg-gradient-to-r from-[#248aa6] to-[#4fd2ff] h-full transition-all duration-300"
                  style={{ width: `${workflowProgress}%` }}
                />
              </div>
            )}

            {/* Live Artifact Box when generated */}
            {videoUrl && (
              <div className="p-4 rounded-xl bg-[#0a1824] border border-[#2ea8c9] flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-[#7fd4ff] font-semibold">
                  <span>✨ Latest Produced Video: {plan?.title}</span>
                  {lastUploadedLink && (
                    <a
                      href={lastUploadedLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#ff4d64] underline"
                    >
                      Open on YouTube ↗
                    </a>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleShareDirect}
                    className="flex-1 cursor-pointer bg-gradient-to-r from-[#a3141c] to-[#ff2d3f] text-white py-2.5 rounded-lg text-xs font-bold hover:brightness-110"
                  >
                    📤 Share Directly to YouTube
                  </button>
                  <a
                    href={videoUrl}
                    download={`${plan?.title || 'apex-short'}.webm`}
                    className="flex-1 text-center cursor-pointer bg-[#0d1a24] border border-[#2ea8c9] text-[#9fe8ff] py-2.5 rounded-lg text-xs hover:bg-[#142838]"
                  >
                    ⬇ Download Video
                  </a>
                  {thumbUrl && (
                    <a
                      href={thumbUrl}
                      download="thumbnail.png"
                      className="cursor-pointer bg-[#0d1a24] border border-[#1d3a4d] text-[#9fe8ff] px-3 py-2.5 rounded-lg text-xs hover:bg-[#142838]"
                    >
                      Cover
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Live Terminal Log */}
            {workflowLogs.length > 0 && (
              <div className="p-3 bg-[#03080d] border border-[#122432] rounded-xl text-[11px] leading-relaxed text-[#8fd8f5] font-mono max-h-[170px] overflow-y-auto whitespace-pre-wrap">
                {workflowLogs.map((m, i) => (
                  <div key={i}>{m}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. TOPIC RESEARCH TAB */}
        {tab === 'research' && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Topic niche (e.g. Next-Gen Humanoids, Space Exploration)"
                className="flex-1 bg-[#0a151d] border border-[#1d3a4d] rounded-xl p-3 text-xs text-[#eaf9ff]"
              />
              <button
                onClick={() => performResearch(niche)}
                className="cursor-pointer bg-gradient-to-r from-[#176282] to-[#2ea8c9] text-[#03181f] px-4 py-2.5 rounded-xl font-bold text-xs"
              >
                🔍 Research Trends
              </button>
            </div>

            {researchedTopics.length > 0 ? (
              <div className="flex flex-col gap-3">
                {researchedTopics.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-[#091520] border border-[#173347] hover:border-[#2ea8c9] transition-all flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-bold text-[#eaf9ff]">{item.title}</div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(79,210,255,0.15)] text-[#4fd2ff] font-semibold border border-[rgba(79,210,255,0.3)] whitespace-nowrap">
                        🔥 {item.viralPotential}% Viral Score
                      </span>
                    </div>

                    <div className="text-[11px] text-[#8fd8f5] leading-relaxed">
                      <b>Hook:</b> "{item.hook}"
                    </div>

                    <div className="text-[10.5px] text-[#5c8ba6] leading-relaxed">
                      {item.summary}
                    </div>

                    <div className="flex gap-1.5 flex-wrap text-[9.5px] text-[#4d7a96]">
                      {item.searchKeywords.map((k) => (
                        <span key={k} className="px-1.5 py-0.5 rounded bg-[#050c12] border border-[#122432]">
                          #{k}
                        </span>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-1 border-t border-[rgba(79,210,255,0.08)] mt-1">
                      <button
                        onClick={() => {
                          setSelectedTopicResearch(item);
                          setTopic(item.title);
                          setTab('video');
                          onToast(`Loaded: "${item.title}"`);
                        }}
                        className="cursor-pointer flex-1 bg-[#0d1a24] text-[#9fe8ff] border border-[#1d3a4d] rounded-lg py-1.5 text-xs hover:bg-[#142838]"
                      >
                        Customize Script
                      </button>
                      <button
                        onClick={async () => {
                          setSelectedTopicResearch(item);
                          setTopic(item.title);
                          setTab('autopilot');
                          const planData = await formulateScript(item.title);
                          const { blob, url, thumb } = await produceVideo(planData);
                          await uploadToYouTube(blob, planData);
                        }}
                        className="cursor-pointer flex-1 bg-gradient-to-r from-[#176282] to-[#2ea8c9] text-[#03181f] font-bold rounded-lg py-1.5 text-xs"
                      >
                        ⚡ One-Click Video & Upload
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[#527d97] border border-dashed border-[#173042] rounded-xl">
                Click "Research Trends" to discover automated high-converting video topics with viral metrics.
              </div>
            )}
          </div>
        )}

        {/* 3. STUDIO TAB */}
        {tab === 'video' && (
          <div className="flex flex-col gap-3.5">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Video topic or headline"
              className="w-full bg-[#0a151d] border border-[#1d3a4d] rounded-xl p-3 text-xs text-[#eaf9ff]"
            />

            <div className="flex gap-2">
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="flex-1 bg-[#0a151d] border border-[#1d3a4d] rounded-xl p-2.5 text-xs text-[#d8f2ff]"
              >
                <option value="hi">Hindi Voiceover</option>
                <option value="en">English Voiceover</option>
              </select>

              <select
                value={scenesCount}
                onChange={(e) => setScenesCount(parseInt(e.target.value, 10))}
                className="flex-1 bg-[#0a151d] border border-[#1d3a4d] rounded-xl p-2.5 text-xs text-[#d8f2ff]"
              >
                <option value={5}>5 Scenes</option>
                <option value={6}>6 Scenes</option>
                <option value={8}>8 Scenes</option>
              </select>
            </div>

            <button
              onClick={async () => {
                if (!topic.trim()) return onToast('Please enter a topic');
                const planData = await formulateScript(topic.trim());
                await produceVideo(planData);
              }}
              disabled={busyRef.current}
              className="cursor-pointer w-full bg-gradient-to-r from-[#176282] to-[#2ea8c9] text-[#03181f] font-bold py-3 rounded-xl text-xs uppercase tracking-wider"
            >
              {busyRef.current ? 'Generating & Rendering…' : 'Generate & Render Short Video'}
            </button>

            {plan && (
              <div className="p-3 bg-[#081219] border border-[#173042] rounded-xl flex flex-col gap-2">
                <div className="text-xs font-semibold text-[#8fd8f5]">{plan.title}</div>
                <div className="text-[11px] text-[#5a86a1]">{plan.description}</div>
                <div className="flex flex-col gap-1.5 mt-2">
                  {plan.scenes.map((s, idx) => (
                    <div key={idx} className="p-2 rounded bg-[#050c12] text-[10.5px]">
                      <b className="text-[#4fd2ff]">Scene {idx + 1}:</b> {s.caption} —{' '}
                      <span className="text-[#a5d8f0]">"{s.narration}"</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. CONTENT PACK TAB */}
        {tab === 'content' && (
          <div className="flex flex-col gap-3">
            <button
              onClick={async () => {
                if (!topic.trim() && !niche.trim()) return onToast('Please enter a topic');
                const r = await fetch('/content/plan', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ topic: topic.trim() || niche.trim(), lang }),
                });
                const j = await r.json();
                setContentPlan(j);
                onToast('Viral content package created!');
              }}
              className="cursor-pointer w-full bg-gradient-to-r from-[#1a6d3f] to-[#2fc978] text-[#03150c] font-bold py-3 rounded-xl text-xs uppercase tracking-wider"
            >
              Generate Complete Shorts Content Strategy
            </button>

            {contentPlan && (
              <div className="flex flex-col gap-2.5">
                <div className="p-3 rounded-xl bg-[#091520] border border-[#173042]">
                  <div className="text-[10px] text-[#4fd2ff] font-semibold mb-1">5 VIRAL HOOKS</div>
                  <div className="text-xs text-[#dff4ff] leading-relaxed whitespace-pre-wrap">
                    {contentPlan.hooks.map((h, i) => `${i + 1}. ${h}`).join('\n')}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#091520] border border-[#173042]">
                  <div className="text-[10px] text-[#4fd2ff] font-semibold mb-1">TIMED REEL SCRIPT</div>
                  <div className="text-xs text-[#dff4ff] leading-relaxed whitespace-pre-wrap">
                    {contentPlan.script.map((x) => `${x.t}s — ${x.line}`).join('\n')}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#091520] border border-[#173042]">
                  <div className="text-[10px] text-[#4fd2ff] font-semibold mb-1">HASHTAGS & POST TIME</div>
                  <div className="text-xs text-[#dff4ff]">{contentPlan.hashtags.map((h) => '#' + h).join(' ')}</div>
                  <div className="text-[10.5px] text-[#749eb7] mt-1">{contentPlan.bestTime}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. HISTORY & QUEUE TAB */}
        {tab === 'history' && (
          <div className="flex flex-col gap-3">
            <div className="p-3 rounded-xl bg-[#091520] border border-[#173042] flex flex-col gap-2">
              <div className="text-xs font-semibold text-[#8fd8f5]">Optional YouTube Access Token</div>
              <div className="text-[10.5px] text-[#527d97]">
                Provide an OAuth Bearer token to automatically publish videos to your channel directly.
              </div>
              <input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Bearer ya29.a0A..."
                className="w-full bg-[#050c12] border border-[#1d3a4d] rounded-lg p-2 text-xs text-[#d8f2ff]"
              />
            </div>

            {jobHistory.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {jobHistory.map((job) => (
                  <div
                    key={job.id}
                    className="p-3 rounded-xl bg-[#091520] border border-[#173042] flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <b className="text-[#dff4ff]">{job.topic || job.niche}</b>
                      <span
                        className={`text-[9.5px] px-2 py-0.5 rounded uppercase font-semibold ${
                          job.status === 'completed'
                            ? 'bg-[#154625] text-[#5df589]'
                            : job.status === 'error'
                            ? 'bg-[#461515] text-[#f55d5d]'
                            : 'bg-[#153446] text-[#5dbbf5]'
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>

                    <div className="text-[10px] text-[#5a86a1]">
                      {new Date(job.timestamp).toLocaleString()} · {job.niche}
                    </div>

                    {job.youtubeUrl && (
                      <div className="text-xs text-[#4fd2ff] mt-1">
                        <a href={job.youtubeUrl} target="_blank" rel="noreferrer" className="underline">
                          {job.youtubeUrl} ↗
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-[#527d97]">
                No jobs executed yet. Launch your first Auto-Pilot run!
              </div>
            )}
          </div>
        )}

        {/* Hidden Frame Canvas for video rendering */}
        <canvas ref={previewCanvasRef} className="hidden" />
      </div>
    </div>
  );
};
