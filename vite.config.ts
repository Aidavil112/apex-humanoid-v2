import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// BASE_PATH lets us build for a sub-path host such as GitHub Pages
// (https://<user>.github.io/<repo>/) without touching the source.
//   npm run build                     -> base "/"      (Render, Docker, any root host)
//   PAGES_BASE=/apex-humanoid-v2/ npm run build  -> sub-path build
const base = process.env.PAGES_BASE || './';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});
