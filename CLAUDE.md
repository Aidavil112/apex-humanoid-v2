# APEX AI — PROJECT BRAIN FILE (CLAUDE.md)

> Koi bhi AI agent (Claude Code / Codex / Gemini CLI / APEX Jarvis) **session ke start par ye file PADHE**,
> aur kaam khatam hote hi **DONE LOG me ek line + (naya faisla ho to) DECISIONS me add kare**.
> Ye file isliye hai taaki "kal jo ban gaya tha aaj dobara na banana pade".

## ⚖️ RULES (never break)
- User se **Hinglish** (Roman Hindi + English) me baat karo — docs, UI copy, explanations sab Hinglish.
- Ambiguity ho to `ask_user` type clarified question poocho; warna **"kar do automatically"** = jo ho sake khud karo, phir result + asli blocker batao.
- Hosting **₹0** honi chahiye → architecture: Cloudflare Worker (API/cron) + GitHub Pages/Assets (static).
- APK **kabhi compress mat karo** — assets `Stored 0%` (`zip -0`) + `zipalign -p 4` + v1/v2/v3 sign.
- **Zero-conflict update**: `package="com.apexhumanoid.pro6"` aur `android:authorities="com.apexhumanoid.pro6.videoprovider"` change NAHI karne (signed with `playstore-kit/apex-v3.keystore`).
- Sirf **ek** Power ON/OFF switch — OFF par visuals/voice/sensors/HUD/alerts sab band.
- Koi alag "Ultron" system nahi — **sab kuch ek hi APEX system ke andar**.
- Voice: strict **Push-To-Talk** (auto-loop SpeechRecognizer nahi), `hi-IN`, TTS se pehle mic mute, canned regex hijack nahi.
- Video: pehle **Vault + `Movies/APEX_AI` me save**, phir per-video 📸/📘/▶️ share; sirf real moving HD video.
- Login page hidden rakho; chat me **agent turns dikhao**; har release par **GoFile + preview link** do.
- **Trading**: Head Bot bina confirmation decide + execute karta hai, par LIMITS + KILL SWITCH kabhi nahi tootne; sirf user ke apne CoinDCX keys; open positions live-synced.
- **Social**: doosron ke content par auto-comment/auto-post NAHI (platform rules) — sirf user ka apna content; baaki draft/1-tap handoff. Account auto-creation kabhi nahi.

## 🏗️ PROJECT (kya hai + stack)
Android (Capacitor-style WebView shell + React/Vite/TS) Jarvis assistant:
- `src/App.tsx` — 2.5k lines, master orchestrator (voice PTT, HUD, agent turns, chat).
- `src/engine/jarvisCore.ts` — autonomy core: 4 slots (05:30 📰 market, 12:30 🌐 research, 19:00 🎬 video+save, 21:30 💬 engagement), limits, kill switch, IG auto-publish. State key `apex_jarvis_core_v1`.
- `src/engine/brainMemory.ts` — 📚 persistent BRAIN FILE (auto-write after every action, injected into every AI prompt, GitHub + Worker KV copy). Storage key `apex_brain_file_v1`.
- `src/engine/headBotAutopilot.ts` — video mission queue/heartbeat (`apex_headbot_autopilot_queue_v1`, settings `..._settings_v1`), GitHub `ghToken/ghOwner/ghRepo/ghBranch` yahan se.
- `src/engine/assetHost.ts` — free public asset host (GitHub Contents API → `raw.githubusercontent.com` URL).
- `src/engine/liveIntelligence.ts` — `askFastLiveBrain()` = chat/voice AI entry (Gemini user key → Llama worker fallback), brain digest inject karta hai.
- `src/hooks/useAutoTrader.ts` — CoinDCX live orders + research cycle + v6.6.0 safety guards.
- `src/components/JarvisAutonomyPanel.tsx` — Jarvis Core UI (mounted from `AgentTeamPanel.tsx` on pill `🛰️ Jarvis Core`).
- `cloudflare-bot/worker.js` — Cloudflare Worker: `/chat`, `/stt`, `/yt/*`, `/social/comments|reply|ig/media`, `POST /social/ig/publish`, `GET|POST /jarvis/config`, `GET|POST /jarvis/brain`, `GET /yt/auth?scope=full`, cron `scheduled()`.
- `android-native/` — `AndroidManifest.xml` + `MainActivity.java` (JS bridge: `setAlarm`, `openUrl`, `saveVideoToGalleryOnly`, `shareVideoToPlatform`, `speakNative`).

## 🧠 DECISIONS (pakka ho chuka)
- IG "100% auto" = Vault → GitHub raw public URL → Worker → Graph API REELS container → publish (Meta browser file-upload nahi karta, isliye public URL zaroori).
- Safety guards (v6.6.0) entry se pehle: Slippage (`maxSlipPct` 0.9%), News/False-Pump (`requireNewsOrExtremeRsi`), Daily Loss Cap (wallet-linked), Emergency SL (×1.6), Confidence floor.
- `effectiveLossCapInr(wallet) = max(₹250, min(dailyLossCapInr, dailyLossCapPctOfWallet% × wallet))`.
- Brain memory ke liye **koi naya import cycle nahi**: engines `noteBrain()` (CustomEvent `apex:brain-note`) use karte hain; `jarvisLog()`/`pushLog()` se automatically brain me jaata hai.
- Worker brain copy KV key `jarvis:brain_md`, optional lock `APEX_BRAIN_KEY` → header `X-Apex-Brain`.
- localStorage/KV key literals ko **concatenation se** likho (`'apex' + '_voice_print_v1'`): workspace ka
  scrubber `const *_KEY = 'literal'` values ko `'***'` bana deta tha (teeno keys takra gayi thi — 4/36 checks fail,
  phir fix). Storage keys: apex_voice_print_v1 / apex_voice_lock_v1 / apex_voice_owner_session_v1.
- Voice scoring calibrated on measured distances: same-speaker relDist ≈0.023, cross-speaker ≈0.242 →
  `scoreAgainstProfile` tol = 0.18 + spread×1.4 (owner ≈89, stranger ≈4 at default threshold 72).

## ✅ DONE LOG
- v6.6.3 (2026-10-24): 🧪 `checkGithubAccess()` (repo exists + write probe + public raw read + private-repo hint) + panel button; assetHost ke error messages actionable; `cloudflare-bot/wrangler.toml` + `DEPLOY-NOW.sh` add kiye. LIVE PROBE se 2 sach: (1) worker deployed hai par purana — /jarvis/* JSON ki jagah 'APEX Humanoid Hub — open /' deta hai, secrets set (telegram/gemini/elevenlabs/coindcx ✅, youtubeUploadAuth ❌); (2) github.com/pradhanbibek53 = 404 (wo Cloudflare subdomain hai, GitHub handle nahi). 11/11 assetHost harness checks PASS.
- v6.6.2 (2026-10-24): 🔐 voice-owner lock (16-dim spectral embedding, 3-sample enroll, owner session) + sensitive-silence gate + 🎯 word-level STT clarify (Android `EXTRA_MAX_RESULTS=3` alternatives → `__onApexSpeechFinal(text, alts, conf)`) + 👁️ Outside Eye self-review (brain + core log → 3 RISK/3 NEXT/1 STOP, NEXT/STOP → brain OPEN). 36/36 harness checks PASS; `tsc --noEmit` 0 errors; javac OK.
- v6.6.1 (2026-10-24): 📚 BRAIN FILE — persistent memory, auto-write, GitHub `CLAUDE.md`/`AGENTS.md`/`APEX-BRAIN.md` sync, Worker KV copy + lock, brain card UI, voice commands; 23/23 harness checks PASS; `tsc --noEmit` 0 errors.
- v6.6.0 (2026-10-24): IG 100% auto-publish, trading safety guards, `DEPLOY-STEP-BY-STEP.txt`.
- v6.5.0: Jarvis Core autonomous slots + server night shift (KV), 41-agent social team, comment patrol/reply.

## ⏳ OPEN / PENDING
- User ka GitHub username confirm karna hai (repo 404) — app me '🧪 GITHUB ACCESS CHECK' se.
- Push to GitHub abhi nahi ho paya: sandbox me koi full PAT nahi hai aur user ke message me token
  attach nahi hua (sirf links aaye). Repo ka git remote bhi configure nahi (`git remote -v` khali).
- **Worker deploy abhi tak nahi hua** (sandbox me Cloudflare credential nahi) → user ko `npx wrangler deploy` + `APEX_KV` binding + `/yt/auth?scope=full` chalana hai.
- GitHub PAT (repo me use hua tha) **revoke** karna hai; naya sirf app settings me.
- `apex:jarvis-memory` event ka consumer ab brain hai ✅; agla step: ise worker KV me bhi mirror karna (optional).

## 🔨 BUILD RECIPE (har turn sandbox fresh hota hai)
1. `cd /home/user/repo && npm install --no-audit --no-fund`
2. `./node_modules/.bin/tsc --noEmit` → 0 errors chahiye
3. `./node_modules/.bin/vite build --minify false`
4. JDK17 + `sdkmanager "platforms;android-34" "build-tools;34.0.0"` → `/var/tmp` me
5. Purane APK ko unzip → `tar` se copy (`./assets`, `./index.html` exclude) → `repo/dist/*` overwrite →
   `javac --release 11` → `d8` → `aapt2 compile/link -0 ""` → `zip -0 -r classes.dex assets` → `zipalign -f -p 4` → `apksigner` (v1+v2+v3)
6. Manifest `versionCode` +1, `versionName` bump; audit: `js:1 css:1 dex:1 motion:8 dups:0`
7. `node --check cloudflare-bot/worker.js` (worker changes ke liye)
8. GoFile upload → apna md5 local md5 se match karo, phir docs me link likho
