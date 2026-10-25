/**
 * 🍎 iOS / iPadOS AUTOPILOT SUPPORT — Apple PWA jo ALLOW karta hai, bas wahi (honest).
 *
 * Sach pehle:
 *   • iOS Safari me PWA background me LAMBA kaam nahi kar sakti. App band/bahar →
 *     JS suspend. Isliye "raat 7 baje phone band rahe aur upload ho jaye" iPhone par
 *     MUMKIN NAHI (Apple ki policy — code ki galti nahi). Android par native bridge
 *     + AlarmManager se hota hai, iPhone par nahi.
 *   • Jo MUMKIN hai aur yahan kiya gaya:
 *       1) 🖥️ SCREEN WAKE LOCK (iOS 16.4+): render chalte waqt screen band na ho —
 *          warna 30s–2min me phone so jaata hai aur mission beech me mar jaati hai.
 *       2) 🔁 APP WAPAS KHULNE PAR CATCH-UP: jo mission adhoori ruki thi, app khulte hi
 *          dobara uth kar chal padti hai (headBotAutopilot.resumeInterruptedMissions).
 *       3) HONEST UI LINE: user ko saaf pata rahe ki iPhone par kya chal raha hai.
 *
 * Koi jhooth nahi: ye module background execution ka WAADA nahi karta.
 */

export function isAppleTouch(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iPadAsMac = /Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadAsMac;
}

export function wakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as any).wakeLock?.request;
}

type WakeState = 'on' | 'off' | 'unsupported';

let sentinel: any = null;
let want = false;
let watching = false;
let lastReason = '';

async function acquire(reason: string): Promise<boolean> {
  if (!wakeLockSupported()) return false;
  try {
    sentinel = await (navigator as any).wakeLock.request('screen');
    lastReason = reason;
    // Browser kabhi bhi lock chhod sakta hai (tab switch, battery saver) → wapas lena hai
    try {
      sentinel.addEventListener('release', () => {
        sentinel = null;
      });
    } catch {}
    return true;
  } catch {
    sentinel = null;
    return false;
  }
}

function watchVisibility() {
  if (watching || typeof document === 'undefined') return;
  watching = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && want && !sentinel) {
      void acquire(lastReason || 'resume');
    }
  });
}

/**
 * Screen ko jaagta rakho (jab tak releaseAwake na ho).
 * @returns lock mil gaya to true (unsupported/battery-saver par false)
 */
export async function keepAwake(reason = 'autopilot'): Promise<boolean> {
  want = true;
  watchVisibility();
  if (sentinel) return true;
  return await acquire(reason);
}

export function releaseAwake(): void {
  want = false;
  try {
    sentinel?.release?.();
  } catch {}
  sentinel = null;
}

export function wakeLockState(): WakeState {
  if (!wakeLockSupported()) return 'unsupported';
  return sentinel ? 'on' : 'off';
}

/** UI/voice ke liye ek line — jhooth ke bina. */
export function iosAutopilotNote(): string {
  if (!isAppleTouch()) {
    return '🤖 Android: alarm + background service se scheduled upload chalta hai.';
  }
  if (!wakeLockSupported()) {
    return '🍎 iPhone (purana iOS): screen band hote hi autopilot rukega — app khuli rakho. iOS 16.4+ par screen-lock bachav milta hai.';
  }
  return '🍎 iPhone: render ke waqt screen jaagti rehti hai (Wake Lock). App poori band hui to mission next open par khud catch-up karegi — background me nahi.';
}
