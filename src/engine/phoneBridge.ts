// Universal Real Android Phone Controller + Mobile Deep-Link Engine
// Instant (<5ms) zero-confirmation execution for all safe phone commands:
// Open ANY App (YouTube, WhatsApp, Instagram, Camera, Maps, Chrome, Paytm, GPay, PhonePe, Calculator, Settings, or ANY installed app by name),
// Torch/Flashlight ON/OFF, Hardware Volume UP/DOWN/MAX/MUTE, Alarms, Timers, Calls, Searches & Navigation!

declare global {
  interface Window {
    ApexAndroid?: {
      setSpeakerphone?: (on: boolean) => void;
      hasNativeStt?: () => boolean;
      startNativeListen?: (lang: string) => void;
      stopNativeListen?: () => void;
      canSpeakNative?: () => boolean;
      speakNative?: (text: string, lang: string, utteranceId: string) => boolean;
      stopNativeSpeak?: () => void;
      openPackage: (pkg: string, fallbackUrl: string) => boolean;
      openAppByName?: (appName: string) => boolean;
      openUrl: (url: string) => void;
      setTorch?: (on: boolean) => boolean;
      adjustVolume?: (mode: string) => boolean;
      openCamera?: () => boolean;
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
  phone?: string;
  torchOn?: boolean;
  volumeMode?: 'up' | 'down' | 'max' | 'mute';
}

const APP_MAP: Record<string, { pkg: string; scheme: string; web: string }> = {
  youtube: { pkg: 'com.google.android.youtube', scheme: 'vnd.youtube://', web: 'https://m.youtube.com/' },
  whatsapp: { pkg: 'com.whatsapp', scheme: 'whatsapp://app', web: 'https://wa.me/' },
  instagram: { pkg: 'com.instagram.android', scheme: 'instagram://app', web: 'https://www.instagram.com/' },
  telegram: { pkg: 'org.telegram.messenger', scheme: 'tg://resolve', web: 'https://web.telegram.org/' },
  coindcx: { pkg: 'com.coindcx.btc', scheme: 'coindcx://', web: 'https://coindcx.com/' },
  maps: { pkg: 'com.google.android.apps.maps', scheme: 'geo:0,0?q=', web: 'https://maps.google.com/' },
  spotify: { pkg: 'com.spotify.music', scheme: 'spotify://', web: 'https://open.spotify.com/' },
  chrome: { pkg: 'com.android.chrome', scheme: 'googlechrome://navigate?url=https://www.google.com', web: 'https://www.google.com/' },
  google: { pkg: 'com.google.android.googlequicksearchbox', scheme: 'https://www.google.com', web: 'https://www.google.com/' },
  gmail: { pkg: 'com.google.android.gm', scheme: 'googlegmail://', web: 'https://mail.google.com/' },
  playstore: { pkg: 'com.android.vending', scheme: 'market://home', web: 'https://play.google.com/store' },
  calculator: { pkg: 'com.google.android.calculator', scheme: '', web: '' },
  calendar: { pkg: 'com.google.android.calendar', scheme: '', web: 'https://calendar.google.com/' },
  clock: { pkg: 'com.google.android.deskclock', scheme: '', web: '' },
  contacts: { pkg: 'com.google.android.contacts', scheme: '', web: '' },
  gallery: { pkg: 'com.google.android.apps.photos', scheme: '', web: 'https://photos.google.com/' },
  paytm: { pkg: 'net.one97.paytm', scheme: 'paytmmp://', web: 'https://paytm.com/' },
  phonepe: { pkg: 'com.phonepe.app', scheme: 'phonepe://', web: 'https://www.phonepe.com/' },
  gpay: { pkg: 'com.google.android.apps.nbu.paisa.user', scheme: 'tez://', web: 'https://pay.google.com/' },
  amazon: { pkg: 'in.amazon.mShop.android.shopping', scheme: '', web: 'https://www.amazon.in/' },
  flipkart: { pkg: 'com.flipkart.android', scheme: '', web: 'https://www.flipkart.com/' },
  zomato: { pkg: 'com.application.zomato', scheme: '', web: 'https://www.zomato.com/' },
  swiggy: { pkg: 'in.swiggy.android', scheme: '', web: 'https://www.swiggy.com/' },
  facebook: { pkg: 'com.facebook.katana', scheme: 'fb://', web: 'https://m.facebook.com/' },
  twitter: { pkg: 'com.twitter.android', scheme: 'twitter://', web: 'https://x.com/' },
  netflix: { pkg: 'com.netflix.mediaclient', scheme: '', web: 'https://www.netflix.com/' },
};

export function executePhoneAction(action: string, payload?: PhoneCommandPayload): boolean {
  const bridge = window.ApexAndroid;

  if (action === 'SET_TORCH' && payload) {
    if (bridge?.setTorch) return bridge.setTorch(Boolean(payload.torchOn));
    return false;
  }

  if (action === 'ADJUST_VOLUME' && payload?.volumeMode) {
    if (bridge?.adjustVolume) return bridge.adjustVolume(payload.volumeMode);
    return false;
  }

  if (action === 'OPEN_CAMERA') {
    if (bridge?.openCamera) return bridge.openCamera();
    if (bridge?.openAppByName) return bridge.openAppByName('camera');
    return false;
  }

  if (action === 'SET_ALARM' && payload) {
    const h = typeof payload.hour === 'number' ? payload.hour : 7;
    const m = typeof payload.minute === 'number' ? payload.minute : 0;
    const label = payload.text || 'APEX Alarm';
    if (bridge?.setAlarm) return bridge.setAlarm(h, m, label);
    return false;
  }

  if (action === 'SET_TIMER' && payload) {
    const secs = payload.seconds || 300;
    if (bridge?.setTimer) return bridge.setTimer(secs, 'APEX Timer');
    return false;
  }

  const dialTarget = payload?.number || payload?.phone;
  if (action === 'DIAL_PHONE' && dialTarget) {
    const clean = dialTarget.replace(/[^0-9+]/g, '');
    if (bridge?.dialNumber) bridge.dialNumber(clean);
    else window.location.href = `tel:${clean}`;
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
    const key = payload.app.toLowerCase().trim();
    const q = payload.query?.trim() || '';

    // 1. Direct YouTube Search / Video Play
    if (key === 'youtube' && q) {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
      if (bridge?.openUrl) bridge.openUrl(url);
      else window.open(url, '_blank');
      return true;
    }

    // 2. Google Search
    if ((key === 'google' || key === 'chrome') && q) {
      const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
      if (bridge?.openUrl) bridge.openUrl(url);
      else window.open(url, '_blank');
      return true;
    }

    // 3. Google Maps Location Search / Navigation
    if (key === 'maps' && q) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
      if (bridge?.openUrl) bridge.openUrl(url);
      else window.open(url, '_blank');
      return true;
    }

    // 4. WhatsApp Direct Message
    if (key === 'whatsapp' && payload.text) {
      const url = `https://wa.me/?text=${encodeURIComponent(payload.text)}`;
      if (bridge?.openUrl) bridge.openUrl(url);
      else window.open(url, '_blank');
      return true;
    }

    // 5. Known App Package OR Dynamic Installed App Name Search on Phone!
    const info = APP_MAP[key];
    if (info) {
      if (bridge?.openPackage) {
        const ok = bridge.openPackage(info.pkg, info.web || `https://www.google.com/search?q=${encodeURIComponent(key)}`);
        if (ok) return true;
      }
      if (bridge?.openAppByName && bridge.openAppByName(key)) {
        return true;
      }
      const isAndroid = /android/i.test(navigator.userAgent);
      if (isAndroid && info.pkg) {
        window.location.href = `intent://#Intent;package=${info.pkg};S.browser_fallback_url=${encodeURIComponent(
          info.web || 'https://m.youtube.com/'
        )};end`;
        return true;
      }
      if (info.web) {
        window.open(info.web, '_blank');
        return true;
      }
    }

    // 6. ANY Installed Phone App by Spoken Name (e.g. "open MyJio", "open Zerodha", "open Free Fire")!
    if (bridge?.openAppByName) {
      const launched = bridge.openAppByName(key);
      if (launched) return true;
    }

    // Web fallback search if testing inside desktop browser preview
    const fallbackWeb = `https://www.google.com/search?q=${encodeURIComponent(key)}`;
    if (bridge?.openUrl) bridge.openUrl(fallbackWeb);
    else window.open(fallbackWeb, '_blank');
    return true;
  }

  return false;
}

/** Instant <2ms Natural Hindi + Hinglish + English Phone Task Parser! */
export function parseLocalPhoneCommand(raw: string): {
  action: string;
  payload: PhoneCommandPayload;
  reply: string;
} | null {
  const t = raw.trim();
  const low = t.toLowerCase();

  // 1. Flashlight / Torch ON & OFF ("torch on karo", "flashlight jalao", "light band karo")
  if (/\b(torch|flashlight|flash\s*light|mobile\s*light|back\s*light)\b/i.test(low)) {
    const turnOff = /\b(off|band|stop|bujha)\b/i.test(low);
    return {
      action: 'SET_TORCH',
      payload: { torchOn: !turnOff },
      reply: turnOff ? 'Phone ki torch band kar di hai!' : 'Phone ki torch on kar di hai!',
    };
  }

  // 2. Hardware Volume Control ("volume badhao", "full volume karo", "volume kam karo", "mute phone")
  if (/\b(volume|awaaz|sound\s*level)\b/i.test(low) || /\b(mute\s*phone|unmute)\b/i.test(low)) {
    if (/\b(full|max|100|poora|pura)\b/i.test(low)) {
      return { action: 'ADJUST_VOLUME', payload: { volumeMode: 'max' }, reply: 'Phone volume full kar diya hai!' };
    }
    if (/\b(mute|silent|zero)\b/i.test(low)) {
      return { action: 'ADJUST_VOLUME', payload: { volumeMode: 'mute' }, reply: 'Phone media mute kar diya hai!' };
    }
    if (/\b(down|kam|low|dheere|ghatao|decrease)\b/i.test(low)) {
      return { action: 'ADJUST_VOLUME', payload: { volumeMode: 'down' }, reply: 'Phone volume kam kar diya hai!' };
    }
    if (/\b(up|badhao|zyada|tez|increase|raise)\b/i.test(low)) {
      return { action: 'ADJUST_VOLUME', payload: { volumeMode: 'up' }, reply: 'Phone volume badha diya hai!' };
    }
  }

  // 3. Phone Camera ("camera kholo", "open camera", "selfie camera")
  if (/\b(open\s*camera|camera\s*(?:kholo|open|chalu\s*karo)|selfie\s*lelo|photo\s*kheecho)\b/i.test(low)) {
    return {
      action: 'OPEN_CAMERA',
      payload: {},
      reply: 'Phone Camera khol diya hai!',
    };
  }

  // 4. Alarm ("subah 6:30 ka alarm lagao", "set alarm 7 30")
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
      reply: `${hour}:${padM} ka phone alarm set kar diya hai!`,
    };
  }

  // 5. Timer ("5 minute ka timer lagao")
  if (/\b(timer)\b/i.test(low)) {
    const nm = low.match(/(\d+)/);
    const mins = nm ? parseInt(nm[1], 10) : 5;
    const secs = /sec/i.test(low) ? mins : mins * 60;
    return {
      action: 'SET_TIMER',
      payload: { seconds: secs },
      reply: `${mins} ${/sec/i.test(low) ? 'second' : 'minute'} ka timer start kar diya hai!`,
    };
  }

  // 6. Phone Call ("call 9876543210")
  const dialMatch = low.match(/(?:call\s*karo|call|phone\s*lagao|dial)\s+([+0-9][0-9\s-]{6,})/);
  if (dialMatch?.[1]) {
    return {
      action: 'DIAL_PHONE',
      payload: { number: dialMatch[1] },
      reply: `Phone dialer me ${dialMatch[1].trim()} laga diya hai!`,
    };
  }

  // 7. YouTube Real App + Search/Play ("open youtube", "youtube kholo", "youtube par arijit singh chalao", "play hanuman chalisa on youtube")
  if (/\b(youtube|you\s*tube|yt)\b/i.test(low) && !/\b(shorts?\s*studio)\b/i.test(low)) {
    let cleanedQ = '';
    const playOnYt = t.match(/(?:play|search|chalao|lagao|baja[o]?)\s+(.+?)\s+(?:on|in|par|pe|me)\s+(?:youtube|you\s*tube)/i);
    const ytPar = t.match(/(?:youtube|you\s*tube)\s+(?:par|pe|me|on)\s+(.+?)(?:\s+(?:chalao|play|search|lagao|kholo|baja[o]?))?$/i);
    if (playOnYt?.[1]) cleanedQ = playOnYt[1].trim();
    else if (ytPar?.[1] && !/^(kholo|open|app|chalao)$/i.test(ytPar[1].trim())) cleanedQ = ytPar[1].trim();
    return {
      action: 'LAUNCH_APP',
      payload: { app: 'youtube', query: cleanedQ },
      reply: cleanedQ ? `YouTube par "${cleanedQ}" chala raha hoon!` : 'YouTube app khol diya hai!',
    };
  }

  // 8. WhatsApp
  if (/\b(whatsapp|whats\s*app)\b/i.test(low)) {
    const msgMatch = t.match(/(?:message|msg|bhejo|likho)\s+(.+)/i);
    return {
      action: 'LAUNCH_APP',
      payload: { app: 'whatsapp', text: msgMatch?.[1]?.trim() },
      reply: 'WhatsApp khol diya hai!',
    };
  }

  // 9. Instagram
  if (/\b(instagram|insta)\b/i.test(low)) {
    return {
      action: 'LAUNCH_APP',
      payload: { app: 'instagram' },
      reply: 'Instagram khol diya hai!',
    };
  }

  // 10. Settings / Wi-Fi / Bluetooth / Location / Display / Battery
  if (/\b(wifi|wi-fi|bluetooth|hotspot|location\s*setting|display\s*setting|battery\s*setting|phone\s*setting|open\s*settings|settings\s*kholo)\b/i.test(low)) {
    const sec = /wifi|wi-fi/i.test(low)
      ? 'wifi'
      : /bluetooth/i.test(low)
      ? 'bluetooth'
      : /location|gps/i.test(low)
      ? 'location'
      : /display|brightness/i.test(low)
      ? 'display'
      : /battery/i.test(low)
      ? 'battery'
      : 'main';
    return { action: 'OPEN_SETTINGS', payload: { app: sec }, reply: `Phone ${sec.toUpperCase()} Settings khol diya hai!` };
  }

  // 11. Google Maps Navigation / Location
  if (/\b(google\s*maps|maps\s*kholo|open\s*maps|navigate\s*to|rasta\s*batao)\b/i.test(low)) {
    const loc = t.replace(/.*?(?:navigate\s*to|rasta\s*batao|maps\s*(?:me|par)?)/i, '').replace(/kholo|open/gi, '').trim();
    return { action: 'LAUNCH_APP', payload: { app: 'maps', query: loc }, reply: loc ? `Google Maps me ${loc} khol diya hai!` : 'Google Maps khol diya hai!' };
  }

  // 12. Google Search
  const gMatch = t.match(/(?:google\s*(?:par|pe)?\s*search\s*(?:karo)?|search\s+(?:on\s+google\s+)?for|search\s+google)\s+(.+)/i);
  if (gMatch?.[1]) {
    return {
      action: 'LAUNCH_APP',
      payload: { app: 'google', query: gMatch[1].trim() },
      reply: `Google par "${gMatch[1].trim()}" khol diya hai!`,
    };
  }

  // 13. Universal "Open <AppName>" or "<AppName> kholo / chalu karo" for ANY installed app on the user's phone!
  const openEn = low.match(/^(?:please\s+|bhai\s+|apex\s+)*(?:open|launch|start)\s+([a-z0-9\s.+]{2,28}?)(?:\s+app|\s+application|\s+please|\s+karo)?$/i);
  const openHi = low.match(/^(?:please\s+|bhai\s+|apex\s+)*([a-z0-9\s.+]{2,28}?)\s+(?:app\s+)?(?:kholo|khol\s*do|open\s*karo|chalu\s*karo)$/i);
  const rawApp = (openEn?.[1] || openHi?.[1] || '').trim();
  if (
    rawApp &&
    !/^(apex|menu|trade|trading|power|mic|gesture|memory|mood|theme|avatar|sound)$/i.test(rawApp)
  ) {
    const normalized = rawApp.replace(/\s+/g, '') === 'playstore' || rawApp.includes('play store')
      ? 'playstore'
      : rawApp.includes('google pay')
      ? 'gpay'
      : rawApp;
    return {
      action: 'LAUNCH_APP',
      payload: { app: normalized },
      reply: `${rawApp.toUpperCase()} khol diya hai!`,
    };
  }

  return null;
}
