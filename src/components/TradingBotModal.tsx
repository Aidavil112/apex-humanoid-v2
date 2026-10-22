import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { MarketPairData, TradingPosition, TradeOrderLog, AutoAnalysisItem, MoodType } from '../types';
import { CryptoNewsModal } from './CryptoNewsModal';

const GEO_HUBS = [
  { city: 'Mumbai', country: 'India', lat: 19.0760, lng: 72.8777, label: 'CoinDCX Node (IN)' },
  { city: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198, label: 'Binance SG' },
  { city: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503, label: 'BitFlyer JP' },
  { city: 'London', country: 'UK', lat: 51.5074, lng: -0.1278, label: 'LMAX London' },
  { city: 'New York', country: 'USA', lat: 40.7128, lng: -74.0060, label: 'Gemini NY' },
  { city: 'Dubai', country: 'UAE', lat: 25.2048, lng: 55.2708, label: 'Bybit MENA' },
  { city: 'Frankfurt', country: 'Germany', lat: 50.1109, lng: 8.6821, label: 'Eurex DE' },
  { city: 'Zurich', country: 'Switzerland', lat: 47.3769, lng: 8.5417, label: 'Crypto Valley' },
];

const OrderGeoMap: React.FC<{ logs: TradeOrderLog[] }> = ({ logs }) => {
  const mapSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svgEl = mapSvgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const w = 720;
    const h = 210;

    // Projection & Path generator
    const projection = d3
      .geoEquirectangular()
      .scale(102)
      .translate([w / 2, h / 2 + 10]);

    const pathGenerator = d3.geoPath().projection(projection);

    // Grid lines (Graticule)
    const graticule = d3.geoGraticule().step([30, 30]);
    svg
      .append('path')
      .datum(graticule)
      .attr('d', pathGenerator)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(79, 210, 255, 0.08)')
      .attr('stroke-width', 0.8);

    // Map Outline Box & Equator
    svg
      .append('path')
      .datum(d3.geoGraticule().outline())
      .attr('d', pathGenerator)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(79, 210, 255, 0.22)')
      .attr('stroke-width', 1.2);

    // Base Hub Nodes
    GEO_HUBS.forEach((hub) => {
      const coords = projection([hub.lng, hub.lat]);
      if (!coords) return;
      const [x, y] = coords;

      // Small hub dot
      svg
        .append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 2.8)
        .attr('fill', 'rgba(79, 210, 255, 0.55)');

      // Hub City Label
      svg
        .append('text')
        .attr('x', x)
        .attr('y', y - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(125, 212, 255, 0.65)')
        .attr('font-size', '7.5px')
        .attr('font-family', 'sans-serif')
        .text(hub.city);
    });

    // Plot Order Logs with Geo Location metadata
    logs.slice(0, 8).forEach((log, i) => {
      const geo = log.geo || GEO_HUBS[i % GEO_HUBS.length];
      const coords = projection([geo.lng, geo.lat]);
      if (!coords) return;
      const [x, y] = coords;

      const isBuy = log.type === 'BUY';
      const color = isBuy ? '#00f5a0' : log.profit ? '#ffd13b' : '#ff4f70';

      // Outer Pulse Ring
      svg
        .append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 9)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 1.2)
        .attr('opacity', 0.6);

      // Order Core Dot
      svg
        .append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 4)
        .attr('fill', color);

      // Order callout badge text
      const labelText = `${isBuy ? '▲ BUY' : '▼ SELL'} ${log.pair} ($${log.price.toLocaleString()})`;
      svg
        .append('text')
        .attr('x', x)
        .attr('y', y + 14)
        .attr('text-anchor', 'middle')
        .attr('fill', color)
        .attr('font-size', '8px')
        .attr('font-weight', 'bold')
        .attr('font-family', 'monospace')
        .text(labelText);
    });
  }, [logs]);

  return (
    <div className="p-3.5 rounded-xl bg-[#081522] border border-[rgba(79,210,255,0.15)] space-y-2">
      <div className="flex items-center justify-between border-b border-[rgba(79,210,255,0.1)] pb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-white tracking-wider uppercase">
            🌍 Global Order Geo-Location Map (D3 Plot)
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(0,245,160,0.15)] text-[#00f5a0] border border-[rgba(0,245,160,0.3)] font-semibold">
            Live Geo-Node Sync
          </span>
        </div>
        <span className="text-[9.5px] text-[#55819c]">
          {GEO_HUBS.length} Exchange Nodes Connected
        </span>
      </div>

      <div className="w-full h-48 bg-[#040a10] rounded-lg border border-[rgba(79,210,255,0.1)] p-1 relative overflow-hidden flex items-center justify-center">
        <svg ref={mapSvgRef} viewBox="0 0 720 210" className="w-full h-full block" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[9.5px] text-[#6d96b0] pt-0.5">
        <span>Nodes: Mumbai (CoinDCX) · Singapore · Tokyo · London · New York · Dubai</span>
        <span className="text-[#00f5a0]">🟢 Low Latency Sync (&lt;14ms)</span>
      </div>
    </div>
  );
};

interface TradingBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHeartRate: number;
  pairs: MarketPairData[];
  selectedPairIndex: number;
  onSelectPairIndex: (index: number) => void;
  autoTrading: boolean;
  onToggleAutoTrading: () => void;
  balance: number;
  positions: TradingPosition[];
  tradeLogs: TradeOrderLog[];
  analysisFeed: AutoAnalysisItem[];
  strategy: 'SENTIMENT_ALPHA' | 'TREND_MOMENTUM' | 'GRID_SCALPER';
  onChangeStrategy: (strat: 'SENTIMENT_ALPHA' | 'TREND_MOMENTUM' | 'GRID_SCALPER') => void;
  onManualBuy: (symbol: string) => void;
  onManualSell: (symbol: string) => void;
  onTriggerSentimentTrade?: (mood: MoodType, msg: string) => void;
}

export const TradingBotModal: React.FC<TradingBotModalProps> = ({
  isOpen,
  onClose,
  currentHeartRate,
  pairs,
  selectedPairIndex,
  onSelectPairIndex,
  autoTrading,
  onToggleAutoTrading,
  balance,
  positions,
  tradeLogs,
  analysisFeed,
  strategy,
  onChangeStrategy,
  onManualBuy,
  onManualSell,
  onTriggerSentimentTrade,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activePair = pairs[selectedPairIndex] || pairs[0];
  const totalPnl = positions.reduce((acc, p) => acc + p.pnl, 0);

  // Real CoinDCX Integration States
  const [coindcxKey, setCoindcxKey] = useState<string>(() => localStorage.getItem('coindcx_key') || '');
  const [coindcxSecret, setCoindcxSecret] = useState<string>(() => localStorage.getItem('coindcx_secret') || '');
  const [showKeyForm, setShowKeyForm] = useState<boolean>(false);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [inrBalance, setInrBalance] = useState<string>('128,450.00');
  const [usdtBalance, setUsdtBalance] = useState<string>('1,540.25');
  const [connectMsg, setConnectMsg] = useState<string | null>(null);
  const [isNewsModalOpen, setIsNewsModalOpen] = useState<boolean>(false);

  const checkCoinDcxBalances = async (k?: string, s?: string) => {
    const keyToUse = k !== undefined ? k : coindcxKey;
    const secretToUse = s !== undefined ? s : coindcxSecret;
    try {
      const balBody = JSON.stringify({ apiKey: keyToUse, apiSecret: secretToUse });
      let r = await fetch('/api/coindcx/balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: balBody,
      }).catch(() => null);
      if (!r || !r.ok) {
        r = await fetch('https://apex-humanoid-v2.pradhanbibek53.workers.dev/api/coindcx/balances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: balBody,
        });
      }
      const j = await r.json();
      if (j.ok) {
        setIsLiveConnected(j.live);
        if (j.balances && Array.isArray(j.balances)) {
          const inr = j.balances.find((b: any) => b.currency === 'INR');
          const usdt = j.balances.find((b: any) => b.currency === 'USDT');
          if (inr) setInrBalance(parseFloat(inr.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 }));
          if (usdt) setUsdtBalance(parseFloat(usdt.balance).toLocaleString('en-US', { minimumFractionDigits: 2 }));
        }
        if (j.live) {
          setConnectMsg('Connected to Live CoinDCX Account!');
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (isOpen) {
      checkCoinDcxBalances();
    }
  }, [isOpen]);

  const handleSaveKeys = () => {
    localStorage.setItem('coindcx_key', coindcxKey.trim());
    localStorage.setItem('coindcx_secret', coindcxSecret.trim());
    setConnectMsg('Testing CoinDCX Connection...');
    checkCoinDcxBalances(coindcxKey.trim(), coindcxSecret.trim());
  };

  // Render Interactive Chart with Fake BUY and SELL Marks
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const data = activePair.history;
    if (!data || data.length < 2) return;

    const min = Math.min(...data) * 0.997;
    const max = Math.max(...data) * 1.003;
    const range = max - min || 1;

    // Background Grid
    ctx.strokeStyle = 'rgba(79, 210, 255, 0.07)';
    ctx.lineWidth = 1;
    for (let y = 14; y < h; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let x = 40; x < w; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Chart Gradient Area
    const isUp = activePair.change24h >= 0;
    const strokeColor = isUp ? '#00f5a0' : '#ff4f70';
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, isUp ? 'rgba(0, 245, 160, 0.28)' : 'rgba(255, 79, 112, 0.28)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    const step = w / (data.length - 1);
    ctx.beginPath();
    data.forEach((val, i) => {
      const x = i * step;
      const y = h - ((val - min) / range) * (h - 32) - 16;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Main Price Line
    ctx.beginPath();
    data.forEach((val, i) => {
      const x = i * step;
      const y = h - ((val - min) / range) * (h - 32) - 16;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Current Price Pulse Head
    const lastX = w;
    const lastY = h - ((data[data.length - 1] - min) / range) * (h - 32) - 16;
    ctx.beginPath();
    ctx.arc(lastX - 4, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = strokeColor;
    ctx.fill();

    // DRAW VISUAL FAKE BUY AND SELL MARKERS ON CHART!
    // ("khud he fake buy aur sell mark karke rakhna")
    const markers = activePair.markers || [];
    markers.forEach((m) => {
      // Map marker index to X coordinate on current data curve
      const clampedIdx = Math.max(0, Math.min(data.length - 1, m.index));
      const mx = clampedIdx * step;
      const my = h - ((data[clampedIdx] - min) / range) * (h - 32) - 16;

      const isBuy = m.type === 'BUY';
      const markColor = isBuy ? '#00f5a0' : '#ff4f70';
      const badgeBg = isBuy ? 'rgba(0, 245, 160, 0.92)' : 'rgba(255, 79, 112, 0.92)';

      // Vertical marker pin line to price point
      ctx.beginPath();
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = markColor;
      ctx.lineWidth = 1.2;
      ctx.moveTo(mx, isBuy ? my + 4 : my - 4);
      ctx.lineTo(mx, isBuy ? my + 26 : my - 26);
      ctx.stroke();
      ctx.setLineDash([]);

      // Glowing dot on exact price point
      ctx.beginPath();
      ctx.arc(mx, my, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = markColor;
      ctx.shadowColor = markColor;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Marker Badge Box
      const badgeY = isBuy ? my + 26 : my - 26;
      const text = isBuy ? `▲ ${m.label}` : `▼ ${m.label}`;
      ctx.font = 'bold 9px monospace';
      const textWidth = ctx.measureText(text).width;
      const padX = 6;
      const badgeW = textWidth + padX * 2;
      const badgeH = 15;
      const bx = Math.max(4, Math.min(w - badgeW - 4, mx - badgeW / 2));
      const by = isBuy ? badgeY : badgeY - badgeH;

      ctx.fillStyle = badgeBg;
      ctx.beginPath();
      ctx.roundRect(bx, by, badgeW, badgeH, 3);
      ctx.fill();

      // Badge Text
      ctx.fillStyle = '#05111b';
      ctx.fillText(text, bx + padX, by + 11);
    });
  }, [activePair, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[rgba(3,8,13,0.85)] backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#050e16] border border-[rgba(79,210,255,0.3)] shadow-[0_25px_70px_-20px_rgba(0,0,0,0.95)] flex flex-col font-mono text-[#a1c2d6]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[rgba(79,210,255,0.18)] bg-[rgba(6,18,29,0.7)] sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[rgba(0,245,160,0.12)] border border-[#00f5a0] flex items-center justify-center text-[#00f5a0] text-lg font-bold shadow-[0_0_15px_rgba(0,245,160,0.4)]">
              📈
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white text-sm sm:text-base font-semibold tracking-wider uppercase">
                  APEX TRADING BOT // AUTO-TRADE & AUTO-ANALYSIS
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(0,245,160,0.15)] text-[#00f5a0] border border-[#00f5a0] font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00f5a0] animate-ping" />
                  AUTO-PILOT ACTIVE
                </span>
              </div>
              <div className="text-[10px] text-[#55819c] flex items-center gap-2 mt-0.5">
                <span>
                  Telemetry Sync: <b className="text-[#ffd13b] font-semibold">{currentHeartRate} BPM</b>
                </span>
                <span>·</span>
                <span>Simulated Fake Orders: <b className="text-white">Active</b></span>
                <span>·</span>
                <span>Automated Market Analysis: <b className="text-[#00f5a0]">Continuous</b></span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Hide Trading Bot"
            className="w-8 h-8 rounded-lg border border-[rgba(79,210,255,0.2)] text-[#6d94af] hover:text-white hover:bg-[rgba(79,210,255,0.1)] flex items-center justify-center text-sm transition-colors cursor-pointer"
            title="Hide Trading Bot (Keeps Auto-Trading in Background)"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Real CoinDCX Integration & Live Wallet Status Banner */}
          <div className="p-3 rounded-xl bg-[rgba(6,22,34,0.85)] border border-[rgba(0,245,160,0.3)] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00f5a0] animate-pulse" />
                  CoinDCX Live Exchange Engine
                </span>
                <span className={`text-[9.5px] px-2 py-0.5 rounded font-bold uppercase ${
                  isLiveConnected
                    ? 'bg-[rgba(0,245,160,0.2)] text-[#00f5a0] border border-[#00f5a0]'
                    : 'bg-[rgba(255,209,59,0.15)] text-[#ffd13b] border border-[rgba(255,209,59,0.3)]'
                }`}>
                  {isLiveConnected ? '🟢 Live Money Trading Active' : '🟡 Sandbox Mode (Stream Active)'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-[10px] text-[#78a4c0] text-right">
                  <span>INR: <b className="text-[#00f5a0]">₹{inrBalance}</b></span> · <span>USDT: <b className="text-white">${usdtBalance}</b></span>
                </div>
                <button
                  onClick={() => setShowKeyForm((prev) => !prev)}
                  className="px-2.5 py-1 rounded bg-[rgba(79,210,255,0.15)] hover:bg-[rgba(79,210,255,0.25)] border border-[rgba(79,210,255,0.3)] text-[#4fd2ff] text-[10px] font-semibold transition-all cursor-pointer"
                >
                  {showKeyForm ? '✕ Close Credentials' : '🔑 Connect Real CoinDCX API Keys'}
                </button>
              </div>
            </div>

            {/* API Key Input Form */}
            {showKeyForm && (
              <div className="p-3 rounded-lg bg-[#040c14] border border-[rgba(79,210,255,0.2)] space-y-2.5 text-xs">
                <div className="text-[10px] text-[#8db1ca]">
                  Enter your CoinDCX API Key & Secret below. Orders will be executed directly on CoinDCX with real INR/USDT balances:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9.5px] text-[#5b87a6] block mb-1 uppercase font-semibold">CoinDCX API Key</label>
                    <input
                      type="text"
                      value={coindcxKey}
                      onChange={(e) => setCoindcxKey(e.target.value)}
                      placeholder="Paste your CoinDCX API Key"
                      className="w-full bg-[#081726] border border-[rgba(79,210,255,0.2)] rounded px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#00f5a0]"
                    />
                  </div>
                  <div>
                    <label className="text-[9.5px] text-[#5b87a6] block mb-1 uppercase font-semibold">CoinDCX API Secret</label>
                    <input
                      type="password"
                      value={coindcxSecret}
                      onChange={(e) => setCoindcxSecret(e.target.value)}
                      placeholder="Paste your CoinDCX API Secret"
                      className="w-full bg-[#081726] border border-[rgba(79,210,255,0.2)] rounded px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#00f5a0]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-[#00f5a0]">{connectMsg}</span>
                  <button
                    onClick={handleSaveKeys}
                    className="px-4 py-1.5 rounded bg-[#00f5a0] hover:bg-[#00c880] text-[#041610] text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_12px_rgba(0,245,160,0.3)]"
                  >
                    Save & Authenticate Live Trading
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-[#081522] border border-[rgba(79,210,255,0.15)] flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#55819c]">Portfolio Balance</span>
              <span className="text-lg sm:text-xl font-bold text-white mt-1">
                ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[9.5px] text-[#00f5a0] mt-0.5 font-medium">+16.4% Simulated Yield</span>
            </div>

            <div className="p-3 rounded-xl bg-[#081522] border border-[rgba(79,210,255,0.15)] flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#55819c]">Unrealized PnL</span>
              <span className={`text-lg sm:text-xl font-bold mt-1 ${totalPnl >= 0 ? 'text-[#00f5a0]' : 'text-[#ff4f70]'}`}>
                {totalPnl >= 0 ? `+$${totalPnl.toFixed(2)}` : `-$${Math.abs(totalPnl).toFixed(2)}`}
              </span>
              <span className="text-[9.5px] text-[#6d96b0] mt-0.5 font-medium">Active Across {positions.length} Pairs</span>
            </div>

            <div className="p-3 rounded-xl bg-[#081522] border border-[rgba(79,210,255,0.15)] flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#55819c]">Market Sentiment</span>
              <span className="text-lg sm:text-xl font-bold text-[#ffd13b] mt-1 flex items-center gap-1.5">
                ⚡ EXCITED
              </span>
              <span className="text-[9.5px] text-[#ffd13b] mt-0.5 font-medium">89% Bullish Greed Index</span>
            </div>

            <div className="p-3 rounded-xl bg-[#081522] border border-[rgba(79,210,255,0.15)] flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#55819c]">Auto-Trade Engine</span>
              <div className="flex items-center justify-between mt-1">
                <span className={`text-sm font-bold ${autoTrading ? 'text-[#00f5a0]' : 'text-[#849fb3]'}`}>
                  {autoTrading ? '● AUTO-PILOT ON' : '○ PAUSED'}
                </span>
                <button
                  onClick={onToggleAutoTrading}
                  className={`text-[9.5px] px-2 py-0.5 rounded cursor-pointer border ${
                    autoTrading
                      ? 'bg-[#00f5a0] text-[#041a12] border-[#00f5a0] font-semibold'
                      : 'bg-transparent text-[#6d96b0] border-[#6d96b0]'
                  }`}
                >
                  {autoTrading ? 'Pause' : 'Activate'}
                </button>
              </div>
              <span className="text-[9.5px] text-[#55819c] mt-0.5">Win Rate: 85.2%</span>
            </div>
          </div>

          {/* Interactive Chart with Fake BUY and SELL Markers */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#081522] border border-[rgba(79,210,255,0.15)] space-y-3">
            {/* Pair Selector Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {pairs.map((p, idx) => (
                <button
                  key={p.symbol}
                  onClick={() => onSelectPairIndex(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider transition-all cursor-pointer whitespace-nowrap border flex items-center gap-2 ${
                    selectedPairIndex === idx
                      ? 'bg-[rgba(79,210,255,0.2)] border-[#4fd2ff] text-white shadow-[0_0_12px_rgba(79,210,255,0.3)]'
                      : 'bg-transparent border-[rgba(79,210,255,0.1)] text-[#658ba3] hover:text-white'
                  }`}
                >
                  <span>{p.symbol}</span>
                  <span className={p.change24h >= 0 ? 'text-[#00f5a0]' : 'text-[#ff4f70]'}>
                    {p.change24h >= 0 ? `+${p.change24h}%` : `${p.change24h}%`}
                  </span>
                </button>
              ))}
            </div>

            {/* Price Detail Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1 border-t border-[rgba(79,210,255,0.08)]">
              <div className="flex items-baseline gap-2.5">
                <span className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                  ${activePair.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className={`text-xs font-semibold ${activePair.change24h >= 0 ? 'text-[#00f5a0]' : 'text-[#ff4f70]'}`}>
                  {activePair.change24h >= 0 ? `+${activePair.change24h}% (24h)` : `${activePair.change24h}% (24h)`}
                </span>
              </div>

              <div className="flex items-center gap-3 text-[10px] text-[#658ba3]">
                <span>RSI(14): <b className="text-white">{activePair.rsi}</b></span>
                <span>MACD: <b className="text-[#00f5a0]">{activePair.macd}</b></span>
                <span>24h High: <b className="text-white">${activePair.high24h.toLocaleString()}</b></span>
                <span>24h Low: <b className="text-white">${activePair.low24h.toLocaleString()}</b></span>
              </div>
            </div>

            {/* Area Chart Canvas with BUY / SELL markers */}
            <div className="w-full h-44 bg-[#040a10] rounded-lg border border-[rgba(79,210,255,0.1)] p-1 relative overflow-hidden">
              <canvas ref={canvasRef} width={760} height={176} className="w-full h-full block" />
              <div className="absolute top-2 right-2 text-[9px] text-[#4fd2ff] bg-[rgba(6,18,28,0.75)] px-2 py-0.5 rounded border border-[rgba(79,210,255,0.2)] flex items-center gap-2">
                <span className="flex items-center gap-1 text-[#00f5a0]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00f5a0]" />
                  ▲ AUTO BUY MARKERS
                </span>
                <span className="flex items-center gap-1 text-[#ff4f70]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff4f70]" />
                  ▼ AUTO SELL MARKERS
                </span>
              </div>
            </div>
          </div>

          {/* Manual Fake Trade Execution & Simulation Controls */}
          <div className="p-3 rounded-xl bg-[rgba(6,22,34,0.6)] border border-[rgba(79,210,255,0.2)] flex flex-wrap items-center justify-between gap-2.5">
            <div className="text-[10px] text-[#84a9c2]">
              <b className="text-[#4fd2ff]">Autonomous Fake Trade & Sentiment Controls:</b> Auto-trader analyzes technicals and automatically marks BUY/SELL orders. You can also manually force marked fake orders below:
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onManualBuy(activePair.symbol)}
                className="px-3 py-1.5 rounded-lg bg-[rgba(0,245,160,0.15)] border border-[#00f5a0] text-[#00f5a0] hover:bg-[#00f5a0] hover:text-[#041a12] text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_10px_rgba(0,245,160,0.2)]"
                title="Mark fake BUY on chart immediately"
              >
                ▲ Force Fake BUY
              </button>
              <button
                onClick={() => onManualSell(activePair.symbol)}
                className="px-3 py-1.5 rounded-lg bg-[rgba(255,79,112,0.15)] border border-[#ff4f70] text-[#ff4f70] hover:bg-[#ff4f70] hover:text-white text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                title="Mark fake SELL / TP on chart immediately"
              >
                ▼ Force Fake SELL
              </button>
              <button
                onClick={() => {
                  onTriggerSentimentTrade?.('excited', 'Massive Bullish Breakout! Fake orders surging! Apex core heart rate accelerating!');
                }}
                className="px-3 py-1.5 rounded-lg bg-[rgba(255,209,59,0.18)] border border-[#ffd13b] text-[#ffd13b] hover:bg-[#ffd13b] hover:text-[#0a1620] text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_10px_rgba(255,209,59,0.3)]"
              >
                🚀 Trigger Surge (+18%)
              </button>
              <button
                onClick={() => setIsNewsModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-[rgba(79,210,255,0.18)] border border-[#4fd2ff] text-[#4fd2ff] hover:bg-[#4fd2ff] hover:text-[#041620] text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_10px_rgba(79,210,255,0.25)] flex items-center gap-1.5"
                title="Fetch latest 5 search-grounded market news headlines"
              >
                <span>📰</span>
                <span>Search Grounded News (Top 5)</span>
              </button>
            </div>
          </div>

          {/* Autonomous Market Analysis Stream (Live AI Reasoning) */}
          <div className="p-3.5 rounded-xl bg-[#081522] border border-[rgba(79,210,255,0.15)] flex flex-col space-y-2">
            <div className="flex items-center justify-between border-b border-[rgba(79,210,255,0.1)] pb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-white tracking-wider uppercase">
                  🤖 Automated Market Analysis Feed
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(79,210,255,0.12)] text-[#4fd2ff] border border-[rgba(79,210,255,0.2)]">
                  Continuous AI Scan
                </span>
              </div>
              <span className="text-[9.5px] text-[#00f5a0] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00f5a0] animate-ping" />
                Live Analysis
              </span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-[10px]">
              {analysisFeed.map((item) => (
                <div
                  key={item.id}
                  className="p-2 rounded-lg bg-[#050f18] border border-[rgba(79,210,255,0.08)] flex items-start justify-between gap-3"
                >
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[#55819c] font-mono text-[9px]">{item.time}</span>
                      <b className="text-white text-[10px]">{item.pair}</b>
                      <span
                        className={`text-[8.5px] px-1.5 py-0.2 rounded font-semibold ${
                          item.signal === 'BUY_SIGNAL'
                            ? 'bg-[rgba(0,245,160,0.15)] text-[#00f5a0] border border-[rgba(0,245,160,0.3)]'
                            : item.signal === 'PROFIT_TAKE'
                            ? 'bg-[rgba(255,209,59,0.15)] text-[#ffd13b] border border-[rgba(255,209,59,0.3)]'
                            : 'bg-[rgba(79,210,255,0.1)] text-[#79b4d6] border border-[rgba(79,210,255,0.2)]'
                        }`}
                      >
                        {item.signal}
                      </span>
                      <span className="text-[9px] text-[#4d758f]">Confidence: {item.confidence}%</span>
                    </div>
                    <p className="text-[9.5px] text-[#93b7ce] leading-relaxed">{item.analysis}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* D3 Map Visualization for Geo-Location Order Tracking */}
          <OrderGeoMap logs={tradeLogs} />

          {/* Bottom Grid: Active Positions & Trade Execution Audit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Active Open Positions */}
            <div className="p-3.5 rounded-xl bg-[#081522] border border-[rgba(79,210,255,0.15)] flex flex-col space-y-2">
              <div className="flex items-center justify-between border-b border-[rgba(79,210,255,0.1)] pb-1.5">
                <span className="text-[11px] font-semibold text-white tracking-wider uppercase">Active Open Positions</span>
                <span className="text-[9.5px] text-[#55819c]">{positions.length} Open Orders</span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {positions.length === 0 ? (
                  <div className="p-4 text-center text-[10px] text-[#55819c]">
                    No open positions. Autonomous bot scanning for next entry...
                  </div>
                ) : (
                  positions.map((pos) => (
                    <div
                      key={pos.id}
                      className="p-2 rounded-lg bg-[#050f18] border border-[rgba(79,210,255,0.08)] flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <b className="text-white text-[11px]">{pos.pair}</b>
                          <span className="text-[9px] px-1.5 rounded bg-[rgba(0,245,160,0.15)] text-[#00f5a0] font-bold">
                            {pos.type}
                          </span>
                        </div>
                        <div className="text-[9.5px] text-[#55819c] mt-0.5">
                          Entry: ${pos.entryPrice.toLocaleString()} · Amount: {pos.amount}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`font-bold text-[11px] ${pos.pnl >= 0 ? 'text-[#00f5a0]' : 'text-[#ff4f70]'}`}>
                          {pos.pnl >= 0 ? `+$${pos.pnl.toFixed(2)}` : `-$${Math.abs(pos.pnl).toFixed(2)}`}
                        </div>
                        <div className={`text-[9.5px] ${pos.pnl >= 0 ? 'text-[#00f5a0]' : 'text-[#ff4f70]'}`}>
                          ({pos.pnlPercent >= 0 ? `+${pos.pnlPercent}%` : `${pos.pnlPercent}%`})
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Execution Audit Logs */}
            <div className="p-3.5 rounded-xl bg-[#081522] border border-[rgba(79,210,255,0.15)] flex flex-col space-y-2">
              <div className="flex items-center justify-between border-b border-[rgba(79,210,255,0.1)] pb-1.5">
                <span className="text-[11px] font-semibold text-white tracking-wider uppercase">
                  Algo Execution Audit (Fake Trades)
                </span>
                <span className="text-[9.5px] text-[#00f5a0] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00f5a0] animate-ping" />
                  Live Sync
                </span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-[10px]">
                {tradeLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-1.5 rounded bg-[#050f18] border border-[rgba(79,210,255,0.06)] flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#55819c]">{log.time}</span>
                        <b className="text-white">{log.pair}</b>
                        <span
                          className={`text-[9px] font-semibold ${
                            log.type.includes('BUY') ? 'text-[#00f5a0]' : 'text-[#ffd13b]'
                          }`}
                        >
                          {log.type}
                        </span>
                      </div>
                      <div className="text-[9px] text-[#6d96b0]">{log.reason}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] px-1 rounded bg-[rgba(255,209,59,0.1)] text-[#ffd13b] border border-[rgba(255,209,59,0.2)]">
                        {log.sentimentTrigger}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Grounding Crypto News Modal */}
      <CryptoNewsModal isOpen={isNewsModalOpen} onClose={() => setIsNewsModalOpen(false)} />
    </div>
  );
};
