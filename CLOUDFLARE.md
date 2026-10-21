# Private repo + Free hosting — Cloudflare Pages

**Aapka sawaal:** private repo rakh ke GitHub Pages chalega?
**Jawab:** Nahi — GitHub Free mein Pages sirf **public** repo pe milta hai.
(Pages from private repo = GitHub Pro $4/month, aur site phir bhi public rahegi.)

**Solution:** Cloudflare Pages — **repo private rehta hai, hosting free, auto-deploy.**

---

## Kya milega

| Cheez | Detail |
|---|---|
| Cost | **$0** — 500 builds/month, unlimited bandwidth |
| Repo visibility | **Private** (koi code public nahi hoga) |
| Auto-deploy | `git push` → 60 sec mein live |
| HTTPS | Free, auto |
| Custom domain | Free |
| Cold start | **Koi nahi** (Netlify/Render se behtar) |

---

## Setup (browser se, 3 minute — phone se bhi)

### 1. Cloudflare account
[pages.cloudflare.com](https://pages.cloudflare.com) → **Sign up** (email ya GitHub se)

### 2. Repo connect karo
1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. **GitHub** authorize karo → sirf `apex-humanoid-v2` repo ko access do
   *(GitHub App hai, token ki zaroorat nahi — aap manually permission dete ho)*
3. Repo select karo → **Begin setup**

### 3. Build settings (exactly ye daalo)

| Field | Value |
|---|---|
| Framework preset | **None** (ya Vite) |
| Production branch | `main` |
| **Build command** | `npm install --no-audit --no-fund && npm run build` |
| **Build output directory** | `dist` |

> `PAGES_BASE` set **na** karo — Cloudflare root `/` pe serve karta hai, `dist` bilkul sahi hai.

### 4. Deploy
**Save and Deploy** dabao → 1-2 min → URL:
```
https://apex-humanoid-v2.pages.dev
```

Bas. Repo private hai, site live hai. 🎉

---

## Deploy ke baad

| Kaam | Kaise |
|---|---|
| Phone pe install | Chrome ⋮ → **Add to Home screen** (PWA) |
| Privacy / Terms | `https://your-site.pages.dev/privacy.html` |
| Custom domain | Pages → **Custom domains** → apna domain add → DNS |
| Auto-deploy | Har `git push` pe khud deploy (main branch) |
| Preview deploys | Har branch/PR ka alag URL milta hai — free |

---

## Repo mein kya ready hai

| File | Kaam |
|---|---|
| `public/_headers` | Caching + security headers (Cloudflare/Netlify dono padhte hain) |
| `public/_redirects` | SPA fallback — koi bhi path app shell serve kare |
| `public/manifest.webmanifest` | PWA install |
| `render.yaml` | (optional) Render pe full-stack version |

---

## Teen options — comparison

| | GitHub Pages | **Cloudflare Pages** | Netlify Drop |
|---|---|---|---|
| Private repo | ❌ (Pro $4 chahiye) | ✅ | ✅ (repo connect hi nahi) |
| Cost | Free | **Free** | Free |
| Auto-deploy on push | ✅ | ✅ | ❌ (manual drag) |
| Setup | repo public karna padega | 3 min, GitHub App | 60 sec, no account |
| Bandwidth | 100 GB/mo soft | Unlimited | 100 GB/mo |
| Cold start | Nahi | **Nahi** | Nahi |

**Recommendation:** Cloudflare Pages — private repo + free + auto-deploy, teeno ek saath.

---

## Agar GitHub Pages hi chahiye

Do raaste:

1. **Pro le lo** — $4/month → Settings → Pages → private repo se publish.
   (Site public rahegi, sirf code private.)
2. **Repo public karo** — free. Is repo mein koi secret nahi hai (scan kiya hai,
   `.env` gitignored hai, keys sirf env vars se aati hain), to public karna safe hai.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Build fail: `vite: not found` | Build command mein `npm install` hona chahiye (dev deps chahiye build ke liye) |
| Blank page | Build output directory `dist` hai ya nahi check karo |
| 404 on refresh | `_redirects` file `dist/` mein hona chahiye (build ke baad verify karo) |
| Assets 404 | `PAGES_BASE` set mat karo — root build hona chahiye |
| Build 10 min se zyada | Node version 20 set karo (Settings → Environment variables → `NODE_VERSION=20`) |
