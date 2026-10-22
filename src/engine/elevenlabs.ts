export interface ElevenVoicePreset {
  id: string;
  name: string;
  tag: string;
  gender: 'Male' | 'Female' | 'Neutral';
}

export const ELEVEN_VOICE_PRESETS: ElevenVoicePreset[] = [
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George (APEX Default)', tag: 'Deep Warm Male · Hindi + English', gender: 'Male' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', tag: 'Cinematic Deep JARVIS Tone', gender: 'Male' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', tag: 'Young Friendly Dost Vibe', gender: 'Male' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', tag: 'Crisp Executive Male', gender: 'Male' },
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', tag: 'Expressive Natural Female AI', gender: 'Female' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', tag: 'Warm Sweet Female Companion', gender: 'Female' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', tag: 'Energetic Conversational Female', gender: 'Female' },
  { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River', tag: 'Calm Minimal Eclipse OS Voice', gender: 'Neutral' },
];

export interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
  modelId: 'eleven_flash_v2_5' | 'eleven_multilingual_v2';
  stability: number;
  similarityBoost: number;
}

const STORAGE_KEY = 'apex_elevenlabs_v1';

export function cleanElevenKey(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(/^(xi-api-key\s*:\s*|bearer\s+)/i, '')
    .trim();
}

export function loadElevenConfig(): ElevenLabsConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        apiKey: cleanElevenKey(p.apiKey || ''),
        voiceId: String(p.voiceId || 'JBFqnCBsd6RMkjVDRZzb').trim(),
        modelId: p.modelId === 'eleven_multilingual_v2' ? 'eleven_multilingual_v2' : 'eleven_flash_v2_5',
        stability: typeof p.stability === 'number' ? p.stability : 0.42,
        similarityBoost: typeof p.similarityBoost === 'number' ? p.similarityBoost : 0.78,
      };
    }
  } catch {}
  return {
    apiKey: '',
    voiceId: 'JBFqnCBsd6RMkjVDRZzb',
    modelId: 'eleven_flash_v2_5',
    stability: 0.42,
    similarityBoost: 0.78,
  };
}

export function saveElevenConfig(cfg: ElevenLabsConfig): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...cfg,
        apiKey: cleanElevenKey(cfg.apiKey),
        voiceId: String(cfg.voiceId || 'JBFqnCBsd6RMkjVDRZzb').trim(),
      })
    );
  } catch {}
}

/**
 * Direct Phone/Browser -> ElevenLabs HD TTS synthesis.
 * Uses user's own residential mobile/Wi-Fi IP so Free-Tier ElevenLabs keys NEVER get Cloudflare IP-blocked!
 */
export async function fetchElevenLabsAudioDirect(
  text: string,
  overrideCfg?: Partial<ElevenLabsConfig>,
  signal?: AbortSignal
): Promise<ArrayBuffer | null> {
  const cfg = { ...loadElevenConfig(), ...(overrideCfg || {}) };
  const key = cleanElevenKey(cfg.apiKey);
  const cleanText = String(text || '').trim().slice(0, 900);
  if (!key || !cleanText) return null;

  const voiceId = cfg.voiceId || 'JBFqnCBsd6RMkjVDRZzb';
  const modelsToTry =
    cfg.modelId === 'eleven_flash_v2_5'
      ? ['eleven_flash_v2_5', 'eleven_multilingual_v2']
      : ['eleven_multilingual_v2', 'eleven_flash_v2_5'];

  for (const modelId of modelsToTry) {
    try {
      const r = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'xi-api-key': key,
            accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text: cleanText,
            model_id: modelId,
            voice_settings: {
              stability: cfg.stability,
              similarity_boost: cfg.similarityBoost,
            },
          }),
          signal,
        }
      );
      if (r.ok) {
        const ab = await r.arrayBuffer();
        if (ab.byteLength > 250) return ab;
      } else if (r.status === 404 && voiceId !== 'JBFqnCBsd6RMkjVDRZzb') {
        // Fallback to default premade George voice if user entered a library/custom voice restricted on free plan
        const rFallback = await fetch(
          'https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128',
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'xi-api-key': key,
              accept: 'audio/mpeg',
            },
            body: JSON.stringify({
              text: cleanText,
              model_id: modelId,
              voice_settings: { stability: cfg.stability, similarity_boost: cfg.similarityBoost },
            }),
            signal,
          }
        );
        if (rFallback.ok) {
          const ab2 = await rFallback.arrayBuffer();
          if (ab2.byteLength > 250) return ab2;
        }
      }
    } catch {}
  }

  return null;
}

export async function testAndVerifyElevenKey(
  rawKey: string,
  voiceId = 'JBFqnCBsd6RMkjVDRZzb'
): Promise<{ ok: boolean; message: string; remainingChars?: number; audio?: ArrayBuffer }> {
  const key = cleanElevenKey(rawKey);
  if (!key) {
    return { ok: false, message: 'Pehle ElevenLabs API Key (sk_...) paste karein!' };
  }

  let remainingChars: number | undefined;
  try {
    const subRes = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      headers: { 'xi-api-key': key },
    });
    if (subRes.ok) {
      const sub = await subRes.json();
      if (typeof sub.character_limit === 'number' && typeof sub.character_count === 'number') {
        remainingChars = Math.max(0, sub.character_limit - sub.character_count);
      }
    }
  } catch {}

  // Always do a real live Hindi/Hinglish TTS audio test so even scoped TTS-only sk_ keys verify 100%!
  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId || 'JBFqnCBsd6RMkjVDRZzb')}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'xi-api-key': key,
          accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: 'Namaste boss! Main APEX bol raha hoon, ElevenLabs HD voice bilkul active hai!',
          model_id: 'eleven_flash_v2_5',
          voice_settings: { stability: 0.42, similarity_boost: 0.78 },
        }),
      }
    );

    if (r.ok) {
      const ab = await r.arrayBuffer();
      const quotaTxt =
        typeof remainingChars === 'number' ? ` (${remainingChars.toLocaleString()} credits baaki)` : '';
      return {
        ok: true,
        message: `✅ ElevenLabs HD Voice Connected & Playing!${quotaTxt}`,
        remainingChars,
        audio: ab,
      };
    }

    const errJson = await r.json().catch(() => ({}));
    const detail = errJson?.detail?.message || errJson?.detail?.status || `HTTP ${r.status}`;
    return {
      ok: false,
      message: `❌ ElevenLabs Error: ${detail}`,
    };
  } catch (e: any) {
    return { ok: false, message: `❌ Network error: ${e?.message || 'Failed'}` };
  }
}
