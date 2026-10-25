 PENDING SRC FIXES (25/10/2026 2:45 am) — sandbox do baar `src/` ko build-55 snapshot par
rollback kar deta aaya hai, isliye ye 3 patch **agle build (6.6.16 / build 57)** me daalne hain.
Abhi ship-kida **v6.6.15 / build 56** (GoFile `DreXyUYT`, md5 `d02dfd7805f96af6ff1b74d79ac97d33`)
me REEL ENGINE **already andar hai** — ye `unzip -p … | grep` se prove ho chuka hai
(`assets/www/assets/index-BHP0Ju-m.js` → "REEL ENGINE" ×2 · "reelEngine" ×4). Isliye APK dobara
banana zaroori nahi — balki abhi rebuild karna **khatarnak** hai (src adhoora hai → feature
chhoot jaata).

────────────────────────────────────────────────────────────────────────
PATCH 1 — src/engine/r2Host.ts : `parseR2Paste` do bug
  (a) CHHOTA LABEL FORM parse nahi hota tha — app ka apna R2_TEMPLATE `access:` / `secret:`
      likhta hai, par regex me "key" word lazmi tha → **secret kabhi bhar-ta hi nahi tha**.
  (b) keys gaib ho to `gluedAkid` fallback **public dev URL ka 32-hex hash** utha leta tha
      (`pub-879f71683a7a403aa61fa1fb120f90d7` → Access Key ID ban jaata) → silent garbage →
      user ko `SignatureDoesNotMatch` dikhta. Test ne pakda: tools/r2-paste-test.mjs assert #4.
Fix (do while replace):
```ts
  const akid =
    t.match(/access[ _-]*key[ _-]*(?:id)?[^0-9a-zA-Z]{0,4}([0-9a-zA-Z]{16,})/i) ||
    t.match(/^[ \t]*access[ \t]*(?:key[ \t]*id)?[ \t]*:[ \t]*([0-9a-zA-Z]{16,})/im);
  const sk =
    t.match(/secret[ _-]*(?:access[ _-]*)?key[^0-9a-zA-Z]{0,4}([0-9a-zA-Z_]{16,})/i) ||
    t.match(/^[ \t]*secret[ \t]*(?:access[ \t]*key)?[ \t]*:[ \t]*([0-9a-zA-Z_]{16,})/im);
  // endpoint host ke saath pub-<32hex> bhi kaato, warna wahi hash access key ban jaata hai
  const afterEp = t
    .replace(/([0-9a-f]{32}(?:\.[0-9a-z-]+)?\.r2\.cloudflarestorage\.com)/i, ' ')
    .replace(/pub-[0-9a-f]{32}/gi, ' ');
```
PATCH 2 — src/components/JarvisAutonomyPanel.tsx : R2_TEMPLATE ke labels
```ts
  const R2_TEMPLATE = ['endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com', 'bucket: apex',
    'access key id: <Access Key ID>', 'secret access key: <Secret Access Key>',
    'public: https://pub-<xxxx>.r2.dev'].join('\n');
```
PATCH 3 — REEL ENGINE (engine + panel UI + buildInfo 6.6.16/57) — poora code `APEX-BRAIN.md`
  ke DONE entry me likha hai (v6.6.15 wali), wahi dobara apply karna hai:
  • `AutoPilotSettings` += `reelEngine: 'auto'|'footage'|'motion'` + `motionStyle: MotionStyle`
    (defaults `auto` / `kino-glass`), `loadSettings()` me validate+k bharnā
  • `executeMission` STEP 2+3 → engine router: motion = `renderMotionForgeVideo(prompt,{style,
    durationSec,width:1080,height:1920,fps:30,saveToVault:false,onProgress})` wrapped in
    `withTimeout(…,120000,'Motion render')` → `video = {blob,url,base64:await blobToBase64(mf.blob),
    mimeType,fileName,title,caption,durationSec,scenes:[]}`; fail/timeout → `⚠️ … footage engine
    par switch` → `video = video || (await runOpenMontageProduction({…}))`
  • panel: Motion Forge card me 🎲 AUTO / 📹 FOOTAGE / ✨ MOTION chips (`patchIg({reelEngine})`) +
    "🤖 AUTO REEL CHALAO" (`runMissionNow`, platforms = amPublish ? all : none) + 📥 SIRF SAVE ↔
    📤 SAVE + PUBLISH toggle + live `amNote` line + 180s watchdog (button azaad, mission queue me)
  • `App.tsx` voice: "reel engine motion|footage|auto karo" → `saveAutopilotSettings({reelEngine})`
    (ye branch ROLLBACK me bhi bachi hui hai — isliye src abhi typecheck NAHI karta, patch 3
    lagte hi theek ho jaayega)
  • tests already maujood hain: `tools/core-panel-test.mjs` me 13 REEL ENGINE asserts (60/60 pass
    kiye the) + naya `tools/r2-paste-test.mjs` (6 asserts; 5/6 — assert #4 PATCH 1 (b) se pass hoga)

────────────────────────────────────────────────────────────────────────
USER KE LIYE AABI PASTE FORM (shipped v6.6.15 parser ke hisaab se — FULL labels zaroori hain):
```
endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
bucket: apex
access key id: <Access Key ID>
secret access key: <Secret Access Key>
public: https://pub-<hash>.r2.dev
```
`access:` / `secret:` (chhote labels) PATCH 1 ke baad chalenge, abhi nahi.
────────────────────────────────────────────────────────────────────────
Rebuild ka sahi tareeka (jab src stable ho):
  cd /home/user/repo && npm install --no-audit --no-fund && npm i jsdom --no-audit --no-fund
  node tools/r2-paste-test.mjs && bash tools/ui-test.sh          # 61/61 + 0 exception chahiye
  bash tools/build-apk.sh 6.6.16 57 && bash tools/verify-apk.sh  # 12/12
  bash tools/upload-gofile.sh                                    # noServer aaye to store9/store1 auto-try
  # phar APK ke andar grep se prove karo:
  unzip -p /home/user/APEX-AI-Pro.apk assets/www/assets/index-*.js | grep -c "REEL ENGINE"
