// ═══════════════════════════════════════════════════════════════════════════
// 🎙️ VOICE DOCTOR (v6.6.10) — "voice me problem aa rahi hai" ka 1-tap jawab.
// Phone par hi check karta hai: TTS ready? kitne voice mile? native STT available?
// mic permission? MediaRecorder se video ban sakta hai? AudioContext chalta hai?
// Kabhi throw nahi karta — hamesha row-list deta hai.
// ═══════════════════════════════════════════════════════════════════════════
export interface VoiceCheckRow {
  id: string;
  ok: boolean;
  label: string;
  fix?: string;
}

const row = (id: string, ok: boolean, label: string, fix?: string): VoiceCheckRow => ({ id, ok, label, fix });

export async function runVoiceDoctor(langHint = 'hi-IN'): Promise<{ rows: VoiceCheckRow[]; good: number; verdict: string; voice: string }> {
  const rows: VoiceCheckRow[] = [];
  const push = (r: VoiceCheckRow) => rows.push(r);

  // 1) system TTS
  let tts = false;
  try { tts = typeof window !== 'undefined' && 'speechSynthesis' in window; } catch {}
  push(row('tts', tts, '️ System TTS (bolne wala engine)', tts ? undefined : 'Phone ▸ Settings  Language ▸ TTS install karo'));

  // 2) voices + Hindi voice
  let voices = 0, hindi = false;
  try {
    const list = (window as any).speechSynthesis?.getVoices?.() || [];
    voices = list.length;
    hindi = list.some((v: any) => String(v.lang || '').toLowerCase().startsWith('hi'));
  } catch {}
  push(row('voices', voices > 0, `🎚️ Voice list — ${voices} mile${hindi ? ' · Hindi ✅' : ' · Hindi ❌'}`, voices === 0 ? 'TTS app me language download karo (Google TTS Voices → Hindi)' : hindi ? undefined : 'Hindi voice nahi → English me bolega'));

// 3) native STT (hamara apna mic engine)
  let stt = false;
  try { stt = Boolean((window as any).ApexAndroid?.hasNativeStt?.()); } catch {}
  push(row('stt', stt, '🎤 Native mic (APEX ka apna speech engine)', stt ? undefined : 'Browser me nahi — APK ke andar hi chalta hai'));

  // 4) mic permission
  let perm = 'unknown';
  try { perm = (await (navigator as any).permissions?.query?.({ name: 'microphone' as any })?.then?.((s: any) => s.state)) || (typeof (navigator as any).mediaDevices !== 'undefined' ? 'check-on-use' : 'no-api'); } catch { perm = 'check-on-use'; }
  push(row('perm', perm === 'granted' || perm === 'check-on-use', `🔓 Mic permission — ${perm}`, perm === 'denied' ? 'Phone ▸ Settings ▸ Apps ▸ APEX AI ▸ Permissions ▸ Microphone ON' : undefined));

  // 5) AudioContext (voice playback)
  let ac = false;
  try {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (Ctor) { const c = new Ctor(); ac = Boolean(c.state); try { c.close(); } catch {} }
  } catch {}
  push(row('audioctx', ac, '🔊 Audio engine (voice playback)', ac ? undefined : 'Phone ka browser lock hai — screen ek baar tap karo'));

  // 6) video record (Motion Forge) — voice doctor me isliye kyunki yahi atakta hai
  let rec = false;
  try { rec = typeof (window as any).MediaRecorder === 'function' && (window as any).MediaRecorder.isTypeSupported('video/webm;codecs=vp9'); } catch {}
  push(row('rec', rec, '🎬 Video record (Motion Forge)', rec ? undefined : 'WebView purana — Chrome update karo'));

  // 🎙️ 6.6.13: "mic sunta hai par jawab nahi" wali shikayat ka asli kaaran = App ka
  //    busy/speaking lock atak jana. App apni health window par batata hai.
  type VH = { busy?: boolean; busyForMs?: number; speaking?: boolean; listening?: boolean; queued?: number; autoFollow?: boolean; powered?: boolean };
  const vhWin = (typeof window !== 'undefined' ? window : globalThis) as unknown as { __apexVoiceHealth?: () => VH };
  const vh: VH | undefined = vhWin.__apexVoiceHealth?.();
  if (vh) {
    const stuck = (vh.busy && (vh.busyForMs ?? 0) > 6000) || (vh.speaking && (vh.busyForMs ?? 0) > 6000);
    push(
      row(
        'lock',
        !stuck,
        stuck
          ? `🔒 Voice lock atka hai (${Math.round((vh.busyForMs ?? 0) / 1000)}s) — ${vh.queued ? `queue me 1 baat hai` : 'queue khaali'}`
          : `🔓 Voice lock clean (busy=${vh.busy ? 'haan' : 'nahi'} · bol raha=${vh.speaking ? 'haan' : 'nahi'} · queue=${vh.queued ?? 0})`,
        stuck ? 'CORE panel me 🎙️ AWAAZ RESET KARO dabao (2 second me theek)' : undefined,
      ),
    );
    push(
      row(
        'follow',
        true,
        vh.autoFollow
          ? '🔁 Auto-follow ON hai — Jarvis ke baad mic khud khulta hai (echo guard lagi hai)'
          : '🎙️ Strict Push-To-Talk — mic sirf aapke tap se khulta hai',
      ),
    );
  }

  const good = rows.filter((r) => r.ok).length;
  const bad = rows.filter((r) => !r.ok);
  const verdict = bad.length === 0 ? '✅ Voice system pura theek hai' : `⚠️ ${bad.length} cheez check karni hai`;
  const voice = bad.length === 0
    ? 'Voice system me koi dikkat nahi hai. Mic aur speaker dono ready hain.'
    : `Voice check me ${bad.length} dikkat mili. Sabse pehle ${bad[0].label.replace(/^[^\u00C0-\u024F\w]+/, '')} theek karo.`;
  return { rows, good, verdict, voice };
}

/** 🎙️ Voice lock (busy/speaking/queue) zor se clear karta hai — "atak gaya" ka one-tap ilaaj.
 *    App is event ko sunta hai (src/App.tsx keeper) aur saare mic/TTS state reset karta hai. */
export function resetVoiceLock(): { ok: boolean; note: string } {
  try {
    const win = (typeof window !== 'undefined' ? window : globalThis) as unknown as { __apexVoiceHealth?: unknown };
    const had = typeof win.__apexVoiceHealth === 'function';
    window.dispatchEvent(new CustomEvent('apex:voice-reset'));
    return { ok: had, note: had ? 'Mic + speaker lock reset kar diya — ab boliye' : 'Reset bheja (App listener nahi mila — page refresh karo)' };
  } catch (e) {
    return { ok: false, note: `Reset fail: ${String((e as { message?: string })?.message || e).slice(0, 60)}` };
  }
}
