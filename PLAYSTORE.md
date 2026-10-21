# APEX Humanoid → Play Store (TWA)

Ye guide aapko **Play Store pe APEX ka asli Android app** banane ke liye end-to-end le jayega.
Technique: **TWA (Trusted Web Activity)** — Play Store pe native app, par andar aapki website
fullscreen chalti hai (koi browser bar nahi). Updates instant — website update = app update.

```
Website (Render)  ──TWA──►  Play Store app (.aab)
        │                          │
        └── /.well-known/assetlinks.json  ← domain verification
```

---

## 0. Puri picture (kya-kya lagega)

| Cheez | Detail |
|---|---|
| Deployed HTTPS site | Render pe deploy hona chahiye — **required** |
| Java JDK 17 | Bubblewrap ke liye (auto-download ho jata hai) |
| @bubblewrap/cli | `npx @bubblewrap/cli` |
| Signing keystore | Script bana deta hai — **safe rakho** |
| Play Console account | **$25 one-time** (India mein ~₹2,100) |
| Time | Pehli baar: 1–2 din (Play review 1–7 din) |

> Play Store pe daalna zaroori nahi — **PWA install (Chrome → Add to Home screen)** bilkul free hai
> aur 90% experience same. Play Store tab jab chahiye jab aapko Play listing / distribution chahiye.

---

## 1. Pehle site deploy karo

```bash
# Render → New + → Blueprint → apex-humanoid-v2 → Apply
# URL milega: https://apex-humanoid-xxxx.onrender.com
```

Verify:
```bash
curl -I https://apex-humanoid-xxxx.onrender.com/
curl -s https://apex-humanoid-xxxx.onrender.com/manifest.webmanifest | head
```

Domain note likh lo — aage har jagah `DOMAIN` matlab yahi.

---

## 2. Package name + env vars

Package ID **permanent** hota hai — Play Store pe ek baar publish hone ke baad change nahi hota.

```
ANDROID_PACKAGE_NAME=com.aidavil.apexhumanoid
```
> `com.aidavil.*` best hai (aapka GitHub username) — reverse-domain convention. Koi aur bhi chalega
> jab tak unique hai, par `com.example.*` Play Store reject kar deta hai.

Render → **Environment** → ye add karo (fingerprints baad mein):

| Key | Value |
|---|---|
| `ANDROID_PACKAGE_NAME` | `com.aidavil.apexhumanoid` |
| `ANDROID_SHA256_FINGERPRINTS` | *(step 4 ke baad)* |

Server ne `/.well-known/assetlinks.json` route already bana diya hai — env var set karte hi live ho jayega.

---

## 3. App bundle banao

```bash
cd twa
DOMAIN=apex-humanoid-xxxx.onrender.com ./build.sh
```

Script ye karega:
1. Site + `manifest.webmanifest` reachable hai ya nahi — check
2. `twa-manifest.json` mein aapka domain/package bhar dega
3. **`android.keystore`** bana dega (password screen pe print hoga — **likh lo!**)
4. `bubblewrap build` → **`app-release-bundle.aab`** + `app-release-signed.apk`

Output:
```
twa/app-release-bundle.aab     ← Play Console pe yahi upload hota hai
twa/app-release-signed.apk     ← phone pe direct test install
```

**Pehli baar bubblewrap JDK/SDK maang sakta hai** — `Y` dabao, khud download kar lega (~1 GB).
Manual chahiye to:
```bash
npx @bubblewrap/cli doctor    # kya missing hai batata hai
```

### Phone pe test (Play Store se pehle)

```bash
adb install twa/app-release-signed.apk
```
App khulega — agar URL bar dikh raha hai to assetlinks verify nahi hua (step 4 karo). Chhoti si
"Installing APK" warning normal hai (sideload).

---

## 4. Digital Asset Links (sabse important step)

Ye batata hai ki "ye app is domain ka malik hai". Bina iske app Chrome ke andar URL bar ke saath
khulega (TWA verify fail).

### 4a. Fingerprints nikaalo

```bash
cd twa
./fingerprint.sh <keystore-password>       # local upload key
```
```
SHA256: 6A:1B:...   ← upload key
```

Aur Play Console se **Play App Signing key** ka fingerprint:
**App → Test and release → Setup → App integrity → App signing key certificate → SHA-256**

> Play App Signing **ON** rakho (default). Google app ko re-sign karta hai — isliye **dono**
> fingerprints chahiye: lokal upload key + Google ki signing key.

### 4b. Render pe set karo

```
ANDROID_SHA256_FINGERPRINTS=6A:1B:...,FA:9E:...
```
(comma separated, dono)

### 4c. Verify

```bash
curl -s https://YOUR_DOMAIN/.well-known/assetlinks.json | python3 -m json.tool
```

Google ka official verifier:
```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://YOUR_DOMAIN&relation=delegate_permission/common.handle_all_urls
```
`statements` array khali nahi hona chahiye.

**Common galti:** fingerprint mein `SHA256:` prefix ya lowercase — script uppercase kar deta hai,
par prefix hata dena (server sirf `AA:BB:...` format leta hai).

---

## 5. Play Console

1. [play.google.com/console](https://play.google.com/console) → **$25** one-time fee, identity verify
2. **Create app**:
   - Name: `APEX Humanoid`
   - Default language: English (India) / Hindi
   - App or game: **App** · Free/Paid: **Free**
   - Declarations tick karo
3. **Testing → Internal testing → Create new release** → `app-release-bundle.aab` upload
4. Release notes likho → **Review** → **Rollout**
5. Internal testers ke email add karo → link se install → **asli phone pe verify karo**
   (URL bar nahi dikhna chahiye!)
6. Sab theek → **Production** pe promote

### Store listing ke liye zaroori

| Item | Spec |
|---|---|
| App icon | 512×512 PNG — `icon-512.png` ready hai ✅ |
| Feature graphic | 1024×500 PNG/JPG |
| Phone screenshots | **2 minimum**, min 320px, 16:9 ya 9:16 — apne screenshots se upload karo |
| Short description | 80 chars max |
| Full description | 4000 chars max |
| Privacy policy URL | **Required** — ek page chahiye (neeche note) |
| Data safety form | Camera/mic/storage access declare karo |
| Content rating | Questionnaire bharo (IARC) |
| Target audience | 13+ ya 18+ |

### Privacy policy (chahiye hi)

Ek simple `privacy.html` banao aur host karo — batao ki:
- Camera sirf gesture tracking ke liye, video kabhi server pe nahi jata
- Mic sirf speech recognition ke liye (browser ka Web Speech API)
- Koi personal data store nahi hota (except localStorage settings)
- Third-party: ElevenLabs (voice), Google Gemini/OpenAI (chat) — tab hi jab keys set ho

Bolo to main `privacy.html` + `terms.html` bhi bana dun.

---

## 6. Updates

Website update karna = app update **automatically** (TWA live web content dikhata hai).

Sirf tab naya `.aab` chahiye jab:
- App icon/name change
- Version bump (`appVersionCode` badhao — hamesha +1, kabhi repeat nahi)
- Permissions/policy change

```bash
cd twa
# twa-manifest.json mein appVersionCode +1 karo
npx @bubblewrap/cli build --skipPwaValidation
# naya .aab upload
```

---

## 7. Troubleshooting

| Problem | Wajah | Fix |
|---|---|---|
| App mein URL bar dikh raha hai | Asset Links verify nahi hua | Step 4 dohrao; fingerprint format check |
| `assetlinks.json` 404 | Env vars set nahi | Render env mein `ANDROID_PACKAGE_NAME` + `ANDROID_SHA256_FINGERPRINTS` |
| `bubblewrap doctor` JDK error | Java 17 nahi | `sudo apt install openjdk-17-jdk` ya bubblewrap ka auto-download `Y` |
| Play: "package name already exists" | Kisi aur ne liya | `PACKAGE` badlo, phir se build |
| Play: "version code already used" | Purana code | `appVersionCode` +1 |
| Build fail: `SDK not found` | Android SDK missing | `npx @bubblewrap/cli doctor` → `Y` se install |
| App kholte hi blank | Render cold start | Free tier ~50s; `cron-job.org` se `/health` ping |
| Mic/camera app mein nahi chalta | TWA mein permission flow alag | Android Settings → app → Permissions se manually do |
| Play review reject: "webview only" | TWA minimal functionality | Screenshots + description mein features highlight karo, ya Play policy dekh lo |

---

## 8. Checklist

- [ ] Site HTTPS pe deployed (`/health` OK)
- [ ] `manifest.webmanifest` reachable
- [ ] `ANDROID_PACKAGE_NAME` set
- [ ] `cd twa && DOMAIN=... ./build.sh` → `.aab` ready
- [ ] `android.keystore` + password **safe backup** (gitignored hai)
- [ ] Play App Signing cert fingerprint liya
- [ ] `ANDROID_SHA256_FINGERPRINTS` set → assetlinks verify
- [ ] Internal testing pe **URL bar nahi** dikh raha
- [ ] Privacy policy hosted
- [ ] Screenshots + feature graphic ready
- [ ] Production rollout

---

## Files

| File | Kaam |
|---|---|
| `twa/twa-manifest.json` | Bubblewrap config (domain/package auto-fill) |
| `twa/build.sh` | Manifest fill → keystore → `.aab` build |
| `twa/fingerprint.sh` | SHA-256 nikaalo + assetlinks live verify |
| `server.ts` → `/.well-known/assetlinks.json` | Domain verification endpoint (env-driven) |
| `public/manifest.webmanifest` | PWA manifest (TWA isi se padhta hai) |
