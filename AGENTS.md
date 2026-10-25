# APEX BRAIN FILE

_Auto-updated by APEX Jarvis. Last write: 24/10/2026, 08:55 pm IST.

**AI agents ke liye Nirdesh:** ye file project ka persistent memory hai. Session ke start par
ise PADHO, RULES follow karo, DECISIONS dobara mat poochho, aur kaam khatam hote hi DONE LOG me
ek line aur (naya faisla ho to DECISIONS/OPEN) update karo. (App khud bhi `🧠 AUTO-WRITE` se
ye file badalti hai — isliye format kharab mat karo.)

## 📦 SHIP (abhi ye version current hai)

- **v6.6.15 · build 56** → https://gofile.io/d/DreXyUYT · `/home/user/APEX-AI-Pro.apk`
  · 112,074,236 B · md5 `f9c8b1942ae5d04cbad071ac99d5a9ce`
  · gates: `tools/verify-apk.sh` 12/12 ✅ · `tools/ui-test.sh` core **60/60** ✅ + click-sweep 93 buttons 0 exception · tsc 0 errors
  · naya: 🎛️ **REEL ENGINE** (`reelEngine: auto|footage|motion` + `motionStyle`) — auto/daily missions ka
    video Motion Forge (OneTake-look, phone par) se banega; fail/120s timeout par web footage par
    auto-fallback; UI Motion Forge card ke ANDAR (chips + 🤖 AUTO REEL CHALAO + 📥/📤 toggle + 180s watchdog)
- Purane (update ke liye theek, par ab ship NAHI): 55 `vDXnjUdd` · 54 `z5GhVn1I` · 53 `9tk6b1iH` · 52 `XGfw1DTM`
- ❌ KABHI mat bhejo: 48 `NNwICvcZ`, 47 `aCgqBH62`, `r7FYzR7c`, `emrcJmxn` (build 44–48 = launch crash)

## ⚖️ RULES (user preferences — never break)

- [24/10/2026] **Alag-alag system/UI mat banao** — jo function bane wo Jarvis ke andar hi add ho (ek 👑 Head Bot, ek CORE panel, ek setup jagah). "Jarvis ka system dekho, uske alag kuchh mat karo".

- [24/10/2026] Hamesha Hinglish (Roman Hindi + English) — chat, voice, docs, UI copy sab.
- [24/10/2026] Voice reply 2-3 crisp sentence, emoji/asterisk/hashtag nahi (TTS saaf bole).
- [24/10/2026] Strict Push-To-Talk: SpeechRecognizer kabhi auto-loop nahi, mic sirf tap par, hi-IN, TTS se pehle mic mute.
- [24/10/2026] Sirf EK Power ON/OFF switch — OFF par visuals, voice, sensors, HUD, alerts sab band. "Call" mode nahi.
- [24/10/2026] Alag "Ultron" system nahi — sab ek APEX ke andar (Single Unified System, 👑 Head Bot).
- [24/10/2026] APK zero-conflict update: package `com.apexhumanoid.pro6` + authority `com.apexhumanoid.pro6.videoprovider`, sign `playstore-kit/apex-v3.keystore`.
- [24/10/2026] Files compress NAHI karo — assets Stored 0% (`zip -0`), zipalign -p 4, v1+v2+v3. Size ki chinta mat karo (user: "1 GB bhi chalega"), videos APK ke ANDAR hi rahengi.
- [24/10/2026] Video pehle Vault + Movies/APEX_AI me save, phir per-video 📸/📘/▶️ share; sirf real moving HD video. WhatsApp send box nahi.
- [24/10/2026] Hosting hamesha ₹0 — Cloudflare Worker (+assets) aur GitHub public repo; R2 = ₹0 asset host, GitHub raw fallback (90 MB cap).
- [24/10/2026] Trading: Head Bot bina confirmation decide+execute karta hai, par limits + kill switch kabhi nahi tootne; sirf user ke apne CoinDCX keys; positions live-synced.
- [24/10/2026] Doosron ke content par auto-comment/auto-post NAHI, auto account creation NAHI, password/accessibility automation NAHI — sirf apne content par official API + public URL.
- [24/10/2026] Har release par direct APK link + preview server link + md5 do; login page hidden; chat me agent turns dikhao; Hybrid Demo HUD + Smart Dock rehne do.
- [24/10/2026] "Kar do automatically" — jo ho sake khud karo, phir result + asli blocker batao. Ambiguous input par `ask_user`.

## 🚫 DO-NOT / ✅ DO (engineering — inhi galtiyon se seekha gaya)

• DO-NOT: HTML tag JSX *string literal* ke andar mat daalo (`'🧪 GITHUB<br />X'` screen par
  "<br />" chhap deta tha).
• DO-NOT: count/label lazy mat chhodo — mount par bhar do, warna user ko "0" dikhta hai jab tak
  tap na kare (ALL VIDEOS (0) wala bug). List ka source me shipped assets (APK clips) bhi gino.
• DO-NOT: koi button `disabled` mat chhodo bina ye bataye ki tap karne par kya karna hai; aur
  "looks-disabled" colors (bg-white/10 + text-slate-400) busy state ke liye mat use karo.
• DO-NOT: sheet ke andar ka overlay (video hub, modal) backdrop tak click bubble mat karne do —
  `onClick={(e)=>e.stopPropagation()}` lagao (varna clip tap karte hi poora CORE sheet band).
• DO-NOT: source `android-native/AndroidManifest.xml` ka `package` v3 mat chhodo — build script
  ab usi file se manifest link karta hai; v3 = phone par update ki jagah DUSRA app. pro6 hi ho.
• DO-NOT: component naam RELATIVE (".MainActivity") — hamesha fully-qualified
  `com.apexhumanoid.v3.X`, kyonki packaging package ko pro6 rakhti hai (relative = launch crash).
• DO: sheet se bahar koi bhaari/naya panel stage-pill switcher me mat chhupao — Dock se 1 tap
  + fresh install par ek baar auto-open (coreOpen pattern).
• DO: naya engine kaam = `logDayEvent(who, what, how, ok)` (src/engine/dayLog.ts) — "📊 AAJ KYA
  KIYA" card isi se banta hai; user ko agents ka din-bhar ka kaam app me dikhna chahiye.
• DO: direct `window.open` / `navigator.clipboard.*` mat likho → `apexOpen()` / `apexCopy()` /
  `apexPaste()` (src/engine/nativeUi.ts). WebView me ye APIs chup-chaap fail hoti hain.
• DO: <input type="file"> chahiye to MainActivity ka onShowFileChooser already ready hai.
• DO: LAG se pehle `.apex-smooth` (perfMode.ts); naya `backdrop-blur-*` soch kar hi daalo
  (mid-range MIUI cost).
• DO: har build se PEHLE `bash tools/ui-test.sh` (tsc + jsdom core test + click-sweep) aur
  `bash tools/verify-apk.sh <apk>` — exit 0 ke bina upload = mana hai (v44–48 isi se crash hue).
  "Build pass" = feature live hona nahi; render + click sabit karo.
• Agar user "keeps stopping" bole → `Android/data/com.apexhumanoid.pro6/files/apex-crash.txt` maango.

## 🏗️ PROJECT (kya hai + stack)

- [24/10/2026] APEX AI = Android (WebView shell + React/Vite/TS) Jarvis assistant: hologram HUD, PTT voice, CoinDCX Spot+Futures Head-Bot trading, YouTube/Instagram/Facebook content autopilot, night shift.
- [24/10/2026] Repo: `/home/user/repo` (web + engines) · `/home/user/android-native` (MainActivity.java, manifest, res) · `/home/user/repo/cloudflare-bot/worker.js` on "apex-humanoid-v2" (apex-humanoid-v2.pradhanbibek53.workers.dev) + KV `APEX_KV` + cron */10.
- [24/10/2026] Tools (sab repo me, dobara chalane layak): `tools/ui-test.sh` · `tools/core-panel-test.mjs` · `tools/click-sweep.mjs` · `tools/jsdom-harness.mjs` · `tools/build-apk.sh <ver> <code>` · `tools/verify-apk.sh` · `tools/upload-gofile.sh`.
- [24/10/2026] Build pipeline: vite build → dist → `assets/www` (+ `/var/tmp/apex_media` ke 8 clips + mediapipe; na ho to pichle APK se extract) → javac/d8 → aapt2 link → `zip -0` → zipalign → apksigner.
- [24/10/2026] GitHub: account = `Aidavil112`, repo = `apex-humanoid-v2` (public, main). `pradhanbibek53` = Cloudflare subdomain, GitHub handle NAHI.
- [24/10/2026] Sandbox restore ke baad: `npm install`, JDK/SDK `/var/tmp` me dobara (api.adoptium.net + dl.google.com se), preview `python3 -m http.server 4173 --bind 0.0.0.0 --directory /var/tmp/preview_bundle`. `aapt2`/`apksigner` PATH par nahi → `export PATH=/var/tmp/android-sdk/build-tools/34.0.0:/var/tmp/jdk17/bin:$PATH`.

## 🧠 DECISIONS (jo pakka ho chuka hai)

- [24/10/2026] 📚 BRAIN FILE pattern: persistent memory har AI prompt me inject + har autonomous kaam ke baad auto-update.
- [24/10/2026] IG "100% auto" = Vault video → GitHub Contents API → public raw URL → Worker POST /social/ig/publish → Graph REELS container → poll → publish → permalink + Telegram.
- [24/10/2026] Daily loss cap = max(₹250, min(panel cap, 6% × usable wallet)); slippage > 0.9% ya bina live headline + extreme RSI par entry skip; force exit SL ×1.6.
- [24/10/2026] 🔐 Voice lock = 16-dim spectral embedding device par; sensitive reply unverified awaaz ko sirf screen par; owner session 10 min.
- [24/10/2026] 🎯 Word confirm = STT ke 3 alternatives + interim-vs-final diff + confidence; short answer par kabhi nahi.
- [24/10/2026] Storage/KV key literals string-concatenation se likho ('apex' + '_day_log_v1'): workspace scrubber `const *_KEY = 'literal'` ko '***' bana deta hai.
- [24/10/2026] Videos APK ke andar, 0% compression, in-app inline `<video>` player — koi alag page/host nahi (user ki size chinta nahi hai).

## ✅ DONE LOG

- [25/10/2026 2:10am] ⚠️ **Sandbox rollback pakda + restore**: workspace purane snapshot par gaya tha → `git log` me sirf `aa2f4e0` (mere commit ke objects gayab) aur 3 src file undo (`reelEngine`, panel ka `REEL ENGINE`, buildInfo 6.6.14/55) — khatarnak: App.tsx ki voice branch bachi rahi isliye repo typecheck toota, aur local APK build 55 par palat gaya tha. Fix: 3 file dobara apply → `tools/ui-test.sh` tsc 0 + core **60/60** + sweep 93 buttons 0 exception → `build-apk.sh 6.6.15 56` → `verify-apk.sh` 12/12 → **APK ke andar feature grep se proof** (`assets/www/assets/index-BHP0Ju-m.js` me "REEL ENGINE" ×2, "reelEngine" ×4). Fresh ship copy: https://gofile.io/d/DreXyUYT · 112,074,236 B · md5 `d02dfd7805f96af6ff1b74d79ac97d33` (purana ZBmpMyeG bhi same 6.6.15/56). **Rule:** ship ke turant baad commit + docs me feature ka poora description (git objects bhi kho sakte hain); rollback-shak par pehle 3 grep: src feature marker, buildInfo version, APK md5.
- [25/10/2026 2:45am] 🔁 `src/` dobara rollback (teesri baar nahi ladunga) → **APK rebuild SKIP** (adhoore src se feature khonā risk); pending patches `tools/PENDING-SRC-FIXES.md` me + naya `tools/r2-paste-test.mjs` (6 asserts, shipped app ke liye bhi). **2 asli bug nikle:** (a) `parseR2Paste` ka `gluedAkid` fallback keys-gaib par **pub-<32hex> hash ko Access Key ID** bana leta hai → `SignatureDoesNotMatch`; (b) app ka `📋 4-LINE TEMPLATE` chhote labels (`access:`/`secret:`) likhta hai jo regex padhता ही नहीं → **secret template se kabhi bharta hi nahi tha**. User-facing rule abhi: R2 VAULT me **FULL labels** — `access key id:` / `secret access key:`. Fix agle build (6.6.16/57) me.
- v6.6.15 (build 56): 🎛️ REEL ENGINE — `AutoPilotSettings.reelEngine/motionStyle` + `executeMission` STEP 2+3 engine router (motion = `renderMotionForgeVideo` 1080×1920 → `blobToBase64` → fail/timeout par footage fallback, `withTimeout(120s)`), Jarvis panel ke Motion Forge card me 🎲//✨ chips +  AUTO REEL CHALAO (runMissionNow) + 📥 SIRF SAVE ↔ 📤 SAVE+PUBLISH + live stage line + 180s button watchdog, voice "reel engine motion karo". **⚙️ Build-chain fix:** `tools/build-apk.sh` ab source `android-native/AndroidManifest.xml` bhi sync karta hai (warna verify ka "APK version == source manifest" gate hamesha false-fail karta tha) aur `buildInfo.ts` ka version hardcoded hai — har ship par bump zaroori. **☁️ Upload fix:** GoFile `/servers` kabhi `noServer` deta hai → `upload-gofile.sh` ab known stores (store9/store1/…) direct try karta hai (0x0.st = uploads disabled, catbox = Invalid uploader, pixeldrain = auth, tmpfiles = 502 → naya `tools/upload-mirror.sh`).
- v6.6.14 (build 55): 🧭 `🧭 JARVIS SETUP — 3 KAAM` card (worker+KV / R2 / GitHub PAT) CORE panel ke upar — live status + ▸ KAISE KAREIN 6 steps + 🔗 link + 📋 command copy + asli check buttons (wahin ke engines, state share) + 🗣️ BOLO; "⏳ n BAKI/✅ SAB TAIYAR" badge + `🔄 TINO KAAM CHECK KARO`; voice "setup kaise karein/kya baki hai/3 kaam/r2/pat" → panel+row khulta hai; 🔧 `tools/setup-toolchain.sh` + build-apk auto-install. Tests 48/48, sweep 89 buttons 0 exception, verify 12/12.

- v6.6.13 (build 54): 🎙️ VOICE CONTROL THEEK: power ON ka branch tha hi nahi tha (baat general AI chat me gir jaati thi) + pending "haan/cancel" sawaal kisi bhi "…band karo" ko apna jawab samajh leta tha (ULTA kaam) + TTS echo mic me wapas suni jaati thi. Ab: power on/off voice se, confirm sirf ≤5-word haan/na par aur koi naya target aaye to purana confirm saaf-safai se chhoda jata hai, 3-gram echo filter. ⏳ STUCK-FIX: speak() ka onEnd guaranteed (28s safety timer) + power-off par bhi callback, 22s keeper (atka busy/speaking khud reset + toast + day-log), busy waqt ki baat QUEUE me (drop nahi), panel ke 12 busy flags ka apna guard (55s; DEV 8s) + "⏳ abhi chal raha hai" live line + ↺ ATKA HUA CHHODO + 🎙️ AWAAZ RESET KARO (button + "awaaz reset karo" voice) + VOICE DOCTOR me 2 nayi rows. 📊 "aaj kya kar rahe ho" bhi ab day-log kholta hai. Tests: core 38/38 (voice routing + guard firing tak), sweep 0 exception, verify 12/12.

- v6.6.12 (build 53): 🐞 clip tap se CORE sheet band hone wala bubble bug (stopPropagation); 📊 day-log button hamesha reachable + "poori list" expand (pehle log load hote hi button gayab); 🔍 YouTube `Trend Dhundho` ab Hinglish + busy label + fail par reason (chup no-op khatam); 🧪 jsdom suite repo me self-contained (`tools/ui-test.sh` 20/20 + sweep 75 buttons 0 exception); 🔒 gate ne pakda ki source manifest v3 tha → pro6 fix + app-id lock (warna "update" = dusra app); 📦 `tools/build-apk.sh` + `tools/upload-gofile.sh` likhe gaye.
- v6.6.11 (build 52): 📁 ALL VIDEOS (8) app-clip list + inline players; 📊 AAJ KYA KIYA day-log card + voice "aaj kya kiya"; `<br/>` label fix; 5 low-contrast pills; engines ne kaam self-report karna shuru (video save, IG post, standup, patrol, research cycle, reels sync, self-check).
- v6.6.10 (build 51): 🛰️ CORE panel Dock se 1 tap + fresh install auto-open; ⚡ SMOOTH toggle (.apex-smooth + html class sync); 🎙️ VOICE DOCTOR (TTS/mic/STT rows); ✅ PURA LATEST? CHECK KARO badge.
- v6.6.9 (build 50): click-sweep 21 → 0 errors; `apexOpen/apexCopy/apexPaste` native bridge (WebView silent-fail khatam); MainActivity file-chooser + share sheet.
- v6.6.8 (build 49): launch-crash post-mortem; verify-apk.sh gate bana; MainActivity onCreate try/catch + apex-crash.txt + fallback WebView.
- v6.6.7: 🔎 build badge + selfCheck (8 real checks) + 📁 ALL VIDEOS inline player + Motion Forge inline playback.
- v6.6.6: 🎬 MOTION FORGE (prompt → 1080×1920 reel: kinetic type + morphing blobs + eased camera + flash/whip/glitch/zoom-blur/slice + stat count-up; Canvas+MediaRecorder, ₹0, Vault-save) · 🏢 COMPANY MODE standup (department-wise live checks → blocker brain OPEN me, deduped).
- v6.6.5: 🪣 R2 asset host (Web-Crypto SigV4 — AWS vectors 8/8), presigned PUT, paste auto-split, `🧪 R2 CHECK` / `🛠️ CORS FIX`, worker `/asset/*` proxy, IG publish 88 MB+ par auto-R2.
- v6.6.4: ghOwner/ghRepo defaults + backfill; pura code GitHub `main` par push (51 files).
- v6.6.3: `checkGithubAccess()` + panel button; `cloudflare-bot/wrangler.toml` + DEPLOY-NOW.sh.
- v6.6.2: 🔐 voice-owner lock + sensitive silence + 🎯 word confirm + 👁️ Outside Eye (harness 36/36).
- v6.6.1: 📚 BRAIN FILE (jarvisLog/pushLog auto-capture, GitHub CLAUDE.md/AGENTS.md sync, KV copy + X-Apex-Brain lock) (17/17).
- v6.6.0: 📸 Instagram 100% auto-publish + 🛡️ 5 trading safety guards + DEPLOY-STEP-BY-STEP guide.

## ⏳ OPEN / PENDING (abhi kya karna hai)
- [24/10/2026 9:55pm] 🎬 OneTake-look reel renderer repo me aa gaya: `tools/reel-render.py` (PIL+numpy+static ffmpeg; 1080×1920/12 s/31 s render; spring+area-preserving squash+word-pop+count-up+whip+tmix motion blur; numpy 128-BPM beat). Sample: `preview/APEX-REEL-DEMO.mp4`. Original OneTake skill GPU (CUDA/NVENC/Remotion) mangta hai — wahi wajah ki phone/app me Motion Forge hi iska equivalent hai. ⚠️ 1px scanline pass moiré banata hai (downscale par) — hata diya; `tmix` me `c0/c1` nahi, `weights` use karo.
- [24/10/2026 9:55pm] 📺 YouTube connect ab sirf 2 secret door: `YOUTUBE_CLIENT_ID` + `YOUTUBE_CLIENT_SECRET` (worker me `/yt/auth /yt/callback /yt/upload /yt/plan /yt/status /yt/voice` already hain; `/yt/callback` refresh token **apne aap KV** me save karta hai `yt:refresh_token` — KV binding ka pehla asli faayda). Poora naksha: `YOUTUBE-API-KYA-KAREGA.txt`. Live: `/yt/auth` → "Step 1 Needed: YOUTUBE_CLIENT_ID", `/health` → `youtubeUploadAuth:false`. ⚠️ Secret chat me mat bhejo (mask ho jaate hain) — box me paste.

- [24/10/2026] 📱 Phone par v6.6.12 (53) install karo — settings me "APEX AI 6.6.12" aur app me `✅ PURA LATEST? CHECK KARO` se proof.
- [24/10/2026] 🪣 R2 setup abhi adhura (screenshot me red "missing: endpoint/keys") → panel ke `🪣 R2 VAULT` card me dashboard blob paste → `✂️ PASTE SE BHARO` → `🧪 R2 CHECK`. Sandbox se `r2.cloudflarestorage.com` TLS-block tha, isliye data-plane yahin test nahi ho paya.
- [24/10/2026] ✅ KV **namespace ban gaya** (user ne dashboard se): id `e31bee0bb26c4fcc90154f80e1ba78da` — `cloudflare-bot/wrangler.toml` **aur** root `wrangler.jsonc` (iska `kv_namespaces` khali tha — root se deploy par binding gayab ho jaati, trap band) dono me bhardi gayi.
- [24/10/2026] ✅ `worker.js` me `withKVAlias(env)` (fetch+scheduled entry): dashboard ka default Variable name `KV_BINDING` ho to bhi chalega — alias test 5/5, `node --check` OK. BAKI SIRF: Worker → Settings → Bindings → Add → **KV namespace** → Variable name `APEX_KV` → namespace `APEX KV` → **Save and Deploy**; tab `/jarvis/brain` → `{"ok":true}` (abhi old code live: `APEX_KV binding missing`).
- [24/10/2026] ⏳ Uske baad: `*/10 * * * *` cron (Triggers) → app me `🧭 JARVIS SETUP` row 1 ✅ → phir row 2 **R2** (bucket `apex` + public URL + API token 4 line `✂️ PASTE SE BHARO`) → row 3 **GitHub PAT** (`tools/push-github.sh`). Naya code paste karna ho to `preview/worker.js` (151,369 B) se copy — par naam `APEX_KV` rakh liya to paste ki zaroorat nahi.
- [24/10/2026] GitHub PAT app me dobara daalna hai (field khaali hai) — chat wala PAT revoke karna hai; repo ka local git tip `aa2f4e0` par abhi bhi v6.6.5+ code push nahi hua.
- [24/10/2026] 🎬 Motion Forge ka asli render sirf device/browser me test hota hai (Node me MediaRecorder nahi) → `🎬 MOTION FORGE → ▶️ RENDER KARO`.
- [24/10/2026] Instagram Business/Creator token (instagram_basic, instagram_manage_comments, instagram_manage_replies, publish_video, pages_read_engagement) app me daalna hai; `QUEUE (0)` tabhi bharega.
- [24/10/2026] /yt/auth?scope=full se YouTube refresh token → `wrangler secret put YOUTUBE_REFRESH_TOKEN` (health me youtubeUploadAuth:false).
- [24/10/2026] Optional: `wrangler secret put APEX_BRAIN_KEY` (brain KV lock) → app me 🔑 Brain lock key.

## 📌 NOTES

- [24/10/2026] Reel (Ai.Akshu, 432K views): Higgsfield KATANA — "prompt → generate → render, After Effects nahi" → APEX me wahi ka free local renderer (Motion Forge).
- [24/10/2026] Reel (Colton AI Dean, 115K): "main 19 ka hoon, company me akela human" → agents department-wise kaam karte hain + insaan sirf approve karta hai; uska mechanism public nahi tha (lead-magnet funnel), isliye APEX me sirf transparency loop (day-log) + 52-agent autopilot hi copy kiya.
- [24/10/2026] Repo public hai → koi bhi token/password commit mat karo; `wrangler.toml` me sab secrets commented `wrangler secret put` lines hi rehne chahiye. `.gitignore`: `tools/.bundle.mjs`, `.harness-entry.tsx`.
- [24/10/2026] Dok path: current step-by-step = `DEPLOY-STEP-BY-STEP.txt`; `LIVE-NOW.txt`, `FREE-HOSTING.txt`, `NETLIFY-60-SECONDS.txt`, `TELEGRAM-KAISE-KARE.txt`, `ALL-API-KEYS-GUIDE.md` superseded/archived hain (header me likha hai).
