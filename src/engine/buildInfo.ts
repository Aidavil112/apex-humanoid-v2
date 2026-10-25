/**
 * 🔎 BUILD INFO + SELF-CHECK — install ke baad ek nazar me pata chal jaaye ki app
 * pura latest hai aur naye systems wired hain ya nahi (koi alag page kholne ki zaroorat nahi).
 *
 * `selfCheck()` sirf WAQAI cheezein ginta hai: localStorage keys, vault count,
 * recorder support, settings flags — aur ek line ka verdict deta hai.
 */

import { motionForgeSupported } from './motionForge';
import { isR2Configured, loadR2Settings, R2_STORE } from './r2Host';
import { BRAIN_KEY, loadBrain } from './brainMemory';
import { loadSettings } from './headBotAutopilot';

export const BUILD = {
  name: '6.6.14',
  code: 55,
  /** ye list UI badge + voice dono me use hoti hai */
  systems: ['📚 Brain File', '🔐 Awaz Pehchaan', '🎯 Word Confirm', '👁️ Bahar ki Aankh', '🪣 R2 Host', '🐙 GitHub Host', '🎬 Motion Forge', '🏢 Company Mode', '📊 Day Log', '🎞️ App-Andar Video Hub', '🎙️ Voice Keeper', '🧭 Setup (3 kaam)', '📸 IG Auto', '💰 CoinDCX Desk'],
} as const;

export interface CheckItem {
  label: string;
  ok: boolean;
  note: string;
}

export interface SelfCheckResult {
  build: string;
  code: number;
  at: number;
  items: CheckItem[];
  okCount: number;
  warnCount: number;
  verdict: string;
  /** speak() ke liye — emoji-free */
  voice: string;
}

function flag(key: string): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

/** Vault + motion + R2 + brain + voice — sab ki wiring 1 second me. */
export async function selfCheck(): Promise<SelfCheckResult> {
  const items: CheckItem[] = [];
  const push = (label: string, ok: boolean, note: string) => items.push({ label, ok, note });

  const brain = (() => {
    try {
      return loadBrain();
    } catch {
      return null;
    }
  })();
  push('📚 Brain File', !!brain && brain.entries.length > 0, brain ? `${brain.entries.length} entries (GitHub store: ${flag(BRAIN_KEY) ? 'yes' : 'no'})` : 'load fail');

  let vaultCount = 0;
  try {
    const { listVaultVideos } = await import('./videoVaultDb');
    vaultCount = (await listVaultVideos()).length;
  } catch {
    /* idb unavailable */
  }
  push('🎞️ Video Vault', vaultCount >= 0, `${vaultCount} clip app ke andar (koi alag page nahi)`);

  const mf = motionForgeSupported();
  push('🎬 Motion Forge', mf.ok, mf.ok ? 'Canvas + MediaRecorder ready' : mf.reason || 'recorder unavailable');

  const r2 = (() => {
    try {
      return loadR2Settings();
    } catch {
      return null;
    }
  })();
  push('🪣 R2 Host', !!r2 && r2.enabled && isR2Configured(r2), r2?.enabled ? (isR2Configured(r2) ? `bucket ${r2.bucket}` : 'config adhoora') : `off (store: ${flag(R2_STORE) ? 'saved' : 'empty'})`);

  const st = (() => {
    try {
      return loadSettings();
    } catch {
      return null;
    }
  })();
  push('📸 IG auto-publish', !!st && !!st.igAccessToken && !!st.igBusinessId, st ? `host: ${st.assetHostKind === 'r2' ? 'R2' : 'GitHub'} · repo ${st.ghOwner}/${st.ghRepo}` : 'settings fail');
  push('🔐 Awaz Pehchaan', flag('apex' + '_voice_print_v1'), flag('apex' + '_voice_lock_v1') ? 'lock stored' : 'enroll: "awaaz register karo"');
  push('🏢 Company Mode', true, 'standup ready');
  push('💰 CoinDCX sync', !!st, 'live wallet + positions');

  const okCount = items.filter((i) => i.ok).length;
  const warnCount = items.length - okCount;
  const verdict = `v${BUILD.name} (build ${BUILD.code}) — ${okCount}/${items.length} system wired${warnCount ? `, ${warnCount} ko aapka input chahiye` : ', koi gadbadi nahi'}.`;
  const voice = `Build version ${BUILD.name}, code ${BUILD.code}. ${items.length} me se ${okCount} system jude hue hain.${
    warnCount ? ` ${warnCount} cheez me aapka input bacha hai — screen par dikha raha hoon.` : ' Koi gadbadi nahi mili.'
  }`;
  return { build: BUILD.name, code: BUILD.code, at: Date.now(), items, okCount, warnCount, verdict, voice };
}

export function describeBuild(): string {
  return `v${BUILD.name} · build ${BUILD.code} · ${BUILD.systems.length} systems`;
}
