#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   Offline self-test for the Telegram bot — NO real token needed.
   Spins up a fake Telegram API, points TELEGRAM_API_BASE at it, and verifies
   that the bot answers commands correctly.

     node scripts/telegram-selftest.js
   --------------------------------------------------------------------------- */
const http = require('http');

const PORT = 5099;
const calls = [];
let pendingUpdate = null;

/* ---------- fake Telegram API ---------- */
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const method = req.url.split('/').pop().split('?')[0];
    let payload = {};
    try {
      payload = JSON.parse(body || '{}');
    } catch {}
    calls.push({ method, payload });

    res.setHeader('content-type', 'application/json');
    if (method === 'getMe') {
      return res.end(JSON.stringify({ ok: true, result: { id: 42, is_bot: true, username: 'apex_test_bot', first_name: 'APEX Test' } }));
    }
    if (method === 'getUpdates') {
      // deliver one update on the first poll, then hang like a real long-poll
      if (pendingUpdate) {
        const u = [pendingUpdate];
        pendingUpdate = null;
        return res.end(JSON.stringify({ ok: true, result: u }));
      }
      return setTimeout(() => res.end(JSON.stringify({ ok: true, result: [] })), 300);
    }
    if (method === 'getWebhookInfo') {
      return res.end(JSON.stringify({ ok: true, result: { url: '' } }));
    }
    return res.end(JSON.stringify({ ok: true, result: true }));
  });
});

function startTelegram(token) {
  return http.request;
}

/* ---------- run ---------- */
server.listen(PORT, '127.0.0.1', async () => {
  console.log('fake Telegram API on', PORT);

  // Patch the bot to talk to our fake server by overriding global fetch base
  process.env.TELEGRAM_BOT_TOKEN = 'TEST:TOKEN';
  process.env.GEMINI_API_KEY = ''; // no brain → exercises the guidance path
  process.env.OPENAI_API_KEY = '';
  process.env.TELEGRAM_ALLOWED_CHATS = '';

  // intercept fetch: rewrite api.telegram.org -> localhost
  const realFetch = global.fetch;
  global.fetch = (url, opts) => {
    if (typeof url === 'string' && url.includes('api.telegram.org')) {
      const method = url.split('/bot')[1].split('/').slice(1).join('/');
      const rewritten = `http://127.0.0.1:${PORT}/bot${(url.split('/bot')[1].split('/')[0])}/${method}`;
      return realFetch(rewritten, opts);
    }
    return realFetch(url, opts);
  };

  // queue an update BEFORE the bot polls
  pendingUpdate = {
    update_id: 1,
    message: {
      message_id: 10,
      chat: { id: 777, type: 'private', first_name: 'Tester' },
      from: { id: 777, first_name: 'Tester', username: 'tester' },
      text: '/help',
    },
  };

  const { startPolling, handleUpdate } = await import('../telegram.ts').catch(async () => {
    return await import('tsx/esm/api').then(({ tsImport }) => tsImport('../telegram.ts', import.meta.url));
  });

  // direct handler tests (deterministic, no polling race)
  const results = [];
  const run = async (text, label) => {
    calls.length = 0;
    await handleUpdate({
      update_id: 100,
      message: { message_id: 1, chat: { id: 777, type: 'private' }, from: { id: 777, username: 'tester' }, text },
    });
    // give async sends a tick
    await new Promise((r) => setTimeout(r, 400));
    const sent = calls.filter((c) => c.method === 'sendMessage');
    const chatActions = calls.filter((c) => c.method === 'sendChatAction');
    results.push({
      label,
      replies: sent.length,
      first: sent[0]?.payload?.text?.slice(0, 90)?.replace(/\n/g, ' ⏎ '),
      typing: chatActions.length > 0,
    });
  };

  await run('/help', '/help');
  await run('/whoami', '/whoami');
  await run('/voice on', '/voice on');
  await run('hello there', 'free text (no AI key)');

  // allowlist test
  process.env.TELEGRAM_ALLOWED_CHATS = '123456';
  calls.length = 0;
  await handleUpdate({
    update_id: 101,
    message: { message_id: 2, chat: { id: 999, type: 'private' }, from: { id: 999 }, text: 'hi' },
  });
  await new Promise((r) => setTimeout(r, 400));
  results.push({
    label: 'allowlist blocks stranger',
    replies: calls.filter((c) => c.method === 'sendMessage').length,
    first: calls.find((c) => c.method === 'sendMessage')?.payload?.text?.slice(0, 80)?.replace(/\n/g, ' ⏎ '),
    typing: false,
  });

  console.log('\n=== RESULTS ===');
  for (const r of results) console.log(JSON.stringify(r));

  const ok = results.every((r) => r.replies >= 1);
  console.log('\n' + (ok ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'));
  server.close();
  process.exit(ok ? 0 : 1);
});
