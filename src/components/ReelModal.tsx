import React, { useState } from 'react';

interface ReelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTopicForShorts: (topic: string) => void;
  onOpenAgentCompany?: () => void;
  onToast: (msg: string) => void;
}

const DEFAULT_REEL_URL = 'https://www.facebook.com/share/r/1CsnV4FJGt/?mibextid=wwXIfr';

export const ReelModal: React.FC<ReelModalProps> = ({
  isOpen,
  onClose,
  onSelectTopicForShorts,
  onOpenAgentCompany,
  onToast,
}) => {
  const [reelUrl, setReelUrl] = useState(DEFAULT_REEL_URL);
  const [activeUrl, setActiveUrl] = useState(DEFAULT_REEL_URL);
  const [activeTab, setActiveTab] = useState<'player' | 'ai_script' | 'facebook_post'>('player');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);

  if (!isOpen) return null;

  const isFacebook = /facebook\.com|fb\.watch/i.test(activeUrl);

  const extractInstaId = (url: string): string => {
    const match = url.match(/(?:reel|p)\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : 'DeZfiXZqJtP';
  };

  const handleUpdateReel = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = reelUrl.trim();
    if (!clean) return;
    setActiveUrl(clean);
    setGeneratedScript(null);
    onToast(`Loaded ${/facebook|fb/i.test(clean) ? 'Facebook' : 'Instagram'} Reel!`);
  };

  const handleOpenDirect = () => {
    window.open(activeUrl, '_blank', 'noopener,noreferrer');
  };

  const handleConvertToShort = () => {
    const topicSuggestion = isFacebook
      ? 'Facebook Reel Strategy: AI Humanoid & Automated Trading Bot'
      : 'AI Chief of Staff and 19 Sub-Agents Running My Company';
    onSelectTopicForShorts(topicSuggestion);
    onClose();
    onToast(`Reel loaded into YouTube Content Agent: "${topicSuggestion}"`);
  };

  const handleGenerateAIScript = async () => {
    setIsGenerating(true);
    onToast('Analyzing Facebook Reel viral hook with Gemini AI…');
    try {
      const res = await fetch('/yt/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: `Facebook Viral Reel Analysis: ${activeUrl}`,
          lang: 'hi',
          scenes: 5,
        }),
      });
      const data = await res.json();
      if (data && data.scenes) {
        const text = `🔥 VIRAL REEL SCRIPT (${data.title || 'Facebook AI Strategy'})\n\n` +
          `📌 HOOK: ${data.scenes[0]?.caption || 'THIS CHANGE CHANGES EVERYTHING'}\n` +
          `🗣️ NARRATION: ${data.scenes[0]?.narration || ''}\n\n` +
          `🎬 SCENE 2: ${data.scenes[1]?.caption || ''}\n` +
          `🗣️ NARRATION: ${data.scenes[1]?.narration || ''}\n\n` +
          `📲 HASHTAGS: ${(data.tags || ['#facebookreels', '#viral', '#ai', '#tradingbot']).join(' ')}`;
        setGeneratedScript(text);
        setActiveTab('ai_script');
        onToast('AI Viral Reel Script Generated!');
      } else {
        throw new Error('Fallback script');
      }
    } catch (e) {
      setGeneratedScript(
        `🔥 VIRAL FACEBOOK REEL SCRIPT\n\n📌 HOOK: 100% Real Trading Bot & AI Humanoid Connected!\n🗣️ NARRATION: Yeh dekho kaise AI humanoid aur real CoinDCX trading bot automated execution kar rahe hain.\n\n🎬 SCENE 2: REAL PROFIT AUTOMATION\n🗣️ NARRATION: Grounded search news aur virtual heart rate pulse sync ho kar trades place karte hain.\n\n📲 HASHTAGS: #facebookreels #crypto #tradingbot #ai #automation #viral`
      );
      setActiveTab('ai_script');
    } finally {
      setIsGenerating(false);
    }
  };

  const embedSrc = isFacebook
    ? `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(activeUrl)}&show_text=false&width=500`
    : `https://www.instagram.com/p/${extractInstaId(activeUrl)}/embed/captioned/`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#04090ecc] backdrop-blur-md overflow-y-auto font-mono text-[#d8f2ff]">
      <div className="w-full max-w-[560px] bg-[#07131d] border border-[rgba(79,210,255,0.28)] rounded-2xl p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.95)] max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[rgba(79,210,255,0.14)] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1877f222] border border-[#1877f266] flex items-center justify-center text-lg">
              {isFacebook ? '📘' : '📸'}
            </div>
            <div>
              <div className="text-[13px] tracking-[0.2em] text-[#ff6495] font-semibold uppercase">
                {isFacebook ? 'FACEBOOK REEL STUDIO' : 'INSTAGRAM REEL STUDIO'}
              </div>
              <div className="text-[10px] text-[#55829e] tracking-wider">
                Direct Reel Player · Viral Script Generator · Auto-Post Caption
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer bg-[#0d1a24] text-[#9fe8ff] border border-[#1d3a4d] rounded-lg px-3 py-1.5 text-xs hover:bg-[#142838] transition-colors"
          >
            ✕ close
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1.5 p-1 rounded-xl bg-[#0a151d] border border-[#1d3a4d] mb-4">
          <button
            onClick={() => setActiveTab('player')}
            className={`flex-1 cursor-pointer py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'player'
                ? 'bg-[#1877f2] text-white shadow-[0_0_12px_rgba(24,119,242,0.5)]'
                : 'text-[#689ab9] hover:text-[#e0f4ff]'
            }`}
          >
            ▶ Player
          </button>
          <button
            onClick={() => {
              if (!generatedScript) handleGenerateAIScript();
              else setActiveTab('ai_script');
            }}
            className={`flex-1 cursor-pointer py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'ai_script'
                ? 'bg-[#1877f2] text-white shadow-[0_0_12px_rgba(24,119,242,0.5)]'
                : 'text-[#689ab9] hover:text-[#e0f4ff]'
            }`}
          >
            🤖 AI Script
          </button>
        </div>

        {/* Input Form for Reel URL */}
        <form onSubmit={handleUpdateReel} className="flex gap-2 mb-4">
          <input
            type="text"
            value={reelUrl}
            onChange={(e) => setReelUrl(e.target.value)}
            placeholder="Paste Facebook or Instagram Reel URL…"
            className="flex-1 bg-[#0a151d] border border-[#1d3a4d] rounded-xl p-2.5 text-xs text-[#eaf9ff] focus:outline-none focus:border-[#1877f2]"
          />
          <button
            type="submit"
            className="cursor-pointer bg-[#1877f2] text-white px-3.5 py-2 rounded-xl text-xs font-bold hover:brightness-110"
          >
            Load
          </button>
        </form>

        {/* Tab 1: Reel Player Frame & Direct Fallback */}
        {activeTab === 'player' && (
          <div className="flex flex-col gap-3 mb-4">
            {/* Embedded Iframe Player */}
            <div className="relative w-full aspect-[9/14] sm:aspect-[9/13] max-h-[420px] bg-[#020508] border border-[rgba(79,210,255,0.2)] rounded-xl overflow-hidden shadow-inner flex flex-col items-center justify-center">
              <iframe
                src={embedSrc}
                className="w-full h-full border-0 rounded-xl"
                title={isFacebook ? 'Facebook Reel' : 'Instagram Reel'}
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>

            {/* Direct Open Action Banner (Solves iframe restriction on mobile) */}
            <div className="p-3 rounded-xl bg-[rgba(24,119,242,0.12)] border border-[rgba(24,119,242,0.35)] flex items-center justify-between gap-2">
              <div className="text-[11px] text-[#aedaff] leading-snug">
                <span className="font-bold text-white">Direct Facebook Watch:</span> If iframe is restricted by Facebook, tap below to view directly in app.
              </div>
              <button
                onClick={handleOpenDirect}
                className="cursor-pointer whitespace-nowrap px-3 py-1.5 rounded-lg bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-xs shadow-[0_0_14px_rgba(24,119,242,0.6)]"
              >
                ↗ Watch Reel
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: AI Generated Viral Script */}
        {activeTab === 'ai_script' && (
          <div className="mb-4 flex flex-col gap-3">
            <div className="p-3 rounded-xl bg-[#06121c] border border-[#1d3a4d] max-h-[300px] overflow-y-auto">
              {isGenerating ? (
                <div className="text-center py-8 text-xs text-[#55829e] animate-pulse">
                  ⚡ Gemini AI analyzing Reel viral dynamics…
                </div>
              ) : (
                <pre className="text-xs text-[#d8f2ff] whitespace-pre-wrap font-sans leading-relaxed">
                  {generatedScript}
                </pre>
              )}
            </div>
            <button
              onClick={() => {
                if (generatedScript) {
                  navigator.clipboard.writeText(generatedScript);
                  onToast('Script copied to clipboard!');
                }
              }}
              className="cursor-pointer w-full py-2.5 rounded-xl bg-[#1d3a4d] hover:bg-[#284f68] text-[#e0f4ff] font-bold text-xs text-center"
            >
              📋 Copy AI Script
            </button>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex flex-col gap-2.5">
          {onOpenAgentCompany && (
            <button
              onClick={() => {
                onClose();
                onOpenAgentCompany();
              }}
              className="w-full cursor-pointer bg-gradient-to-r from-[#ff5522] via-[#ff7a18] to-[#ffd13b] text-[#140801] py-3 rounded-xl font-bold text-xs tracking-wider shadow-[0_0_20px_rgba(255,100,34,0.4)] hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              <span>🏢</span>
              <span>LAUNCH MULTI-AGENT COMPANY FOR REELS</span>
              <span>⚡</span>
            </button>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={handleGenerateAIScript}
              className="flex-1 cursor-pointer bg-[#1877f2] text-white py-3 rounded-xl font-bold text-xs tracking-wider shadow-md hover:brightness-110 transition-all flex items-center justify-center gap-1.5"
            >
              <span>🤖</span>
              <span>Generate AI Reel Script</span>
            </button>

            <button
              onClick={handleConvertToShort}
              className="flex-1 cursor-pointer bg-gradient-to-r from-[#176282] to-[#2ea8c9] text-[#03181f] py-3 rounded-xl font-bold text-xs tracking-wider hover:brightness-110 transition-all flex items-center justify-center gap-1.5"
            >
              <span>🎬</span>
              <span>Remix to YouTube Short</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
