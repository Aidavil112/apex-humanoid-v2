/* ---------------------------------------------------------------------------
   APEX Humanoid — All-in-One Free Backend + Telegram Bot (Cloudflare Workers)
   ---------------------------------------------------------------------------
   100% FREE ($0/mo) · 24x7 No Cold Start · Powers BOTH Telegram + 3D Web App:
     1. AI Brain: Free Gemini Key (AIza / AQ.) -> auto-fallback to Cloudflare Llama 3.3 70B
     2. ElevenLabs Voice: /voice on, /say <text> in Telegram + POST /yt/voice for Web App
     3. CoinDCX Trading: /price, /balance in Telegram + /api/coindcx/* for Web App
   --------------------------------------------------------------------------- */

const TG = (token) => `https://api.telegram.org/bot${token}`;

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const jsonRes = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });

const HELP = `<b>APEX Humanoid 🤖</b>

Kuch bhi likho — AI turant jawab dega!
/price — Live CoinDCX BTC/ETH/SOL prices 📊
/balance — Live CoinDCX wallet balance 💰
/voice on — ElevenLabs voice replies ON 🔊
/voice off — Text replies mode
/say &lt;text&gt; — ElevenLabs voice note bhejo 🎙️
/id — tumhara chat id
/app — live 3D Humanoid link
/clear — memory reset

<i>24×7 Free · AI + ElevenLabs + CoinDCX Ready</i>`;

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

async function sendVoiceNote(token, chatId, mp3Buffer, caption = '') {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('voice', new Blob([mp3Buffer], { type: 'audio/mpeg' }), 'apex-voice.mp3');
  if (caption) form.append('caption', caption.slice(0, 900));
  const r = await fetch(`${TG(token)}/sendVoice`, { method: 'POST', body: form });
  return await r.json();
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ----------------------- ElevenLabs Text-to-Speech ----------------------- */

async function generateElevenLabsSpeech(env, text, customVoiceId) {
  const apiKey = String(env.ELEVENLABS_API_KEY || '').trim();
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY set nahi hai');
  const voiceId = String(customVoiceId || env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb').trim();
  const modelId = String(env.ELEVENLABS_MODEL || 'eleven_multilingual_v2').trim();

  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'xi-api-key': apiKey,
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: String(text).slice(0, 900),
        model_id: modelId,
        voice_settings: { stability: 0.45, similarity_boost: 0.75 },
      }),
    }
  );
  if (!r.ok) {
    const errTxt = (await r.text()).slice(0, 180);
    throw new Error(`ElevenLabs ${r.status}: ${errTxt}`);
  }
  return await r.arrayBuffer();
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

async function fetchCoinDcxTickers() {
  const r = await fetch('https://api.coindcx.com/exchange/ticker', {
    headers: { accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`CoinDCX ticker ${r.status}`);
  const all = await r.json();
  const targets = new Set(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BTCINR', 'ETHINR', 'SOLINR']);
  return all.filter((item) => targets.has(item.market));
}

async function fetchCoinDcxBalances(key, secret) {
  const body = JSON.stringify({ timestamp: Math.floor(Date.now()) });
  const sig = await hmacSha256Hex(secret, body);
  const r = await fetch('https://api.coindcx.com/exchange/v1/users/balances', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-AUTH-APIKEY': key,
      'X-AUTH-SIGNATURE': sig,
    },
    body,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.message || `CoinDCX ${r.status}`);
  return data;
}

/* ------------------------- Dual AI Brain Engine -------------------------- */

async function callGoogleEndpoint(url, key, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  let j = null;
  try {
    j = JSON.parse(txt);
  } catch {}
  return { ok: r.ok, status: r.status, json: j };
}

async function askWorkersAI(env, text, history = []) {
  if (!env.AI || typeof env.AI.run !== 'function') {
    throw new Error('Workers AI binding unavailable');
  }
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-8).map((h) => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: String(h.text).slice(0, 800),
    })),
    { role: 'user', content: text },
  ];
  for (const m of ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct']) {
    try {
      const res = await env.AI.run(m, { messages, max_tokens: 450, temperature: 0.7 });
      const out = typeof res?.response === 'string' ? res.response : '';
      if (out.trim()) return { text: out.trim(), engine: m };
    } catch {}
  }
  throw new Error('AI unavailable');
}

async function askBrain(env, text, history = []) {
  const cleanKey = String(env.GEMINI_API_KEY || '').trim();
  if (cleanKey) {
    const contents = [
      { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
      { role: 'model', parts: [{ text: 'Samajh gaya! Main APEX Humanoid hoon.' }] },
      ...history.slice(-8).map((h) => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: String(h.text).slice(0, 800) }],
      })),
      { role: 'user', parts: [{ text }] },
    ];
    const payload = { contents, generationConfig: { temperature: 0.7, maxOutputTokens: 500 } };

    for (const m of ['gemini-2.5-flash', 'gemini-flash-latest']) {
      try {
        const res = await callGoogleEndpoint(
          `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
          cleanKey,
          payload
        );
        if (res.ok) {
          const out = (res.json?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
          if (out.trim()) return { text: out.trim(), engine: `gemini:${m}` };
        }
        if (res.status === 401 || res.status === 403) break;
      } catch {}
    }

    for (const m of ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash']) {
      try {
        const res = await callGoogleEndpoint(
          `https://aiplatform.googleapis.com/v1/publishers/google/models/${m}:generateContent`,
          cleanKey,
          payload
        );
        if (res.ok) {
          const out = (res.json?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
          if (out.trim()) return { text: out.trim(), engine: `vertex:${m}` };
        }
      } catch {}
    }
  }
  return await askWorkersAI(env, text, history);
}

/* --------------------------- Telegram Handler ---------------------------- */

const memStore = new Map();
const voicePrefs = new Map();

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

  const raw = (msg.text || '').trim();
  if (!raw) return;

  if (raw === '/start' || raw === '/help') return send(token, chatId, HELP);
  if (raw === '/id' || raw === '/whoami') {
    return send(token, chatId, `chat id: <code>${chatId}</code>\nname: ${esc(msg.from?.first_name || '—')}`);
  }
  if (raw === '/app' || raw === '/state') {
    const appUrl = env.APP_URL || 'https://aidavil112.github.io/apex-humanoid-v2/';
    return send(token, chatId, `🌐 <b>APEX Humanoid Live App:</b>\n${appUrl}`);
  }
  if (raw === '/clear') {
    memStore.delete(chatId);
    await env.APEX_KV?.delete(`hist:${chatId}`);
    return send(token, chatId, '🧹 Memory clear ho gayi.');
  }
  if (raw === '/voice' || raw === '/voice on') {
    voicePrefs.set(chatId, true);
    const hasEl = !!env.ELEVENLABS_API_KEY;
    return send(
      token,
      chatId,
      hasEl
        ? '🔊 <b>ElevenLabs Voice ON!</b> Ab har jawab voice note ke saath aayega.'
        : '🔊 Voice preference ON (par abhi <code>ELEVENLABS_API_KEY</code> Cloudflare Settings mein add karni baaki hai).'
    );
  }
  if (raw === '/voice off') {
    voicePrefs.set(chatId, false);
    return send(token, chatId, '🔇 Voice replies OFF — sirf text aayega.');
  }
  if (raw.startsWith('/say ')) {
    const speakText = raw.slice(5).trim();
    if (!env.ELEVENLABS_API_KEY) {
      return send(token, chatId, '⚠️ Pehle Cloudflare Settings mein <code>ELEVENLABS_API_KEY</code> add karo.');
    }
    try {
      await tgCall(token, 'sendChatAction', { chat_id: chatId, action: 'record_voice' });
      const mp3 = await generateElevenLabsSpeech(env, speakText);
      return sendVoiceNote(token, chatId, mp3, speakText);
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
      const balances = await fetchCoinDcxBalances(k, s);
      const nonZero = (Array.isArray(balances) ? balances : [])
        .filter((b) => Number(b.balance) > 0 || ['INR', 'USDT', 'BTC', 'ETH'].includes(b.currency))
        .slice(0, 10)
        .map((b) => `• <b>${esc(b.currency)}:</b> ${Number(b.balance).toFixed(4)}`);
      return send(token, chatId, `💰 <b>CoinDCX Live Wallet</b>\n\n${nonZero.join('\n') || '0 balance'}`);
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

  if (voicePrefs.get(chatId) && env.ELEVENLABS_API_KEY) {
    try {
      const mp3 = await generateElevenLabsSpeech(env, reply);
      await sendVoiceNote(token, chatId, mp3);
    } catch {}
  }
}

/* ------------------------ Setup Dashboard HTML --------------------------- */

function renderSetupPage(env, origin, result) {
  const hasToken = !!env.TELEGRAM_BOT_TOKEN;
  const hasGemini = !!env.GEMINI_API_KEY;
  const hasEleven = !!env.ELEVENLABS_API_KEY;
  const hasCdx = !!(env.COINDCX_API_KEY && env.COINDCX_API_SECRET);
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
  <p style="margin:0 0 18px;color:#8bb0c9;font-size:14px">Telegram Bot + ElevenLabs Voice + CoinDCX Trading</p>
  ${resultBox}
  <div style="padding:16px;border-radius:14px;background:#0c1824;border:1px solid rgba(79,210,255,0.2)">
    <div style="font-weight:700;margin-bottom:10px;font-size:15px">API Status</div>
    ${row('TELEGRAM_BOT_TOKEN', hasToken, '❌ Required')}
    ${row('AI Brain (Llama 3.3 70B + Gemini)', true, '')}
    ${row('GEMINI_API_KEY', hasGemini, '⚪ Optional (Free tier OK)')}
    ${row('ELEVENLABS_API_KEY', hasEleven, '⚪ Optional (Voice TTS)')}
    ${row('COINDCX_API_KEY + SECRET', hasCdx, '⚪ Optional (Live Trading)')}
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
        brainReady: true,
      });
    }

    // ---- Web App AI Chat ----
    if (request.method === 'POST' && url.pathname === '/chat') {
      try {
        const body = await request.json();
        const out = await askBrain(env, String(body?.text || 'Hello').slice(0, 1000), Array.isArray(body?.history) ? body.history : []);
        return jsonRes({ ok: true, text: out.text, model: out.engine });
      } catch (e) {
        return jsonRes({ ok: false, error: e.message }, 500);
      }
    }

    // ---- Web App & Studio ElevenLabs Voice Proxy ----
    if (request.method === 'POST' && url.pathname === '/yt/voice') {
      try {
        const body = await request.json();
        const mp3 = await generateElevenLabsSpeech(env, String(body?.text || ''), body?.voiceId);
        return new Response(mp3, {
          status: 200,
          headers: { 'content-type': 'audio/mpeg', ...CORS_HEADERS },
        });
      } catch (e) {
        return jsonRes({ ok: false, error: e.message }, 502);
      }
    }

    // ---- CoinDCX Live Market & Authenticated Trading Proxy ----
    if (url.pathname === '/api/coindcx/status') {
      const configured = !!(env.COINDCX_API_KEY && env.COINDCX_API_SECRET);
      return jsonRes({ ok: true, exchange: 'CoinDCX', configured, mode: configured ? 'LIVE' : 'SANDBOX' });
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
      if (!k || !s) return jsonRes({ ok: true, live: false, balances: [] });
      try {
        const balances = await fetchCoinDcxBalances(k, s);
        return jsonRes({ ok: true, live: true, balances });
      } catch (e) {
        return jsonRes({ ok: false, live: false, error: e.message }, 401);
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/coindcx/trade') {
      const body = await request.json().catch(() => ({}));
      const k = String(body?.apiKey || env.COINDCX_API_KEY || '').trim();
      const s = String(body?.apiSecret || env.COINDCX_API_SECRET || '').trim();
      const market = String(body?.market || 'BTCUSDT').toUpperCase();
      const side = String(body?.side || 'buy').toLowerCase() === 'sell' ? 'sell' : 'buy';
      const quantity = parseFloat(String(body?.quantity)) || 0.01;
      const price = parseFloat(String(body?.price)) || 0;

      if (k && s) {
        try {
          const payloadObj = {
            side,
            order_type: body?.order_type || 'market_order',
            market,
            price_per_unit: price,
            total_quantity: quantity,
            timestamp: Math.floor(Date.now()),
          };
          const rawBody = JSON.stringify(payloadObj);
          const sig = await hmacSha256Hex(s, rawBody);
          const r = await fetch('https://api.coindcx.com/exchange/v1/orders/create', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'X-AUTH-APIKEY': k,
              'X-AUTH-SIGNATURE': sig,
            },
            body: rawBody,
          });
          const data = await r.json();
          if (!r.ok) return jsonRes({ ok: false, error: data?.message || 'Order failed', details: data }, r.status);
          return jsonRes({ ok: true, live: true, status: 'EXECUTED_ON_COINDCX', response: data });
        } catch (e) {
          return jsonRes({ ok: false, error: e.message }, 502);
        }
      }
      return jsonRes({ ok: true, live: false, simulated: true, status: 'FILLED_SANDBOX' });
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
};
