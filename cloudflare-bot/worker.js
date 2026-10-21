/* ---------------------------------------------------------------------------
   APEX Humanoid — Telegram bot on Cloudflare Workers (100% FREE, 24x7)
   ---------------------------------------------------------------------------
   Works both ways:
     A) Create app -> Import GitHub repo (Aidavil112/apex-humanoid-v2) -> Deploy
     B) Create app -> Hello World Worker -> Edit code -> Paste this file -> Deploy

   Then in Worker -> Settings -> Variables and Secrets -> + Add:
     - TELEGRAM_BOT_TOKEN      (Secret)  123456:AAH... (@BotFather -> /newbot)
     - GEMINI_API_KEY          (Secret)  AIza... (https://aistudio.google.com/apikey)
     - TELEGRAM_ALLOWED_CHATS  (Text)    optional chat id lock (/id se milega)
     - TELEGRAM_WEBHOOK_SECRET (Secret)  optional secret lock

   Finally, open your *.workers.dev link in Chrome and tap "Connect Bot Now"!
   --------------------------------------------------------------------------- */

const TG = (token) => `https://api.telegram.org/bot${token}`;

const HELP = `<b>APEX Humanoid 🤖</b>

Kuch bhi likho — AI turant jawab dega!
/help — commands list
/id — tumhara chat id (lock karne ke liye)
/clear — memory reset
/app — live 3D Humanoid link

<i>24×7 Free · Cloudflare Workers + Gemini AI</i>`;

const SYSTEM_PROMPT =
  'You are APEX Humanoid, a smart friendly AI assistant. ' +
  'Reply naturally in the exact language/style the user uses (Hinglish, Hindi, or English). ' +
  'Keep replies crisp and helpful (under 80 words unless asked for detail).';

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

async function askGemini(key, text, history = []) {
  const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
  const contents = [
    ...history.slice(-8).map((h) => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(h.text).slice(0, 800) }],
    })),
    { role: 'user', parts: [{ text }] },
  ];
  let lastErr = '';
  for (const m of models) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
          }),
        }
      );
      if (!r.ok) {
        lastErr = `${m}: HTTP ${r.status}`;
        continue;
      }
      const j = await r.json();
      const out = (j?.candidates?.[0]?.content?.parts || []).map((p) => p.text).join('');
      if (out && out.trim()) return out.trim();
      lastErr = `${m}: empty response`;
    } catch (e) {
      lastErr = e.message;
    }
  }
  throw new Error(lastErr || 'Gemini call failed');
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
    await env.APEX_KV?.delete(`hist:${chatId}`);
    return send(token, chatId, '🧹 Memory clear ho gayi.');
  }

  if (!env.GEMINI_API_KEY) {
    return send(
      token,
      chatId,
      '⚠️ <code>GEMINI_API_KEY</code> abhi set nahi hai.\n\n' +
        'Cloudflare → Worker → Settings → Variables and Secrets → + Add:\n' +
        'Name: <code>GEMINI_API_KEY</code>\nValue: AIza... (aistudio.google.com/apikey se free)'
    );
  }

  let history = [];
  if (env.APEX_KV) {
    try {
      history = (await env.APEX_KV.get(`hist:${chatId}`, 'json')) || [];
    } catch {}
  }

  await tgCall(token, 'sendChatAction', { chat_id: chatId, action: 'typing' });

  let reply;
  try {
    reply = await askGemini(env.GEMINI_API_KEY, raw, history);
  } catch (e) {
    reply = `⚠️ AI error: ${e.message}`;
  }

  if (env.APEX_KV) {
    try {
      const next = [...history, { role: 'user', text: raw }, { role: 'model', text: reply }].slice(-10);
      await env.APEX_KV.put(`hist:${chatId}`, JSON.stringify(next), { expirationTtl: 86400 });
    } catch {}
  }

  await send(token, chatId, esc(reply));
}

function renderSetupPage(env, origin, result) {
  const hasToken = !!env.TELEGRAM_BOT_TOKEN;
  const hasGemini = !!env.GEMINI_API_KEY;
  const hasSecret = !!env.TELEGRAM_WEBHOOK_SECRET;

  const badge = (ok) =>
    ok
      ? '<span style="color:#2ef2a4;font-weight:700">✅ Added</span>'
      : '<span style="color:#ff6b6b;font-weight:700">❌ Missing</span>';

  let resultBox = '';
  if (result) {
    if (result.ok) {
      const botLink = result.username ? `<p style="margin:14px 0 0"><a href="https://t.me/${esc(result.username)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#2ef2a4;color:#041a12;font-weight:700;text-decoration:none">💬 Open @${esc(result.username)} in Telegram</a></p>` : '';
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
    <div style="font-weight:700;margin-bottom:12px;font-size:15px">Step 1: Keys Status</div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.07);font-size:14px">
      <code>TELEGRAM_BOT_TOKEN</code> ${badge(hasToken)}
    </div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:14px">
      <code>GEMINI_API_KEY</code> ${badge(hasGemini)}
    </div>
    ${
      !hasToken || !hasGemini
        ? `<p style="margin:12px 0 0;font-size:13px;color:#ffd480;line-height:1.5">
            👉 Cloudflare Dashboard → is Worker pe jao → <b>Settings</b> → <b>Variables and Secrets</b> → <b>+ Add</b> karke dono keys save karo, phir ye page refresh karo.
          </p>`
        : ''
    }
  </div>

  <form method="GET" action="/setup" style="margin-top:16px;padding:16px;border-radius:14px;background:#0c1824;border:1px solid rgba(79,210,255,0.2)">
    <div style="font-weight:700;margin-bottom:10px;font-size:15px">Step 2: 1-Tap Activate</div>
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
  async fetch(request, env, ctx) {
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

    // ---- JSON health ----
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          ok: true,
          bot: 'APEX Humanoid Telegram bot',
          configured: !!env.TELEGRAM_BOT_TOKEN,
          brain: !!env.GEMINI_API_KEY,
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

    // ---- Telegram webhook receiver ----
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
      const work = handleUpdate(update, env).catch((e) => console.error('handler', e.message));
      if (ctx && typeof ctx.waitUntil === 'function') {
        ctx.waitUntil(work);
        return new Response('ok');
      }
      await work;
      return new Response('ok');
    }

    return new Response('APEX Telegram bot — open / to setup', { status: 200 });
  },
};
