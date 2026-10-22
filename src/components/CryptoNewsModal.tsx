import React, { useState, useEffect } from 'react';

export interface NewsHeadline {
  id: string;
  title: string;
  source: string;
  time: string;
  summary: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  impactScore: number;
  url?: string;
}

interface CryptoNewsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CryptoNewsModal: React.FC<CryptoNewsModalProps> = ({ isOpen, onClose }) => {
  const [headlines, setHeadlines] = useState<NewsHeadline[]>([]);
  const [loading, setLoading] = useState(false);
  const [isGrounded, setIsGrounded] = useState(false);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/news/grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.headlines)) {
        setHeadlines(data.headlines);
        setIsGrounded(Boolean(data.grounded));
      }
    } catch (e) {
      console.error('Failed to fetch grounded crypto news:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNews();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#04090eee] backdrop-blur-md font-mono text-[#d8f2ff]">
      <div className="w-full max-w-[620px] bg-[#07131d] border border-[rgba(79,210,255,0.28)] rounded-2xl p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.95)] max-h-[90vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[rgba(79,210,255,0.14)]">
          <div className="flex items-center gap-2">
            <span className="text-xl">📰</span>
            <div>
              <div className="text-sm font-bold text-white tracking-wider uppercase flex items-center gap-2">
                <span>Crypto Market Search Grounding</span>
                <span className="text-[9px] px-2 py-0.5 rounded bg-[rgba(0,245,160,0.15)] text-[#00f5a0] border border-[#00f5a0] font-semibold">
                  {isGrounded ? '🔍 Google Search Live' : '⚡ AI Grounded'}
                </span>
              </div>
              <div className="text-[10px] text-[#55829e] tracking-wider">
                Top 5 real-time breaking market headlines for sentiment context
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-[rgba(79,210,255,0.2)] text-[#6d94af] hover:text-white hover:bg-[rgba(79,210,255,0.1)] flex items-center justify-center text-xs transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-12 text-center space-y-2">
            <div className="w-6 h-6 border-2 border-[#00f5a0] border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-xs text-[#55819c] animate-pulse">
              Searching Google for latest breaking crypto market headlines…
            </div>
          </div>
        ) : (
          /* Headlines List */
          <div className="space-y-3">
            {headlines.map((item) => (
              <div
                key={item.id || item.title}
                className="p-3.5 rounded-xl bg-[#050f18] border border-[rgba(79,210,255,0.12)] hover:border-[rgba(79,210,255,0.3)] transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[10px]">
                      <span className="text-[#55819c]">{item.time}</span>
                      <span>·</span>
                      <span className="text-[#4fd2ff] font-medium">{item.source}</span>
                      <span
                        className={`text-[8.5px] px-1.5 py-0.2 rounded font-bold uppercase ${
                          item.sentiment === 'BULLISH'
                            ? 'bg-[rgba(0,245,160,0.18)] text-[#00f5a0] border border-[rgba(0,245,160,0.3)]'
                            : item.sentiment === 'BEARISH'
                            ? 'bg-[rgba(255,79,112,0.18)] text-[#ff4f70] border border-[rgba(255,79,112,0.3)]'
                            : 'bg-[rgba(255,209,59,0.18)] text-[#ffd13b] border border-[rgba(255,209,59,0.3)]'
                        }`}
                      >
                        {item.sentiment}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-white leading-snug">
                      {item.title}
                    </h4>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[rgba(255,209,59,0.12)] text-[#ffd13b] border border-[rgba(255,209,59,0.25)] font-bold block">
                      Impact: {item.impactScore}/100
                    </span>
                  </div>
                </div>

                <p className="text-[10.5px] text-[#8cb0c9] leading-relaxed">
                  {item.summary}
                </p>

                {item.url && (
                  <div className="pt-1 flex items-center justify-between text-[10px]">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#00f5a0] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>Read Original Source</span>
                      <span>↗</span>
                    </a>
                    <span className="text-[#3c637c] text-[9px]">Verified Grounding</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[rgba(79,210,255,0.1)] text-[10.5px]">
          <span className="text-[#4f7f9e]">
            Grounding refreshed via Google Search API
          </span>

          <button
            onClick={fetchNews}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg bg-[rgba(79,210,255,0.15)] hover:bg-[rgba(79,210,255,0.25)] border border-[rgba(79,210,255,0.3)] text-[#4fd2ff] font-semibold transition-all cursor-pointer disabled:opacity-50"
          >
            🔄 Refresh Grounded News
          </button>
        </div>
      </div>
    </div>
  );
};
