import React, { useState } from 'react';
import {
  ELEVEN_VOICE_PRESETS,
  ElevenLabsConfig,
  cleanElevenKey,
  loadElevenConfig,
  saveElevenConfig,
  testAndVerifyElevenKey,
} from '../engine/elevenlabs';
import { audio } from '../engine/audio';

interface ElevenLabsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (cfg: ElevenLabsConfig) => void;
}

export const ElevenLabsModal: React.FC<ElevenLabsModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const initial = loadElevenConfig();
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [voiceId, setVoiceId] = useState(initial.voiceId);
  const [modelId, setModelId] = useState<'eleven_flash_v2_5' | 'eleven_multilingual_v2'>(initial.modelId);
  const [statusMsg, setStatusMsg] = useState<string>(
    initial.apiKey
      ? '✅ ElevenLabs API Key saved on this device — Direct HD Voice Active!'
      : 'Apni ElevenLabs API Key (sk_...) yahan daalein — Free Tier key bhi 100% chalegi!'
  );
  const [testing, setTesting] = useState(false);

  if (!isOpen) return null;

  const handleSaveAndTest = async () => {
    setTesting(true);
    setStatusMsg('⏳ ElevenLabs HD Voice test ho rahi hai...');
    audio.ensureCtx();

    const cleaned = cleanElevenKey(apiKey);
    const nextCfg: ElevenLabsConfig = {
      apiKey: cleaned,
      voiceId: voiceId.trim() || 'JBFqnCBsd6RMkjVDRZzb',
      modelId,
      stability: 0.42,
      similarityBoost: 0.78,
    };
    saveElevenConfig(nextCfg);
    onConfigSaved?.(nextCfg);

    if (!cleaned) {
      setTesting(false);
      setStatusMsg('ℹ️ Direct key hata di gayi — Cloud Worker voice use hogi.');
      return;
    }

    const res = await testAndVerifyElevenKey(cleaned, nextCfg.voiceId);
    setStatusMsg(res.message);
    if (res.ok && res.audio) {
      await audio.playVoiceArrayBuffer(res.audio);
    }
    setTesting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(0,0,0,0.82)] backdrop-blur-xl flex items-center justify-center p-3 font-sans">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-[#070b12] border border-[rgba(168,85,247,0.45)] shadow-[0_24px_80px_rgba(0,0,0,0.95)] p-4 sm:p-5 text-[#e6eef8] space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] pb-3">
          <div>
            <div className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
              <span>🎙️ ElevenLabs HD Voice Studio</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(46,242,164,0.16)] border border-[rgba(46,242,164,0.4)] text-[#2ef2a4]">
                Direct Phone IP · Free-Tier Friendly
              </span>
            </div>
            <p className="text-[11px] text-[#94a3b8] mt-0.5">
              Seedha aapke phone se ElevenLabs connect hota hai — Cloudflare Free-Tier IP block 100% bypass!
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.07)] text-white text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Step 1: API Key */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#d8b4fe]">
              1. ElevenLabs API Key (`sk_...`)
            </label>
            <a
              href="https://elevenlabs.io/app/settings/api-keys"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-bold text-[#4fd2ff] underline"
            >
              🔑 Free Key Yahan Se Lein →
            </a>
          </div>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste sk_... ElevenLabs API Key here"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1422] border border-[rgba(168,85,247,0.35)] text-xs text-white font-mono outline-none focus:border-[#c084fc]"
          />
        </div>

        {/* Step 2: Voice Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#d8b4fe] block">
            2. Choose Hindi + English Voice (`{ELEVEN_VOICE_PRESETS.find((v) => v.id === voiceId)?.name || 'Custom Voice'}`)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ELEVEN_VOICE_PRESETS.map((v) => {
              const selected = voiceId === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setVoiceId(v.id)}
                  className={`p-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                    selected
                      ? 'bg-[rgba(168,85,247,0.22)] border-[#c084fc] text-white'
                      : 'bg-[#0d1422] border-[rgba(255,255,255,0.08)] text-[#cbd5e1] hover:border-[rgba(255,255,255,0.22)]'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>{v.name}</span>
                    <span className="text-[9.5px] opacity-75">{v.gender}</span>
                  </div>
                  <div className="text-[10px] text-[#94a3b8] truncate mt-0.5">{v.tag}</div>
                </button>
              );
            })}
          </div>

          <div className="pt-1">
            <label className="text-[10.5px] text-[#94a3b8] block mb-1">
              Ya Custom ElevenLabs Voice ID paste karein (optional):
            </label>
            <input
              type="text"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              placeholder="Voice ID e.g. JBFqnCBsd6RMkjVDRZzb"
              className="w-full px-3 py-2 rounded-xl bg-[#0d1422] border border-[rgba(255,255,255,0.1)] text-[11px] font-mono text-white outline-none"
            />
          </div>
        </div>

        {/* Step 3: Model Selector */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setModelId('eleven_flash_v2_5')}
            className={`p-2.5 rounded-xl text-left border cursor-pointer ${
              modelId === 'eleven_flash_v2_5'
                ? 'bg-[rgba(46,242,164,0.16)] border-[#2ef2a4] text-white'
                : 'bg-[#0d1422] border-[rgba(255,255,255,0.08)] text-[#94a3b8]'
            }`}
          >
            <div className="text-xs font-bold">⚡ Flash v2.5 (Recommended)</div>
            <div className="text-[10px] opacity-80">75ms Ultra-Fast · 2× Double Free Credits!</div>
          </button>
          <button
            onClick={() => setModelId('eleven_multilingual_v2')}
            className={`p-2.5 rounded-xl text-left border cursor-pointer ${
              modelId === 'eleven_multilingual_v2'
                ? 'bg-[rgba(79,210,255,0.16)] border-[#4fd2ff] text-white'
                : 'bg-[#0d1422] border-[rgba(255,255,255,0.08)] text-[#94a3b8]'
            }`}
          >
            <div className="text-xs font-bold">🎭 Multilingual v2 HD</div>
            <div className="text-[10px] opacity-80">Deepest Studio Emotion · Hindi/Hinglish</div>
          </button>
        </div>

        {/* Status Banner */}
        <div className="p-3 rounded-xl bg-[#0d1422] border border-[rgba(255,255,255,0.1)] text-xs text-[#e2e8f0]">
          {statusMsg}
        </div>

        {/* Save & Live Audio Test Button */}
        <div className="flex gap-2">
          <button
            onClick={handleSaveAndTest}
            disabled={testing}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#a855f7] via-[#ec4899] to-[#f97316] text-white font-extrabold text-xs tracking-wide shadow-[0_8px_24px_rgba(168,85,247,0.45)] cursor-pointer disabled:opacity-50"
          >
            {testing ? '⏳ Testing ElevenLabs Voice...' : '🔊 SAVE & TEST ELEVENLABS HD VOICE NOW'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 rounded-xl bg-[rgba(255,255,255,0.08)] text-white text-xs font-bold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
