# APEX Humanoid — Deploy Playbook (v2)

Repo: `Aidavil112/apex-humanoid-v2` · Server: Express + `tsx server.ts` · Frontend: Vite → `dist/`
Port: `PORT` env var (default **3000**) · Health check: **`/health`**

---

## 0. Environment variables

| Key | Required | Kya karta hai |
|---|---|---|
| `PORT` | ⛔ | Server port. Render/Railway khud dete hain — **set na karo** |
| `NODE_ENV` | ✅ | `production` — isse Express `dist/` serve karta hai (Vite middleware off) |
| `ELEVENLABS_API_KEY` | optional | Real TTS voice. Na ho to browser voice fallback |
| `ELEVENLABS_MODEL` / `ELEVENLABS_VOICE_ID` | optional | Voice tuning |
| `GEMINI_API_KEY` | optional | `/chat` ke liye (3.8-flash → 3.5-lite fallback) |
| `OPENAI_API_KEY` | optional | `/chat` ka doosra provider |
| `COINDCX_API_KEY` / `COINDCX_API_SECRET` | optional | Live trading (na ho to `FILLED_SANDBOX` demo mode) |

> ⚠️ `.env` kabhi commit na karo — `.gitignore` mein already blocked hai. Sab keys **host ke dashboard** se daalo.

---

## 1. Sabse aasan — Render Blueprint (repo mein `render.yaml` hai)

1. [render.com](https://render.com) → **New +** → **Blueprint**
2. Repo `apex-humanoid-v2` select karo → Render `render.yaml` khud padh lega
3. **Apply** dabao
4. **Environment** tab → jo keys chahiye daalo (`ELEVENLABS_API_KEY` etc.) → **Save**
5. 2–3 min baad URL milega: `https://apex-humanoid-xxxx.onrender.com`

`render.yaml` mein pehle se set hai: `buildCommand` = install + build, `startCommand` = `npm start`, `healthCheckPath` = `/health`, region = Singapore (India se latency kam), plan = free.

**Free tier ki 3 baatein:** cold start ~50s (15 min inactivity ke baad), 750 ghante/month, custom domain allowed.

---

## 2. Docker se kahin bhi

```bash
docker build -t apex-humanoid .
docker run -p 3000:3000 --env-file .env apex-humanoid
# kholo: http://localhost:3000
```

`Dockerfile` multi-stage hai: build stage Vite build karta hai, runtime stage sirf `dist/` + prod deps le kar chalta hai (~200 MB), non-root `node` user, `HEALTHCHECK` built-in.

**Render pe Docker:** New + → Web Service → repo → Runtime **Docker** → health check `/health`
**Fly.io:**
```bash
fly launch --no-deploy      # Dockerfile auto-detect
fly secrets set ELEVENLABS_API_KEY=sk_...
fly deploy
```
**Railway:** repo connect → auto-detect Dockerfile → Variables mein keys → Deploy
**Apna VPS (Ubuntu):**
```bash
git clone https://github.com/Aidavil112/apex-humanoid-v2.git && cd apex-humanoid-v2
cp .env.example .env && nano .env          # keys daalo
docker compose up -d --build               # docker-compose.yml included
```
Phir Caddy se free HTTPS (sabse aasan):
```
yourdomain.com {
    reverse_proxy 127.0.0.1:3000
}
```

---

## 3. Custom domain

**Render:** Service → **Settings** → **Custom Domains** → **Add Custom Domain** → apna domain daalo.

DNS records (registrar: GoDaddy / Namecheap / Cloudflare):

| Type | Name | Value | Note |
|---|---|---|---|
| `CNAME` | `www` | `apex-humanoid-xxxx.onrender.com` | www ke liye |
| `ALIAS` / `A` | `@` | Render dashboard jo dikhaye | Apex/root ke liye — Cloudflare pe **CNAME flattening** use karo |
| `TXT` | `_render` | verification value | Sirf agar Render maange |

- **SSL:** Render khud Let's Encrypt cert deta hai — DNS propagate (5–30 min) ke baad **Verify** dabao
- **Cloudflare:** proxy **ON** rakho → *SSL/TLS → Full (strict)*. Ye free CDN + DDoS bhi deta hai
- **Redirect:** `www` → root ya ulta, Render ke Redirects tab se ek line mein set ho jata hai

---

## 4. GitHub Actions (already included)

**`.github/workflows/ci.yml`** — har push/PR pe:
- `npm ci` → `tsc --noEmit` (typecheck) → `vite build` → server boot + `/health` smoke test
- Docker image build + container health check (proof ki Dockerfile chalta hai)

**`.github/workflows/deploy-render.yml`** — CI pass hone ke baad Render deploy hook fire karta hai:
1. Render → Service → **Settings** → **Deploy Hook** → URL copy
2. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `RENDER_DEPLOY_HOOK_URL` · Value: hook URL
3. Bas — ab har `main` push pe auto-deploy

> Secret na ho to workflow sirf warning deta hai, fail nahi hota.

---

## 5. Health, logs & troubleshooting

```bash
curl https://your-app.onrender.com/health
# {"status":"ok","GEMINI_API_KEY":"not set",...,"printer":"demo (virtual benchy)"}
```

| Problem | Wajah | Fix |
|---|---|---|
| Build fail: `vite: not found` | `npm install --omit=dev` | `render.yaml` ka build command use karo (`npm install && npm run build`) |
| Blank/white page | `dist/` serve nahi ho raha | `NODE_ENV=production` set hai? |
| White screen sirf iframe preview mein | `localStorage` access throws | Already fixed — `index.html` ka storage shim |
| 502 / service sleeping | Render free cold start | 15 min baad pehla request ~50s lega — normal |
| Voice nahi bol raha | `ELEVENLABS_API_KEY` missing | Env var daalo → redeploy; fallback browser voice hai |
| `/chat` generic reply | Koi LLM key nahi | `GEMINI_API_KEY` ya `OPENAI_API_KEY` daalo |
| Camera/mic kaam nahi karta | HTTPS chahiye | Deployed URL use karo (localhost bhi chalega) |

---

## 6. Security checklist (deploy se pehle)

- [ ] `.env` commit nahi hua (`git log --all -- .env` khali hona chahiye)
- [ ] Sab API keys **host dashboard** se set
- [ ] Trading keys sirf tab daalo jab live trade chahiye — warna demo mode best
- [ ] Exposed GitHub tokens revoke: [settings/tokens](https://github.com/settings/tokens)
- [ ] Custom domain pe HTTPS **Full (strict)** (Cloudflare) ho
- [ ] `COINDCX_API_SECRET` ko read-only/permission-limited key rakho
