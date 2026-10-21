#!/usr/bin/env tsx
/* ---------------------------------------------------------------------------
   Telegram bot setup helper
   ---------------------------------------------------------------------------
   Usage:
     npx tsx scripts/telegram-setup.ts info
        -> bot ka naam, token valid hai ya nahi

     npx tsx scripts/telegram-setup.ts webhook https://your-app.onrender.com
        -> webhook register karta hai (secret bhi set)

     npx tsx scripts/telegram-setup.ts poll
        -> webhook hata deta hai (polling mode ke liye)

   Env (ya .env se):
     TELEGRAM_BOT_TOKEN        required
     TELEGRAM_WEBHOOK_SECRET   optional (recommended)
   --------------------------------------------------------------------------- */

import 'dotenv/config';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const API = `https://api.telegram.org/bot${TOKEN}`;

if (!TOKEN) {
  console.error(`
❌ TELEGRAM_BOT_TOKEN nahi mila.

Kaise lo (2 minute, phone se bhi):
  1. Telegram kholo -> @BotFather -> /newbot
  2. Naam do (e.g. "APEX Humanoid"), username do (e.g. apex_humanoid_bot)
  3. Token milega: 123456789:AAH...  <- ye copy karo
  4. .env file me daalo:  TELEGRAM_BOT_TOKEN=123456789:AAH...
     (ya host pe: Render -> Environment -> Add Environment Variable)
`);
  process.exit(1);
}

async function call(method: string, body: Record<string, unknown> = {}) {
  const r = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await r.json()) as any;
}

async function main() {
  const cmd = process.argv[2] || 'info';

  if (cmd === 'info') {
    const me = await call('getMe');
    if (!me.ok) {
      console.error('❌ Token invalid:', me.description);
      process.exit(1);
    }
    const wh = await call('getWebhookInfo');
    console.log('✅ Bot: @' + me.result.username + '  (' + me.result.first_name + ')');
    console.log('   id:', me.result.id);
    console.log('   webhook:', wh.result?.url || '(none — polling mode)');
    if (wh.result?.pending_update_count) console.log('   pending updates:', wh.result.pending_update_count);
    if (wh.result?.last_error_message) console.log('   ⚠️ last error:', wh.result.last_error_message);
    return;
  }

  if (cmd === 'webhook') {
    const base = (process.argv[3] || process.env.APP_URL || '').replace(/\/$/, '');
    if (!base) {
      console.error('❌ URL do:  npx tsx scripts/telegram-setup.ts webhook https://your-app.onrender.com');
      process.exit(1);
    }
    const url = `${base}/telegram/webhook`;
    const body: Record<string, unknown> = {
      url,
      allowed_updates: ['message', 'edited_message'],
      drop_pending_updates: true,
    };
    if (SECRET) body.secret_token = SECRET;

    const r = await call('setWebhook', body);
    if (!r.ok) {
      console.error('❌ setWebhook fail:', r.description);
      process.exit(1);
    }
    console.log('✅ Webhook set:', url);
    if (SECRET) console.log('   secret token header: x-telegram-bot-api-secret-token');

    // quick reachability check
    try {
      const h = await fetch(`${base}/telegram`);
      const j: any = await h.json();
      console.log('   server says:', JSON.stringify(j));
    } catch {
      console.log('   ⚠️ server /telegram reachable nahi — deploy hua hai?');
    }
    return;
  }

  if (cmd === 'poll') {
    const r = await call('deleteWebhook', { drop_pending_updates: false });
    console.log(r.ok ? '✅ Webhook hataya — ab polling mode chalega (npx tsx telegram.ts)' : '❌ ' + r.description);
    return;
  }

  console.log('Commands: info | webhook <url> | poll');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
