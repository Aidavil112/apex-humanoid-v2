// Universal Android Native APK Bridge + Mobile Chrome Deep-Link Launcher

declare global {
  interface Window {
    ApexAndroid?: {
      openPackage: (pkg: string, fallbackUrl: string) => boolean;
      openUrl: (url: string) => void;
      setAlarm: (hour: number, minute: number, message: string) => boolean;
      setTimer: (seconds: number, message: string) => boolean;
      dialNumber: (phone: string) => void;
      openSettings: (section: string) => void;
    };
  }
}

export interface PhoneCommandPayload {
  app?: string;
  query?: string;
  text?: string;
  hour?: number;
  minute?: number;
  seconds?: number;
  number?: string;
}

const APP_MAP: Record<string, { pkg: string; scheme: string; web: string }> = {
  whatsapp: { pkg: 'com.whatsapp', scheme: 'whatsapp://app', web: 'https://wa.me/' },
  instagram: { pkg: 'com.instagram.android', scheme: 'instagram://app', web: 'https://www.instagram.com/' },
  youtube: { pkg: 'com.google.android.youtube', scheme: 'vnd.youtube://', web: 'https://m.youtube.com/' },
  telegram: { pkg: 'org.telegram.messenger', scheme: 'tg://resolve', web: 'https://t.me/apex_humanoid1_bot' },
  coindcx: { pkg: 'com.coindcx.btc', scheme: 'coindcx://', web: 'https://coindcx.com/' },
  maps: { pkg: 'com.google.android.apps.maps', scheme: 'geo:19.0760,72.8777', web: 'https://maps.google.com/' },
  spotify: { pkg: 'com.spotify.music', scheme: 'spotify://', web: 'https://open.spotify.com/' },
  chrome: { pkg: 'com.android.chrome', scheme: 'https://www.google.com', web: 'https://www.google.com/' },
  camera: { pkg: 'com.android.camera', scheme: '', web: '' },
};

export function executePhoneAction(action: string, payload?: PhoneCommandPayload): boolean {
  const bridge = window.ApexAndroid;

  if (action === 'SET_ALARM' && payload) {
    const h = typeof payload.hour === 'number' ? payload.hour : 7;
    const m = typeof payload.minute === 'number' ? payload.minute : 0;
    const label = payload.text || 'APEX Alarm';
    if (bridge?.setAlarm) {
      return bridge.setAlarm(h, m, label);
    }
    return false;
  }

  if (action === 'SET_TIMER' && payload) {
    const secs = payload.seconds || 300;
    if (bridge?.setTimer) {
      return bridge.setTimer(secs, 'APEX Timer');
    }
    return false;
  }

  if (action === 'DIAL_PHONE' && payload?.number) {
    const clean = payload.number.replace(/[^0-9+]/g, '');
    if (bridge?.dialNumber) {
      bridge.dialNumber(clean);
    } else {
      window.location.href = `tel:${clean}`;
    }
    return true;
  }

  if (action === 'OPEN_SETTINGS') {
    const sec = payload?.app || 'main';
    if (bridge?.openSettings) {
      bridge.openSettings(sec);
      return true;
    }
    return false;
  }

  if (action === 'LAUNCH_APP' && payload?.app) {
    const key = payload.app.toLowerCase();
    const q = payload.query?.trim() || '';

    // Special search deep links
    if (key === 'youtube' && q) {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
      if (bridge?.openUrl) bridge.openUrl(url);
      else window.open(url, '_blank');
      return true;
    }
    if (key === 'google' || (key === 'chrome' && q)) {
      const url = `https://www.google.com/search?q=${encodeURIComponent(q || 'news')}`;
      if (bridge?.openUrl) bridge.openUrl(url);
      else window.open(url, '_blank');
      return true;
    }
    if (key === 'maps' && q) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
      if (bridge?.openUrl) bridge.openUrl(url);
      else window.open(url, '_blank');
      return true;
    }
    if (key === 'whatsapp' && payload.text) {
      const url = `https://wa.me/?text=${encodeURIComponent(payload.text)}`;
      if (bridge?.openUrl) bridge.openUrl(url);
      else window.location.href = url;
      return true;
    }

    const info = APP_MAP[key];
    if (info) {
      if (bridge?.openPackage) {
        bridge.openPackage(info.pkg, info.web);
        return true;
      }
      // Mobile Chrome on Android intent:// deep-link launcher!
      const isAndroid = /android/i.test(navigator.userAgent);
      if (isAndroid && info.pkg) {
        window.location.href = `intent://#Intent;package=${info.pkg};S.browser_fallback_url=${encodeURIComponent(
          info.web
        )};end`;
        return true;
      }
      if (info.web) {
        window.open(info.web, '_blank');
        return true;
      }
    }
  }

  return false;
}

/** Local client-side fast parser so typed commands ALSO launch phone apps instantaneously in < 5ms! */
export function parseLocalPhoneCommand(raw: string): {
  action: string;
  payload: PhoneCommandPayload;
  reply: string;
} | null {
  const t = raw.trim();
  const low = t.toLowerCase();

  // Alarm: "subah 6:30 ka alarm lagao", "set alarm 7 30", "alarm 6 baje"
  if (/\b(alarm)\b/i.test(low)) {
    const tm = low.match(/(\d{1,2})(?:[:.\s]+(\d{1,2}))?/);
    let hour = tm ? parseInt(tm[1], 10) : 7;
    const minute = tm && tm[2] ? Math.min(59, parseInt(tm[2], 10)) : 0;
    if (/(sham|shaam|raat|pm|dopahar)/i.test(low) && hour < 12) hour += 12;
    if (/(subah|am)/i.test(low) && hour === 12) hour = 0;
    hour = Math.max(0, Math.min(23, hour));
    const padM = String(minute).padStart(2, '0');
    return {
      action: 'SET_ALARM',
      payload: { hour, minute, text: 'APEX Alarm' },
      reply: `Done boss! ${hour}:${padM} ka phone alarm set kar raha hoon.`,
    };
  }

  // Timer: "5 minute ka timer lagao"
  if (/\b(timer)\b/i.test(low)) {
    const nm = low.match(/(\d+)/);
    const mins = nm ? parseInt(nm[1], 10) : 5;
    const secs = /sec/i.test(low) ? mins : mins * 60;
    return {
      action: 'SET_TIMER',
      payload: { seconds: secs },
      reply: `${mins} minute ka timer chalu kar diya hai!`,
    };
  }

  // Phone call number: "call 9876543210"
  const dialMatch = low.match(/(?:call\s*karo|call|phone\s*lagao|dial)\s+([+0-9][0-9\s-]{6,})/);
  if (dialMatch?.[1]) {
    return {
      action: 'DIAL_PHONE',
      payload: { number: dialMatch[1] },
      reply: `Phone dialer me ${dialMatch[1].trim()} laga raha hoon.`,
    };
  }

  // WhatsApp
  if (/\b(whatsapp|whats\s*app)\b/i.test(low)) {
    const msgMatch = t.match(/(?:message|msg|bhejo|likho)\s+(.+)/i);
    return {
      action: 'LAUNCH_APP',
      payload: { app: 'whatsapp', text: msgMatch?.[1]?.trim() },
      reply: 'WhatsApp khol raha hoon boss!',
    };
  }

  // Instagram
  if (/\b(instagram|insta)\b/i.test(low)) {
    return {
      action: 'LAUNCH_APP',
      payload: { app: 'instagram' },
      reply: 'Instagram khol raha hoon boss!',
    };
  }

  // YouTube App (when NOT saying "YouTube Studio")
  if (/\b(youtube)\b/i.test(low) && !/\b(studio|short\s*upload)\b/i.test(low)) {
    const qMatch = t.match(/youtube\s+(?:par|pe|me|on)?\s*(.+?)(?:\s+(?:chalao|play|search|lagao|kholo))?$/i);
    const cleanedQ = qMatch?.[1] && !/^(kholo|open|app|chalao)$/i.test(qMatch[1].trim()) ? qMatch[1].trim() : '';
    return {
      action: 'LAUNCH_APP',
      payload: { app: 'youtube', query: cleanedQ },
      reply: cleanedQ ? `YouTube par "${cleanedQ}" khol raha hoon!` : 'YouTube app khol raha hoon!',
    };
  }

  // Telegram
  if (/\b(telegram)\b/i.test(low)) {
    return { action: 'LAUNCH_APP', payload: { app: 'telegram' }, reply: 'Telegram khol raha hoon!' };
  }

  // CoinDCX Official App
  if (/\b(coindcx\s*app|open\s*coindcx)\b/i.test(low)) {
    return { action: 'LAUNCH_APP', payload: { app: 'coindcx' }, reply: 'CoinDCX app khol raha hoon!' };
  }

  // Google Maps
  if (/\b(google\s*maps|maps\s*kholo|open\s*maps|navigate\s*to)\b/i.test(low)) {
    const loc = t.replace(/.*?(?:navigate\s*to|maps\s*(?:me|par)?)/i, '').replace(/kholo|open/gi, '').trim();
    return { action: 'LAUNCH_APP', payload: { app: 'maps', query: loc }, reply: 'Google Maps khol raha hoon!' };
  }

  // Spotify
  if (/\b(spotify)\b/i.test(low)) {
    return { action: 'LAUNCH_APP', payload: { app: 'spotify' }, reply: 'Spotify khol raha hoon!' };
  }

  // Settings / Wi-Fi / Bluetooth
  if (/\b(wifi\s*setting|wi-fi\s*setting|bluetooth\s*setting|phone\s*setting|open\s*settings|settings\s*kholo)\b/i.test(low)) {
    const sec = /wifi|wi-fi/i.test(low) ? 'wifi' : /bluetooth/i.test(low) ? 'bluetooth' : 'main';
    return { action: 'OPEN_SETTINGS', payload: { app: sec }, reply: 'Phone Settings khol raha hoon!' };
  }

  // Google Search
  const gMatch = t.match(/(?:google\s*(?:par|pe)?\s*search\s*(?:karo)?|search\s+on\s+google)\s+(.+)/i);
  if (gMatch?.[1]) {
    return {
      action: 'LAUNCH_APP',
      payload: { app: 'google', query: gMatch[1].trim() },
      reply: `Google par "${gMatch[1].trim()}" search kar raha hoon!`,
    };
  }

  return null;
}
