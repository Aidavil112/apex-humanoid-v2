# APEX Humanoid (React + WebGL2 Rebuild)

A procedural 300k-particle WebGL2 humanoid robot featuring interactive speech recognition, audio synthesis, hand gesture tracking, mood responsiveness, and an integrated YouTube Short & Content Package Studio.

## Architecture

- **Frontend**: React 19 SPA powered by Vite and Tailwind CSS.
- **Visual Engine**: Procedural WebGL2 point cloud rendering with custom GLSL vertex and fragment shaders, additive particle blending, breathing dynamics, orbital rings, halo, and animated topographic terrain.
- **Audio Engine**: Synthesized drone, fifth, LFO, and sound effects generated live via the Web Audio API without external audio files.
- **Backend**: Express + Vite middleware server (`server.ts`) hosting API routes for conversational AI (`/chat`, `/chat/stream`), ElevenLabs TTS proxy (`/tts`), YouTube Shorts script planner & voice generator (`/yt/plan`, `/yt/voice`), Content Package strategist (`/content/plan`), and 3D printer telemetry (`/printer`).

## Features

1. **Procedural Humanoid**: 300,000 mathematical points sampled in real time. Switch between procedural characters (Nova, Astra, Unit 7), portrait avatars (KAZE, VEGA), or upload your own face photo to sample into the point cloud.
2. **Interactive Brain & Voice**: Real-time microphone listening via Web Speech API, instant offline rules, and server-side model streaming.
3. **Hand Gesture Tracking**: In-browser skin-tone centroid tracking using the device camera for natural gaze follow without external ML dependencies.
4. **YouTube Shorts Studio**: Full vertical video generator with AI script planning, multi-scene voice synthesis, 2D particle canvas drawing with audio track alignment, MediaRecorder export, and Web Share API integration.
5. **Content Package Strategist**: Generates viral short-form content packages (5 hooks, timed reel script, caption, hashtags, thumbnail copy, posting time recommendation).
6. **Themes & Customization**: Cyan, Violet, Mint, and Amber color palettes with responsive HUD telemetry and ambient lighting controls.

## Development

```bash
npm run dev      # Starts full-stack server on port 3000
npm run build    # Builds Vite frontend into dist/
npm run lint     # Validates TypeScript types
```
## Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Aidavil112/apex-humanoid-v2)

One-click (ya manual 3 steps): **[DEPLOY-NOW.md](./DEPLOY-NOW.md)**

Production-ready, dono raaste:

| Method | Command / steps |
|---|---|
| **Render (blueprint)** | `render.yaml` included → Render → New + → Blueprint → repo select → Apply |
| **Docker** | `docker build -t apex-humanoid . && docker run -p 3000:3000 --env-file .env apex-humanoid` |
| **Docker Compose** | `docker compose up -d --build` |
| **Any Node host** | `npm ci && npm run build && NODE_ENV=production npm start` |

- Health check: `GET /health`
- CI: `.github/workflows/ci.yml` — typecheck → build → server smoke test → Docker image build
- Auto-deploy: `.github/workflows/deploy-render.yml` (repo secret `RENDER_DEPLOY_HOOK_URL`)

Full guide (env vars, custom domain, DNS, troubleshooting): **[DEPLOY-V2.md](./DEPLOY-V2.md)**

## Android / mobile

PWA-ready — Chrome se "Add to Home screen" karke fullscreen app ki tarah chalao.
Termux / Codespaces se phone pe hi build + deploy bhi ho jata hai.

**[ANDROID.md](./ANDROID.md)** — complete guide (Termux commands, HTTPS/mic notes, Play Store options)

Play Store app chahiye? **TWA (Trusted Web Activity)** setup ready hai:
`cd twa && DOMAIN=your-domain ./build.sh` → `.aab` → Play Console.
Full steps: **[PLAYSTORE.md](./PLAYSTORE.md)**
