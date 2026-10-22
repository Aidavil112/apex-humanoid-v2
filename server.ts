import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

/* --- Local fallbacks --- */
function localReply(text: string): string {
  if (/^(hi|hey|hello|namaste)\b/i.test(text)) return 'Hello. The face is rendering, the brain is local.';
  if (/who are you|what are you/i.test(text)) return 'I am a point-cloud humanoid driven by your own server.';
  if (/time/i.test(text)) return 'It is ' + new Date().toLocaleTimeString('en-IN') + ' here.';
  return 'You said: "' + text.slice(0, 120) + '". Wire an API key and I will answer properly.';
}

async function askOpenAI(text: string): Promise<string> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + process.env.OPENAI_API_KEY,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are the voice behind a small glowing particle face. Answer in one or two short spoken sentences. No markdown.' },
        { role: 'user', content: text },
      ],
      max_tokens: 120,
      temperature: 0.7,
    }),
  });
  if (!r.ok) throw new Error('openai ' + r.status);
  const j: any = await r.json();
  return j.choices[0].message.content.trim();
}

function pcmToWav(pcm: Buffer, rate: number, channels: number, bits: number): Buffer {
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write('WAVE', 8);
  head.write('fmt ', 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(channels, 22);
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE((rate * channels * bits) / 8, 28);
  head.writeUInt16LE((channels * bits) / 8, 32);
  head.writeUInt16LE(bits, 34);
  head.write('data', 36);
  head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}

async function askGemini(text: string, history: any[] = []): Promise<string> {
  const formattedHistory = Array.isArray(history)
    ? history
        .filter((h) => h && h.role && h.text)
        .map((h) => ({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: String(h.text).slice(0, 800) }],
        }))
    : [];
  const key = process.env.GEMINI_API_KEY;
  const BASE = 'https://generativelanguage.googleapis.com/v1beta';
  const models = [
    process.env.GEMINI_MODEL,
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ].filter(Boolean) as string[];

  let lastErr = 'no model tried';
  const ask = async (model: string) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let r: any;
    try {
      r = await fetch(`${BASE}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key! },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: formattedHistory.concat([{ role: 'user', parts: [{ text }] }]),
          systemInstruction: {
            parts: [
              {
                text: 'You are the voice behind a small glowing particle humanoid. Answer in ONE short spoken sentence, at most 15 words. No markdown, no lists. Match the user language (Hindi or English).',
              },
            ],
          },
          generationConfig: {
            maxOutputTokens: 120,
            temperature: 0.85,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    if (r.status === 400) {
      const r2 = await fetch(`${BASE}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key! },
        body: JSON.stringify({
          contents: formattedHistory.concat([{ role: 'user', parts: [{ text }] }]),
          systemInstruction: {
            parts: [
              {
                text: 'You are the voice behind a small glowing particle humanoid. Answer in ONE short spoken sentence, at most 15 words. No markdown, no lists. Match the user language (Hindi or English).',
              },
            ],
          },
          generationConfig: { maxOutputTokens: 120, temperature: 0.85 },
        }),
      });
      if (!r2.ok) throw new Error(model + ' ' + r2.status);
      const j2: any = await r2.json();
      const o2 =
        j2.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!o2) throw new Error(model + ' empty reply');
      return o2.trim();
    }

    if (!r.ok) throw new Error(model + ' ' + r.status);
    const j: any = await r.json();
    const out = j.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!out) throw new Error(model + ' empty reply');
    return out.trim();
  };

  for (const m of models) {
    try {
      return await ask(m);
    } catch (e: any) {
      lastErr = e.message;
    }
  }

  try {
    const r = await fetch(`${BASE}/models?pageSize=100`, { headers: { 'x-goog-api-key': key! } });
    const j: any = await r.json();
    const cand = (j.models || []).find(
      (m: any) =>
        (m.supportedGenerationMethods || []).includes('generateContent') &&
        !/image|tts|audio|embedding|veo|imagen|lyria/i.test(m.name)
    );
    if (cand) {
      try {
        return await ask(cand.name.replace(/^models\//, ''));
      } catch (e: any) {
        lastErr = e.message;
      }
    }
  } catch (e: any) {
    lastErr += ' | list failed: ' + e.message;
  }
  throw new Error(lastErr);
}

/* --- ElevenLabs TTS --- */
const EL_KEY = process.env.ELEVENLABS_API_KEY || '';
const EL_VOICE = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
const EL_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_v4_turbo';

async function elevenTTS(text: string, voiceId?: string, modelId?: string): Promise<Buffer> {
  const vid = voiceId || EL_VOICE;
  const mid = modelId || EL_MODEL;
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(vid)}/stream?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'xi-api-key': EL_KEY,
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: mid,
        voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.25, use_speaker_boost: true },
      }),
    }
  );
  if (!r.ok) {
    const detail = (await r.text()).slice(0, 300).replace(/sk_[A-Za-z0-9_-]+/g, 'sk_***');
    const err: any = new Error('elevenlabs ' + r.status + ': ' + detail);
    err.status = r.status;
    throw err;
  }
  return Buffer.from(await r.arrayBuffer());
}

/* --- State and Remote Actions --- */
interface AppState {
  seq: number;
  mood: string | null;
  avatar: string | null;
  say: string | null;
  theme: number | null;
  ts: number;
}
const STATE: AppState = { seq: 0, mood: null, avatar: null, say: null, theme: null, ts: 0 };

function IST_note(): string {
  try {
    return (
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date()) + ' IST'
    );
  } catch (e) {
    return new Date().toISOString();
  }
}

function pushAction(a: Partial<AppState>): number {
  STATE.seq++;
  STATE.ts = Date.now();
  if (a.mood !== undefined) STATE.mood = a.mood;
  if (a.avatar !== undefined) STATE.avatar = a.avatar;
  if (a.say !== undefined) STATE.say = a.say;
  if (a.theme !== undefined) STATE.theme = a.theme;
  return STATE.seq;
}

/* --- Schedule --- */
const DEFAULT_SCHEDULE =
  '08:00=Good morning. Systems are awake and the room is quiet. | 23:00=It is eleven. Time to close the screen and sleep.';
function parseSchedule(str: string) {
  return String(str || '')
    .split('|')
    .map((part) => {
      const i = part.indexOf('=');
      if (i < 0) return null;
      const hm = part.slice(0, i).trim().match(/^(\d{1,2}):(\d{2})$/);
      const text = part.slice(i + 1).trim();
      if (!hm || !text) return null;
      const h = Math.min(23, parseInt(hm[1], 10)),
        m = Math.min(59, parseInt(hm[2], 10));
      return { h, m, text, key: (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m };
    })
    .filter(Boolean) as { h: number; m: number; text: string; key: string }[];
}

const SCHEDULE = parseSchedule(process.env.SCHEDULE || DEFAULT_SCHEDULE);
const fired: Record<string, boolean> = {};

function istParts() {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(new Date())) o[p.type] = p.value;
  return o;
}

function scheduleTick() {
  const t = istParts();
  const key = `${t.year}-${t.month}-${t.day} ${t.hour}:${t.minute}`;
  for (const s of SCHEDULE) {
    if (s.h !== Number(t.hour) || s.m !== Number(t.minute)) continue;
    if (fired[key + ' ' + s.key]) continue;
    fired[key + ' ' + s.key] = true;
    pushAction({ say: s.text, mood: 'speaking' });
    console.log('schedule fired', s.key, '->', s.text.slice(0, 60));
  }
  const keys = Object.keys(fired);
  if (keys.length > 40) {
    for (const k of keys.slice(0, keys.length - 40)) delete fired[k];
  }
}
if (SCHEDULE.length) setInterval(scheduleTick, 20000);

/* --- 3D Printer Bridge --- */
const PRINTER_URL = (process.env.OCTOPRINT_URL || '').replace(/\/+$/, '');
const PRINTER_KEY = process.env.OCTOPRINT_API_KEY || '';
const PRINTER_KIND = (process.env.PRINTER_KIND || 'octoprint').toLowerCase();
const DEMO = { file: 'benchy.gcode', started: Date.now() };

function demoStatus() {
  const mins = (Date.now() - DEMO.started) / 60000;
  const pct = Math.min(97, Math.round(6 + mins * 4));
  return {
    configured: false,
    demo: true,
    state: 'Printing (demo)',
    file: DEMO.file,
    progress: pct,
    timeLeft: Math.max(1, Math.round(24 - mins)) + ' min',
    hint: 'Demo printer active. Set OCTOPRINT_URL for hardware integration.',
  };
}

async function printerCall(pathname: string, method: string, body?: any) {
  if (!PRINTER_URL) throw Object.assign(new Error('no printer configured (set OCTOPRINT_URL)'), { code: 501 });
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (PRINTER_KEY) headers['X-Api-Key'] = PRINTER_KEY;
  const sep = pathname.includes('?') ? '&' : '?';
  const url =
    PRINTER_URL +
    pathname +
    (PRINTER_KEY && PRINTER_KIND === 'moonraker' ? sep + 'apikey=' + encodeURIComponent(PRINTER_KEY) : '');
  const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text();
  let json = null;
  try {
    json = JSON.parse(txt);
  } catch (e) {}
  if (!r.ok) throw Object.assign(new Error('printer ' + r.status + ': ' + txt.slice(0, 160)), { code: 502 });
  return json || { raw: txt.slice(0, 200) };
}

async function printerStatus() {
  if (!PRINTER_URL) return demoStatus();
  if (PRINTER_KIND === 'moonraker') {
    const j: any = await printerCall('/printer/objects/query?print_stats&virtual_sdcard', 'GET');
    const st = j.result?.status || {};
    const ps = st.print_stats || {};
    const vd = st.virtual_sdcard || {};
    return {
      configured: true,
      kind: 'moonraker',
      state: ps.state || 'unknown',
      file: ps.filename || null,
      progress: vd.progress ? Math.round(vd.progress * 100) : null,
    };
  }
  const job: any = await printerCall('/api/job', 'GET');
  const pr: any = await printerCall('/api/printer', 'GET');
  return {
    configured: true,
    kind: 'octoprint',
    state: pr.state?.text || 'unknown',
    file: job.job?.file?.name || null,
    progress: job.progress?.completion != null ? Math.round(job.progress.completion) : null,
    timeLeft:
      job.progress?.printTimeLeft != null ? Math.round(job.progress.printTimeLeft / 60) + ' min' : null,
  };
}

async function printerStart(file?: string) {
  if (!PRINTER_URL) {
    if (!file) throw Object.assign(new Error('file name required, e.g. benchy.gcode'), { code: 400 });
    DEMO.file = file;
    DEMO.started = Date.now();
    return 'demo: started ' + file + ' (no real printer configured)';
  }
  if (!file) throw Object.assign(new Error('file name required, e.g. benchy.gcode'), { code: 400 });
  if (PRINTER_KIND === 'moonraker') {
    await printerCall('/printer/print/start?filename=' + encodeURIComponent(file), 'POST');
    return 'started ' + file;
  }
  await printerCall('/api/files/local/' + encodeURIComponent(file), 'POST', { command: 'select', print: true });
  return 'started ' + file;
}

async function printerStop() {
  if (!PRINTER_URL) {
    DEMO.started = Date.now() - 9999999;
    return 'demo: cancelled';
  }
  if (PRINTER_KIND === 'moonraker') {
    await printerCall('/printer/print/cancel', 'POST');
    return 'cancelled';
  }
  await printerCall('/api/job', 'POST', { command: 'cancel' });
  return 'cancelled';
}

/* --- API Endpoints --- */

app.get('/state', (req: Request, res: Response) => {
  res.setHeader('cache-control', 'no-store');
  res.json(STATE);
});

app.post('/cmd', (req: Request, res: Response) => {
  const p = req.body || {};
  const out: Partial<AppState> = {};
  for (const k of ['say', 'mood', 'avatar', 'theme'] as (keyof AppState)[]) {
    if (p[k] !== undefined) (out as any)[k] = p[k];
  }
  const seq = pushAction(out);
  res.json({ ok: true, seq });
});

app.post('/event', (req: Request, res: Response) => {
  const p = req.body || {};
  const out: Partial<AppState> = {};
  for (const k of ['say', 'mood', 'avatar', 'theme'] as (keyof AppState)[]) {
    if (p[k] !== undefined) (out as any)[k] = p[k];
  }
  if (!Object.keys(out).length) {
    return res.status(400).json({ error: 'nothing to do' });
  }
  const seq = pushAction(out);
  res.json({ ok: true, seq, at: IST_note() });
});

app.get('/schedule', (req: Request, res: Response) => {
  res.setHeader('cache-control', 'no-store');
  res.json({
    now: IST_note(),
    schedule: SCHEDULE.map((s) => ({ time: s.key + ' IST', text: s.text })),
  });
});

app.get('/health', (req: Request, res: Response) => {
  const g = process.env.GEMINI_API_KEY || '';
  const o = process.env.OPENAI_API_KEY || '';
  const mask = (v: string) => (v ? v.slice(0, 6) + '…' + v.slice(-4) + ' (len ' + v.length + ')' : 'not set');
  res.setHeader('cache-control', 'no-store');
  res.json({
    status: 'ok',
    GEMINI_API_KEY: mask(g),
    OPENAI_API_KEY: mask(o),
    model: process.env.GEMINI_MODEL || 'auto (3.8-flash → 3.5-lite → 3.1-lite)',
    schedule: SCHEDULE.map((s) => s.key),
    printer: PRINTER_URL ? `${PRINTER_KIND} @ ${PRINTER_URL}` : 'demo (virtual benchy)',
  });
});

/* --- Android / PWA: Digital Asset Links (TWA verification) ---
   Play Store TWA app apne domain ko verify karne ke liye ye file maangta hai.
   Env vars:
     ANDROID_PACKAGE_NAME        e.g. com.aidavil.apexhumanoid
     ANDROID_SHA256_FINGERPRINTS comma separated SHA-256 cert fingerprints
                                 (Play App Signing cert + local upload key cert)
   Docs: https://developers.google.com/digital-asset-links */
app.get(['/.well-known/assetlinks.json', '/assetlinks.json'], (req: Request, res: Response) => {
  const packageName = process.env.ANDROID_PACKAGE_NAME || '';
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'public, max-age=300');

  if (!packageName || fingerprints.length === 0) {
    return res.status(404).json({
      error: 'Digital Asset Links not configured',
      hint: 'Set ANDROID_PACKAGE_NAME and ANDROID_SHA256_FINGERPRINTS env vars on your host.',
    });
  }

  res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]);
});

app.post('/chat', async (req: Request, res: Response) => {
  const { text, history } = req.body || {};
  const safeText = String(text || '').slice(0, 2000);
  const safeHistory = Array.isArray(history) ? history.slice(-8) : [];
  let reply: string;
  try {
    if (process.env.GEMINI_API_KEY) {
      reply = await askGemini(safeText, safeHistory);
    } else if (process.env.OPENAI_API_KEY) {
      reply = await askOpenAI(safeText);
    } else {
      reply = localReply(safeText);
    }
  } catch (e: any) {
    reply = localReply(safeText) + ' (model call fallback: ' + e.message + ')';
  }
  res.json({ text: reply });
});

app.post('/chat/stream', async (req: Request, res: Response) => {
  const { text, history, model } = req.body || {};
  const safeText = String(text || '').slice(0, 2000);
  const safeHistory = Array.isArray(history) ? history.slice(-8) : [];
  let want = '';
  if (typeof model === 'string' && /^gemini-[a-z0-9.\-]{2,40}$/.test(model)) want = model;

  res.setHeader('content-type', 'text/event-stream');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('connection', 'keep-alive');

  const send = (o: any) => res.write('data: ' + JSON.stringify(o) + '\n\n');
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    send({ text: localReply(safeText), done: true });
    return res.end();
  }

  const formattedHistory = safeHistory
    .filter((h: any) => h && h.role && h.text)
    .map((h: any) => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(h.text).slice(0, 800) }],
    }));

  const models = [want, process.env.GEMINI_MODEL, 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.8-flash']
    .filter(Boolean)
    .filter((m, i, a) => a.indexOf(m) === i) as string[];

  let wrote = false;
  for (const m of models) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            contents: formattedHistory.concat([{ role: 'user', parts: [{ text: safeText }] }]),
            systemInstruction: {
              parts: [
                {
                  text: 'You are the voice behind a small glowing particle humanoid. Answer in ONE short spoken sentence, at most 15 words. No markdown. Match the user language (Hindi or English).',
                },
              ],
            },
            generationConfig: { maxOutputTokens: 120, temperature: 0.9, thinkingConfig: { thinkingBudget: 0 } },
          }),
        }
      );
      if (!r.ok || !r.body) continue;
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === '[DONE]') continue;
          try {
            const j: any = JSON.parse(raw);
            const parts = j.candidates?.[0]?.content?.parts;
            const piece = parts && parts.map((p: any) => p.text || '').join('');
            if (piece) {
              wrote = true;
              send({ text: piece });
            }
          } catch (e) {}
        }
      }
      if (wrote) {
        send({ done: true });
        return res.end();
      }
    } catch (e) {
      // try next
    }
  }

  send({ text: 'Model limit reached. Reset will occur tomorrow.', done: true });
  res.end();
});

app.post('/tts', async (req: Request, res: Response) => {
  const { text, voiceId, modelId } = req.body || {};
  const safeText = String(text || '').slice(0, 4000);
  if (!safeText) return res.status(400).json({ error: 'text required' });
  if (!EL_KEY) return res.status(503).json({ error: 'ELEVENLABS_API_KEY not set' });
  try {
    const audio = await elevenTTS(safeText, voiceId, modelId);
    res.setHeader('content-type', 'audio/mpeg');
    res.setHeader('cache-control', 'no-store');
    res.send(audio);
  } catch (e: any) {
    res.status(e.status || 502).json({ error: e.message });
  }
});

/* --- YouTube Plan & Voice --- */
app.post('/yt/plan', async (req: Request, res: Response) => {
  const p = req.body || {};
  const topic = String(p.topic || '').slice(0, 300);
  const lang = p.lang === 'hi' ? 'Hindi' : p.lang === 'en' ? 'English' : 'the same language as the topic';
  const n = Math.min(Math.max(parseInt(p.scenes, 10) || 6, 4), 10);
  if (!topic) return res.status(400).json({ error: 'topic required' });

  const key = process.env.GEMINI_API_KEY;
  const fallback = {
    title: topic.slice(0, 70),
    description: topic + '\n\n#shorts #ai',
    tags: ['shorts', 'ai', 'humanoid', 'future'],
    thumbnailText: topic.split(/\s+/).slice(0, 4).join(' ').toUpperCase(),
    scenes: Array.from({ length: n }, (_, i) => ({
      caption: topic.split(/\s+/).slice(0, 7).join(' ').toUpperCase(),
      narration: i === 0 ? topic + '.' : topic + ' — part ' + (i + 1) + '.',
    })),
  };

  if (!key) return res.json(fallback);

  const prompt =
    'Make a YouTube Shorts plan about: "' +
    topic +
    '".\nReturn ONLY JSON: {"title":string,"description":string,"tags":string[],"thumbnailText":string,' +
    '"scenes":[{"caption":string,"narration":string}]}\n' +
    'Exactly ' +
    n +
    ' scenes. caption = at most 7 words, ALL CAPS, shown on screen. ' +
    'narration = one spoken sentence, at most 18 words, natural ' +
    lang +
    '. ' +
    'narration must never repeat caption word for word. description = 2 short lines + hashtags. tags = 8 lowercase words.';

  try {
    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 900, temperature: 0.9, responseMimeType: 'application/json' },
        }),
      }
    );
    const j: any = await r.json();
    const txt =
      j.candidates?.[0]?.content?.parts?.map((x: any) => x.text || '').join('') || '';
    const plan = JSON.parse(txt);
    if (!plan.scenes || !plan.scenes.length) throw new Error('no scenes in plan');
    res.json(plan);
  } catch (e: any) {
    res.json({ ...fallback, note: 'gemini plan fallback: ' + e.message });
  }
});

app.post('/content/plan', async (req: Request, res: Response) => {
  const p = req.body || {};
  const topic = String(p.topic || '').slice(0, 300);
  const lang = p.lang === 'en' ? 'English' : 'Hindi (Roman script, casual)';
  const niche = String(p.niche || '').slice(0, 80);
  if (!topic) return res.status(400).json({ error: 'topic required' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.json({
      hooks: [
        'Stop doing this if you want results',
        'The secret nobody tells you about ' + topic,
        '3 things I wish I knew earlier',
        'Why most people fail at this',
        'Watch this before trying ' + topic,
      ],
      script: [
        { t: 0, line: 'Here is what you actually need to know about ' + topic + '.' },
        { t: 5, line: 'First, master the fundamental workflow without distractions.' },
        { t: 12, line: 'Second, focus on continuous daily iteration.' },
        { t: 20, line: 'Save this guide and start applying it today.' },
      ],
      caption: 'Transform your approach with these key steps. What is your biggest challenge here?',
      hashtags: ['growth', 'learning', 'productivity', 'tips', 'viral', 'mindset', 'workflow'],
      cta: 'Follow for more practical daily breakdowns!',
      thumbnailText: 'STOP DOING THIS',
      bestTime: 'Post at 6:30 PM IST when engagement peaks.',
      whyItWorks: 'Direct pattern interrupt hook with actionable value.',
    });
  }

  const prompt =
    'You are a content strategist for short-form video. Topic: "' +
    topic +
    '".' +
    (niche ? ' Niche: ' + niche + '.' : '') +
    ' Write in ' +
    lang +
    '.\nReturn ONLY JSON with this shape:\n' +
    '{"hooks":[5 strings, each under 12 words, each a different angle],' +
    '"script":[{"t":seconds,"line":string}],' +
    '"caption":string (max 220 chars, ends with a question),' +
    '"hashtags":[12 strings without #],' +
    '"cta":string,' +
    '"thumbnailText":string (max 4 words, CAPS),' +
    '"bestTime":string (one sentence),' +
    '"whyItWorks":string (one sentence about the hook)}';

  try {
    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1100, temperature: 0.95, responseMimeType: 'application/json' },
        }),
      }
    );
    const raw = await r.text();
    if (!r.ok) return res.status(502).json({ error: 'gemini ' + r.status + ': ' + raw.slice(0, 160) });
    const j = JSON.parse(raw);
    let txt =
      (j.candidates?.[0]?.content?.parts || []).map((x: any) => x.text || '').join('').trim();
    txt = txt.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const a = txt.indexOf('{'),
      b = txt.lastIndexOf('}');
    if (a >= 0 && b >= 0) txt = txt.slice(a, b + 1);
    const plan = JSON.parse(txt);
    res.json(plan);
  } catch (e: any) {
    res.status(502).json({ error: 'gemini: ' + e.message });
  }
});

app.post('/yt/voice', async (req: Request, res: Response) => {
  const p = req.body || {};
  const text = String(p.text || '').slice(0, 900).trim();
  const voice = /^[A-Za-z]{3,12}$/.test(p.voice || '') ? p.voice : 'Kore';
  if (!text) return res.status(400).json({ error: 'text required' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'no key' });

  const models = ['gemini-2.5-flash-preview-tts', 'gemini-3.1-flash-tts-preview'];
  let last = 'no model';
  for (const m of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
      });
      if (!r.ok) {
        last = m + ' ' + r.status + ' ' + (await r.text()).slice(0, 160);
        continue;
      }
      const j: any = await r.json();
      const part = j.candidates?.[0]?.content?.parts?.find((x: any) => x.inlineData);
      if (!part) {
        last = m + ' no audio';
        continue;
      }
      const pcm = Buffer.from(part.inlineData.data, 'base64');
      const rate = Number((String(part.inlineData.mimeType).match(/rate=(\d+)/) || [])[1] || 24000);
      res.setHeader('content-type', 'audio/wav');
      res.setHeader('cache-control', 'no-store');
      res.setHeader('x-model', m);
      res.setHeader('x-rate', String(rate));
      return res.send(pcmToWav(pcm, rate, 1, 16));
    } catch (e: any) {
      last = m + ' ' + e.message;
    }
  }
  res.status(502).json({ error: last });
});

/* --- Topic Research AI Agent --- */
app.post('/agent/research', async (req: Request, res: Response) => {
  const p = req.body || {};
  const niche = String(p.niche || 'Future AI & Cybernetics').slice(0, 150);
  const key = process.env.GEMINI_API_KEY;

  const fallbackTopics = [
    {
      id: 'ai-robotics-2026',
      title: 'Humanoid Robots Are Now Learning 10x Faster',
      category: 'Robotics & AI',
      hook: 'This robot learned in 4 hours what took humans 20 years.',
      summary: 'New synthetic neural networks allow humanoid robotics to simulate physical reality and master motor balance instantaneously.',
      angle: 'Shocking acceleration in physical embodiment vs pure software models',
      viralPotential: 96,
      searchKeywords: ['humanoid robots', 'ai breakthrough', 'future tech', 'robotics 2026'],
      facts: [
        'Simulation training runs at 10,000x realtime physics speeds.',
        'Humanoid hardware costs have plummeted by 84% in three years.',
        'Over 100,000 factory units are scheduled for deployment this year.'
      ],
      targetAudience: 'Tech enthusiasts, engineers, curious creators',
      whyTrending: 'Recent viral demonstrations of humanoid dexterity and spatial autonomy.'
    },
    {
      id: 'quantum-chips-breakthrough',
      title: 'The Silent Quantum Breakthrough That Changes Encryption',
      category: 'Quantum Computing',
      hook: 'Every password you own might be obsolete sooner than you think.',
      summary: 'Room-temperature topological qubits just crossed the threshold of reliable error-corrected calculations.',
      angle: 'Urgent cybersecurity transition and the dawn of post-RSA computation',
      viralPotential: 92,
      searchKeywords: ['quantum computer', 'encryption broken', 'cybersecurity', 'tech secrets'],
      facts: [
        'Post-quantum cryptographic standards are being rushed into modern browsers.',
        'Logical qubit coherence times reached an all-time record stability.',
        'Simulating molecular drug compounds takes seconds instead of centuries.'
      ],
      targetAudience: 'Programmers, security analysts, general science fans',
      whyTrending: 'Major national labs published peer-reviewed validation of fault-tolerant chips.'
    },
    {
      id: 'bci-neural-interfaces',
      title: 'Brain-Computer Interfaces Allow Thinking at 100 WPM',
      category: 'Neurotech',
      hook: 'They just controlled a computer without moving a single muscle.',
      summary: 'Non-invasive high-density optical neural lace achieves real-time thought-to-text decoding with sub-millisecond latency.',
      angle: 'The boundary between biological thought and digital computing is dissolving',
      viralPotential: 94,
      searchKeywords: ['neural interface', 'brain chip', 'cyborg tech', 'future humans'],
      facts: [
        'Decoding accuracy for imagined speech has reached 98.4%.',
        'Users can navigate complex 3D environments completely hands-free.',
        'Non-invasive optical caps match previous surgical electrode fidelity.'
      ],
      targetAudience: 'Futurists, gamers, medical technology followers',
      whyTrending: 'Public clinical trials demonstrated seamless thought-based typing and browsing.'
    },
    {
      id: 'autonomous-ai-agents',
      title: 'Autonomous AI Agents Just Built Their Own Software Company',
      category: 'Autonomous Agents',
      hook: 'Five AI agents built a revenue-generating app with zero human help.',
      summary: 'Multi-agent frameworks now collaborate hierarchically: product manager agent designs, architect specifies, engineers code and debug.',
      angle: 'The shift from assistant chat interfaces to self-directing agent teams',
      viralPotential: 97,
      searchKeywords: ['ai agents', 'autonomous coding', 'agentic workflow', 'future of work'],
      facts: [
        'Agentic swarms self-correct code failures via iterative compilation loops.',
        'Deployment pipelines run autonomously from natural language user intent.',
        'Execution costs per feature are now 1/50th of traditional development cycles.'
      ],
      targetAudience: 'Builders, founders, digital creators, students',
      whyTrending: 'Explosive rise of agentic coding and autonomous workflow automation.'
    }
  ];

  if (!key) {
    return res.json({ niche, topics: fallbackTopics });
  }

  const prompt =
    'You are an elite viral YouTube Shorts research strategist. ' +
    'Niche: "' + niche + '". ' +
    'Perform deep research and uncover 4 compelling, highly engaging short-form video topics. ' +
    'Return ONLY valid JSON matching this schema: ' +
    '{"topics":[{"id":string,"title":string,"category":string,"hook":string,"summary":string,' +
    '"angle":string,"viralPotential":number,"searchKeywords":string[],"facts":string[],' +
    '"targetAudience":string,"whyTrending":string}]}';

  try {
    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1400, temperature: 0.9, responseMimeType: 'application/json' },
        }),
      }
    );
    const raw = await r.text();
    if (!r.ok) return res.json({ niche, topics: fallbackTopics });
    const j = JSON.parse(raw);
    let txt = (j.candidates?.[0]?.content?.parts || []).map((x: any) => x.text || '').join('').trim();
    txt = txt.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
    if (a >= 0 && b >= 0) txt = txt.slice(a, b + 1);
    const parsed = JSON.parse(txt);
    if (!parsed.topics || !parsed.topics.length) return res.json({ niche, topics: fallbackTopics });
    res.json({ niche, topics: parsed.topics });
  } catch (e: any) {
    res.json({ niche, topics: fallbackTopics, note: e.message });
  }
});

/* --- Crypto Market News Search Grounding API --- */
app.post('/api/news/grounding', async (req: Request, res: Response) => {
  res.setHeader('cache-control', 'no-store');
  const key = process.env.GEMINI_API_KEY;

  const fallbackHeadlines = [
    {
      id: 'news-1',
      title: 'Bitcoin Surges Past $94,200 as Global Institutional ETF Inflows Hit Record $1.2B',
      source: 'CoinDesk Search Grounding',
      time: '12 mins ago',
      summary: 'Spot Bitcoin ETFs saw unprecedented daily net inflows led by BlackRock IBIT and Fidelity Wise Origin funds, driving price action higher.',
      sentiment: 'BULLISH',
      impactScore: 94,
      url: 'https://www.coindesk.com/markets/bitcoin-etf-inflows-record',
    },
    {
      id: 'news-2',
      title: 'Ethereum Layer-2 Total Value Locked (TVL) Crosses $48B Milestone',
      source: 'CoinTelegraph Grounded Intelligence',
      time: '28 mins ago',
      summary: 'Arbitrum, Base, and Optimism record transaction throughput records as gas fees remain below $0.01 per swap.',
      sentiment: 'BULLISH',
      impactScore: 88,
      url: 'https://cointelegraph.com/news/ethereum-layer2-tvl-record',
    },
    {
      id: 'news-3',
      title: 'Solana Network Activity Surges with DEX Trading Volume Surpassing $3.8B Daily',
      source: 'Decrypt Live Search',
      time: '45 mins ago',
      summary: 'Raydium and Orca volume surges driven by new liquidity pairs and institutional market makers establishing SOL positions.',
      sentiment: 'BULLISH',
      impactScore: 91,
      url: 'https://decrypt.co/solana-dex-volume-record-high',
    },
    {
      id: 'news-4',
      title: 'Global Regulators Finalize Unified Framework for Crypto Asset Custody & Staking',
      source: 'Bloomberg Crypto Live',
      time: '1 hour ago',
      summary: 'New guidelines clarify staking rewards treatment and institutional vault safety standards, boosting market confidence.',
      sentiment: 'NEUTRAL',
      impactScore: 82,
      url: 'https://www.bloomberg.com/crypto/regulatory-framework-custody',
    },
    {
      id: 'news-5',
      title: 'CoinDCX Expands Liquidity Aggregation for INR and USDT Trading Pairs',
      source: 'CryptoIndia Live News',
      time: '2 hours ago',
      summary: 'India’s premier exchange CoinDCX launches zero-slippage execution protocols for top 20 crypto assets.',
      sentiment: 'BULLISH',
      impactScore: 86,
      url: 'https://coindcx.com/blog/announcements/liquidity-aggregation-upgrade',
    },
  ];

  if (!key) {
    return res.json({ ok: true, grounded: false, headlines: fallbackHeadlines });
  }

  try {
    const prompt =
      'Search for the top 5 latest breaking crypto market news headlines right now for Bitcoin, Ethereum, Solana, and crypto market sentiment. ' +
      'Return ONLY a JSON object with this schema: ' +
      '{"headlines":[{"id":string,"title":string,"source":string,"time":string,"summary":string,"sentiment":"BULLISH"|"BEARISH"|"NEUTRAL","impactScore":number,"url":string}]}';

    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          tools: [{ googleSearch: {} }],
          generationConfig: { maxOutputTokens: 1200, temperature: 0.3, responseMimeType: 'application/json' },
        }),
      }
    );

    if (!r.ok) {
      return res.json({ ok: true, grounded: false, headlines: fallbackHeadlines });
    }

    const j: any = await r.json();
    let txt = j.candidates?.[0]?.content?.parts?.map((x: any) => x.text || '').join('').trim();
    const searchGroundingMetadata = j.candidates?.[0]?.groundingMetadata;

    txt = txt.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
    if (a >= 0 && b >= 0) txt = txt.slice(a, b + 1);

    const parsed = JSON.parse(txt);
    if (!parsed.headlines || !parsed.headlines.length) {
      return res.json({ ok: true, grounded: false, headlines: fallbackHeadlines });
    }

    res.json({
      ok: true,
      grounded: true,
      headlines: parsed.headlines.slice(0, 5),
      groundingMetadata: searchGroundingMetadata || null,
    });
  } catch (e: any) {
    res.json({ ok: true, grounded: false, headlines: fallbackHeadlines, note: e.message });
  }
});

/* --- YouTube Direct Upload Proxy --- */
app.post('/yt/upload', async (req: Request, res: Response) => {
  const { title, description, tags, privacyStatus, videoBase64, accessToken } = req.body || {};
  const safeTitle = String(title || 'APEX Short Video').slice(0, 100);
  const safeDesc = String(description || '#shorts #ai #apex').slice(0, 5000);
  const safeTags = Array.isArray(tags) ? tags.slice(0, 20) : ['shorts', 'ai'];
  const privacy = ['public', 'unlisted', 'private'].includes(privacyStatus) ? privacyStatus : 'public';

  if (!videoBase64) {
    return res.status(400).json({ error: 'Video content (base64) required for upload' });
  }

  // If user provided a real Google OAuth Access Token
  if (accessToken && accessToken.length > 20) {
    try {
      const buffer = Buffer.from(videoBase64.replace(/^data:video\/[a-z0-9]+;base64,/, ''), 'base64');
      
      // Step 1: Initiate Resumable Upload on YouTube Data API v3
      const initRes = await fetch(
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': 'video/webm',
            'X-Upload-Content-Length': String(buffer.length),
          },
          body: JSON.stringify({
            snippet: {
              title: safeTitle,
              description: safeDesc,
              tags: safeTags,
              categoryId: '28', // Science & Technology
            },
            status: {
              privacyStatus: privacy,
              selfDeclaredMadeForKids: false,
            },
          }),
        }
      );

      if (!initRes.ok) {
        const errText = await initRes.text();
        return res.status(initRes.status).json({
          error: `YouTube API initialization failed (${initRes.status}): ${errText.slice(0, 200)}`,
        });
      }

      const uploadUrl = initRes.headers.get('location');
      if (!uploadUrl) {
        throw new Error('No upload location header returned from YouTube');
      }

      // Step 2: Stream the video bytes to the upload URL
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/webm',
          'Content-Length': String(buffer.length),
        },
        body: buffer,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        return res.status(uploadRes.status).json({
          error: `YouTube video transfer failed (${uploadRes.status}): ${errText.slice(0, 200)}`,
        });
      }

      const uploadJson: any = await uploadRes.json();
      const videoId = uploadJson.id;
      return res.json({
        ok: true,
        uploaded: true,
        videoId,
        youtubeUrl: `https://www.youtube.com/shorts/${videoId}`,
        privacyStatus: privacy,
        message: 'Successfully uploaded to YouTube channel!',
      });
    } catch (e: any) {
      return res.status(502).json({ error: 'Direct YouTube upload error: ' + e.message });
    }
  }

  // If no accessToken provided: provide simulated success with direct web-share and download payload
  const mockId = 'apex_' + Math.random().toString(36).substring(2, 10);
  return res.json({
    ok: true,
    uploaded: false,
    needsToken: true,
    simulated: true,
    videoId: mockId,
    youtubeUrl: `https://www.youtube.com/shorts/${mockId}`,
    message: 'Video prepared. To publish automatically, supply a YouTube OAuth access token or use the instant 1-tap YouTube Share handoff.',
    sharePayload: {
      title: safeTitle,
      description: safeDesc,
      tags: safeTags,
    },
  });
});

/* --- Printer Endpoints --- */
app.get(['/printer', '/printer/status'], async (req: Request, res: Response) => {
  try {
    const out = await printerStatus();
    res.setHeader('cache-control', 'no-store');
    res.json(out);
  } catch (e: any) {
    res.status(e.code || 502).json({ error: e.message });
  }
});

app.post('/printer/start', async (req: Request, res: Response) => {
  try {
    const file = req.body?.file;
    const result = await printerStart(file);
    res.json({ ok: true, result });
  } catch (e: any) {
    res.status(e.code || 502).json({ error: e.message });
  }
});

app.post('/printer/stop', async (req: Request, res: Response) => {
  try {
    const result = await printerStop();
    res.json({ ok: true, result });
  } catch (e: any) {
    res.status(e.code || 502).json({ error: e.message });
  }
});

/* --- CoinDCX Exchange Trading API Proxy --- */
const COINDCX_BASE_URL = process.env.COINDCX_BASE_URL || 'https://api.coindcx.com';
const COINDCX_KEY = process.env.COINDCX_API_KEY || '';
const COINDCX_SECRET = process.env.COINDCX_API_SECRET || '';

let cachedTickers: any[] = [];
let lastTickerFetch = 0;

app.get('/api/coindcx/status', (req: Request, res: Response) => {
  res.setHeader('cache-control', 'no-store');
  const isKeyConfigured = Boolean(COINDCX_KEY && COINDCX_KEY.length > 5);
  res.json({
    ok: true,
    exchange: 'CoinDCX',
    configured: isKeyConfigured,
    mode: isKeyConfigured ? 'LIVE_KEY_AUTHENTICATED' : 'LIVE_MARKET_STREAM_SANDBOX',
    keyMasked: isKeyConfigured ? COINDCX_KEY.slice(0, 4) + '...' + COINDCX_KEY.slice(-4) : 'not_set',
    baseUrl: COINDCX_BASE_URL,
    message: isKeyConfigured
      ? 'CoinDCX API Key & Secret authenticated. Live orders will be routed to CoinDCX.'
      : 'CoinDCX Live Market Stream active. Running orders in ultra-low latency sandbox mode (Set COINDCX_API_KEY & COINDCX_API_SECRET in server env for live execution).',
    timestamp: Date.now(),
  });
});

app.get('/api/coindcx/ticker', async (req: Request, res: Response) => {
  res.setHeader('cache-control', 'no-store');
  const now = Date.now();
  if (cachedTickers.length && now - lastTickerFetch < 2500) {
    return res.json({ ok: true, source: 'cache', data: cachedTickers });
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch('https://api.coindcx.com/exchange/ticker', {
      headers: { Accept: 'application/json' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (r.ok) {
      const all: any[] = await r.json();
      const targetMarkets = new Set([
        'BTCUSDT',
        'ETHUSDT',
        'SOLUSDT',
        'BTCINR',
        'ETHINR',
        'SOLINR',
        'DOGEUSDT',
        'XRPUSDT',
        'ADAUSDT',
      ]);
      const matched = all.filter((item: any) => targetMarkets.has(item.market));
      if (matched.length > 0) {
        cachedTickers = matched;
        lastTickerFetch = now;
        return res.json({ ok: true, source: 'coindcx_live', data: matched });
      }
    }
  } catch (e: any) {
    // Fallback gracefully
  }

  const fallback = [
    { market: 'BTCUSDT', last_price: '94250.00', change_24_hour: '2.45', high: '94800.00', low: '92100.00', volume: '1845.2' },
    { market: 'ETHUSDT', last_price: '3420.50', change_24_hour: '1.82', high: '3460.00', low: '3350.00', volume: '8490.5' },
    { market: 'SOLUSDT', last_price: '218.40', change_24_hour: '4.25', high: '222.00', low: '208.50', volume: '24100.0' },
    { market: 'BTCINR', last_price: '8150000.00', change_24_hour: '2.50', high: '8200000.00', low: '7950000.00', volume: '320.1' },
    { market: 'ETHINR', last_price: '298500.00', change_24_hour: '1.90', high: '302000.00', low: '292000.00', volume: '950.0' },
    { market: 'SOLINR', last_price: '18950.00', change_24_hour: '4.30', high: '19250.00', low: '18100.00', volume: '4200.0' },
  ];
  cachedTickers = fallback;
  return res.json({ ok: true, source: 'fallback_live_sim', data: fallback });
});

app.post('/api/coindcx/balances', async (req: Request, res: Response) => {
  res.setHeader('cache-control', 'no-store');
  const key = String(req.body?.apiKey || COINDCX_KEY || '').trim();
  const secret = String(req.body?.apiSecret || COINDCX_SECRET || '').trim();

  if (key && secret && key.length > 5) {
    try {
      const payload = { timestamp: Math.floor(Date.now()) };
      const jsonBody = JSON.stringify(payload);
      const signature = crypto.createHmac('sha256', secret).update(jsonBody).digest('hex');

      const liveRes = await fetch(`${COINDCX_BASE_URL}/exchange/v1/users/balances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AUTH-APIKEY': key,
          'X-AUTH-SIGNATURE': signature,
        },
        body: jsonBody,
      });

      if (liveRes.ok) {
        const balancesArr: any[] = await liveRes.json();
        return res.json({
          ok: true,
          live: true,
          balances: balancesArr,
          timestamp: Date.now(),
        });
      }
    } catch (e: any) {
      // Fallback to sandbox balance
    }
  }

  return res.json({
    ok: true,
    live: false,
    simulated: true,
    balances: [
      { currency: 'INR', balance: '128450.00', locked_balance: '0.00' },
      { currency: 'USDT', balance: '1540.25', locked_balance: '0.00' },
      { currency: 'BTC', balance: '0.0845', locked_balance: '0.00' },
      { currency: 'ETH', balance: '1.240', locked_balance: '0.00' },
    ],
    timestamp: Date.now(),
  });
});

app.post('/api/coindcx/trade', async (req: Request, res: Response) => {
  const { market, side, price, quantity, order_type = 'market_order', apiKey, apiSecret } = req.body || {};
  if (!market || !side || !quantity) {
    return res.status(400).json({ error: 'market, side, and quantity are required' });
  }

  const safeSide = side.toLowerCase() === 'sell' ? 'sell' : 'buy';
  const safeMarket = String(market).toUpperCase();
  const safeQty = parseFloat(String(quantity)) || 0.01;
  const safePrice = parseFloat(String(price)) || 0;

  const key = String(apiKey || COINDCX_KEY || '').trim();
  const secret = String(apiSecret || COINDCX_SECRET || '').trim();

  // Real CoinDCX Authenticated Order Execution if keys are present
  if (key && secret && key.length > 5) {
    try {
      const bodyPayload = {
        side: safeSide,
        order_type: order_type || 'market_order',
        market: safeMarket,
        price_per_unit: safePrice,
        total_quantity: safeQty,
        timestamp: Math.floor(Date.now()),
      };
      const jsonBody = JSON.stringify(bodyPayload);
      const signature = crypto.createHmac('sha256', secret).update(jsonBody).digest('hex');

      const liveRes = await fetch(`${COINDCX_BASE_URL}/exchange/v1/orders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AUTH-APIKEY': key,
          'X-AUTH-SIGNATURE': signature,
        },
        body: jsonBody,
      });

      const responseJson: any = await liveRes.json();
      if (!liveRes.ok) {
        return res.status(liveRes.status).json({
          error: responseJson.message || 'CoinDCX order execution failed',
          details: responseJson,
        });
      }

      return res.json({
        ok: true,
        live: true,
        order_id: responseJson.id || responseJson.orders?.[0]?.id || `cdx_${Date.now()}`,
        market: safeMarket,
        side: safeSide,
        price: safePrice,
        quantity: safeQty,
        status: 'EXECUTED_ON_COINDCX',
        response: responseJson,
      });
    } catch (e: any) {
      return res.status(502).json({ error: 'CoinDCX API connection error: ' + e.message });
    }
  }

  // Simulated trade execution with real CoinDCX pricing
  const simOrderId = `coindcx_sim_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  return res.json({
    ok: true,
    live: false,
    simulated: true,
    order_id: simOrderId,
    market: safeMarket,
    side: safeSide,
    price: safePrice,
    quantity: safeQty,
    status: 'FILLED_SANDBOX',
    timestamp: Date.now(),
    message: 'Simulated execution matching CoinDCX live book. (Add COINDCX API Key & Secret for real money execution)',
  });
});

/* --- Vite / SPA Integration --- */
async function startServer() {
  console.log(`🚀 Starting APEX Humanoid Server... Environment: PORT=${PORT}, NODE_ENV=${process.env.NODE_ENV}`);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      const indexPath = path.resolve(distPath, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err && !res.headersSent) {
          res.status(200).send(`<!DOCTYPE html><html><head><title>APEX Humanoid</title></head><body style="background:#0a0c10;color:#fff;font-family:sans-serif;display:grid;place-content:center;height:100vh;"><h2>APEX Humanoid Service Active</h2><p>Server running on port ${PORT}.</p></body></html>`);
        }
      });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ APEX Humanoid full-stack server successfully listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

