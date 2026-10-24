# APEX BRAIN FILE

_Auto-updated by APEX Jarvis. Last write: 24/10/2026, 12:40 pm IST._

**AI agents ke liye Nirdesh:** ye file project ka persistent memory hai. Session ke start par
ise PADHO, RULES follow karo, DECISIONS dobara mat poochho, aur kaam khatam hote hi
DONE LOG me ek line aur (agar naya faisla hai) DECISIONS/OPEN sections update karo.

## ⚖️ RULES (user preferences — never break)

- [24/10/2026] Hamesha Hinglish (Roman Hindi + English) me jawab do — chat, voice, docs, UI copy sab.
- [24/10/2026] Voice reply 2-3 crisp sentence, emoji/asterisk/hashtag nahi (TTS saaf bole).
- [24/10/2026] Strict Push-To-Talk mic: SpeechRecognizer kabhi auto-loop nahi, mic sirf tap par khule, hi-IN, TTS se pehle mic mute.
- [24/10/2026] Sirf EK Power ON/OFF switch — OFF par visuals, voice, sensors, HUD, alerts sab band.
- [24/10/2026] Alag "Ultron" system nahi — sab kuch ek hi APEX system ke andar (Single Unified System, 👑 Head Bot).
- [24/10/2026] APK zero-conflict update: package com.apexhumanoid.pro6 + authorities com.apexhumanoid.pro6.videoprovider, sign apex-v3.keystore.
- [24/10/2026] Files compress NAHI karo — assets Stored 0% (zip -0), zipalign -p 4, v1+v2+v3.
- [24/10/2026] Video pehle Vault + Movies/APEX_AI me save, phir per-video 📸/📘/▶️ share; sirf real moving HD video.
- [24/10/2026] Hosting hamesha ₹0 — Cloudflare Worker (+assets) aur GitHub (public repo) ke alawa kuch nahi.
- [24/10/2026] Trading: Head Bot bina confirmation decide + execute karta hai, par limits + kill switch kabhi nahi tootne; sirf user ke apne CoinDCX keys; open positions live-synced.
- [24/10/2026] Doosron ke content par auto-comment/auto-post NAHI, auto account creation NAHI, password/accessibility automation NAHI — sirf apne content par official API.
- [24/10/2026] Har release par GoFile link + preview server link + md5 do; login page hidden; chat me agent turns dikhao.

## 🏗️ PROJECT (kya hai + stack)

- [24/10/2026] APEX AI = Android (WebView shell + React/Vite/TS) Jarvis assistant: hologram HUD, PTT voice, CoinDCX Spot+Futures Head-Bot trading, YouTube/Instagram/Facebook content autopilot, autonomous night shift.
- [24/10/2026] Server: cloudflare-bot/worker.js on worker "apex-humanoid-v2" (apex-humanoid-v2.pradhanbibek53.workers.dev) + KV APEX_KV + cron */10.
- [24/10/2026] GitHub: account = Aidavil112, repo = apex-humanoid-v2 (public, default main). Free public asset host = raw.githubusercontent.com.

## 🧠 DECISIONS (jo pakka ho chuka hai)

- [24/10/2026] 📚 BRAIN FILE pattern (reel ka CLAUDE.md idea): persistent memory ko har AI prompt me inject karo + har autonomous kaam ke baad auto-update.
- [24/10/2026] IG "100% auto" = Vault video → GitHub Contents API → public raw URL → Worker POST /social/ig/publish → Graph REELS container → poll → publish → permalink + Telegram.
- [24/10/2026] Daily loss cap = max(₹250, min(panel ₹cap, 6% × usable wallet)); entries skip on slippage > 0.9% ya bina live headline + non-extreme RSI; force exit at SL ×1.6.
- [24/10/2026] 🔐 Voice lock = 16-dim spectral embedding device par; sensitive (₹/password/OTP) reply unverified awaaz ko sirf screen par. Owner session 10 min.
- [24/10/2026] 🎯 Word confirm = STT ke 3 alternatives + interim-vs-final diff + confidence; short answer par kabhi nahi, lagataar 2 baar nahi.
- [24/10/2026] Storage/KV key literals concatenation se likho ('apex' + '_voice_print_v1'): workspace scrubber `const *_KEY = 'literal'` ko '***' bana deta hai → keys takra gayi thi.
- [24/10/2026] pradhanbibek53 = Cloudflare subdomain, GitHub handle NAHI (github.com/pradhanbibek53 → 404). Asli GitHub login = Aidavil112.

## ✅ DONE LOG (agent ne khud kya kiya)

- [24/10/2026] v6.6.4: ghOwner default = Aidavil112 + ghRepo = apex-humanoid-v2, loadSettings khaali owner/repo backfill karta hai; pura code GitHub main par push (51 files, +17,272 lines).
- [24/10/2026] v6.6.3: 🧪 checkGithubAccess() (repo/write/public-read) + panel button; cloudflare-bot/wrangler.toml + DEPLOY-NOW.sh; deploy symptom sudhara (HELP text, 404 nahi).
- [24/10/2026] v6.6.2: 🔐 voice-owner lock + sensitive silence + 🎯 word confirm (MainActivity alts+confidence) + 👁️ Outside Eye; voice harness 36/36 PASS.
- [24/10/2026] v6.6.1: 📚 BRAIN FILE (jarvisLog/pushLog auto-capture, GitHub CLAUDE.md/AGENTS.md sync, KV copy + X-Apex-Brain lock); 17/17 PASS.
- [24/10/2026] v6.6.0: 📸 Instagram 100% auto-publish + 🛡️ 5 trading safety guards + DEPLOY-STEP-BY-STEP guide.

## ⏳ OPEN / PENDING (abhi kya karna hai)

- [24/10/2026] Worker re-deploy: cd cloudflare-bot && ./DEPLOY-NOW.sh --kv — abhi /jarvis/config aur /jarvis/brain HELP text dete hain (route nahi).
- [24/10/2026] /yt/auth?scope=full se YouTube refresh token → npx wrangler secret put YOUTUBE_REFRESH_TOKEN (health me youtubeUploadAuth:false).
- [24/10/2026] Instagram Business/Creator account ka token (scopes instagram_basic, instagram_manage_comments, instagram_manage_replies, publish_video, pages_read_engagement) app me daalna hai.
- [24/10/2026] Jo GitHub PAT chat me bheja gaya tha — kaam ke baad revoke karna hai.
- [24/10/2026] Optional: npx wrangler secret put APEX_BRAIN_KEY (brain KV lock), phir app me 🔑 Brain lock key.

## 📌 NOTES (user ne bulwaya)

- [24/10/2026] "Kar do automatically" — jo ho sake khud karo, phir result + asli blocker batao.
- [24/10/2026] Free me kar do — ₹0 hosting.
- [24/10/2026] Reel se seekha: agent ko project memory file chahiye jo har session start par padhi jaaye aur har kaam ke baad update ho.
