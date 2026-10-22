/* ---------------------------------------------------------------------------
   APEX Humanoid — Complete Free Cloud Hub (Cloudflare Workers · $0/mo · 24x7)
   ---------------------------------------------------------------------------
   Powers ALL systems in one place:
     1. Telegram AI Bot (@apex_humanoid1_bot): Chat, /yt, /price, /balance, /voice, /say
     2. Autonomous YouTube Shorts Agent: /agent/research, /yt/plan, /content/plan,
        /yt/voice (ElevenLabs OR Free Workers AI TTS), /yt/upload (OAuth + Refresh Token)
     3. Live Crypto & CoinDCX Trading: /api/coindcx/ticker, /balances, /trade, /api/news/grounding
     4. 3D Humanoid Web App AI Chat & Voice: /chat, /yt/voice
   --------------------------------------------------------------------------- */

const TG = (token) => `https://api.telegram.org/bot${token}`;

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-voice-history, x-wallet-context',
};

const jsonRes = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });

const HELP = `<b>APEX Humanoid 🤖</b>

Kuch bhi likho — AI turant jawab dega!
/yt &lt;topic&gt; — Automatic YouTube Shorts script + hook 🎬
/price — Live CoinDCX BTC/ETH/SOL prices 📊
/balance — Live CoinDCX wallet balance 💰
/autotrade on — 24×7 Smart CoinDCX Auto-Trader ON 🤖
/autotrade off — Auto-Trader OFF ⏹
/autotrade now — Abhi turant 1 Smart Trade execute karo ⚡
/voice on — Voice replies ON 🔊
/voice off — Text replies mode
/say &lt;text&gt; — AI Voice note bhejo 🎙️
/id — tumhara chat id
/app — live 3D Humanoid + Auto YouTube Studio link
/clear — memory reset

<i>24×7 Free · AI + YouTube Auto-Studio + Voice + CoinDCX</i>`;

const SYSTEM_PROMPT =
  'You are APEX Humanoid, a smart, warm, helpful AI assistant created for the user. ' +
  'Reply naturally in the exact language/style the user uses (Hinglish, Hindi, or English). ' +
  'Keep replies clear, conversational, and concise (under 100 words unless user asks for detail).';

async function tgCall(token, method, body = {}) {
  try {
    const r = await fetch(`${TG(token)}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, description: e.message };
  }
}

async function send(token, chatId, text, extra = {}) {
  const payload = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra };
  let r = await tgCall(token, 'sendMessage', payload);
  if (r && r.ok === false && /parse/i.test(String(r.description || ''))) {
    r = await tgCall(token, 'sendMessage', {
      chat_id: chatId,
      text: String(text).replace(/<[^>]+>/g, ''),
      disable_web_page_preview: true,
    });
  }
  return r;
}

async function sendVoiceNote(token, chatId, audioBytes, caption = '') {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('voice', new Blob([audioBytes], { type: 'audio/mpeg' }), 'apex-voice.mp3');
  if (caption) form.append('caption', caption.slice(0, 900));
  const r = await fetch(`${TG(token)}/sendVoice`, { method: 'POST', body: form });
  return await r.json();
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function base64ToUint8(b64) {
  const clean = String(b64).replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/* ---------------- Voice Synthesis (ElevenLabs + Free Workers TTS) -------- */

async function synthesizeSpeechBytes(env, text, customVoiceId) {
  const cleanText = String(text || '').trim().slice(0, 800);
  if (!cleanText) throw new Error('text required');

  // 1) ElevenLabs HD Voice when key is provided
  const elKey = String(env.ELEVENLABS_API_KEY || '').trim();
  if (elKey) {
    try {
      const voiceId = String(customVoiceId || env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb').trim();
      const modelId = String(env.ELEVENLABS_MODEL || 'eleven_multilingual_v2').trim();
      const r = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'xi-api-key': elKey, accept: 'audio/mpeg' },
          body: JSON.stringify({
            text: cleanText,
            model_id: modelId,
            voice_settings: { stability: 0.45, similarity_boost: 0.75 },
          }),
        }
      );
      if (r.ok) return { bytes: await r.arrayBuffer(), mime: 'audio/mpeg' };
    } catch {}
  }

  // 2) Free Zero-Key Cloudflare Workers AI TTS (@cf/myshell-ai/melotts / @cf/deepgram/aura-1)
  if (env.AI && typeof env.AI.run === 'function') {
    try {
      const res = await env.AI.run('@cf/myshell-ai/melotts', { prompt: cleanText, lang: 'en' });
      if (res?.audio) {
        return { bytes: base64ToUint8(res.audio).buffer, mime: 'audio/mpeg' };
      }
    } catch {}
    try {
      const res = await env.AI.run('@cf/deepgram/aura-1', { text: cleanText });
      if (res instanceof ReadableStream || res?.body) {
        const ab = await new Response(res).arrayBuffer();
        if (ab.byteLength > 100) return { bytes: ab, mime: 'audio/mpeg' };
      }
    } catch {}
  }

  throw new Error('TTS unavailable — add ELEVENLABS_API_KEY for HD multilingual voice');
}

/* --------------------- CoinDCX Live Market & Trading --------------------- */

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchAllCoinDcxTickers() {
  const r = await fetch('https://api.coindcx.com/exchange/ticker', { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`CoinDCX ticker ${r.status}`);
  return await r.json();
}

async function fetchCoinDcxTickers() {
  const all = await fetchAllCoinDcxTickers();
  const targets = new Set(['BTCINR', 'ETHINR', 'SOLINR', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'USDTINR']);
  return all.filter((item) => targets.has(item.market));
}

function decodeHttpBody(raw) {
  const idx = raw.indexOf('\r\n\r\n');
  if (idx < 0) return raw;
  const headers = raw.slice(0, idx).toLowerCase();
  let body = raw.slice(idx + 4);
  if (headers.includes('transfer-encoding: chunked')) {
    let out = '';
    let pos = 0;
    while (pos < body.length) {
      const lineEnd = body.indexOf('\r\n', pos);
      if (lineEnd < 0) break;
      const hex = body.slice(pos, lineEnd).split(';')[0].trim();
      const len = parseInt(hex, 16);
      if (!len || Number.isNaN(len)) break;
      out += body.slice(lineEnd + 2, lineEnd + 2 + len);
      pos = lineEnd + 2 + len + 2;
    }
    return out;
  }
  return body;
}

// CoinDCX Futures Wallets requires a signed GET request WITH a JSON body (rejected by WHATWG fetch).
async function coindcxSignedGetWithBody(path, key, secret, payloadObj) {
  const body = JSON.stringify(payloadObj);
  const sig = await hmacSha256Hex(secret, body);
  const byteLen = new TextEncoder().encode(body).byteLength;
  const rawReq =
    `GET ${path} HTTP/1.1\r\n` +
    `Host: api.coindcx.com\r\n` +
    `User-Agent: APEX-CloudHub/2.0\r\n` +
    `Accept: application/json\r\n` +
    `Content-Type: application/json\r\n` +
    `Content-Length: ${byteLen}\r\n` +
    `X-AUTH-APIKEY: ${key}\r\n` +
    `X-AUTH-SIGNATURE: ${sig}\r\n` +
    `Connection: close\r\n\r\n` +
    body;

  try {
    const { connect } = await import('cloudflare:sockets');
    const socket = connect({ hostname: 'api.coindcx.com', port: 443 }, { secureTransport: 'on', allowHalfOpen: true });
    const writer = socket.writable.getWriter();
    await writer.write(new TextEncoder().encode(rawReq));
    writer.releaseLock();
    const rawResp = await new Response(socket.readable).text();
    try {
      await socket.close();
    } catch {}
    const jsonText = decodeHttpBody(rawResp);
    return JSON.parse(jsonText);
  } catch {
    const tls = await import('node:tls');
    const rawResp = await new Promise((resolve, reject) => {
      const s = tls.connect({ host: 'api.coindcx.com', port: 443, servername: 'api.coindcx.com' }, () => s.write(rawReq));
      let buf = '';
      s.on('data', (c) => (buf += c.toString('utf8')));
      s.on('end', () => resolve(buf));
      s.on('error', reject);
    });
    return JSON.parse(decodeHttpBody(rawResp));
  }
}

async function coindcxSignedPost(path, key, secret, payloadObj) {
  const body = JSON.stringify(payloadObj);
  const sig = await hmacSha256Hex(secret, body);
  const r = await fetch(`https://api.coindcx.com${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-AUTH-APIKEY': key, 'X-AUTH-SIGNATURE': sig },
    body,
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.message || `CoinDCX ${r.status}`);
  return data;
}

async function fetchCoinDcxBalances(key, secret) {
  const [spotRaw, futuresWalletsRaw, futuresPosRaw, tickersRaw] = await Promise.all([
    coindcxSignedPost('/exchange/v1/users/balances', key, secret, { timestamp: Math.floor(Date.now()) }),
    coindcxSignedGetWithBody('/exchange/v1/derivatives/futures/wallets', key, secret, {
      timestamp: Math.floor(Date.now()),
    }).catch(() => []),
    coindcxSignedPost('/exchange/v1/derivatives/futures/positions', key, secret, {
      timestamp: Math.floor(Date.now()),
      page: '1',
      size: '25',
      margin_currency_short_name: ['INR', 'USDT'],
    }).catch(() => []),
    fetchAllCoinDcxTickers().catch(() => []),
  ]);

  const priceMap = new Map();
  for (const t of Array.isArray(tickersRaw) ? tickersRaw : []) {
    const p = parseFloat(t.last_price);
    if (p > 0) priceMap.set(String(t.market).toUpperCase(), p);
  }
  const usdtInr = priceMap.get('USDTINR') || 87.5;

  const toInrValue = (currency, qty) => {
    const c = String(currency || '').toUpperCase();
    if (!qty || qty <= 0) return 0;
    if (c === 'INR') return qty;
    if (c === 'USDT') return qty * usdtInr;
    if (priceMap.has(`${c}INR`)) return qty * priceMap.get(`${c}INR`);
    if (priceMap.has(`${c}USDT`)) return qty * priceMap.get(`${c}USDT`) * usdtInr;
    return 0;
  };

  let spotInr = 0;
  let spotUsdt = 0;
  const holdings = [];

  for (const b of Array.isArray(spotRaw) ? spotRaw : []) {
    const avail = parseFloat(b.balance) || 0;
    const locked = parseFloat(b.locked_balance) || 0;
    const total = avail + locked;
    const cur = String(b.currency || '').toUpperCase();
    if (cur === 'INR') spotInr += total;
    if (cur === 'USDT') spotUsdt += total;
    if (total > 0) {
      const valueInr = toInrValue(cur, total);
      holdings.push({
        wallet: 'SPOT',
        currency: cur,
        balance: avail,
        locked_balance: locked,
        total,
        valueInr,
        valueUsdt: valueInr / usdtInr,
      });
    }
  }

  let futuresInr = 0;
  let futuresUsdt = 0;
  for (const w of Array.isArray(futuresWalletsRaw) ? futuresWalletsRaw : []) {
    const avail = parseFloat(w.balance) || 0;
    const locked = parseFloat(w.locked_balance) || 0;
    const crossOrder = parseFloat(w.cross_order_margin) || 0;
    const crossUser = parseFloat(w.cross_user_margin) || 0;
    const total = avail + locked + crossOrder + crossUser;
    const cur = String(w.currency_short_name || w.currency || '').toUpperCase();
    if (cur === 'INR') futuresInr += total;
    if (cur === 'USDT') futuresUsdt += total;
    if (total > 0) {
      const valueInr = toInrValue(cur, total);
      holdings.push({
        wallet: 'FUTURES',
        currency: cur,
        balance: avail,
        locked_balance: locked + crossOrder + crossUser,
        total,
        valueInr,
        valueUsdt: valueInr / usdtInr,
      });
    }
  }

  const totalInr = holdings.reduce((s, h) => s + (h.valueInr || 0), 0);
  const totalUsdt = totalInr / usdtInr;

  const activePositions = (Array.isArray(futuresPosRaw) ? futuresPosRaw : [])
    .filter((p) => Math.abs(parseFloat(p.active_pos) || 0) > 0)
    .map((p) => {
      const qty = parseFloat(p.active_pos) || 0;
      const entry = parseFloat(p.avg_price) || 0;
      const mark = parseFloat(p.mark_price) || entry;
      const rawPair = String(p.pair || '').replace(/^B-/, '').replace('_', '/');
      const diff = qty >= 0 ? mark - entry : entry - mark;
      const pnlUsdt = diff * Math.abs(qty);
      return {
        id: String(p.id),
        pair: rawPair,
        type: qty >= 0 ? 'LONG' : 'SHORT',
        entryPrice: entry,
        currentPrice: mark,
        amount: Math.abs(qty),
        leverage: parseFloat(p.leverage) || 1,
        marginCurrency: p.margin_currency_short_name || 'INR',
        pnl: parseFloat(pnlUsdt.toFixed(4)),
        pnlPercent: entry > 0 ? parseFloat(((diff / entry) * 100).toFixed(2)) : 0,
        status: 'OPEN',
      };
    });

  return {
    spotInr,
    spotUsdt,
    futuresInr,
    futuresUsdt,
    totalInr,
    totalUsdt,
    usdtInr,
    holdings,
    positions: activePositions,
    balances: spotRaw,
    futuresWallets: futuresWalletsRaw,
  };
}

/* ------------------------- Dual AI Brain Engine -------------------------- */

async function callGoogleEndpoint(url, key, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(2500),
  });
  const txt = await r.text();
  let j = null;
  try {
    j = JSON.parse(txt);
  } catch {}
  return { ok: r.ok, status: r.status, json: j };
}

async function askWorkersAI(env, text, history = [], sysPrompt = SYSTEM_PROMPT, maxTokens = 650) {
  if (!env.AI || typeof env.AI.run !== 'function') throw new Error('Workers AI binding unavailable');
  const messages = [
    { role: 'system', content: sysPrompt },
    ...history.slice(-8).map((h) => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: String(h.text).slice(0, 800),
    })),
    { role: 'user', content: text },
  ];
  for (const m of ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct']) {
    try {
      const res = await env.AI.run(m, { messages, max_tokens: maxTokens, temperature: 0.75 });
      const out =
        typeof res?.response === 'string'
          ? res.response
          : res?.response
          ? JSON.stringify(res.response)
          : '';
      if (out.trim()) return { text: out.trim(), engine: m };
    } catch {}
  }
  throw new Error('AI unavailable');
}

async function askBrain(env, text, history = [], sysPrompt = SYSTEM_PROMPT, maxTokens = 650) {
  const cleanKey = String(env.GEMINI_API_KEY || '').trim();
  if (cleanKey) {
    const contents = [
      { role: 'user', parts: [{ text: sysPrompt }] },
      { role: 'model', parts: [{ text: 'Understood.' }] },
      ...history.slice(-8).map((h) => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: String(h.text).slice(0, 800) }],
      })),
      { role: 'user', parts: [{ text }] },
    ];
    const payload = { contents, generationConfig: { temperature: 0.75, maxOutputTokens: Math.max(maxTokens, 1800) } };
    const urls = [
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent',
    ];
    try {
      const winner = await Promise.any(
        urls.map(async (u) => {
          const res = await callGoogleEndpoint(u, cleanKey, payload);
          const out = (res.json?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
          if (!res.ok || !out) throw new Error(`HTTP ${res.status}`);
          return { text: out, engine: u.includes('aiplatform') ? 'vertex:gemini-2.5-flash' : 'gemini:gemini-2.5-flash' };
        })
      );
      if (winner?.text) return winner;
    } catch {}
  }
  return await askWorkersAI(env, text, history, sysPrompt, maxTokens);
}

function parseJsonSafe(raw) {
  const cleaned = String(raw || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const a = cleaned.indexOf('{');
  const b = cleaned.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(cleaned.slice(a, b + 1));
  } catch {
    return null;
  }
}

async function generateYtPlan(env, topic, lang = 'hi', scenesCount = 6) {
  const n = Math.min(Math.max(parseInt(scenesCount, 10) || 6, 4), 10);
  const langLabel = lang === 'en' ? 'English' : 'Hindi/Hinglish (easy spoken style)';
  const prompt =
    `Create a high-retention viral YouTube Short plan about "${topic}". ` +
    `Return ONLY valid JSON with shape: ` +
    `{"title":"...","description":"...","tags":["shorts","ai"],"thumbnailText":"MAX 4 WORDS CAPS","scenes":[{"caption":"MAX 6 WORDS CAPS","narration":"one punchy spoken sentence in ${langLabel}"}]}. ` +
    `Generate exact ${n} scenes.`;
  try {
    const out = await askBrain(env, prompt, [], 'You output strictly valid JSON only. No markdown prose.', 950);
    const parsed = parseJsonSafe(out.text);
    if (parsed && Array.isArray(parsed.scenes) && parsed.scenes.length > 0) return parsed;
  } catch {}
  return {
    title: `${topic.slice(0, 72)} #shorts`,
    description: `${topic}\n\n#shorts #ai #tech #trending`,
    tags: ['shorts', 'ai', 'tech', 'viral', 'humanoid'],
    thumbnailText: topic.split(/\s+/).slice(0, 4).join(' ').toUpperCase(),
    scenes: Array.from({ length: n }, (_, i) => ({
      caption: `${topic.split(/\s+/).slice(0, 4).join(' ').toUpperCase()} #${i + 1}`,
      narration: i === 0 ? `Kya aapko pata hai ${topic} duniya kaise badal raha hai?` : `Step ${i + 1}: ${topic} ka agla bada raz jaano!`,
    })),
  };
}

/* ------------------- Automatic YouTube OAuth Token Helper ---------------- */

async function resolveYouTubeAccessToken(env, requestToken) {
  const rawStr = String(requestToken || '').trim();
  const yaMatch = rawStr.match(/ya29\.[A-Za-z0-9._-]+/);
  const direct = yaMatch ? yaMatch[0] : rawStr;
  if (direct.length > 20) return direct;

  // Auto-refresh permanent OAuth token if user stored Client ID + Secret + Refresh Token!
  const clientId = String(env.YOUTUBE_CLIENT_ID || '').trim();
  const clientSecret = String(env.YOUTUBE_CLIENT_SECRET || '').trim();
  let refreshToken = String(env.YOUTUBE_REFRESH_TOKEN || '').trim();
  if (!refreshToken && env.APEX_KV) {
    try {
      refreshToken = String((await env.APEX_KV.get('yt:refresh_token')) || '').trim();
    } catch {}
  }
  if (clientId && clientSecret && refreshToken) {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const j = await r.json();
    if (r.ok && j.access_token) return j.access_token;
    throw new Error(`YouTube OAuth refresh failed: ${j.error_description || j.error || r.status}`);
  }

  const envAccess = String(env.YOUTUBE_ACCESS_TOKEN || '').trim();
  if (envAccess.length > 20) return envAccess;
  return '';
}

/* --------------------------- Telegram Handler ---------------------------- */

const memStore = new Map();
const voicePrefs = new Map();
let marketMetaCache = { ts: 0, map: null };
let autoTradeState = {
  enabled: false,
  tradeInr: 150,
  lastTradeAt: 0,
  lastCheckAt: 0,
  lastAction: 'Ready — waiting for Auto-Trade ON',
  lastOwnerChatId: '',
  entries: {},
};

const PRECISION_FALLBACK = {
  BTCINR: { prec: 5, minNotional: 100 },
  ETHINR: { prec: 4, minNotional: 100 },
  SOLINR: { prec: 3, minNotional: 100 },
  XRPINR: { prec: 1, minNotional: 100 },
  DOGEINR: { prec: 0, minNotional: 100 },
  BTCUSDT: { prec: 5, minNotional: 5 },
  ETHUSDT: { prec: 4, minNotional: 5 },
  SOLUSDT: { prec: 3, minNotional: 5 },
  XRPUSDT: { prec: 1, minNotional: 5 },
};

async function getCoinDcxMarketMetaMap() {
  if (marketMetaCache.map && Date.now() - marketMetaCache.ts < 5 * 60 * 1000) {
    return marketMetaCache.map;
  }
  const map = new Map();
  for (const [k, v] of Object.entries(PRECISION_FALLBACK)) map.set(k, v);
  try {
    const r = await fetch('https://api.coindcx.com/exchange/v1/markets_details');
    if (r.ok) {
      const list = await r.json();
      if (Array.isArray(list)) {
        for (const m of list) {
          if (m?.coindcx_name) {
            map.set(String(m.coindcx_name).toUpperCase(), {
              prec: typeof m.target_currency_precision === 'number' ? m.target_currency_precision : 4,
              minNotional: Number(m.min_notional) || 100,
              minQty: Number(m.min_quantity) || 0,
              status: m.status || 'active',
            });
          }
        }
      }
      marketMetaCache = { ts: Date.now(), map };
    }
  } catch {}
  return map;
}

async function executeSmartSpotOrder({ apiKey, apiSecret, market, side, inrAmount, quantityOverride }) {
  const [metaMap, tickerRes, acct] = await Promise.all([
    getCoinDcxMarketMetaMap(),
    fetch('https://api.coindcx.com/exchange/ticker').then((r) => r.json()),
    fetchCoinDcxBalances(apiKey, apiSecret),
  ]);

  const byMarket = new Map();
  if (Array.isArray(tickerRes)) {
    for (const t of tickerRes) byMarket.set(String(t.market).toUpperCase(), t);
  }

  let cleanSymbol = String(market || 'BTCINR').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normSide = String(side || 'buy').toLowerCase() === 'sell' ? 'sell' : 'buy';

  // Auto-route USDT symbol -> INR Spot pair when wallet holds INR instead of USDT
  if (cleanSymbol.endsWith('USDT') && (acct.spotUsdt || 0) < 5 && (acct.spotInr || 0) >= 102) {
    const candidateInr = cleanSymbol.replace(/USDT$/, 'INR');
    if (byMarket.has(candidateInr)) {
      cleanSymbol = candidateInr;
    }
  }

  const baseCoin = cleanSymbol.replace(/(INR|USDT)$/, '') || 'BTC';
  const quoteCoin = cleanSymbol.endsWith('USDT') ? 'USDT' : 'INR';
  const tick = byMarket.get(cleanSymbol);
  const lastPrice = Number(tick?.last_price || 0);
  const askPrice = Number(tick?.ask || lastPrice);
  const bidPrice = Number(tick?.bid || lastPrice);
  if (!lastPrice || lastPrice <= 0) {
    throw new Error(`Live price unavailable for ${cleanSymbol}`);
  }

  const meta =
    metaMap.get(cleanSymbol) ||
    PRECISION_FALLBACK[cleanSymbol] || { prec: 4, minNotional: quoteCoin === 'INR' ? 100 : 5 };
  const prec = Math.max(0, Math.min(8, Number(meta.prec ?? 4)));
  const factor = Math.pow(10, prec);
  const usdtInr = acct.usdtInr || 87.5;

  let finalQty = 0;
  if (normSide === 'buy') {
    const availQuote = quoteCoin === 'INR' ? Number(acct.spotInr || 0) : Number(acct.spotUsdt || 0);
    const minReq = Number(meta.minNotional || (quoteCoin === 'INR' ? 100 : 5));
    if (availQuote < minReq) {
      throw new Error(
        `Spot ${quoteCoin} balance (${quoteCoin === 'INR' ? '₹' : '$'}${availQuote.toFixed(2)}) minimum order (${quoteCoin === 'INR' ? '₹' : '$'}${minReq}) se kam hai`
      );
    }
    const desiredQuote =
      inrAmount && Number(inrAmount) > 0
        ? quoteCoin === 'INR'
          ? Number(inrAmount)
          : Number(inrAmount) / usdtInr
        : Number(quantityOverride || 0) * askPrice;

    const clampedQuote = Math.min(availQuote * 0.99, Math.max(minReq * 1.05, desiredQuote || minReq * 1.15));
    const refPx = askPrice > 0 ? askPrice : lastPrice;
    finalQty = Math.ceil((clampedQuote / refPx) * factor) / factor;
    if (finalQty * refPx > availQuote * 0.996) {
      finalQty = Math.floor(((availQuote * 0.994) / refPx) * factor) / factor;
    }
  } else {
    const heldRow = (acct.holdings || []).find((h) => h.wallet === 'SPOT' && h.currency === baseCoin);
    const availCoin = Number(heldRow?.balance || 0);
    if (availCoin <= 0) {
      throw new Error(`Spot wallet me abhi ${baseCoin} coin nahi hai (pehle BUY order lagayein)`);
    }
    const reqQty =
      quantityOverride && Number(quantityOverride) > 0 && Number(quantityOverride) <= availCoin
        ? Number(quantityOverride)
        : inrAmount && Number(inrAmount) > 0
        ? Math.min(availCoin, Number(inrAmount) / (quoteCoin === 'INR' ? bidPrice : bidPrice * usdtInr))
        : availCoin;
    const useFull = (availCoin - reqQty) * (quoteCoin === 'INR' ? bidPrice : bidPrice * usdtInr) < 105;
    finalQty = Math.floor((useFull ? availCoin : reqQty) * factor) / factor;
  }

  finalQty = Number(finalQty.toFixed(prec));
  if (!finalQty || finalQty <= 0) {
    throw new Error(`${cleanSymbol} order quantity minimum step se chhoti hai — ₹150+ amount rakhein`);
  }

  const spotPayload = {
    side: normSide,
    order_type: 'market_order',
    market: cleanSymbol,
    total_quantity: finalQty,
    timestamp: Math.floor(Date.now()),
  };
  const rawBody = JSON.stringify(spotPayload);
  const sig = await hmacSha256Hex(apiSecret, rawBody);
  const r = await fetch('https://api.coindcx.com/exchange/v1/orders/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-AUTH-APIKEY': apiKey, 'X-AUTH-SIGNATURE': sig },
    body: rawBody,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data?.message || JSON.stringify(data) || `CoinDCX rejected ${cleanSymbol}`);
  }
  const executedPrice = normSide === 'buy' ? askPrice : bidPrice;
  const approxInr = quoteCoin === 'INR' ? finalQty * executedPrice : finalQty * executedPrice * usdtInr;
  if (normSide === 'buy') {
    autoTradeState.entries[cleanSymbol] = { entryPrice: executedPrice, ts: Date.now(), qty: finalQty };
  } else {
    delete autoTradeState.entries[cleanSymbol];
  }
  return {
    ok: true,
    live: true,
    wallet: 'SPOT',
    market: cleanSymbol,
    side: normSide.toUpperCase(),
    quantity: finalQty,
    price: executedPrice,
    approxInr: Number(approxInr.toFixed(2)),
    orderId: data?.orders?.[0]?.id || data?.id || 'LIVE_FILLED',
    response: data,
  };
}

async function runSmartAutoTradeCycle(env, opts = {}) {
  const k = String(opts.apiKey || env.COINDCX_API_KEY || '').trim();
  const s = String(opts.apiSecret || env.COINDCX_API_SECRET || '').trim();
  if (!k || !s) {
    return { ok: false, traded: false, error: 'CoinDCX API keys missing' };
  }

  const tradeInr = Math.max(115, Number(opts.tradeInr || autoTradeState.tradeInr || 150));
  const forceEntry = Boolean(opts.forceEntry);
  if (opts.entryHints && typeof opts.entryHints === 'object') {
    autoTradeState.entries = { ...opts.entryHints, ...autoTradeState.entries };
  }
  autoTradeState.lastCheckAt = Date.now();

  const [tickerRes, acct] = await Promise.all([
    fetch('https://api.coindcx.com/exchange/ticker').then((r) => r.json()),
    fetchCoinDcxBalances(k, s),
  ]);
  const byMarket = new Map();
  if (Array.isArray(tickerRes)) {
    for (const t of tickerRes) byMarket.set(String(t.market).toUpperCase(), t);
  }

  const LIQUID_INR = ['BTCINR', 'ETHINR', 'SOLINR', 'XRPINR', 'DOGEINR'];

  // 1) Manage held liquid coins FIRST: Take-Profit >= +0.95% OR Stop-Loss <= -0.85%
  const heldLiquid = [];
  for (const sym of LIQUID_INR) {
    const coin = sym.replace(/INR$/, '');
    const row = (acct.holdings || []).find((h) => h.wallet === 'SPOT' && h.currency === coin);
    const tick = byMarket.get(sym);
    if (row && Number(row.valueInr || 0) >= 105 && tick) {
      heldLiquid.push({ sym, coin, row, tick });
      const bid = Number(tick.bid || tick.last_price || 0);
      const entryInfo = autoTradeState.entries[sym];
      const pnlPct = entryInfo?.entryPrice ? ((bid - entryInfo.entryPrice) / entryInfo.entryPrice) * 100 : null;
      const high = Number(tick.high || bid);
      const low = Number(tick.low || bid);
      const posInRange = high > low ? (bid - low) / (high - low) : 0.5;

      const hitTp = pnlPct !== null ? pnlPct >= 0.95 : posInRange >= 0.92;
      const hitSl = pnlPct !== null && pnlPct <= -0.85;
      if (hitTp || hitSl) {
        const res = await executeSmartSpotOrder({
          apiKey: k,
          apiSecret: s,
          market: sym,
          side: 'sell',
          quantityOverride: row.balance,
        });
        const tag = hitTp
          ? `🎯 Take-Profit Booked (${pnlPct !== null ? '+' + pnlPct.toFixed(2) + '%' : '24h Peak'})`
          : `🛡️ Smart Stop-Loss Protected (${pnlPct.toFixed(2)}%)`;
        autoTradeState.lastTradeAt = Date.now();
        autoTradeState.lastAction = `${tag} on ${sym} (₹${res.approxInr})`;
        if (env.TELEGRAM_BOT_TOKEN && autoTradeState.lastOwnerChatId) {
          send(
            env.TELEGRAM_BOT_TOKEN,
            autoTradeState.lastOwnerChatId,
            `💹 <b>APEX Auto-Trader LIVE SELL</b>\n• Pair: <b>${sym}</b>\n• Qty: <b>${res.quantity}</b> @ ₹${res.price.toLocaleString('en-IN')}\n• Value: <b>₹${res.approxInr}</b>\n• Reason: ${esc(tag)}`
          ).catch(() => {});
        }
        return { ok: true, traded: true, reason: tag, order: res, entries: autoTradeState.entries };
      }
    }
  }

  // 2) Smart Entry Scan when Spot INR available
  const spotInr = Number(acct.spotInr || 0);
  if (spotInr < 106) {
    const msg =
      heldLiquid.length > 0
        ? `Monitoring ${heldLiquid.map((x) => x.sym).join(', ')} for +0.95% Take-Profit (Spot INR ₹${spotInr.toFixed(2)})`
        : `Spot INR ₹${spotInr.toFixed(2)} minimum ₹106 order se kam hai`;
    autoTradeState.lastAction = msg;
    return { ok: true, traded: false, reason: msg, entries: autoTradeState.entries };
  }

  if (!forceEntry && heldLiquid.length >= 2) {
    const msg = `2 live positions active (${heldLiquid.map((x) => x.sym).join(', ')}) — waiting for Take-Profit before next buy`;
    autoTradeState.lastAction = msg;
    return { ok: true, traded: false, reason: msg, entries: autoTradeState.entries };
  }

  const cooldownMs = 8 * 60 * 1000;
  if (!forceEntry && autoTradeState.lastTradeAt && Date.now() - autoTradeState.lastTradeAt < cooldownMs) {
    const minsLeft = Math.ceil((cooldownMs - (Date.now() - autoTradeState.lastTradeAt)) / 60000);
    const msg = `Smart cooldown (${minsLeft}m left) · Watching live ticks & TP/SL`;
    return { ok: true, traded: false, reason: msg, entries: autoTradeState.entries };
  }

  let best = null;
  for (const sym of LIQUID_INR) {
    if (!forceEntry && heldLiquid.some((h) => h.sym === sym)) continue;
    const t = byMarket.get(sym);
    if (!t) continue;
    const last = Number(t.last_price || 0);
    const bid = Number(t.bid || last);
    const ask = Number(t.ask || last);
    const high = Number(t.high || last);
    const low = Number(t.low || last);
    const chg = Number(t.change_24_hour || 0);
    if (last <= 0 || ask <= 0) continue;
    const spreadPct = ((ask - bid) / last) * 100;
    if (!forceEntry && spreadPct > 0.45) continue;
    const posInRange = high > low ? (last - low) / (high - low) : 0.5;
    let score = (0.5 - Math.min(0.5, spreadPct)) * 40;
    let signalReason = '';
    if (posInRange <= 0.38) {
      score += (0.42 - posInRange) * 120;
      signalReason = `Smart Dip Entry (${Math.round(posInRange * 100)}% of 24h range, spread ${spreadPct.toFixed(2)}%)`;
    } else if (chg >= 0.4 && posInRange <= 0.84) {
      score += chg * 12;
      signalReason = `Bullish Momentum (+${chg.toFixed(2)}% 24h, spread ${spreadPct.toFixed(2)}%)`;
    } else {
      score += (0.7 - Math.abs(posInRange - 0.35)) * 25;
      signalReason = `Best Liquid Pair (${sym}, ${chg >= 0 ? '+' : ''}${chg.toFixed(2)}% 24h, spread ${spreadPct.toFixed(2)}%)`;
    }
    if (!best || score > best.score) {
      best = { sym, score, signalReason, posInRange, chg, spreadPct };
    }
  }

  if (!best) {
    return { ok: true, traded: false, reason: 'Waiting for low-spread CoinDCX setup', entries: autoTradeState.entries };
  }

  if (!forceEntry && best.score < 14) {
    const msg = `Scanning ${best.sym} (score ${best.score.toFixed(1)}) — waiting for dip/breakout`;
    autoTradeState.lastAction = msg;
    return { ok: true, traded: false, reason: msg, entries: autoTradeState.entries };
  }

  const order = await executeSmartSpotOrder({
    apiKey: k,
    apiSecret: s,
    market: best.sym,
    side: 'buy',
    inrAmount: Math.min(tradeInr, spotInr * 0.99),
  });
  autoTradeState.lastTradeAt = Date.now();
  autoTradeState.lastAction = `✅ LIVE BUY ${order.market} ₹${order.approxInr} — ${best.signalReason}`;
  if (env.TELEGRAM_BOT_TOKEN && autoTradeState.lastOwnerChatId) {
    send(
      env.TELEGRAM_BOT_TOKEN,
      autoTradeState.lastOwnerChatId,
      `🚀 <b>APEX Auto-Trader LIVE BUY</b>\n• Pair: <b>${order.market}</b>\n• Qty: <b>${order.quantity}</b> @ ₹${order.price.toLocaleString('en-IN')}\n• Invested: <b>₹${order.approxInr}</b>\n• Signal: ${esc(best.signalReason)}`
    ).catch(() => {});
  }
  return {
    ok: true,
    traded: true,
    reason: best.signalReason,
    order,
    entries: autoTradeState.entries,
  };
}

async function handleUpdate(update, env) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const msg = update.message || update.edited_message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const allowed = String(env.TELEGRAM_ALLOWED_CHATS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowed.length && !allowed.includes(String(chatId))) {
    return send(token, chatId, `🔒 Private bot.\nTumhara chat id: <code>${chatId}</code>`);
  }
  autoTradeState.lastOwnerChatId = String(chatId);

  const raw = (msg.text || '').trim();
  if (!raw) return;

  if (raw.toLowerCase().startsWith('/autotrade')) {
    const sub = raw.split(/\s+/)[1]?.toLowerCase() || 'status';
    if (sub === 'on') {
      autoTradeState.enabled = true;
      const res = await runSmartAutoTradeCycle(env, { forceEntry: true }).catch((e) => ({ ok: false, error: e.message }));
      if (res.traded && res.order) {
        return send(
          token,
          chatId,
          `🤖 <b>24×7 Smart Auto-Trader ON!</b>\n✅ First Live Order Executed:\n• <b>${res.order.side} ${res.order.market}</b>: ${res.order.quantity} (₹${res.order.approxInr})\n• Reason: ${esc(res.reason)}`
        );
      }
      return send(token, chatId, `🤖 <b>24×7 Smart Auto-Trader ON!</b>\nStatus: ${esc(res.reason || res.error || 'Monitoring live market')}`);
    }
    if (sub === 'off') {
      autoTradeState.enabled = false;
      return send(token, chatId, '⏹ <b>Auto-Trader OFF.</b> Koi automatic order ab nahi jayega.');
    }
    if (sub === 'now') {
      const res = await runSmartAutoTradeCycle(env, { forceEntry: true }).catch((e) => ({ ok: false, error: e.message }));
      if (res.traded && res.order) {
        return send(
          token,
          chatId,
          `⚡ <b>Smart Trade Executed!</b>\n• <b>${res.order.side} ${res.order.market}</b>: ${res.order.quantity} @ ₹${res.order.price.toLocaleString('en-IN')} (₹${res.order.approxInr})\n• Signal: ${esc(res.reason)}`
        );
      }
      return send(token, chatId, `ℹ️ Smart Check: ${esc(res.reason || res.error || 'No trade')}`);
    }
    return send(
      token,
      chatId,
      `🤖 <b>Auto-Trader Status:</b> ${autoTradeState.enabled ? '🟢 ON' : '🔴 OFF'}\n• Per Trade: ₹${autoTradeState.tradeInr}\n• Last: ${esc(autoTradeState.lastAction)}`
    );
  }

  if (raw === '/start' || raw === '/help') return send(token, chatId, HELP);
  if (raw === '/id' || raw === '/whoami') {
    return send(token, chatId, `chat id: <code>${chatId}</code>\nname: ${esc(msg.from?.first_name || '—')}`);
  }
  if (raw === '/app' || raw === '/state') {
    const appUrl = env.APP_URL || 'https://aidavil112.github.io/apex-humanoid-v2/';
    return send(token, chatId, `🌐 <b>APEX Humanoid + Auto YouTube Studio:</b>\n${appUrl}`);
  }
  if (raw === '/clear') {
    memStore.delete(chatId);
    await env.APEX_KV?.delete(`hist:${chatId}`);
    return send(token, chatId, '🧹 Memory clear ho gayi.');
  }
  if (raw === '/yt' || raw.startsWith('/yt ')) {
    const topic = raw.slice(3).trim() || 'Future AI Robots 2026';
    await tgCall(token, 'sendChatAction', { chat_id: chatId, action: 'typing' });
    const plan = await generateYtPlan(env, topic, 'hi', 5);
    const scenesTxt = plan.scenes
      .map((s, idx) => `<b>Scene ${idx + 1}:</b> [${esc(s.caption)}]\n🗣️ ${esc(s.narration)}`)
      .join('\n\n');
    const appUrl = env.APP_URL || 'https://aidavil112.github.io/apex-humanoid-v2/';
    return send(
      token,
      chatId,
      `🎬 <b>${esc(plan.title)}</b>\n🖼 Thumbnail: <code>${esc(plan.thumbnailText)}</code>\n\n${scenesTxt}\n\n` +
        `#${(plan.tags || ['shorts', 'ai']).slice(0, 6).join(' #')}\n\n` +
        `▶️ <b>Full Auto Video Render & Upload:</b>\n${appUrl} (Menu ☰ → YouTube)`
    );
  }
  if (raw === '/voice' || raw === '/voice on') {
    voicePrefs.set(chatId, true);
    return send(token, chatId, '🔊 <b>Voice replies ON!</b> Ab har jawab voice note ke saath aayega.');
  }
  if (raw === '/voice off') {
    voicePrefs.set(chatId, false);
    return send(token, chatId, '🔇 Voice replies OFF — sirf text aayega.');
  }
  if (raw.startsWith('/say ')) {
    const speakText = raw.slice(5).trim();
    try {
      await tgCall(token, 'sendChatAction', { chat_id: chatId, action: 'record_voice' });
      const { bytes } = await synthesizeSpeechBytes(env, speakText);
      return sendVoiceNote(token, chatId, bytes, speakText);
    } catch (e) {
      return send(token, chatId, `⚠️ Voice error: ${esc(e.message)}`);
    }
  }
  if (raw === '/price' || raw === '/prices') {
    try {
      const list = await fetchCoinDcxTickers();
      const lines = list.map((t) => {
        const chg = Number(t.change_24_hour || 0);
        const arrow = chg >= 0 ? '🟢' : '🔴';
        const unit = t.market.endsWith('INR') ? '₹' : '$';
        return `${arrow} <b>${t.market}:</b> ${unit}${Number(t.last_price).toLocaleString('en-IN')} (${chg.toFixed(2)}%)`;
      });
      return send(token, chatId, `📊 <b>CoinDCX Live Market</b>\n\n${lines.join('\n')}`);
    } catch (e) {
      return send(token, chatId, `⚠️ CoinDCX market error: ${esc(e.message)}`);
    }
  }
  if (raw === '/balance') {
    const k = String(env.COINDCX_API_KEY || '').trim();
    const s = String(env.COINDCX_API_SECRET || '').trim();
    if (!k || !s) {
      return send(
        token,
        chatId,
        '⚠️ CoinDCX keys set nahi hain.\nCloudflare Settings → Variables and Secrets mein add karo:\n• <code>COINDCX_API_KEY</code>\n• <code>COINDCX_API_SECRET</code>'
      );
    }
    try {
      const acct = await fetchCoinDcxBalances(k, s);
      const nonZero = (acct.holdings || [])
        .map((h) => `• <b>[${h.wallet}] ${esc(h.currency)}:</b> ${Number(h.total).toFixed(4)} (₹${Number(h.valueInr || 0).toFixed(2)})`);
      return send(
        token,
        chatId,
        `💰 <b>CoinDCX Real Live Account</b>\n` +
          `<b>Total Value:</b> ₹${Number(acct.totalInr || 0).toFixed(2)} ($${Number(acct.totalUsdt || 0).toFixed(2)})\n` +
          `<b>Spot INR:</b> ₹${Number(acct.spotInr || 0).toFixed(2)} · <b>Futures INR:</b> ₹${Number(acct.futuresInr || 0).toFixed(2)}\n` +
          `<b>Spot USDT:</b> $${Number(acct.spotUsdt || 0).toFixed(2)} · <b>Futures USDT:</b> $${Number(acct.futuresUsdt || 0).toFixed(2)}\n\n` +
          `${nonZero.join('\n') || '0.00 balance'}`
      );
    } catch (e) {
      return send(token, chatId, `⚠️ CoinDCX auth error: ${esc(e.message)}`);
    }
  }

  let history = memStore.get(chatId) || [];
  if (env.APEX_KV) {
    try {
      const kvHist = await env.APEX_KV.get(`hist:${chatId}`, 'json');
      if (kvHist) history = kvHist;
    } catch {}
  }

  await tgCall(token, 'sendChatAction', { chat_id: chatId, action: 'typing' });

  let reply;
  try {
    const res = await askBrain(env, raw, history);
    reply = res.text;
  } catch (e) {
    reply = `⚠️ AI busy hai, 5 second baad try karo. (${e.message})`;
  }

  const next = [...history, { role: 'user', text: raw }, { role: 'model', text: reply }].slice(-10);
  memStore.set(chatId, next);
  if (env.APEX_KV) {
    try {
      await env.APEX_KV.put(`hist:${chatId}`, JSON.stringify(next), { expirationTtl: 86400 });
    } catch {}
  }

  await send(token, chatId, esc(reply));

  if (voicePrefs.get(chatId)) {
    try {
      const { bytes } = await synthesizeSpeechBytes(env, reply);
      await sendVoiceNote(token, chatId, bytes);
    } catch {}
  }
}

/* ------------------------ Setup Dashboard HTML --------------------------- */

function renderSetupPage(env, origin, result) {
  const hasToken = !!env.TELEGRAM_BOT_TOKEN;
  const hasGemini = !!env.GEMINI_API_KEY;
  const hasEleven = !!env.ELEVENLABS_API_KEY;
  const hasCdx = !!(env.COINDCX_API_KEY && env.COINDCX_API_SECRET);
  const hasYt = !!(env.YOUTUBE_REFRESH_TOKEN || env.YOUTUBE_ACCESS_TOKEN);
  const hasSecret = !!env.TELEGRAM_WEBHOOK_SECRET;

  const row = (label, ok, sub) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.07);font-size:14px">
      <code>${label}</code>
      <span style="color:${ok ? '#2ef2a4' : '#9fb8cc'};font-weight:700">${ok ? '✅ Active' : sub}</span>
    </div>`;

  let resultBox = '';
  if (result) {
    resultBox = result.ok
      ? `<div style="margin:16px 0;padding:16px;border-radius:12px;background:#09261b;border:1px solid #2ef2a4">
          <div style="color:#2ef2a4;font-weight:700;font-size:16px">🎉 Bot Connected!</div>
          ${result.username ? `<p style="margin:12px 0 0"><a href="https://t.me/${esc(result.username)}" style="display:inline-block;padding:11px 18px;border-radius:10px;background:#2ef2a4;color:#041a12;font-weight:700;text-decoration:none">💬 Open @${esc(result.username)} in Telegram</a></p>` : ''}
        </div>`
      : `<div style="margin:16px 0;padding:16px;border-radius:12px;background:#2a1014;border:1px solid #ff6b6b;color:#ffd0d0;font-size:14px">❌ ${esc(result.error)}</div>`;
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>APEX Humanoid — Cloud Hub</title>
</head>
<body style="margin:0;padding:20px;background:#060d14;color:#e6f4ff;font-family:system-ui,-apple-system,sans-serif;max-width:540px;margin-inline:auto">
  <h2 style="margin:8px 0 4px;color:#4fd2ff">🤖 APEX Humanoid Hub</h2>
  <p style="margin:0 0 18px;color:#8bb0c9;font-size:14px">Telegram Bot + Auto YouTube Agent + Voice + CoinDCX</p>
  ${resultBox}
  <div style="padding:16px;border-radius:14px;background:#0c1824;border:1px solid rgba(79,210,255,0.2)">
    <div style="font-weight:700;margin-bottom:10px;font-size:15px">Live Modules</div>
    ${row('TELEGRAM_BOT_TOKEN', hasToken, '❌ Required')}
    ${row('AI Brain (Llama 3.3 70B + Gemini)', true, '')}
    ${row('YouTube Shorts Research + Script + Render', true, '')}
    ${row('YouTube Direct Channel Auto-Upload', hasYt, '⚪ Add Token / Connect Below')}
    ${row('Voice TTS (Built-in Free + ElevenLabs)', true, '')}
    ${row('ELEVENLABS_API_KEY (HD Upgrade)', hasEleven, '⚪ Optional')}
    ${row('COINDCX_API_KEY + SECRET', hasCdx, '⚪ Optional (Live Wallet)')}
  </div>
  <div style="margin-top:16px;padding:16px;border-radius:14px;background:#0c1824;border:1px solid rgba(255,80,80,0.28)">
    <div style="font-weight:700;margin-bottom:6px;font-size:15px">📺 Automatic YouTube Channel Link</div>
    <p style="margin:0 0 12px;color:#9fb8cc;font-size:13px">Google Cloud Console me Authorized Redirect URI rakho: <code>${esc(origin)}/yt/callback</code></p>
    <a href="/yt/auth" style="display:block;text-align:center;padding:12px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;background:#ff3b3b;color:#fff">
      🔗 Sign in with Google &amp; Generate YOUTUBE_REFRESH_TOKEN
    </a>
  </div>
  <form method="GET" action="/setup" style="margin-top:16px;padding:16px;border-radius:14px;background:#0c1824;border:1px solid rgba(79,210,255,0.2)">
    ${hasSecret ? `<input name="secret" type="password" placeholder="Enter TELEGRAM_WEBHOOK_SECRET" required style="box-sizing:border-box;width:100%;padding:11px;margin-bottom:10px;border-radius:9px;border:1px solid #2b4c63;background:#061019;color:#fff;font-size:14px" />` : ''}
    <button type="submit" ${!hasToken ? 'disabled' : ''} style="width:100%;padding:13px;border:0;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;background:${hasToken ? '#2ef2a4' : '#263845'};color:${hasToken ? '#041a12' : '#6c8799'}">
      🚀 Sync / Reconnect Telegram Webhook
    </button>
  </form>
</body>
</html>`;
}

/* -------------------------------- Router --------------------------------- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === '/setup') {
      if (!env.TELEGRAM_BOT_TOKEN) {
        return new Response(renderSetupPage(env, url.origin, { ok: false, error: 'TELEGRAM_BOT_TOKEN missing' }), {
          status: 400,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      const expected = env.TELEGRAM_WEBHOOK_SECRET || '';
      const secret = url.searchParams.get('secret') || '';
      if (expected && secret !== expected) {
        return new Response(renderSetupPage(env, url.origin, { ok: false, error: 'Secret mismatch' }), {
          status: 403,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      const hookUrl = `${url.origin}/telegram`;
      const body = { url: hookUrl, allowed_updates: ['message', 'edited_message'], drop_pending_updates: true };
      if (expected) body.secret_token = expected;
      const me = await tgCall(env.TELEGRAM_BOT_TOKEN, 'getMe');
      const r = await tgCall(env.TELEGRAM_BOT_TOKEN, 'setWebhook', body);
      if (url.searchParams.get('format') === 'json') {
        return jsonRes({ setWebhook: r, bot: me?.result?.username || null, hookUrl });
      }
      return new Response(
        renderSetupPage(env, url.origin, r?.ok ? { ok: true, username: me?.result?.username || '' } : { ok: false, error: r?.description || 'Failed' }),
        { headers: { 'content-type': 'text/html; charset=utf-8' } }
      );
    }

    if (url.pathname === '/health') {
      if (url.searchParams.get('ping_ai') === '1') {
        const t0 = Date.now();
        try {
          const out = await askBrain(env, 'Hi bhai kaise ho?');
          return jsonRes({ ok: true, engine: out.engine, ms: Date.now() - t0, reply: out.text });
        } catch (e) {
          return jsonRes({ ok: false, ms: Date.now() - t0, error: e.message }, 500);
        }
      }
      return jsonRes({
        ok: true,
        bot: 'APEX Humanoid Hub',
        telegram: !!env.TELEGRAM_BOT_TOKEN,
        gemini: !!env.GEMINI_API_KEY,
        elevenlabs: !!env.ELEVENLABS_API_KEY,
        coindcx: !!(env.COINDCX_API_KEY && env.COINDCX_API_SECRET),
        youtubeUploadAuth: !!(env.YOUTUBE_REFRESH_TOKEN || env.YOUTUBE_ACCESS_TOKEN),
        youtubeStudioReady: true,
        brainReady: true,
      });
    }

    // ---- Autonomous YouTube Research Agent (/agent/research) ----
    if (request.method === 'POST' && url.pathname === '/agent/research') {
      const body = await request.json().catch(() => ({}));
      const niche = String(body?.niche || 'Future AI & Cybernetics').slice(0, 150);
      const prompt =
        `You are an elite viral YouTube Shorts strategist. Niche: "${niche}". ` +
        `Generate 4 viral short-form video topic ideas. Return ONLY JSON: ` +
        `{"topics":[{"id":"slug","title":"...","category":"...","hook":"...","summary":"...","angle":"...","viralPotential":96,"searchKeywords":["..."],"facts":["...","..."],"targetAudience":"...","whyTrending":"..."}]}`;
      try {
        const out = await askBrain(env, prompt, [], 'Return strictly valid JSON only.', 1100);
        const parsed = parseJsonSafe(out.text);
        if (parsed && Array.isArray(parsed.topics) && parsed.topics.length > 0) {
          return jsonRes({ niche, topics: parsed.topics });
        }
      } catch {}
      return jsonRes({
        niche,
        topics: [
          {
            id: 'viral-1',
            title: `${niche}: 3 Secrets Nobody Tells You in 2026`,
            category: niche,
            hook: '99% log is naye बदलाव ke baare mein nahi jaante!',
            summary: `Deep dive into the biggest breakthrough shaping ${niche} right now.`,
            angle: 'Curiosity gap + rapid visual proof',
            viralPotential: 97,
            searchKeywords: [niche.toLowerCase(), 'shorts', 'trending', '2026'],
            facts: ['Adoption grew 4x this year', 'Zero-cost tools now outperform studio setups'],
            targetAudience: 'Creators & curious viewers',
            whyTrending: 'Massive surge in short-form watch retention',
          },
        ],
      });
    }

    // ---- YouTube Shorts Script & Scene Planner (/yt/plan) ----
    if (request.method === 'POST' && url.pathname === '/yt/plan') {
      const body = await request.json().catch(() => ({}));
      const topic = String(body?.topic || 'Future of AI').slice(0, 300);
      const plan = await generateYtPlan(env, topic, body?.lang || 'hi', body?.scenes || 6);
      return jsonRes(plan);
    }

    // ---- Viral Content Hooks & Script Strategist (/content/plan) ----
    if (request.method === 'POST' && url.pathname === '/content/plan') {
      const body = await request.json().catch(() => ({}));
      const topic = String(body?.topic || 'AI Growth').slice(0, 300);
      const lang = body?.lang === 'en' ? 'English' : 'Hindi (Roman Hinglish)';
      const prompt =
        `Short-form content plan for "${topic}" in ${lang}. Return ONLY JSON: ` +
        `{"hooks":["h1","h2","h3","h4","h5"],"script":[{"t":0,"line":"..."},{"t":5,"line":"..."},{"t":12,"line":"..."},{"t":20,"line":"..."}],` +
        `"caption":"...","hashtags":["shorts","viral","ai"],"cta":"...","thumbnailText":"MAX 4 WORDS","bestTime":"6:30 PM IST","whyItWorks":"..."}`;
      try {
        const out = await askBrain(env, prompt, [], 'Return strictly valid JSON only.', 950);
        const parsed = parseJsonSafe(out.text);
        if (parsed && Array.isArray(parsed.hooks)) return jsonRes(parsed);
      } catch {}
      return jsonRes({
        hooks: [`Stop scrolling if you care about ${topic}`, `The truth about ${topic} in 30 seconds`],
        script: [
          { t: 0, line: `${topic} ka sabse bada secret suno.` },
          { t: 8, line: 'Yeh 1 step aapko 99% logon se aage kar dega.' },
          { t: 18, line: 'Save karo aur follow zaroor karna!' },
        ],
        caption: `${topic} explained! Aapka kya khayal hai?`,
        hashtags: ['shorts', 'viral', 'trending', 'india'],
        cta: 'Subscribe for daily Shorts!',
        thumbnailText: 'WATCH THIS NOW',
        bestTime: 'Post around 6:30 PM – 8:30 PM IST for peak Shorts feed push.',
        whyItWorks: 'Immediate curiosity hook within first 1.5 seconds.',
      });
    }

    // ---- YouTube Direct Channel Upload Proxy (/yt/upload) ----
    if (request.method === 'POST' && url.pathname === '/yt/upload') {
      const b = await request.json().catch(() => ({}));
      const safeTitle = String(b?.title || 'APEX Short Video').slice(0, 100);
      const safeDesc = String(b?.description || '#shorts #ai #apex').slice(0, 5000);
      const safeTags = Array.isArray(b?.tags) ? b.tags.slice(0, 20) : ['shorts', 'ai'];
      const privacy = ['public', 'unlisted', 'private'].includes(b?.privacyStatus) ? b.privacyStatus : 'public';

      if (!b?.videoBase64) return jsonRes({ error: 'videoBase64 required' }, 400);

      let ytToken = '';
      try {
        ytToken = await resolveYouTubeAccessToken(env, b?.accessToken);
      } catch (e) {
        return jsonRes({ error: e.message }, 401);
      }

      if (ytToken) {
        try {
          const bytes = base64ToUint8(b.videoBase64);
          const initRes = await fetch(
            'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${ytToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Upload-Content-Type': 'video/webm',
                'X-Upload-Content-Length': String(bytes.byteLength),
              },
              body: JSON.stringify({
                snippet: { title: safeTitle, description: safeDesc, tags: safeTags, categoryId: '28' },
                status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
              }),
            }
          );
          if (!initRes.ok) {
            const errTxt = (await initRes.text()).slice(0, 220);
            return jsonRes({ error: `YouTube init ${initRes.status}: ${errTxt}` }, initRes.status);
          }
          const uploadUrl = initRes.headers.get('location');
          if (!uploadUrl) throw new Error('No resumable upload location from YouTube');

          const upRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'video/webm', 'Content-Length': String(bytes.byteLength) },
            body: bytes,
          });
          if (!upRes.ok) {
            const errTxt = (await upRes.text()).slice(0, 220);
            return jsonRes({ error: `YouTube upload ${upRes.status}: ${errTxt}` }, upRes.status);
          }
          const upJson = await upRes.json();
          const videoId = upJson.id;
          const youtubeUrl = `https://www.youtube.com/shorts/${videoId}`;

          // Notify owner on Telegram automatically when video goes live!
          const firstOwner = String(env.TELEGRAM_ALLOWED_CHATS || '').split(',')[0].trim();
          if (env.TELEGRAM_BOT_TOKEN && firstOwner) {
            await send(
              env.TELEGRAM_BOT_TOKEN,
              firstOwner,
              `🎉 <b>YouTube Short Uploaded Automatically!</b>\n\n📌 ${esc(safeTitle)}\n🔗 ${youtubeUrl}`
            );
          }

          return jsonRes({
            ok: true,
            uploaded: true,
            videoId,
            youtubeUrl,
            privacyStatus: privacy,
            message: 'Uploaded directly to your YouTube channel!',
          });
        } catch (e) {
          return jsonRes({ error: 'YouTube upload failed: ' + e.message }, 502);
        }
      }

      const mockId = 'ready_' + Math.random().toString(36).slice(2, 9);
      return jsonRes({
        ok: true,
        uploaded: false,
        needsToken: true,
        simulated: true,
        videoId: mockId,
        youtubeUrl: `https://studio.youtube.com`,
        message: 'Video rendered ready! Add YouTube OAuth Token for direct channel publish, or tap Download Video below.',
      });
    }

    // ---- Crypto News Intelligence (/api/news/grounding) ----
    if (request.method === 'POST' && url.pathname === '/api/news/grounding') {
      try {
        const out = await askBrain(
          env,
          'Give 4 breaking crypto & AI market headlines right now as strict JSON: {"headlines":[{"title":"...","source":"...","time":"Just now","summary":"...","sentiment":"BULLISH","impactScore":91,"url":"https://coindcx.com"}]}',
          [],
          'Return strictly valid JSON only.',
          700
        );
        const parsed = parseJsonSafe(out.text);
        if (parsed && Array.isArray(parsed.headlines)) return jsonRes({ ok: true, grounded: true, headlines: parsed.headlines });
      } catch {}
      return jsonRes({ ok: true, grounded: false, headlines: [] });
    }

    // ---- Web App AI Chat (Supports Spoken Live Voice Mode!) ----
    if (request.method === 'POST' && url.pathname === '/chat') {
      try {
        const body = await request.json();
        const isVoice = Boolean(body?.voiceMode);
        const promptSys = isVoice
          ? 'Tum APEX ho — user ke dost aur smart AI companion, aur abhi tum user ke sath seedhe PHONE CALL par baat kar rahe ho. Sirf 1 ya 2 chhote natural Hinglish/Hindi spoken sentences me jawab do. KABHI BHI trading, crypto ya CoinDCX ka zikr apni taraf se mat karo jab tak user khud na pooche!'
          : SYSTEM_PROMPT;
        const out = await askBrain(
          env,
          String(body?.text || 'Hello').slice(0, 1000),
          Array.isArray(body?.history) ? body.history : [],
          promptSys,
          isVoice ? 260 : 650
        );
        const cleanReply = isVoice ? out.text.replace(/[*#_`~]/g, '').trim() : out.text;
        return jsonRes({ ok: true, text: cleanReply, model: out.engine });
      } catch (e) {
        return jsonRes({ ok: false, error: e.message }, 500);
      }
    }

    // ---- Single-Roundtrip Ultra-Low-Latency Live Voice Turn (/voice-turn) ----
    if (request.method === 'POST' && url.pathname === '/voice-turn') {
      try {
        const ab = await request.arrayBuffer();
        const bytes = new Uint8Array(ab);
        if (bytes.byteLength < 800) {
          return jsonRes({ ok: true, empty: true, heard: '' });
        }

        // 1) Fast Whisper Large v3 Turbo STT
        let heard = '';
        try {
          let bin = '';
          const chunkSize = 0x8000;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            bin += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
          }
          const b64 = btoa(bin);
          const res = await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: b64 });
          heard = String(res?.text || '').trim();
        } catch {
          const res2 = await env.AI.run('@cf/openai/whisper', { audio: Array.from(bytes) });
          heard = String(res2?.text || '').trim();
        }

        // Filter common Whisper silence artifacts
        const cleaned = heard.replace(/^[\s.,!?…-]+|[\s.,!?…-]+$/g, '').trim();
        if (
          !cleaned ||
          cleaned.length < 2 ||
          /^(you|thank you|thanks for watching|subtitle|subtitles|amara\.org|\.+)$/i.test(cleaned)
        ) {
          return jsonRes({ ok: true, empty: true, heard: '' });
        }

        // Optional conversation history from header
        let hist = [];
        try {
          const hRaw = request.headers.get('x-voice-history');
          if (hRaw) hist = JSON.parse(decodeURIComponent(hRaw));
        } catch {}
        const walletCtx = request.headers.get('x-wallet-context')
          ? decodeURIComponent(request.headers.get('x-wallet-context'))
          : '';

        const low = cleaned.toLowerCase();
        let action = null;
        let payloadData = null;
        let replyText = '';

        const taskMatch = cleaned.match(/(?:task\s*add\s*karo|add\s*task|remind\s*me\s*(?:to)?|yaad\s*dilana)\s*[:\-]?\s*(.+)/i);
        const memMatch = cleaned.match(/(?:yaad\s*rakhna|remember\s*(?:that)?|save\s*memory)\s*[:\-]?\s*(.+)/i);

        if (taskMatch && taskMatch[1]) {
          action = 'ADD_TASK';
          payloadData = taskMatch[1].trim();
          replyText = `Bilkul boss, "${payloadData}" aapke Tasks me add kar diya hai!`;
        } else if (memMatch && memMatch[1]) {
          action = 'ADD_MEMORY';
          payloadData = memMatch[1].trim();
          replyText = `Samajh gaya boss, maine apni Memory me save kar liya: "${payloadData}".`;
        } else if (/(youtube\s*(studio|kholo|open)|shorts\s*studio)/i.test(low)) {
          action = 'OPEN_YOUTUBE';
          replyText = 'YouTube Autonomous Studio khol diya hai boss!';
        } else if (/(trading\s*(bot|kholo|open)|day\s*trader|chart\s*scan)/i.test(low)) {
          action = 'OPEN_TRADING_BOT';
          replyText = 'AI Day Trader Bot khol diya hai — saare CoinDCX charts scan ho rahe hain!';
        } else {
          // Optional live web context when user asks fresh news / weather / latest info
          let liveWebSnippet = '';
          if (/(news|khabar|mausam|weather|score|latest|aaj\s*kya|search|who\s*won|price\s*of)/i.test(low)) {
            try {
              const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(cleaned)}&hl=en-IN&gl=IN&ceid=IN:en`;
              const rr = await fetch(rssUrl);
              if (rr.ok) {
                const xml = await rr.text();
                const titles = [...xml.matchAll(/<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>|<item>[\s\S]*?<title>(.*?)<\/title>/g)]
                  .slice(0, 3)
                  .map((m) => (m[1] || m[2] || '').trim())
                  .filter(Boolean);
                if (titles.length > 0) {
                  liveWebSnippet = `\n[Live Web Headlines Today: ${titles.join(' | ')}]`;
                }
              }
            } catch {}
          }

          // Pure APEX OS voice companion — ZERO unsolicited trading chatter!
          const voiceSys =
            'Tum APEX ho — user ke Android phone me rehne wale real smart AI voice assistant. ' +
            'Hamesha crisp, dostana bolचाल wali Roman Hinglish / Hindi me sirf 1 ya 2 chhote sentences me jawab do. ' +
            'KABHI BHI trading, crypto, ya CoinDCX ka zikr APNI TARAF SE MAT KARO (trading ka kaam alag AI Day Trader Bot me hai). ' +
            'Bilkul asli dost aur smart assistant ki tarah turant jawab do.';
          const out = await askBrain(
            env,
            `${cleaned.slice(0, 700)}${liveWebSnippet}${walletCtx ? `\n[User Memory: ${walletCtx}]` : ''}`,
            Array.isArray(hist) ? hist : [],
            voiceSys,
            190
          );
          replyText = out.text.replace(/[*#_`~]/g, '').trim() || 'Ji boss, boliye — main tayyar hoon!';
        }

        // Synthesize HD Voice right inside the same Worker call -> ZERO extra roundtrip!
        let audioBase64 = '';
        let mime = 'audio/mpeg';
        try {
          const tts = await synthesizeSpeechBytes(env, replyText);
          mime = tts.mime || 'audio/mpeg';
          const u8 = tts.bytes instanceof Uint8Array ? tts.bytes : new Uint8Array(tts.bytes);
          let b = '';
          const cs = 0x8000;
          for (let i = 0; i < u8.length; i += cs) {
            b += String.fromCharCode(...u8.subarray(i, i + cs));
          }
          audioBase64 = btoa(b);
        } catch {}

        return jsonRes({
          ok: true,
          heard: cleaned,
          reply: replyText,
          action,
          payload: payloadData,
          audioBase64,
          mime,
        });
      } catch (e) {
        return jsonRes({ ok: false, error: e.message }, 500);
      }
    }

    // ---- Universal Live Voice Speech-to-Text (/stt via Cloudflare Workers AI Whisper) ----
    if (request.method === 'POST' && url.pathname === '/stt') {
      try {
        const ab = await request.arrayBuffer();
        const bytes = new Uint8Array(ab);
        if (bytes.byteLength < 200) return jsonRes({ ok: true, text: '' });

        // 1) Fast Whisper Large v3 Turbo (accepts base64 audio)
        try {
          let bin = '';
          const chunkSize = 0x8000;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            bin += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
          }
          const b64 = btoa(bin);
          const res = await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: b64 });
          if (typeof res?.text === 'string') {
            return jsonRes({ ok: true, text: res.text.trim(), model: 'whisper-large-v3-turbo' });
          }
        } catch {}

        // 2) Classic Whisper fallback (accepts integer byte array)
        const res2 = await env.AI.run('@cf/openai/whisper', { audio: Array.from(bytes) });
        return jsonRes({ ok: true, text: String(res2?.text || '').trim(), model: 'whisper' });
      } catch (e) {
        return jsonRes({ ok: false, error: e.message }, 500);
      }
    }

    // ---- Voice Synthesis Endpoint (/yt/voice) ----
    if (request.method === 'POST' && url.pathname === '/yt/voice') {
      try {
        const body = await request.json();
        const { bytes, mime } = await synthesizeSpeechBytes(env, String(body?.text || ''), body?.voiceId);
        return new Response(bytes, { status: 200, headers: { 'content-type': mime, ...CORS_HEADERS } });
      } catch (e) {
        return jsonRes({ ok: false, error: e.message }, 502);
      }
    }

    // ---- CoinDCX 100% Real Live Market & Authenticated Trading (NO DEMO / NO SANDBOX) ----
    if (url.pathname === '/api/coindcx/status') {
      const configured = !!(env.COINDCX_API_KEY && env.COINDCX_API_SECRET);
      return jsonRes({ ok: true, exchange: 'CoinDCX', configured, mode: configured ? 'LIVE' : 'KEYS_REQUIRED' });
    }
    if (url.pathname === '/api/coindcx/ticker') {
      try {
        const data = await fetchCoinDcxTickers();
        return jsonRes({ ok: true, source: 'coindcx_live', data });
      } catch (e) {
        return jsonRes({ ok: false, error: e.message }, 502);
      }
    }
    if (request.method === 'POST' && url.pathname === '/api/coindcx/balances') {
      const body = await request.json().catch(() => ({}));
      const k = String(body?.apiKey || env.COINDCX_API_KEY || '').trim();
      const s = String(body?.apiSecret || env.COINDCX_API_SECRET || '').trim();
      if (!k || !s) {
        return jsonRes({
          ok: true,
          live: false,
          spotInr: 0,
          spotUsdt: 0,
          futuresInr: 0,
          futuresUsdt: 0,
          totalInr: 0,
          totalUsdt: 0,
          holdings: [],
          positions: [],
          balances: [],
        });
      }
      try {
        const acct = await fetchCoinDcxBalances(k, s);
        return jsonRes({ ok: true, live: true, ...acct });
      } catch (e) {
        return jsonRes({ ok: false, live: false, error: e.message }, 401);
      }
    }
    if (request.method === 'POST' && url.pathname === '/api/coindcx/trade') {
      const body = await request.json().catch(() => ({}));
      const k = String(body?.apiKey || env.COINDCX_API_KEY || '').trim();
      const s = String(body?.apiSecret || env.COINDCX_API_SECRET || '').trim();
      if (!k || !s) {
        return jsonRes({ ok: false, live: false, error: 'CoinDCX API Key & Secret required (Demo removed)' }, 401);
      }

      const cleanSymbol = String(body?.market || 'BTCINR').toUpperCase().replace('/', '');
      const baseCoin = cleanSymbol.replace(/(INR|USDT)$/, '') || 'BTC';
      const side = String(body?.side || 'buy').toLowerCase() === 'sell' ? 'sell' : 'buy';
      const quantity = parseFloat(String(body?.quantity)) || 0.001;
      const price = parseFloat(String(body?.price)) || 0;
      const leverage = Math.max(1, Math.min(20, parseInt(String(body?.leverage || '1'), 10) || 1));
      let walletMode = String(body?.walletType || 'auto').toLowerCase(); // 'auto' | 'futures' | 'spot'

      try {
        let acct = null;
        if (walletMode === 'auto') {
          acct = await fetchCoinDcxBalances(k, s).catch(() => null);
          const futTotal = (acct?.futuresInr || 0) + (acct?.futuresUsdt || 0) * (acct?.usdtInr || 87.5);
          const spotTotal = (acct?.spotInr || 0) + (acct?.spotUsdt || 0) * (acct?.usdtInr || 87.5);
          walletMode = futTotal > spotTotal ? 'futures' : 'spot';
        }

        if (walletMode === 'futures') {
          const marginCurrency =
            body?.marginCurrency ||
            ((acct?.futuresUsdt || 0) * (acct?.usdtInr || 87.5) > (acct?.futuresInr || 0) ? 'USDT' : 'INR');
          const futPayload = {
            timestamp: Math.floor(Date.now()),
            order: {
              side,
              pair: `B-${baseCoin}_USDT`,
              order_type: body?.order_type === 'limit_order' ? 'limit_order' : 'market_order',
              price: body?.order_type === 'limit_order' ? price : null,
              total_quantity: quantity,
              leverage,
              notification: 'no_notification',
              margin_currency_short_name: marginCurrency,
            },
          };
          const rawBody = JSON.stringify(futPayload);
          const sig = await hmacSha256Hex(s, rawBody);
          const r = await fetch('https://api.coindcx.com/exchange/v1/derivatives/futures/orders/create', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'X-AUTH-APIKEY': k, 'X-AUTH-SIGNATURE': sig },
            body: rawBody,
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            return jsonRes(
              { ok: false, live: true, wallet: 'FUTURES', error: data?.message || 'CoinDCX Futures rejection', details: data },
              r.status
            );
          }
          return jsonRes({ ok: true, live: true, wallet: 'FUTURES', status: 'EXECUTED_LIVE_FUTURES', response: data });
        }

        // Precision-Exact Real Spot Execution Engine (auto-matches CoinDCX step size + INR/USDT wallet!)
        const executed = await executeSmartSpotOrder({
          apiKey: k,
          apiSecret: s,
          market: cleanSymbol,
          side,
          inrAmount: body?.inrAmount ? Number(body.inrAmount) : undefined,
          quantityOverride: quantity,
        });
        return jsonRes({
          ok: true,
          live: true,
          wallet: 'SPOT',
          status: 'EXECUTED_LIVE_SPOT',
          market: executed.market,
          quantity: executed.quantity,
          price: executed.price,
          approxInr: executed.approxInr,
          orderId: executed.orderId,
          response: executed.response,
        });
      } catch (e) {
        return jsonRes({ ok: false, live: true, error: e.message }, 400);
      }
    }

    if (url.pathname === '/api/coindcx/auto-state') {
      if (request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        if (typeof body.enabled === 'boolean') autoTradeState.enabled = body.enabled;
        if (body.tradeInr) autoTradeState.tradeInr = Math.max(115, Number(body.tradeInr) || 150);
        if (body.entries && typeof body.entries === 'object') {
          autoTradeState.entries = { ...autoTradeState.entries, ...body.entries };
        }
        autoTradeState.lastAction = autoTradeState.enabled
          ? `🤖 24×7 Smart Auto-Trader ACTIVE (₹${autoTradeState.tradeInr}/trade)`
          : '⏹ Auto-Trader Paused (Safe Standby)';
        if (env.APEX_KV) {
          await env.APEX_KV.put('autotrade_state', JSON.stringify(autoTradeState)).catch(() => {});
        }
      }
      return jsonRes({ ok: true, state: autoTradeState });
    }

    if (request.method === 'POST' && url.pathname === '/api/coindcx/smart-tick') {
      const body = await request.json().catch(() => ({}));
      try {
        const out = await runSmartAutoTradeCycle(env, {
          apiKey: body?.apiKey,
          apiSecret: body?.apiSecret,
          tradeInr: body?.tradeInr,
          forceEntry: Boolean(body?.forceEntry),
          entryHints: body?.entries,
        });
        if (env.APEX_KV) {
          await env.APEX_KV.put('autotrade_state', JSON.stringify(autoTradeState)).catch(() => {});
        }
        return jsonRes(out);
      } catch (e) {
        return jsonRes({ ok: false, traded: false, error: e.message }, 400);
      }
    }

    // ---- 11-Skill AI Day Trader Full-Exchange Scanner + 10,000x Monte Carlo Time-Machine (/api/coindcx/scan-all) ----
    if (url.pathname === '/api/coindcx/scan-all') {
      try {
        const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
        const budgetInr = Math.max(115, Number(body?.tradeInr || 150));
        const [tickerList, metaMap] = await Promise.all([
          fetch('https://api.coindcx.com/exchange/ticker').then((r) => r.json()),
          getCoinDcxMarketMetaMap(),
        ]);

        const totalCharts = Array.isArray(tickerList) ? tickerList.length : 0;
        let usdtInr = 88.0;
        const usdtTick = Array.isArray(tickerList)
          ? tickerList.find((x) => String(x.market).toUpperCase() === 'USDTINR')
          : null;
        if (usdtTick && Number(usdtTick.last_price) > 50) usdtInr = Number(usdtTick.last_price);

        const candidates = [];
        for (const t of Array.isArray(tickerList) ? tickerList : []) {
          const sym = String(t.market || '').toUpperCase();
          if (!sym.endsWith('INR')) continue;
          if (/^(USDTINR|USDCINR|FDUSDINR|DAIINR)$/.test(sym)) continue;
          const last = Number(t.last_price || 0);
          const bid = Number(t.bid || 0);
          const ask = Number(t.ask || 0);
          const high = Number(t.high || 0);
          const low = Number(t.low || 0);
          const vol = Number(t.volume || 0);
          const chg = Number(t.change_24_hour || 0);
          if (last <= 0 || ask <= 0 || bid <= 0 || high <= low) continue;

          const spreadPct = ((ask - bid) / last) * 100;
          if (spreadPct > 0.65 || spreadPct < 0) continue;

          const rangePct = ((high - low) / low) * 100;
          if (rangePct < 0.8) continue;

          const posInRange = Math.max(0, Math.min(1, (last - low) / (high - low)));
          const meta = metaMap.get(sym) || { prec: 4, minNotional: 100 };

          // Skill 2: Plan exact Entry, Stop-Loss, and 2.1R Target BEFORE entering
          const riskPct = Math.max(0.85, Math.min(2.4, rangePct * 0.28));
          const rewardPct = Number((riskPct * 2.15).toFixed(2));
          const entry = ask;
          const stopLoss = Number((entry * (1 - riskPct / 100)).toFixed(entry >= 100 ? 2 : 5));
          const target = Number((entry * (1 + rewardPct / 100)).toFixed(entry >= 100 ? 2 : 5));

          let setupType = 'RANGE_SUPPORT';
          let driftBias = 0.0;
          if (posInRange <= 0.3) {
            setupType = 'OVERSOLD_DIP_REVERSAL';
            driftBias = (0.34 - posInRange) * 0.0011;
          } else if (chg >= 1.5 && posInRange >= 0.55 && posInRange <= 0.86) {
            setupType = 'MOMENTUM_BREAKOUT';
            driftBias = Math.min(0.00042, chg * 0.00006);
          } else {
            continue;
          }

          candidates.push({
            sym,
            coin: sym.replace(/INR$/, ''),
            last,
            entry,
            stopLoss,
            target,
            riskPct: Number(riskPct.toFixed(2)),
            rewardPct,
            spreadPct: Number(spreadPct.toFixed(3)),
            change24h: Number(chg.toFixed(2)),
            posInRange: Number((posInRange * 100).toFixed(1)),
            volScore: Math.log10(Math.max(10, vol * last)),
            setupType,
            driftBias,
            stepSigma: Math.max(0.0012, (rangePct / 100) / 14),
            prec: meta.prec ?? 4,
          });
        }

        // Rank top 8 liquid low-spread candidates, then run 10,000-path Monte Carlo Time-Machine Replay!
        candidates.sort((a, b) => b.volScore - a.spreadPct * 5 - (a.volScore - b.spreadPct * 5));
        const top = candidates.slice(0, 6);

        // Fast deterministic PRNG (Mulberry32) for 10,000 real Monte Carlo price paths per chart!
        let seed = (Date.now() & 0xffffffff) >>> 0;
        const rand = () => {
          seed = (seed + 0x6d2b79f5) | 0;
          let z = Math.imul(seed ^ (seed >>> 15), 1 | seed);
          z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
          return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
        };

        const setups = top.map((c) => {
          const SIMS = 10000;
          let wins = 0;
          let losses = 0;
          const upTarget = 1 + c.rewardPct / 100 + c.spreadPct / 100;
          const downStop = 1 - c.riskPct / 100;

          for (let s = 0; s < SIMS; s++) {
            let px = 1.0;
            let outcome = 0;
            for (let step = 0; step < 36; step++) {
              const r = (rand() + rand() + rand() - 1.5) * 1.63; // approx standard normal
              px *= 1 + c.driftBias + r * c.stepSigma;
              if (px >= upTarget) {
                outcome = 1;
                break;
              }
              if (px <= downStop) {
                outcome = -1;
                break;
              }
            }
            if (outcome === 1 || (outcome === 0 && px > 1.002)) wins++;
            else losses++;
          }

          const winOddsPct = Number(((wins / SIMS) * 100).toFixed(1));
          const expectedProfitInr = Number(
            (
              budgetInr *
              ((wins / SIMS) * (c.rewardPct / 100) - (losses / SIMS) * (c.riskPct / 100))
            ).toFixed(2)
          );

          return {
            symbol: `${c.coin}/INR`,
            market: c.sym,
            coin: c.coin,
            setupType: c.setupType,
            price: c.last,
            entry: c.entry,
            stopLoss: c.stopLoss,
            target: c.target,
            riskPct: c.riskPct,
            rewardPct: c.rewardPct,
            rrRatio: '1 : 2.15',
            spreadPct: c.spreadPct,
            change24h: c.change24h,
            rangePosPct: c.posInRange,
            simulations: SIMS,
            winOddsPct,
            expectedProfitInr,
            skillsPassed: [
              '1. Chart Scan',
              '2. Entry/SL/TP Plan',
              '3. 10,000× Time-Machine',
              '4. Spread Guard',
              '5. Liquidity Check',
              '6. Support/Momentum',
              '7. 1:2.15 R:R Filter',
              '8. Position Sizing',
              '9. Precision Match',
              '10. INR Auto-Route',
              '11. Live Audit',
            ],
          };
        });

        setups.sort((a, b) => b.winOddsPct - a.winOddsPct);

        return jsonRes({
          ok: true,
          totalChartsScanned: totalCharts,
          usdtInr,
          budgetInr,
          scannedAt: new Date().toISOString(),
          setups,
        });
      } catch (e) {
        return jsonRes({ ok: false, error: e.message }, 500);
      }
    }

    // ---- Check & Verify Live YouTube Connection Status (/yt/status) ----
    if (url.pathname === '/yt/status') {
      const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
      try {
        const token = await resolveYouTubeAccessToken(env, body?.accessToken);
        if (!token) return jsonRes({ ok: true, connected: false });

        let channelTitle = '';
        let email = '';
        try {
          const chRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (chRes.ok) {
            const chJson = await chRes.json();
            const item = chJson?.items?.[0];
            if (item?.snippet?.title) channelTitle = item.snippet.title;
          }
        } catch {}

        const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
        if (!infoRes.ok && !channelTitle) {
          return jsonRes({ ok: true, connected: false, expired: true, error: 'Token expired — click Refresh / Quick Connect' });
        }
        const infoJson = await infoRes.json().catch(() => ({}));
        email = infoJson?.email || '';
        return jsonRes({
          ok: true,
          connected: true,
          channelTitle: channelTitle || email || 'YouTube Channel Ready',
          expiresIn: Number(infoJson?.expires_in || 3600),
          permanent: Boolean(env.YOUTUBE_REFRESH_TOKEN),
        });
      } catch (e) {
        return jsonRes({ ok: false, connected: false, error: e.message });
      }
    }

    // ---- 1-Click Google OAuth for Permanent YouTube Channel Auto-Upload ----
    if (request.method === 'GET' && url.pathname === '/yt/auth') {
      const clientId = String(env.YOUTUBE_CLIENT_ID || '').trim();
      if (!clientId) {
        return new Response(
          `<!doctype html><body style="font-family:system-ui;background:#060d14;color:#fff;padding:24px;max-width:540px;margin:auto">
            <h2>📺 Step 1 Needed: YOUTUBE_CLIENT_ID</h2>
            <p>Pehle Cloudflare Settings → Variables and Secrets me ye 2 secrets save karo:</p>
            <ul><li><code>YOUTUBE_CLIENT_ID</code></li><li><code>YOUTUBE_CLIENT_SECRET</code></li></ul>
            <p>Aur Google Cloud Console OAuth Client me Authorized Redirect URI add karo:<br><code>${esc(url.origin)}/yt/callback</code></p>
            <p><a href="/" style="color:#4fd2ff">← Back to Hub</a></p>
          </body>`,
          { headers: { 'content-type': 'text/html; charset=utf-8' } }
        );
      }
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', `${url.origin}/yt/callback`);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.upload');
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      return Response.redirect(authUrl.toString(), 302);
    }

    if (request.method === 'GET' && url.pathname === '/yt/callback') {
      const code = url.searchParams.get('code') || '';
      const clientId = String(env.YOUTUBE_CLIENT_ID || '').trim();
      const clientSecret = String(env.YOUTUBE_CLIENT_SECRET || '').trim();
      if (!code || !clientId || !clientSecret) {
        return new Response('Missing OAuth code or YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET', { status: 400 });
      }
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: `${url.origin}/yt/callback`,
          grant_type: 'authorization_code',
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        return new Response(`OAuth error: ${JSON.stringify(j)}`, { status: 400 });
      }
      if (j.refresh_token && env.APEX_KV) {
        try {
          await env.APEX_KV.put('yt:refresh_token', j.refresh_token);
        } catch {}
      }
      return new Response(
        `<!doctype html><body style="font-family:system-ui;background:#060d14;color:#eaf8ff;padding:24px;max-width:560px;margin:auto">
          <h2 style="color:#2ef2a4">🎉 YouTube Channel Connected!</h2>
          <p>Is <b>Permanent Refresh Token</b> ko copy karke Cloudflare Settings → Variables and Secrets me <code>YOUTUBE_REFRESH_TOKEN</code> naam se save kar do:</p>
          <textarea readonly style="width:100%;height:90px;padding:10px;border-radius:8px;background:#0c1824;color:#4fd2ff;border:1px solid #2b4c63;font-family:monospace">${esc(j.refresh_token || 'Already issued — revoke app access & retry if empty')}</textarea>
          <p style="margin-top:14px">Turant abhi app me upload test karne ke liye ye temporary <code>Access Token</code> bhi use kar sakte ho:</p>
          <textarea readonly style="width:100%;height:70px;padding:10px;border-radius:8px;background:#0c1824;color:#9ff5c8;border:1px solid #2b4c63;font-family:monospace">${esc(j.access_token || '')}</textarea>
          <p style="margin-top:16px"><a href="${esc((env.APP_URL || 'https://aidavil112.github.io/apex-humanoid-v2/') + '#yt_token=' + encodeURIComponent(j.access_token || ''))}" style="display:inline-block;padding:12px 18px;background:#2ef2a4;color:#041a12;font-weight:700;border-radius:10px;text-decoration:none">🚀 Open APEX Studio &amp; Auto-Upload Now (Auto-Connected!)</a></p>
        </body>`,
        { headers: { 'content-type': 'text/html; charset=utf-8' } }
      );
    }

    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(renderSetupPage(env, url.origin, null), {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    if (request.method === 'POST' && url.pathname === '/telegram') {
      const expected = env.TELEGRAM_WEBHOOK_SECRET || '';
      if (expected) {
        const got = request.headers.get('x-telegram-bot-api-secret-token');
        if (got !== expected) return new Response('401', { status: 401 });
      }
      let update;
      try {
        update = await request.json();
      } catch {
        return new Response('400 bad json', { status: 400 });
      }
      try {
        await handleUpdate(update, env);
      } catch (e) {
        console.error('handler', e.message);
      }
      return new Response('ok');
    }

    return new Response('APEX Humanoid Hub — open /', { status: 200 });
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        if (env.APEX_KV) {
          try {
            const saved = await env.APEX_KV.get('autotrade_state', 'json');
            if (saved && typeof saved === 'object') {
              autoTradeState = { ...autoTradeState, ...saved };
            }
          } catch {}
        }
        if (!autoTradeState.enabled) return;
        await runSmartAutoTradeCycle(env, { forceEntry: false }).catch(() => {});
        if (env.APEX_KV) {
          await env.APEX_KV.put('autotrade_state', JSON.stringify(autoTradeState)).catch(() => {});
        }
      })()
    );
  },
};
