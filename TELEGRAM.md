# APEX Humanoid — Telegram Bot

Do ready-made bots hain. Aapki hosting ke hisaab se chuno:

| | **A. Cloudflare Worker** ⭐ | **B. Node bot (telegram.ts)** |
|---|---|---|
| Kahan chalta hai | Cloudflare pe (free, 24×7) | Render / VPS / Termux |
| Server chahiye? | ❌ nahi | ✅ haan |
| Cost | **$0 — 100k req/day** | Render free (sleep hota hai) |
| Cold start | ❌ nahi | ✅ ~50s (Render free) |
| Humanoid control (`/say`, `/mood`) | ❌ (static site) | ✅ poora |
| Setup time | 7 min | 5 min |
| GitHub Pages ke saath | ✅ perfect | ❌ Pages pe process nahi chalta |

> **GitHub Pages wala site static hai** — wo webhook receive nahi kar sakta.
> Isliye bot ko alag jagah chahiye. Option A phir bhi **100% free** hai.

---

# OPTION A — Cloudflare Worker (recommended, free & always-on)

## Step 1 — Bot banao (2 min, phone se)

1. Telegram kholo → **@BotFather** → `/newbot`
2. Naam do: `APEX Humanoid`
3. Username do: `apex_humanoid_bot` (unique hona chahiye)
4. Token milega: `123456789:AAH...` ← **ye copy karo**

## Step 2 — Worker deploy karo (3 min)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create**
2. **Worker** → naam: `apex-telegram-bot` → **Deploy**
3. **Edit code** → `cloudflare-bot/worker.js` ka **poora content paste** karo → **Deploy**

## Step 3 — API key kahan daalein 👈 (aapka sawaal)

**Worker → Settings → Variables and Secrets → + Add**

| Name | Type | Value | Zaroori? |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | **Secret** | `123456789:AAH...` (BotFather se) | ✅ haan |
| `GEMINI_API_KEY` | **Secret** | `AIza...` — [aistudio.google.com](https://aistudio.google.com/apikey) se **free** | ✅ haan (AI ke liye) |
| `TELEGRAM_WEBHOOK_SECRET` | **Secret** | koi random string (`openssl rand -hex 24`) | ✅ recommended |
| `TELEGRAM_ALLOWED_CHATS` | Text | tumhara chat id (optional — bot ko lock karta hai) | optional |
| `APEX_KV` | KV binding | conversation memory (optional) | optional |

**Save** dabao. (Secret ek baar save hone ke baad dobara nahi dikhta — normal hai.)

## Step 4 — Webhook register karo

Browser mein kholo:

```
https://<worker-name>.<your-subdomain>.workers.dev/setup?secret=<TELEGRAM_WEBHOOK_SECRET>
```

`"setWebhook": { "ok": true }` dikhe = done ✅

## Step 5 — Test

Telegram mein apne bot ko:
```
/start
```
```
Hello, tum kaun ho?
```

Reply aayega 🎉

### Optional — memory (KV)

Same Worker → **Settings → Bindings → Add → KV namespace**
- Variable name: `APEX_KV`
- Namespace: banao (`apex-bot-memory`)

Isse bot ko yaad rahega ki pichli baat kya thi (24 ghante).

---

# OPTION B — Node bot (poora humanoid control)

Yeh bot app ke saath hi chalta hai — `/say`, `/mood`, `/avatar`, `/theme` se page control ho jata hai.

## Step 1 — Token

BotFather se token lo (upar jaisa).

## Step 2 — API key kahan daalein

**Local (laptop/phone):**
```bash
cp .env.example .env
nano .env      # ya kisi bhi editor se
```
```env
TELEGRAM_BOT_TOKEN=123456789:AAH...
GEMINI_API_KEY=AIza...
TELEGRAM_ALLOWED_CHATS=          # khali = sabko allow
```

**Render pe:**
**Dashboard → Service → Environment → Add Environment Variable**

| Key | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | `123456789:AAH...` |
| `TELEGRAM_WEBHOOK_SECRET` | random string |
| `GEMINI_API_KEY` | `AIza...` |
| `APP_URL` | `https://your-app.onrender.com` |

> ⚠️ **`.env` kabhi commit na karo** — repo public hai. `.gitignore` mein blocked hai.

## Step 3 — Chalاؤ

**Mode 1 — Polling** (simplest, koi URL nahi chahiye):
```bash
npm run telegram
```
```
🤖 Telegram bot up: @apex_humanoid_bot
   brain: gemini · voice: off · open to everyone
```

**Mode 2 — Webhook** (Render ke liye better — koi extra process nahi):

Server pe `TELEGRAM_BOT_TOKEN` set hai to webhook route **automatically** mount ho jata hai:
```
POST /telegram/webhook
GET  /telegram        ← status check
```

Phir webhook register karo:
```bash
npm run telegram:webhook https://your-app.onrender.com
```

## Step 4 — Verify

```bash
npm run telegram:info
```
```
✅ Bot: @apex_humanoid_bot  (APEX Humanoid)
   webhook: https://your-app.onrender.com/telegram/webhook
```

---

# Commands

| Command | Kya karta hai |
|---|---|
| `/start` `/help` | list |
| `/whoami` `/id` | tumhara chat id (allowlist ke liye) |
| `/status` | bot + app health, uptime, brain |
| `/say <text>` | page bole — `"Namaste duniya"` |
| `/mood calm` | humanoid ka mood badlo |
| `/avatar nova` | avatar badlo (nova, astra, unit7, kaze, vega) |
| `/theme violet` | color palette (cyan, violet, mint, amber) |
| `/state` | app ka live state (JSON) |
| `/voice on` | ElevenLabs voice replies (key chahiye) |
| `/clear` | memory reset |
| *(kuch bhi likho)* | AI jawab dega |
| *(voice note)* | transcribe hoke jawab (OpenAI key chahiye) |

---

# Security

| Setting | Kyun |
|---|---|
| `TELEGRAM_ALLOWED_CHATS` | Bot ko sirf tumhare chat tak lock karta hai. Na ho to **koi bhi** tumhara bot use kar sakta hai (aur tumhara Gemini quota kharch karega!) |
| `TELEGRAM_WEBHOOK_SECRET` | Fake webhook requests block karta hai |
| `/whoami` | Apna chat id nikaalne ke liye — pehle ye chalao, phir allowlist me daalo |

**Chat id nikaalne ka tareeka:**
1. Bot ko `/whoami` bhejo
2. Jo number aaye (e.g. `7412345678`) wo `TELEGRAM_ALLOWED_CHATS` me daalo
3. Redeploy → ab sirf tum use kar sakte ho

---

# Free AI key (Gemini)

1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → Google account se sign in
2. **Create API key** → copy (`AIza...`)
3. Free tier: **60 requests/minute, 1500/day** — personal bot ke liye kaafi
4. Koi credit card nahi chahiye

---

# Troubleshooting

| Problem | Wajah | Fix |
|---|---|---|
| Bot reply nahi karta | Webhook set nahi | `/setup?secret=...` kholo, ya `npm run telegram:webhook <url>` |
| `401 Unauthorized` | Token galat | BotFather se dobara copy karo (space na ho) |
| `⚠️ GEMINI_API_KEY set nahi` | Key missing | Step 3 dekho |
| `gemini 429` | Rate limit | 1 min ruk ke try karo; ya paid tier |
| `/say` pe `app offline` | Render free sleep | URL khol ke jagao, phir try karo |
| Webhook me `last_error` | URL galat / server down | `npm run telegram:info` se dekho |
| Bot sabko reply kar raha | Allowlist khali | `/whoami` → `TELEGRAM_ALLOWED_CHATS` set karo |
| Cloudflare pe "secret galat" | Env var save nahi hua | Settings → Variables → verify → Deploy |

---

# Files

| File | Kaam |
|---|---|
| `telegram.ts` | Node bot — polling + webhook handler |
| `scripts/telegram-setup.ts` | `info` / `webhook` / `poll` commands |
| `cloudflare-bot/worker.js` | Serverless bot (Cloudflare Workers) |
| `server.ts` → `/telegram/webhook` | Express route (auto-mounts if token set) |
| `.env.example` | Saare env vars ki list |
