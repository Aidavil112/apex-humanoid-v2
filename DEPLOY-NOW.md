# Deploy APEX Humanoid

Ek click mein Render pe deploy — free tier, HTTPS included.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Aidavil112/apex-humanoid-v2)

> Button Render khol dega → repo select → Blueprint auto-detect (`render.yaml`) → **Apply**.
> Optional env vars (voice/AI keys) deploy ke baad **Environment** tab se daal sakte ho.

---

## Ya manual (3 steps)

1. [render.com](https://render.com) → **Sign in with GitHub**
2. **New +** → **Blueprint** → repo `apex-humanoid-v2` chuno
3. **Apply** → 2–3 min → URL mil jayega

---

## Deploy ke baad

| Check | Command / step |
|---|---|
| Health | `curl https://YOUR-URL.onrender.com/health` |
| App | URL kholo → **ENTER** |
| Android install | Chrome ⋮ → **Add to Home screen** |
| Mic / camera | HTTPS pe hi chalte hain — Render by default HTTPS deta hai |
| Privacy policy | `https://YOUR-URL/privacy.html` (Play Store ke liye chahiye) |
| Terms | `https://YOUR-URL/terms.html` |

## Optional env vars (Render → Environment)

| Key | Kya milega |
|---|---|
| `ELEVENLABS_API_KEY` | Real natural voice (warna browser voice) |
| `GEMINI_API_KEY` ya `OPENAI_API_KEY` | Proper AI chat replies |
| `COINDCX_API_KEY` + `COINDCX_API_SECRET` | Live trading (warna demo mode) |
| `ANDROID_PACKAGE_NAME` | Play Store TWA ke liye |
| `ANDROID_SHA256_FINGERPRINTS` | Play Store TWA ke liye |

Poora guide: [DEPLOY-V2.md](./DEPLOY-V2.md) · Android: [ANDROID.md](./ANDROID.md) · Play Store: [PLAYSTORE.md](./PLAYSTORE.md)
