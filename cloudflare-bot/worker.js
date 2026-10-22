/* ---------------------------------------------------------------------------
   APEX Humanoid — Telegram bot on Cloudflare Workers (100% FREE, 24x7)
   ---------------------------------------------------------------------------
   Brain chain (automatic failover — zero downtime!):
     1. Google Gemini AI Studio (AIza... / AQ... keys via x-goog-api-key)
     2. Google Vertex AI Express Mode (AQ... keys via aiplatform.googleapis.com)
     3. Built-in Free Keyless AI fallback (Pollinations OpenAI-compatible API)
   --------------------------------------------------------------------------- */

const TG = (token) => `https://api.telegram.org/bot${token}`;

const HELP = `<b>APEX Humanoid 🤖</b>

Kuch bhi likho — AI turant jawab dega!
/help — commands list
/id — tumhara chat id (lock karne ke liye)
/clear — memory reset
/app — live 3D Humanoid link

<i>24×7 Free · Always-On AI Assistant</i>`;

const SYSTEM_PROMPT =
  'You are APEX Humanoid, a smart, warm, helpful AI assistant on Telegram created for the user. ' +
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

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function callGoogleEndpoint(url, key, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': key,
    },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  let j = null;
  try {
    j = JSON.parse(txt);
  } catch {}
  return { ok: r.ok, status: r.status, json: j, errMsg: j?.error?.message || txt.slice(0, 140) };
}

async function askFreeFallbackAI(text, history = []) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-8).map((h) => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: String(h.text).slice(0, 800),
    })),
    { role: 'user', content: text },
  ];
  const r = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'openai', messages }),
  });
  if (!r.ok) throw new Error(`fallback HTTP ${r.status}`);
  const j = await r.json();
  const out = j?.choices?.[0]?.message?.content || '';
  if (!out.trim()) throw new Error('empty fallback reply');
  return out.trim();
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
    const payload = {
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
    };

    // 1) Google AI Studio endpoint
    for (const m of ['gemini-2.5-flash', 'gemini-flash-latest']) {
      try {
        const res = await callGoogleEndpoint(
          `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
          cleanKey,
          payload
        );
        if (res.ok) {
          const out = (res.json?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
          if (out.trim()) return { text: out.trim(), engine: `gemini-aistudio:${m}` };
        }
        if (res.status === 401 || res.status === 403) break;
      } catch {}
    }

    // 2) Google Cloud Vertex AI Express Mode endpoint (AQ... keys)
    for (const m of ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash']) {
      try {
        const res = await callGoogleEndpoint(
          `https://aiplatform.googleapis.com/v1/publishers/google/models/${m}:generateContent`,
          cleanKey,
          payload
        );
        if (res.ok) {
          const out = (res.json?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
          if (out.trim()) return { text: out.trim(), engine: `gemini-vertex:${m}` };
        }
      } catch {}
    }
  }

  // 3) Automatic zero-key AI fallback so the bot NEVER goes silent!
  const freeReply = await askFreeFallbackAI(text, history);
  return { text: freeReply, engine: 'apex-free-ai' };
}

// Lightweight in-memory history (per Worker isolate) + optional KV persistence
const memStore = new Map();

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
    reply = `⚠️ AI busy hai, 5 second baad dobara bhejo. (${e.message})`;
  }

  const next = [...history, { role: 'user', text: raw }, { role: 'model', text: reply }].slice(-10);
  memStore.set(chatId, next);
  if (env.APEX_KV) {
    try {
      await env.APEX_KV.put(`hist:${chatId}`, JSON.stringify(next), { expirationTtl: 86400 });
    } catch {}
  }

  await send(token, chatId, esc(reply));
}

function renderSetupPage(env, origin, result) {
  const hasToken = !!env.TELEGRAM_BOT_TOKEN;
  const hasGemini = !!env.GEMINI_API_KEY;
  const hasSecret = !!env.TELEGRAM_WEBHOOK_SECRET;

  const badge = (ok, optionalText) =>
    ok
      ? '<span style="color:#2ef2a4;font-weight:700">✅ Added</span>'
      : `<span style="color:#ffd480;font-weight:700">${optionalText || '❌ Missing'}</span>`;

  let resultBox = '';
  if (result) {
    if (result.ok) {
      const botLink = result.username
        ? `<p style="margin:14px 0 0"><a href="https://t.me/${esc(result.username)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#2ef2a4;color:#041a12;font-weight:700;text-decoration:none">💬 Open @${esc(result.username)} in Telegram</a></p>`
        : '';
      resultBox = `<div style="margin:16px 0;padding:16px;border-radius:12px;background:#09261b;border:1px solid #2ef2a4">
        <div style="color:#2ef2a4;font-weight:700;font-size:16px">🎉 Bot Connected Successfully!</div>
        <div style="color:#b8eed6;font-size:13px;margin-top:6px">Webhook linked to <code>${esc(origin)}/telegram</code></div>
        ${botLink}
      </div>`;
    } else {
      resultBox = `<div style="margin:16px 0;padding:16px;border-radius:12px;background:#2a1014;border:1px solid #ff6b6b;color:#ffd0d0;font-size:14px">
        ❌ <b>Error:</b> ${esc(result.error || 'Webhook failed')}
      </div>`;
    }
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>APEX Telegram Bot — Setup</title>
</head>
<body style="margin:0;padding:20px;background:#060d14;color:#e6f4ff;font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin-inline:auto">
  <h2 style="margin:8px 0 4px;color:#4fd2ff">🤖 APEX Telegram Bot</h2>
  <p style="margin:0 0 18px;color:#8bb0c9;font-size:14px">100% Free · 24×7 Active on Cloudflare Workers</p>

  ${resultBox}

  <div style="padding:16px;border-radius:14px;background:#0c1824;border:1px solid rgba(79,210,255,0.2)">
    <div style="font-weight:700;margin-bottom:12px;font-size:15px">Status</div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.07);font-size:14px">
      <code>TELEGRAM_BOT_TOKEN</code> ${badge(hasToken)}
    </div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:14px">
      <code>AI Brain</code> ${badge(true, '✅ Built-in Free AI Active')}${hasGemini ? ' <small style="color:#7fd8ff">(Gemini)</small>' : ''}
    </div>
  </div>

  <form method="GET" action="/setup" style="margin-top:16px;padding:16px;border-radius:14px;background:#0c1824;border:1px solid rgba(79,210,255,0.2)">
    <div style="font-weight:700;margin-bottom:10px;font-size:15px">1-Tap Activate</div>
    ${
      hasSecret
        ? `<input name="secret" type="password" placeholder="Enter TELEGRAM_WEBHOOK_SECRET" required style="box-sizing:border-box;width:100%;padding:11px;margin-bottom:10px;border-radius:9px;border:1px solid #2b4c63;background:#061019;color:#fff;font-size:14px" />`
        : ''
    }
    <button type="submit" ${!hasToken ? 'disabled' : ''} style="width:100%;padding:13px;border:0;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;background:${hasToken ? '#2ef2a4' : '#263845'};color:${hasToken ? '#041a12' : '#6c8799'}">
      🚀 Connect Bot to Telegram Now
    </button>
  </form>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ---- 1-tap visual setup endpoint ----
    if (url.pathname === '/setup') {
      if (!env.TELEGRAM_BOT_TOKEN) {
        return new Response(
          renderSetupPage(env, url.origin, { ok: false, error: 'Pehle TELEGRAM_BOT_TOKEN add karo (Settings → Variables and Secrets).' }),
          { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } }
        );
      }
      const expected = env.TELEGRAM_WEBHOOK_SECRET || '';
      const secret = url.searchParams.get('secret') || '';
      if (expected && secret !== expected) {
        return new Response(
          renderSetupPage(env, url.origin, { ok: false, error: 'TELEGRAM_WEBHOOK_SECRET galat hai.' }),
          { status: 403, headers: { 'content-type': 'text/html; charset=utf-8' } }
        );
      }
      const hookUrl = `${url.origin}/telegram`;
      const body = {
        url: hookUrl,
        allowed_updates: ['message', 'edited_message'],
        drop_pending_updates: true,
      };
      if (expected) body.secret_token = expected;
      const me = await tgCall(env.TELEGRAM_BOT_TOKEN, 'getMe');
      const r = await tgCall(env.TELEGRAM_BOT_TOKEN, 'setWebhook', body);
      if (url.searchParams.get('format') === 'json') {
        return new Response(JSON.stringify({ setWebhook: r, bot: me?.result?.username || null, hookUrl }, null, 2), {
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(
        renderSetupPage(
          env,
          url.origin,
          r?.ok
            ? { ok: true, username: me?.result?.username || '' }
            : { ok: false, error: r?.description || 'Telegram rejected token — @BotFather token check karo' }
        ),
        { headers: { 'content-type': 'text/html; charset=utf-8' } }
      );
    }

    // ---- JSON health + real end-to-end AI test ----
    if (url.pathname === '/health') {
      if (url.searchParams.get('ping_ai') === '1') {
        const t0 = Date.now();
        try {
          const out = await askBrain(env, 'Hi bhai kaise ho?');
          return new Response(
            JSON.stringify({ ok: true, engine: out.engine, ms: Date.now() - t0, reply: out.text }),
            { headers: { 'content-type': 'application/json; charset=utf-8' } }
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, ms: Date.now() - t0, error: e.message }),
            { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } }
          );
        }
      }
      return new Response(
        JSON.stringify({
          ok: true,
          bot: 'APEX Humanoid Telegram bot',
          configured: !!env.TELEGRAM_BOT_TOKEN,
          geminiKeySet: !!env.GEMINI_API_KEY,
          brainReady: true,
          kv: !!env.APEX_KV,
        }),
        { headers: { 'content-type': 'application/json' } }
      );
    }

    // ---- Visual Mobile Setup Dashboard at "/" ----
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(renderSetupPage(env, url.origin, null), {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    // ---- Telegram webhook receiver (await full completion so Cloudflare never drops reply!) ----
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

    return new Response('APEX Telegram bot — open / to setup', { status: 200 });
  },
};
