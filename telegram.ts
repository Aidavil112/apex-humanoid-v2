/* ---------------------------------------------------------------------------
   APEX Humanoid — Telegram bot
   ---------------------------------------------------------------------------
   Do modes:

     1) POLLING (default)  — kisi bhi always-on Node host pe chalta hai
                             (Render worker, VPS, Termux on Android)
          TELEGRAM_BOT_TOKEN=123:ABC npx tsx telegram.ts

     2) WEBHOOK            — same Express server jo app serve karta hai,
                             usi pe /telegram/webhook route
          TELEGRAM_BOT_TOKEN=123:ABC
          TELEGRAM_WEBHOOK_SECRET=random-string
          (server.ts khud route laga deta hai — telegram.ts import hota hai)

   Env:
     TELEGRAM_BOT_TOKEN        required  — @BotFather se
     TELEGRAM_WEBHOOK_SECRET   optional  — webhook mode me security ke liye
     TELEGRAM_ALLOWED_CHATS    optional  — comma separated chat ids (lock bot to you)
     TELEGRAM_MODE             optional  — "poll" (default) | "webhook"
     APP_URL                   optional  — humanoid app ka URL (default http://127.0.0.1:PORT)
     GEMINI_API_KEY / OPENAI_API_KEY    optional — AI brain
     ELEVENLABS_API_KEY        optional  — voice replies
   --------------------------------------------------------------------------- */

type TgUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; first_name?: string; username?: string; type: string };
    from?: { id: number; first_name?: string; username?: string };
    text?: string;
    voice?: { file_id: string; duration: number };
    audio?: { file_id: string };
  };
};

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API = `https://api.telegram.org/bot${TOKEN}`;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
/** Read at call time so a host can inject env after module load. */
const allowedChats = () =>
  (process.env.TELEGRAM_ALLOWED_CHATS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const APP_URL = (process.env.APP_URL || `http://127.0.0.1:${process.env.PORT || 3000}`).replace(/\/$/, '');
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const EL_KEY = process.env.ELEVENLABS_API_KEY || '';
const EL_VOICE = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';

const voiceOn = new Set<number>();

const SYSTEM_PROMPT =
  'You are APEX, a compact personal assistant living inside a particle humanoid. ' +
  'Reply in the language the user writes in (Hindi, Hinglish and English all fine). ' +
  'Be concise: under 60 words unless asked for detail. No markdown tables, no emoji spam.';

/* ------------------------------- Telegram API ------------------------------ */

async function tg(method: string, body: Record<string, unknown> = {}) {
  try {
    const r = await fetch(`${API}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return (await r.json()) as any;
  } catch {
    return { ok: false };
  }
}

const send = (chat_id: number, text: string, extra: Record<string, unknown> = {}) =>
  tg('sendMessage', {
    chat_id,
    text,
    disable_web_page_preview: true,
    parse_mode: 'HTML',
    ...extra,
  });

/** Telegram ka HTML parse fail ho to plain text me dobara bhejo. */
async function safeSend(chat_id: number, text: string, extra: Record<string, unknown> = {}) {
  const r = await send(chat_id, text, extra);
  if (r && r.ok === false && /parse/i.test(String(r.description || ''))) {
    return send(chat_id, text.replace(/<[^>]+>/g, ''), { ...extra, parse_mode: undefined });
  }
  return r;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ------------------------------- AI brain --------------------------------- */

async function askGemini(text: string, history: { role: string; text: string }[] = []): Promise<string> {
  const models = [process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash'].filter(Boolean) as string[];
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
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
          }),
        }
      );
      if (!r.ok) {
        lastErr = `gemini ${r.status}`;
        continue;
      }
      const j: any = await r.json();
      const out = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
      if (out.trim()) return out.trim();
      lastErr = 'gemini empty';
    } catch (e: any) {
      lastErr = e?.message || 'gemini error';
    }
  }
  throw new Error(lastErr || 'gemini failed');
}

async function askOpenAI(text: string, history: { role: string; text: string }[] = []): Promise<string> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.slice(-8).map((h) => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
        { role: 'user', content: text },
      ],
      max_tokens: 400,
      temperature: 0.7,
    }),
  });
  if (!r.ok) throw new Error(`openai ${r.status}`);
  const j: any = await r.json();
  return j.choices[0].message.content.trim();
}

/* --------------------------- per-chat memory ------------------------------ */
const memory = new Map<number, { role: string; text: string }[]>();

function remember(chatId: number, role: string, text: string) {
  const h = memory.get(chatId) || [];
  h.push({ role, text });
  memory.set(chatId, h.slice(-10));
}

async function think(text: string, chatId: number): Promise<string> {
  const history = memory.get(chatId) || [];

  // 1) Prefer the app's own brain (it knows the current model names + fallbacks)
  if (GEMINI_KEY || OPENAI_KEY) {
    try {
      const r = await fetch(`${APP_URL}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, history }),
        signal: AbortSignal.timeout(25000),
      });
      if (r.ok) {
        const j: any = await r.json();
        if (j && typeof j.text === 'string' && j.text.trim()) return j.text.trim();
      }
    } catch {
      /* app not reachable — fall through to direct API */
    }
    try {
      if (GEMINI_KEY) return await askGemini(text, history);
      if (OPENAI_KEY) return await askOpenAI(text, history);
    } catch (e: any) {
      return `⚠️ AI error: ${esc(e.message)}\nAPI key / quota check karo.`;
    }
  }

  return (
    'Abhi koi AI key set nahi hai, isliye main sirf built-in commands chala sakta hoon.\n\n' +
    '<b>Kaise theek karo:</b>\n' +
    'Host → Environment → <code>GEMINI_API_KEY=...</code> daalo → redeploy.\n\n' +
    'Ya <code>/help</code> likho — jo bina key ke chalta hai wo dikha dunga.'
  );
}

/* ------------------------- humanoid app control --------------------------- */

async function appCmd(payload: Record<string, unknown>): Promise<{ ok: boolean; msg: string }> {
  try {
    const r = await fetch(`${APP_URL}/cmd`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { ok: false, msg: `app ${r.status}` };
    const j: any = await r.json();
    return { ok: !!j?.ok, msg: j?.ok ? `queued #${j.seq}` : 'rejected' };
  } catch {
    return { ok: false, msg: 'app offline' };
  }
}

async function appState(): Promise<any | null> {
  try {
    const r = await fetch(`${APP_URL}/state`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function appHealth(): Promise<any | null> {
  try {
    const r = await fetch(`${APP_URL}/health`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/* ------------------------------ voice reply ------------------------------- */

async function sendVoiceReply(chat_id: number, text: string): Promise<boolean> {
  if (!EL_KEY) return false;
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE}/stream?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'xi-api-key': EL_KEY, accept: 'audio/mpeg' },
      body: JSON.stringify({
        text: text.slice(0, 900),
        model_id: process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.45, similarity_boost: 0.75 },
      }),
    });
    if (!r.ok) return false;
    const buf = Buffer.from(await r.arrayBuffer());
    const form = new FormData();
    form.append('chat_id', String(chat_id));
    form.append('voice', new Blob([buf], { type: 'audio/mpeg' }), 'reply.mp3');
    const up = await fetch(`${API}/sendVoice`, { method: 'POST', body: form });
    return up.ok;
  } catch {
    return false;
  }
}

/* -------------------------------- helpers --------------------------------- */

const HELP = `<b>APEX Humanoid — Telegram</b>

<b>Baatein</b>
Kuch bhi likho — AI jawab dega (key hone par)
/voice on | off — voice reply (ElevenLabs)
/clear — memory reset

<b>Humanoid control</b> (server chalu ho to)
/say &lt;text&gt; — page bole
/mood &lt;idle|listening|thinking|speaking|happy|excited|sad|angry|surprised|calm|neutral&gt;
/avatar &lt;nova|astra|unit7|kaze|vega&gt;
/theme &lt;cyan|violet|mint|amber&gt;
/state — app ka current state

<b>Status</b>
/status — bot + app health
/whoami — tumhara chat id
/help — ye list

<i>Tip: \`/say\` me Hindi bhi chalega.</i>`;

function isAllowed(chatId: number): boolean {
  const list = allowedChats();
  if (!list.length) return true; // open bot
  return list.includes(String(chatId));
}

/* ------------------------------ the handler ------------------------------- */

export async function handleUpdate(u: TgUpdate): Promise<void> {
  const msg = u.message;
  if (!msg) return;

  const chatId = msg.chat.id;
  if (!isAllowed(chatId)) {
    await safeSend(chatId, `🔒 Ye bot private hai.\nTumhara chat id: <code>${chatId}</code>\nOwner ko bolo ye id add kare.`);
    return;
  }

  const raw = (msg.text || '').trim();

  /* -------- voice notes: transcribe only if OpenAI key exists -------- */
  if (msg.voice || msg.audio) {
    if (!OPENAI_KEY) {
      await safeSend(chatId, '🎙 Voice note mila, par transcribe karne ke liye <code>OPENAI_API_KEY</code> chahiye.\nText me likh do.');
      return;
    }
    const text = await transcribe((msg.voice || msg.audio)!.file_id);
    if (!text) {
      await safeSend(chatId, '🎙 Transcribe fail hua. Text me likh do.');
      return;
    }
    await safeSend(chatId, `🎙 <i>${esc(text)}</i>`);
    const reply = await think(text, chatId);
    remember(chatId, 'user', text);
    remember(chatId, 'model', reply);
    await safeSend(chatId, esc(reply));
    if (voiceOn.has(chatId)) await sendVoiceReply(chatId, reply);
    return;
  }

  if (!raw) return;

  /* ------------------------------ commands ------------------------------ */

  if (raw === '/start' || raw === '/help' || /^\/start@/.test(raw)) {
    return void (await safeSend(chatId, HELP));
  }

  if (raw === '/whoami') {
    return void (await safeSend(
      chatId,
      `chat id: <code>${chatId}</code>\nname: ${esc(msg.from?.first_name || '—')}\nusername: @${esc(msg.from?.username || '—')}`
    ));
  }

  if (raw === '/clear') {
    memory.delete(chatId);
    return void (await safeSend(chatId, '🧹 Memory clear ho gayi.'));
  }

  if (raw.startsWith('/voice')) {
    const on = /on|chalu|yes|true/i.test(raw);
    on ? voiceOn.add(chatId) : voiceOn.delete(chatId);
    return void (await safeSend(
      chatId,
      `🔊 Voice replies <b>${on ? 'ON' : 'OFF'}</b>` + (on && !EL_KEY ? '\n⚠️ par ELEVENLABS_API_KEY set nahi hai' : '')
    ));
  }

  if (raw === '/status') {
    await tg('sendChatAction', { chat_id: chatId, action: 'typing' });
    const h = await appHealth();
    const s = await appState();
    const lines = [
      '<b>Bot</b>',
      `uptime: ${Math.round(process.uptime())}s`,
      `brain: ${GEMINI_KEY ? 'gemini' : OPENAI_KEY ? 'openai' : 'local only'}`,
      `voice: ${EL_KEY ? (voiceOn.has(chatId) ? 'elevenlabs (on)' : 'elevenlabs (off)') : 'not configured'}`,
      `app url: <code>${esc(APP_URL)}</code>`,
      '',
      '<b>Humanoid app</b>',
      h ? `status: ${esc(String(h.status))}\nmodel: ${esc(String(h.model || '—'))}` : '❌ reachable nahi',
      s ? `mood: ${esc(String(s.mood || '—'))}\navatar: ${esc(String(s.avatar || '—'))}` : '',
    ];
    return void (await safeSend(chatId, lines.filter(Boolean).join('\n')));
  }

  const say = raw.match(/^\/say(?:@\w+)?\s+([\s\S]+)/i);
  if (say) {
    const r = await appCmd({ say: say[1].trim().slice(0, 300) });
    return void (await safeSend(chatId, `🗣 ${esc(say[1].trim())}\n<i>${esc(r.msg)}</i>`));
  }

  const mood = raw.match(/^\/mood(?:@\w+)?\s+(\w+)/i);
  if (mood) {
    const r = await appCmd({ mood: mood[1].toLowerCase() });
    return void (await safeSend(chatId, `🎭 mood → <b>${esc(mood[1].toLowerCase())}</b>\n<i>${esc(r.msg)}</i>`));
  }

  const avatar = raw.match(/^\/avatar(?:@\w+)?\s+(\w+)/i);
  if (avatar) {
    const r = await appCmd({ avatar: avatar[1].toLowerCase() });
    return void (await safeSend(chatId, `◈ avatar → <b>${esc(avatar[1].toLowerCase())}</b>\n<i>${esc(r.msg)}</i>`));
  }

  const theme = raw.match(/^\/theme(?:@\w+)?\s+(\w+)/i);
  if (theme) {
    const r = await appCmd({ theme: theme[1].toLowerCase() });
    return void (await safeSend(chatId, `🎨 theme → <b>${esc(theme[1].toLowerCase())}</b>\n<i>${esc(r.msg)}</i>`));
  }

  if (/^\/state(?:@\w+)?$/.test(raw)) {
    const s = await appState();
    if (!s) return void (await safeSend(chatId, '❌ App reachable nahi. Pehle server chalu karo.'));
    return void (await safeSend(chatId, `<pre>${esc(JSON.stringify(s, null, 2).slice(0, 3000))}</pre>`));
  }

  /* ------------------------- free text → AI ------------------------- */
  await tg('sendChatAction', { chat_id: chatId, action: 'typing' });
  const reply = await think(raw, chatId);
  remember(chatId, 'user', raw);
  remember(chatId, 'model', reply);
  await safeSend(chatId, esc(reply));
  if (voiceOn.has(chatId)) {
    const ok = await sendVoiceReply(chatId, reply);
    if (!ok) await safeSend(chatId, '<i>(voice reply fail — key check karo)</i>');
  }
}

async function transcribe(fileId: string): Promise<string | null> {
  try {
    const f = await tg('getFile', { file_id: fileId });
    const p = f?.result?.file_path;
    if (!p) return null;
    const bin = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${p}`);
    const buf = Buffer.from(await bin.arrayBuffer());
    const form = new FormData();
    form.append('file', new Blob([buf], { type: 'audio/ogg' }), 'note.ogg');
    form.append('model', 'whisper-1');
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { authorization: `Bearer ${OPENAI_KEY}` },
      body: form,
    });
    if (!r.ok) return null;
    return ((await r.json()) as any).text || null;
  } catch {
    return null;
  }
}

/* --------------------------- webhook entrypoint --------------------------- */

/** Express route handler — server.ts mounts this at POST /telegram/webhook */
export async function webhookHandler(req: any, res: any) {
  // Telegram sends this header when a secret is configured
  if (SECRET) {
    const got = req.get?.('x-telegram-bot-api-secret-token');
    if (got !== SECRET) return res.status(401).json({ ok: false });
  }
  res.status(200).json({ ok: true }); // answer fast, then process
  try {
    await handleUpdate(req.body as TgUpdate);
  } catch (e: any) {
    console.error('[telegram] handler error:', e?.message);
  }
}

/* ------------------------------ polling loop ------------------------------ */

export async function startPolling() {
  if (!TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN missing — @BotFather se token lo, phir .env me daalo');
    process.exit(1);
  }
  // Drop any existing webhook so getUpdates works
  await tg('deleteWebhook', { drop_pending_updates: false });

  const me = await tg('getMe');
  if (me?.ok) {
    console.log(`🤖 Telegram bot up: @${me.result.username} (${me.result.first_name})`);
  } else {
    console.error('❌ Invalid TELEGRAM_BOT_TOKEN —', me?.description || 'unknown error');
    process.exit(1);
  }
  console.log(`   brain: ${GEMINI_KEY ? 'gemini' : OPENAI_KEY ? 'openai' : 'local only'} · voice: ${EL_KEY ? 'elevenlabs' : 'off'} · ${allowedChats().length ? 'locked to ' + allowedChats().join(',') : 'open to everyone'}`);

  let offset = 0;
  const loop = async () => {
    try {
      const r = await fetch(`${API}/getUpdates?timeout=50&offset=${offset}`, {
        signal: AbortSignal.timeout(60000),
      });
      const j: any = await r.json();
      for (const u of j?.result || []) {
        offset = Math.max(offset, u.update_id + 1);
        handleUpdate(u).catch((e) => console.error('[telegram] handler', e?.message));
      }
    } catch (e: any) {
      if (!/abort|timeout/i.test(`${e?.name} ${e?.message}`)) console.error('[telegram] poll', e?.message);
    }
    setTimeout(loop, 500);
  };
  loop();
}

/* ------------------------------ CLI entry -------------------------------- */

const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /telegram\.(ts|js)$/.test(process.argv[1] || '');

if (isDirectRun) {
  startPolling();
}
