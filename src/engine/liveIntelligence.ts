// Clean, Accurate, High-Precision Bilingual (Hindi + Hinglish + English) Intelligence Engine
// Directly powered by Live Llama-3.3-70B / Gemini 2.5 Flash + Real-Time Market Feeds (ZERO regex hijacking!)

import { askGeminiWithUserKey } from './geminiLive';
import { buildBrainPrompt } from './brainMemory';

const CLOUD_WORKER = 'https://apex-humanoid-v2.pradhanbibek53.workers.dev';

/**
 * Light, non-destructive helper ONLY for checking explicit phone/app control keywords
 * when Android SpeechRecognizer outputs Devanagari Hindi script.
 * NEVER sent to the AI brain — the AI brain receives the user's EXACT original words!
 */
const COMMAND_DEVANAGARI_MAP: [RegExp, string][] = [
  [/नमस्ते|नमस्कार|प्रणाम/g, 'namaste'],
  [/हेलो|हैलो|हलो|हाय/g, 'hello'],
  [/ओपन\s*मोंटेज|मोंटेज|ओपन\s*वीडियो/g, 'open montage'],
  [/ऑटो\s*रिसर्च|रिसर्च\s*करो|डीप\s*रिसर्च|रिपोर्ट\s*बनाओ/g, 'auto research karo'],
  [/गाना\s*बजाओ|बजाओ|चलाओ|प्ले\s*करो/g, 'bajao'],
  [/वीडियो\s*बनाओ|वीडियो\s*बनाकर|वीडियो\s*बना\s*के|रील\s*बनाओ|शॉर्ट\s*बनाओ/g, 'video banao'],
  [/सेव\s*करके|सेव\s*करो|सेव\s*कर|रखो/g, 'save karke rakho'],
  [/अपलोड\s*कर\s*दो|अपलोड\s*करो|यूट्यूब\s*पर\s*अपलोड/g, 'video upload kar do'],
  [/व्हाट्सएप|वाट्सएप/g, 'whatsapp'],
  [/यूट्यूब/g, 'youtube'],
  [/इंस्टाग्राम/g, 'instagram'],
  [/फेसबुक/g, 'facebook'],
  [/कैमरा/g, 'camera'],
  [/टॉर्च|फ्लैश/g, 'torch'],
  [/आवाज\s*बढ़ाओ|वॉल्यूम\s*बढ़ाओ|फुल\s*वॉल्यूम/g, 'volume up'],
  [/आवाज\s*कम|वॉल्यूम\s*कम/g, 'volume down'],
  [/खोलो|खोल\s*दो|ओपन\s*करो|चालू\s*करो/g, 'kholo'],
  [/बंद\s*करो|ऑफ\s*करो/g, 'band karo'],
  [/सोना|सोने|गोल्ड/g, 'gold'],
  [/चांदी|सिल्वर/g, 'silver'],
  [/बिटकॉइन|बीटीसी/g, 'bitcoin'],
  [/निफ्टी/g, 'nifty'],
  [/सेंसेक्स/g, 'sensex'],
  [/मौसम|तापमान/g, 'mausam'],
];

export function normalizeSpokenHindiText(raw: string): string {
  if (!raw) return '';
  let out = raw.trim();
  for (const [rx, rep] of COMMAND_DEVANAGARI_MAP) {
    out = out.replace(rx, ` ${rep} `);
  }
  return out.replace(/\s+/g, ' ').trim();
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 2500): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchYahooQuote(symbol: string): Promise<{
  price: number;
  prevClose: number;
} | null> {
  try {
    const r = await fetchWithTimeout(
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2d&interval=15m`,
      {},
      1800
    );
    if (!r.ok) return null;
    const j = await r.json();
    const meta = j?.chart?.result?.[0]?.meta;
    if (!meta || !meta.regularMarketPrice) return null;
    return {
      price: Number(meta.regularMarketPrice),
      prevClose: Number(meta.chartPreviousClose || meta.regularMarketPrice),
    };
  } catch {
    return null;
  }
}

/** Strict exact-only short greetings (NEVER hijacks full sentences or questions!) */
const STRICT_GREETING_ONLY: [RegExp, () => string][] = [
  [
    /^(?:hello|hi|hey|hii+|helo|namaste|namaskar|assalamualaikum|ram\s*ram|radhe\s*radhe|jai\s*shree\s*ram)[,?!.\s]*$/i,
    () => 'Namaste Boss! Main bilkul clear sun raha hoon. Bataiye main aapki kya madad karoon?',
  ],
  [
    /^(?:kaise\s*ho|kya\s*haal\s*hai|how\s*are\s*you)[,?!.\s]*$/i,
    () => 'Main bilkul badhiya hoon Boss! Aap bataiye, aaj kya kaam karna hai?',
  ],
];

/** Real-Time Live Market Rates ONLY when user asks for price/rate/time/weather — everything else goes to Real AI Brain! */
export async function tryResolveRealtimeWorldQuery(rawText: string): Promise<string | null> {
  const norm = normalizeSpokenHindiText(rawText);
  const low = norm.toLowerCase().trim();

  // Only match strict 1-3 word pure greetings
  for (const [rx, fn] of STRICT_GREETING_ONLY) {
    if (rx.test(low)) return fn();
  }

  // Exact Time / Date questions only
  if (/^(?:abhi\s*)?(?:time\s+kya\s*(?:hua\s*)?(?:hai)?|kitne\s+baje\s*(?:hain)?|what\s+time\s+is\s+it|samay\s+kya\s+hai)[?.!]*$/i.test(low)) {
    const nowStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return `Abhi ${nowStr} baj rahe hain Boss.`;
  }
  if (/^(?:aaj\s+ki\s+date\s*(?:kya\s+hai)?|aaj\s+kaunsa\s+din\s+hai|today.?s?\s+date)[?.!]*$/i.test(low)) {
    const dayStr = new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return `Aaj ${dayStr} hai.`;
  }

  const asksPrice = /\b(price|rate|bhav|bhaav|kitna|kitne|kya\s+chal|value|worth|live)\b/i.test(low) || low.split(/\s+/).length <= 3;

  // Live GOLD Price when asking Gold rate
  if (asksPrice && /\b(gold|sona|sone|24k|22k)\b/i.test(low)) {
    try {
      const [cdxTickers, yGold] = await Promise.all([
        fetchWithTimeout('https://api.coindcx.com/exchange/ticker', {}, 1500)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetchYahooQuote('GC=F'),
      ]);
      let ozUsd = yGold?.price || 0;
      let paxgInr = 0;
      let usdInr = 87.5;
      if (Array.isArray(cdxTickers)) {
        const gInr = cdxTickers.find((x: any) => x.market === 'PAXGINR');
        const uInr = cdxTickers.find((x: any) => x.market === 'USDTINR');
        if (gInr && Number(gInr.last_price) > 0) paxgInr = Number(gInr.last_price);
        if (uInr && Number(uInr.last_price) > 0) usdInr = Number(uInr.last_price);
      }
      if (ozUsd > 0 || paxgInr > 0) {
        const g24k10g =
          paxgInr > 0 ? Math.round(paxgInr / 3.11035) : Math.round(((ozUsd * usdInr * 1.06) / 31.1035) * 10);
        const g22k10g = Math.round(g24k10g * 0.916);
        return `Abhi live 24 Carat Gold ${g24k10g.toLocaleString('en-IN')} rupaye prati 10 gram aur 22 Carat ${g22k10g.toLocaleString('en-IN')} rupaye chal raha hai.`;
      }
    } catch {}
  }

  // Live CRYPTO Price when asking Crypto rate
  const cryptoMatch = low.match(/\b(bitcoin|btc|ethereum|eth|solana|sol|xrp|dogecoin|doge|bnb)\b/i);
  if (asksPrice && cryptoMatch) {
    try {
      const symMap: Record<string, string> = {
        bitcoin: 'BTC',
        btc: 'BTC',
        ethereum: 'ETH',
        eth: 'ETH',
        solana: 'SOL',
        sol: 'SOL',
        xrp: 'XRP',
        dogecoin: 'DOGE',
        doge: 'DOGE',
        bnb: 'BNB',
      };
      const base = symMap[cryptoMatch[1].toLowerCase()] || 'BTC';
      const arr = await fetchWithTimeout('https://api.coindcx.com/exchange/ticker', {}, 1500).then((r) => r.json());
      const inrRow = arr.find((x: any) => x.market === `${base}INR`);
      if (inrRow && Number(inrRow.last_price) > 0) {
        const px = Math.round(Number(inrRow.last_price));
        const chg = parseFloat(inrRow.change_24_hour || '0');
        return `Abhi live ${base} ka price ${px.toLocaleString('en-IN')} rupaye hai, 24 ghante me ${chg >= 0 ? 'plus ' : 'minus '}${Math.abs(chg).toFixed(2)} percent.`;
      }
    } catch {}
  }

  if (asksPrice && /\b(nifty|sensex)\b/i.test(low)) {
    const isSensex = /\bsensex\b/i.test(low);
    const q = await fetchYahooQuote(isSensex ? '^BSESN' : '^NSEI');
    if (q) {
      const chg = q.price - q.prevClose;
      return `Abhi ${isSensex ? 'Sensex' : 'Nifty 50'} ${Math.round(q.price).toLocaleString('en-IN')} par chal raha hai (${chg >= 0 ? '+' : ''}${chg.toFixed(0)} points).`;
    }
  }

  return null;
}

export function extractAutoPersonalMemory(rawText: string): string | null {
  const clean = rawText.trim();
  const patterns = [
    /\b(?:mera\s+naam|my\s+name\s+is|i\s+am\s+called)\s+([a-zA-Z\u0900-\u097F\s]{2,30})/i,
    /\b(?:main\s+.{2,35}\s+(?:rehta|rehti|kaam\s+karta|karta)\s+hoon)/i,
    /\b(?:mera\s+(?:favourite|favorite|pasandida|goal|target|birthday)\s+.{2,50})/i,
  ];
  for (const p of patterns) {
    if (clean.match(p)) return clean.slice(0, 100);
  }
  return null;
}

/**
 * Direct Smart Cloud AI Brain (Llama-3.3-70B / Gemini 2.5 Flash)
 * Sends the user's EXACT unmodified speech (Hindi, Hinglish, or English) and returns
 * a 100% accurate, relevant, crystal-clear answer in simple everyday Roman Hinglish!
 */
export async function askFastLiveBrain(opts: {
  userText: string;
  userName: string;
  memories: string[];
  walletSummary: string;
  history: { role: string; text: string }[];
}): Promise<string> {
  const askTrade = /\b(trade|trading|wallet|coindcx|portfolio|profit|loss|position|margin|balance|खाता|बैलेंस|ट्रेड)\b/i.test(
    opts.userText
  );
  const systemInstruction = [
    `You are APEX AI, a smart, accurate, loyal Indian voice assistant talking to ${opts.userName || 'Boss'}.`,
    `STRICT RULES:`,
    `1. Answer the user's EXACT question accurately, directly, and intelligently. NEVER give an unrelated, generic, or opposite reply.`,
    `2. Always write in clean, simple, easy-to-understand everyday Hinglish using plain English alphabet (Roman script, e.g., "Bilkul Boss! Iska matlab yeh hai ki..."), so Indian voice synthesis pronounces every single word clearly.`,
    `3. Keep spoken answers crisp (2 to 3 clear sentences max), warm, and directly helpful. Never use asterisks (*), hashtags (#), or emojis.`,
    askTrade ? `4. Live CoinDCX Account Data: ${opts.walletSummary}` : '',
    // 📚 v6.6.1: pehle sirf memories[0] jaata tha (1 note) → ab poora persistent BRAIN FILE
    opts.memories.length ? `5. User Notes: ${opts.memories.slice(0, 6).join(' | ')}` : '',
    buildBrainPrompt(2200) ? `6. ${buildBrainPrompt(2200)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const fullPrompt = `${systemInstruction}\n\nUser Question: "${opts.userText}"\nClear Accurate Hinglish Answer:`;

  // 1) Direct Gemini 2.5 Flash if user added their own API key
  const geminiDirect = await askGeminiWithUserKey(fullPrompt, opts.history);
  if (geminiDirect) {
    return geminiDirect.replace(/[*#_`~]/g, '').trim();
  }

  // 2) Live Llama-3.3-70B-Instruct Cloud Worker Brain (~0.5s response!)
  try {
    const r = await fetchWithTimeout(
      `${CLOUD_WORKER}/chat`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: fullPrompt,
          message: fullPrompt,
          voiceMode: true,
          fast: true,
          history: opts.history.slice(-6),
        }),
      },
      10000
    );
    if (!r.ok) throw new Error('worker-status');
    const j = await r.json();
    const txt = String(j?.text || j?.reply || '')
      .replace(/[*#_`~]/g, '')
      .replace(/^["']|["']$/g, '')
      .trim();
    if (txt) return txt;
  } catch {}

  return 'Maaf kijiye Boss, internet signal thoda weak tha — kripya ek baar fir se boliyega.';
}
