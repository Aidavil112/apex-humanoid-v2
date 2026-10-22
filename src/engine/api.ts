/**
 * Unified backend fetcher:
 * 1. Uses local Express server routes when running full-stack locally / on Render.
 * 2. Automatically falls back to the 24x7 Free Cloudflare Hub when hosted statically on GitHub Pages.
 */
export const CLOUD_HUB_URL = 'https://apex-humanoid-v2.pradhanbibek53.workers.dev';

export async function hubFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    const local = await fetch(path, init);
    if (local.ok) return local;
  } catch {
    // ignore network failure on relative path
  }
  return fetch(`${CLOUD_HUB_URL}${path}`, init);
}
