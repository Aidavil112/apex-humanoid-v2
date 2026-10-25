// Permanent On-Device IndexedDB Video Vault ("Save karke rakhiye, jab time aaye tab main upload karunga!")
// Stores full binary HD video Blobs + metadata persistently across modal closes, app restarts & phone reboots!

import { hubFetch } from './api';
import { uint8ToBase64 } from './openMontageEngine';

import { logDayEvent } from './dayLog';

export interface SavedVaultVideo {
  id: string;
  createdAt: number;
  title: string;
  caption: string;
  fileName: string;
  mimeType: string;
  durationSec: number;
  sizeBytes: number;
  blob: Blob;
  scheduledAt?: number | null;
  uploadedYoutubeUrl?: string | null;
}

const DB_NAME = 'apex_saved_videos_vault_v1';
const STORE_NAME = 'videos';

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 🔎 v6.6.11: vault khaali na dikhe (file:// par directory listing nahi hoti) —
 *    IndexedDB band ho to bhi app ke andar ke 8 clips gine jaate hain. */
export async function vaultVideoCount(): Promise<number> {
  const n = (await listVaultVideos().catch(() => [] as SavedVaultVideo[])).length;
  return n;
}

export async function saveVideoToVault(entry: SavedVaultVideo): Promise<void> {
  const db = await openVaultDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  try {
    logDayEvent(
      '🎬 Motion Studio',
      `video vault me save hui — ${entry.title || entry.fileName}`,
      `${(entry.sizeBytes / 1e6).toFixed(1)} MB · ${(entry.durationSec || 0).toFixed(1)}s · IndexedDB`,
      true,
    );
  } catch {}
}

export async function listVaultVideos(): Promise<SavedVaultVideo[]> {
  try {
    const db = await openVaultDb();
    const all = await new Promise<SavedVaultVideo[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as SavedVaultVideo[]) || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function deleteVaultVideo(id: string): Promise<void> {
  const db = await openVaultDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function uploadSavedVaultVideoToYouTube(
  item: SavedVaultVideo,
  privacyStatus: 'public' | 'unlisted' | 'private' = 'public'
): Promise<string> {
  const rawBytes = new Uint8Array(await item.blob.arrayBuffer());
  const base64 = uint8ToBase64(rawBytes);
  const accessToken = localStorage.getItem('apex.yt_token') || '';

  const up = await hubFetch('/yt/upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: item.title,
      description: `${item.caption}\n#shorts #ai #automation`,
      tags: ['shorts', 'ai', 'automation'],
      privacyStatus,
      videoBase64: base64,
      mimeType: item.mimeType || 'video/webm',
      accessToken,
    }),
  });

  const uj = await up.json().catch(() => ({}));
  if (!up.ok || uj?.ok === false) {
    throw new Error(uj?.error || 'YouTube account connect karein (🤖 Studio -> 🤖 YT AUTO -> Connect YouTube)');
  }
  const liveUrl = uj?.url || (uj?.videoId ? `https://youtube.com/shorts/${uj.videoId}` : '');
  if (!liveUrl) {
    throw new Error('YouTube upload token missing — Connect YouTube token first');
  }

  const updated: SavedVaultVideo = {
    ...item,
    uploadedYoutubeUrl: liveUrl,
  };
  await saveVideoToVault(updated);
  return liveUrl;
}
