# APEX Humanoid on Android — Complete Guide

Do alag sawaal hain, dono ke jawab:

| Sawal | Jawab |
|---|---|
| **A. Phone pe app chala sakta hoon?** | ✅ Haan — bina Play Store ke, browser se + home-screen app ki tarah |
| **B. Phone se code edit / build / deploy kar sakta hoon?** | ✅ Haan — Termux ya GitHub Codespaces se |

---

# A. Android pe APEX chalao (phone pe)

## A1. Sabse aasan — browser + home screen (2 min)

1. **Pehle app deploy honi chahiye** — Render pe (neeche B4 dekho) ya kisi bhi HTTPS host pe
2. Android Chrome mein URL kholo (e.g. `https://apex-humanoid-xxxx.onrender.com`)
3. **ENTER** dabao → humanoid aayega
4. Chrome menu **(⋮)** → **"Add to Home screen"** → **Install**
5. Ab home screen pe **APEX** icon milega — fullscreen khulega (browser bar nahi), app jaisa

> `public/manifest.webmanifest` repo mein hai (standalone display, portrait, dark theme, maskable icon) — isliye Android ise proper PWA ki tarah install karta hai.

## A2. Phone pe kya-kya kaam karega

| Feature | Android pe | Note |
|---|---|---|
| 3D humanoid (WebGL2) | ✅ | Achi GPU wale phones pe smooth; purane/low-end pe thoda slow |
| Touch se head follow | ✅ | `pointermove` use hota hai — ungli chalao, sar ghumega |
| Mood / theme change | ✅ | Menu sheet se |
| Voice (browser TTS) | ✅ | Key ki zaroorat nahi |
| **Mic se baat** | ✅ | Mic permission maangega, **HTTPS zaroori** |
| **Camera gesture tracking** | ✅ | Camera permission, HTTPS zaroori |
| Auto-trader demo | ✅ | Fake/sandbox mode |
| YouTube/Reel studio export | ⚠️ | MediaRecorder support pe depend — Chrome Android pe mostly chalta hai, storage permission maang sakta hai |
| 300k particles | ⚠️ | Low-end phone pe frames drop ho sakte hain |

## A3. Agar install ka option na dikhe / mic na chale

**HTTPS must hai** mic, camera aur PWA install ke liye. `http://` URL pe ye block ho jate hain.

- Render/Railway/Fly → by default HTTPS ✅
- Local network pe test: `adb reverse tcp:3000 tcp:3000` → phir `http://localhost:3000` phone pe
  (`localhost` ko browser secure context maanta hai)

## A4. Mobile ke liye jo fixes ho chuke hain

| Fix | Kya tha |
|---|---|
| HUD canvas sizing | `absolute inset-0` + `width` attribute → canvas 786px chaura 393px screen pe clip ho raha tha → `w-full h-full` add kiya |
| Top HUD overlap | "SENTIMENT AI" aur "311K PTS" mobile pe ek doosre pe chadh rahe the → compact + hide on phone |
| Blown-out white core | 311k points chhoti screen pe additive blend se safed ho jate the → portrait pe point-size 0.76× (detail wapas, fill-rate bhi kam) |
| Trade badge readability | Badge grey band jaisa lag raha tha bright core ke upar → opaque bg, alpha floor |
| PWA | `manifest.webmanifest` + `mobile-web-app-capable` meta |

---

# B. Android se build / deploy (phone hi computer ban jaye)

## B1. Termux (free, Play Store pe nahi — F-Droid se lo)

> Play Store wala Termux **purana/deprecated** hai. **F-Droid** ya GitHub releases se lo.

```bash
pkg update && pkg upgrade -y
pkg install -y git nodejs-lts

# repo clone karo
git clone https://github.com/Aidavil112/apex-humanoid-v2.git
cd apex-humanoid-v2

# install + build + run
npm install
npm run build
NODE_ENV=production PORT=3000 npx tsx server.ts
```

Ab phone pe hi `http://localhost:3000` kholo — app chalega. 🎉

**Termux ke 3 tips:**

| Problem | Fix |
|---|---|
| `npm install` atak raha hai / memory error | `NODE_OPTIONS=--max-old-space-size=2048 npm install` |
| `sharp`/`rollup` native module error | `pkg install -y build-essential python` |
| Battery pe chalana hai | `pkg install -y termux-api` + `termux-wake-lock` |

**Push karna ho Termux se:**
```bash
git config user.email "you@example.com"
git config user.name "Aidavil112"
git add -A && git commit -m "edit from android"
git push   # PAT maangega — GitHub token daalo (password ki jagah)
```

## B2. GitHub Codespaces (browser se full VS Code — phone pe best)

1. Repo kholo → green **Code** button → **Codespaces** → **Create codespace**
2. 2 GB free/month (personal accounts) — pura Linux + Node + VS Code browser mein
3. Terminal:
   ```bash
   npm install && npm run build && npm start
   ```
4. Port **3000** auto-forward hota hai → "Open in browser" → **phone pe hi preview**
5. Code edit bhi browser ke VS Code se — phone pe typing mushkil ho to Bluetooth keyboard

> Sabse smooth option agar aapko **code change + deploy** phone se karna hai.

## B3. GitHub mobile app (sirf chhote edits)

- [GitHub Android app](https://play.google.com/store/apps/details?id=com.github.android) → repo → file → ✏️ edit → commit
- Chhote fixes ke liye theek; build/deploy nahi kar sakte
- Web UI bhi chalta hai: repo → `.` dabao → github.dev editor khul jayega (desktop keyboard behtar)

## B4. Render deploy (phone se, 5 min)

1. Phone browser → [render.com](https://render.com) → **Sign in with GitHub**
2. **New +** → **Blueprint**
3. `apex-humanoid-v2` repo select → Render `render.yaml` khud padh lega
4. **Apply** → 2-3 min wait
5. Env vars chahiye to **Environment** tab se daalo (optional):
   - `ELEVENLABS_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`
6. URL milega: `https://apex-humanoid-xxxx.onrender.com`
7. Wahi URL phone pe kholo → **Add to Home screen** (A1)

> ⚠️ Free tier 15 min inactivity ke baad sota hai — pehla request ~50 sec le sakta hai. Phone pe "Add to Home screen" ke baad bhi cold start lagega.

## B5. Deploy hook (phone se auto-deploy)

1. Render → service → **Settings** → **Deploy Hook** → URL copy
2. GitHub repo (phone browser) → **Settings → Secrets and variables → Actions**
3. New secret → `RENDER_DEPLOY_HOOK_URL` = wo URL
4. *(Optional)* better-uptime trick: [cron-job.org](https://cron-job.org) se har 10 min pe `/health` ping → cold start khatam

---

# C. Play Store (natara app chahiye?)

Ye ek **website** hai, asli Android app nahi. Play Store pe daalne ke 2 raaste:

| Tareeka | Kaam | Effort |
|---|---|---|
| **TWA (Trusted Web Activity)** | Play Store pe asli app jo aapki site fullscreen kholta hai. Bubblewrap CLI se `assetlinks.json` + `.aab` ban jata hai | Medium — Play Console $25 + domain verify |
| **Capacitor wrapper** | Web app ko native shell mein daal ke APK | Medium — WebGL/WebView performance test karna padega |

Abhi ke liye **PWA install (A1) hi kaafi hai** — Play Store ki jhanjhat ke bina, same fullscreen experience, updates instant.

Agar Play Store chahiye hi, to bolo — main Bubblewrap setup + `assetlinks.json` + build steps bana dunga.

---

# Quick reference

| Kaam | Command / step |
|---|---|
| Phone pe chalao | URL kholo → ENTER → Chrome ⋮ → Add to Home screen |
| Termux se run | `pkg install git nodejs-lts` → clone → `npm i && npm run build && npm start` |
| Codespaces se run | Code → Codespaces → `npm i && npm start` → port 3000 open |
| Deploy | Render → New + → Blueprint → repo → Apply |
| Health check | `curl https://your-app.onrender.com/health` |
| Mic/camera kaam nahi | HTTPS URL use karo |
| Cold start slow | cron-job.org se `/health` ping har 10 min |
