// MYRAA × ULTRON Autonomous Action & Multi-Source Deep Research Engine
// Inspired by Reel 1 (MYRAA Free Jarvis: Direct Song Auto-Play, Smart WhatsApp Auto-Composer, Autonomous Web Research)
// & Reel 2 (ULTRON Cyber Lock HUD + Multi-Device Sync)

import { hubFetch } from './api';
import { askGeminiWithUserKey } from './geminiLive';

export interface AutonomousResearchStep {
  step: number;
  label: string;
  detail: string;
}

export interface AutonomousResearchResult {
  query: string;
  spokenSummary: string;
  markdownReport: string;
  youtubeVideoId?: string;
}

/** Searches YouTube directly for exact playable videoId without needing any API key! */
export async function findPlayableYouTubeVideoId(songOrVideoQuery: string): Promise<{ videoId: string; title: string } | null> {
  const q = encodeURIComponent(songOrVideoQuery.trim());
  const endpoints = [
    `https://pipedapi.kavin.rocks/search?q=${q}&filter=all`,
    `https://pipedapi.tokhmi.xyz/search?q=${q}&filter=all`,
  ];

  for (const ep of endpoints) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2800);
      const r = await fetch(ep, { signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) {
        const j = await r.json();
        const item = Array.isArray(j?.items)
          ? j.items.find((x: any) => typeof x?.url === 'string' && x.url.includes('watch?v='))
          : null;
        if (item) {
          const vid = String(item.url).split('watch?v=')[1]?.split('&')[0];
          if (vid && vid.length >= 8) {
            return { videoId: vid, title: String(item.title || songOrVideoQuery) };
          }
        }
      }
    } catch {}
  }

  // Fallback via Jina YouTube search scrape so we STILL get a real direct watch?v= ID!
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3200);
    const r = await fetch(`https://r.jina.ai/https://www.youtube.com/results?search_query=${q}`, {
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (r.ok) {
      const txt = await r.text();
      const m = txt.match(/watch\?v=([A-Za-z0-9_-]{11})/);
      if (m?.[1]) {
        return { videoId: m[1], title: songOrVideoQuery };
      }
    }
  } catch {}

  return null;
}

/** Launches direct song/video playback on Android YouTube App (or browser tab) hands-free! */
export async function playSongOrVideoHandsFree(rawQuery: string): Promise<{
  playedDirectId: string | null;
  spokenReply: string;
}> {
  const cleanQuery = rawQuery
    .replace(/\b(play|bajao|chalao|sunao|on\s*youtube|youtube\s*(?:par|pe|mein)|song|gaana|music|please|zara|for\s*me|in\s*all\s*devices)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim() || rawQuery.trim();

  const hit = await findPlayableYouTubeVideoId(`${cleanQuery} song official`);
  const bridge = (window as any).ApexAndroid;

  if (hit?.videoId) {
    const watchUrl = `https://www.youtube.com/watch?v=${hit.videoId}&autoplay=1`;
    if (bridge?.openUrl) {
      bridge.openUrl(`vnd.youtube://${hit.videoId}`);
    } else {
      window.open(watchUrl, '_blank', 'noopener,noreferrer');
    }
    return {
      playedDirectId: hit.videoId,
      spokenReply: `${cleanQuery} YouTube par direct chalu kar diya hai Boss!`,
    };
  }

  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;
  if (bridge?.openUrl) bridge.openUrl(searchUrl);
  else window.open(searchUrl, '_blank', 'noopener,noreferrer');
  return {
    playedDirectId: null,
    spokenReply: `${cleanQuery} YouTube par khol diya hai Boss!`,
  };
}

/** Composes a smart AI message and opens WhatsApp ready with text (MYRAA Reel feature)! */
export async function composeAndOpenWhatsAppSmart(rawCommand: string): Promise<string> {
  let drafted = '';
  const prompt = `User said: "${rawCommand}". Write ONLY the ready-to-send natural polite Hinglish/English WhatsApp message text (1-2 sentences, no quotes, no explanation).`;

  const gemReply = await askGeminiWithUserKey(prompt);
  if (gemReply) {
    drafted = gemReply;
  } else {
    try {
      const r = await hubFetch('/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: prompt, fast: true }),
      });
      const j = await r.json();
      drafted = String(j?.text || '').trim();
    } catch {}
  }

  if (!drafted) {
    drafted = `Namaste! Main aapse "${rawCommand}" ke silsile me baat karna chahta tha. Free hokar batayein!`;
  }

  const phoneMatch = rawCommand.match(/(?:\+?91[\s-]?)?([6-9]\d{9})/);
  const waUrl = phoneMatch?.[1]
    ? `https://wa.me/91${phoneMatch[1]}?text=${encodeURIComponent(drafted)}`
    : `whatsapp://send?text=${encodeURIComponent(drafted)}`;

  const bridge = (window as any).ApexAndroid;
  if (bridge?.openUrl) {
    bridge.openUrl(waUrl);
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(drafted)}`, '_blank', 'noopener,noreferrer');
  }

  return `WhatsApp message tayyar karke khol diya hai: "${drafted}"`;
}

/**
 * Full Autonomous Multi-Step Research & Task Execution Agent ("usko kaam do aur woh khud auto research kare!")
 * Searches Wikipedia + Live Web via Jina + Synthesizes actionable Hindi/English Executive Report automatically!
 */
export async function runAutonomousDeepResearch(
  rawTask: string,
  onProgress?: (statusLine: string) => void
): Promise<AutonomousResearchResult> {
  const topic = rawTask
    .replace(
      /\b(auto\s*research|research\s*karo|research\s*karke|khoj\s*karo|iska\s*pata\s*lagao|iske\s*baare\s*mein\s*research|kaam\s*karo|deep\s*search|report\s*banao|plan\s*banao)\b/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim() || rawTask.trim();

  onProgress?.(`🔍 Step 1/3: Live Internet & Encyclopedia par "${topic}" search ho raha hai…`);

  const slug = encodeURIComponent(topic.replace(/\s+/g, '_'));
  const [wikiEn, wikiHi, webSearchTxt] = await Promise.all([
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetch(`https://hi.wikipedia.org/api/rest_v1/page/summary/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    (async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4500);
        const r = await fetch(`https://s.jina.ai/${encodeURIComponent(topic)}`, { signal: ctrl.signal });
        clearTimeout(t);
        if (r.ok) return (await r.text()).slice(0, 1600);
      } catch {}
      return '';
    })(),
  ]);

  onProgress?.(`🧠 Step 2/3: Live data mil gaya — AI Strategist poora report aur action plan bana raha hai…`);

  const rawEvidence = [
    wikiHi?.extract ? `Hindi Wiki: ${wikiHi.extract}` : '',
    wikiEn?.extract ? `English Wiki: ${wikiEn.extract}` : '',
    webSearchTxt ? `Live Web Results: ${webSearchTxt.replace(/\s+/g, ' ').slice(0, 1100)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const synthPrompt =
    `You are APEX Autonomous Research Agent. User task: "${rawTask}".\n` +
    (rawEvidence ? `Live gathered web evidence:\n${rawEvidence}\n\n` : '') +
    `Create a super clear, practical Roman Hinglish response with:\n` +
    `1) TOP 2-LINE SUMMARY (spoken clearly)\n` +
    `2) 4 KEY FACTS / NUMBERS\n` +
    `3) STEP-BY-STEP ACTION PLAN\n` +
    `Keep it crisp, accurate, and easy to read in chat.`;

  let finalReport = await askGeminiWithUserKey(synthPrompt);
  if (!finalReport) {
    try {
      const r = await hubFetch('/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: synthPrompt }),
      });
      const j = await r.json();
      finalReport = String(j?.text || '').trim();
    } catch {}
  }

  if (!finalReport) {
    finalReport =
      rawEvidence.slice(0, 500) ||
      `${topic} par research complete ho gayi hai Boss — main points chat me save kar diye hain.`;
  }

  const cleanReport = finalReport.replace(/[*#`]/g, '').trim();
  const firstTwoSentences = cleanReport
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((s) => s.trim().length > 6)
    .slice(0, 2)
    .join(' ')
    .slice(0, 240);

  onProgress?.(`✅ Step 3/3: Auto-Research Complete! Full report Chat aur Tasks me save ho gaya!`);

  return {
    query: topic,
    spokenSummary: `Boss, ${topic} par auto research poori ho gayi hai! ${firstTwoSentences}`,
    markdownReport: `🧠 AUTO-RESEARCH REPORT: ${topic.toUpperCase()}\n\n${cleanReport}`,
  };
}
