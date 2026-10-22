import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { MarketPairData, TradingPosition, TradeOrderLog, AutoAnalysisItem, MoodType } from '../types';
import { LiveAccountSummary } from '../hooks/useAutoTrader';
import { CryptoNewsModal } from './CryptoNewsModal';

const GEO_HUBS = [
  { city: 'Mumbai', country: 'India', lat: 19.076, lng: 72.8777, label: 'CoinDCX IN' },
  { city: 'Bengaluru', country: 'India', lat: 12.9716, lng: 77.5946, label: 'APEX Live Node' },
  { city: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198, label: 'Asia Feed' },
  { city: 'London', country: 'UK', lat: 51.5074, lng: -0.1278, label: 'Global FX' },
];

const OrderGeoMap: React.FC<{ logs: TradeOrderLog[] }> = ({ logs }) => {
  const mapSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svgEl = mapSvgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const w = 720;
    const h = 190;
    const projection = d3.geoEquirectangular().scale(96).translate([w / 2, h / 2 + 10]);
    const pathGenerator = d3.geoPath().projection(projection);

    const graticule = d3.geoGraticule().step([30, 30]);
    svg.append('path').datum(graticule).attr('d', pathGenerator).attr('fill', 'none').attr('stroke', 'rgba(79,210,255,0.08)');
    svg
      .append('path')
      .datum(d3.geoGraticule().outline())
      .attr('d', pathGenerator)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(79,210,255,0.22)');

    GEO_HUBS.forEach((hub) => {
      const coords = projection([hub.lng, hub.lat]);
      if (!coords) return;
      const [x, y] = coords;
      svg.append('circle').attr('cx', x).attr('cy', y).attr('r', 3).attr('fill', '#00f5a0');
      svg
        .append('text')
        .attr('x', x)
        .attr('y', y - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(180,235,255,0.8)')
        .attr('font-size', '8px')
        .text(hub.city);
    });

    logs.slice(0, 6).forEach((log, i) => {
      const geo = log.geo || GEO_HUBS[i % GEO_HUBS.length];
      const coords = projection([geo.lng, geo.lat]);
      if (!coords) return;
      const [x, y] = coords;
      const isBuy = log.type === 'BUY';
      const color = isBuy ? '#00f5a0' : '#ff4f70';
      svg.append('circle').attr('cx', x).attr('cy', y).attr('r', 8).attr('fill', 'none').attr('stroke', color);
      svg
        .append('text')
        .attr('x', x)
        .attr('y', y + 14)
        .attr('text-anchor', 'middle')
        .attr('fill', color)
        .attr('font-size', '8px')
        .attr('font-weight', 'bold')
        .text(`${isBuy ? '▲ BUY' : '▼ SELL'} ${log.pair}`);
    });
  }, [logs]);

  return (
    <div className="p-3.5 rounded-xl bg-[#081522] border border-[rgba(79,210,255,0.15)] space-y-2">
      <div className="flex items-center justify-between border-b border-[rgba(79,210,255,0.1)] pb-1.5">
        <span className="text-[11px] font-semibold text-white tracking-wider uppercase">
          🌍 CoinDCX Live Exchange Routing (India Direct)
        </span>
        <span className="text-[9.5px] text-[#00f5a0]">🟢 Real Exchange Stream</span>
      </div>
      <div className="w-full h-40 bg-[#040a10] rounded-lg border border-[rgba(79,210,255,0.1)] p-1 overflow-hidden">
        <svg ref={mapSvgRef} viewBox="0 0 720 190" className="w-full h-full block" />
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
  smartStatus?: string;
  onSmartTradeNow?: () => void;
  balance: number;
  liveAccount?: LiveAccountSummary;
  onSyncAccount?: (k?: string, s?: string) => Promise<any>;
  orderInrAmount?: number;
  onChangeOrderAmount?: (v: number) => void;
  walletType?: 'auto' | 'futures' | 'spot';
  onChangeWalletType?: (w: 'auto' | 'futures' | 'spot') => void;
  leverage?: number;
  onChangeLeverage?: (lev: number) => void;
  orderBusy?: boolean;
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
  smartStatus,
  onSmartTradeNow,
  balance,
  liveAccount,
  onSyncAccount,
  orderInrAmount = 200,
  onChangeOrderAmount,
  walletType = 'auto',
  onChangeWalletType,
  leverage = 1,
  onChangeLeverage,
  orderBusy = false,
  positions,
  tradeLogs,
  analysisFeed,
  onManualBuy,
  onManualSell,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activePair = pairs[selectedPairIndex] || pairs[0];
  const isInrPair = activePair.symbol.endsWith('/INR');
  const currencyPrefix = isInrPair ? '₹' : '$';
  const totalPnl = positions.reduce((acc, p) => acc + p.pnl, 0);

  const [coindcxKey, setCoindcxKey] = useState<string>(() => localStorage.getItem('coindcx_key') || '');
  const [coindcxSecret, setCoindcxSecret] = useState<string>(() => localStorage.getItem('coindcx_secret') || '');
  const [showKeyForm, setShowKeyForm] = useState<boolean>(false);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);
  const [isNewsModalOpen, setIsNewsModalOpen] = useState<boolean>(false);
  const [syncingWallet, setSyncingWallet] = useState<boolean>(false);

  const handleRefreshWallet = async () => {
    if (!onSyncAccount) return;
    setSyncingWallet(true);
    const j = await onSyncAccount(coindcxKey.trim() || undefined, coindcxSecret.trim() || undefined);
    setSyncingWallet(false);
    if (j?.live) setConnectMsg('✅ Real CoinDCX Wallet Synced!');
  };

  useEffect(() => {
    if (isOpen && onSyncAccount) {
      onSyncAccount();
    }
  }, [isOpen, onSyncAccount]);

  const handleSaveKeys = async () => {
    localStorage.setItem('coindcx_key', coindcxKey.trim());
    localStorage.setItem('coindcx_secret', coindcxSecret.trim());
    setConnectMsg('Syncing live CoinDCX account...');
    const j = await onSyncAccount?.(coindcxKey.trim(), coindcxSecret.trim());
    if (j?.live) {
      setConnectMsg('✅ Connected to Real CoinDCX Wallet!');
      setShowKeyForm(false);
    } else {
      setConnectMsg('⚠️ Check API Key / Secret permissions');
    }
  };

  // Render Live Price Chart
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

    const min = Math.min(...data) * 0.999;
    const max = Math.max(...data) * 1.001;
    const range = max - min || 1;

    ctx.strokeStyle = 'rgba(79, 210, 255, 0.07)';
    ctx.lineWidth = 1;
    for (let y = 14; y < h; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const isUp = activePair.change24h >= 0;
    const strokeColor = isUp ? '#00f5a0' : '#ff4f70';
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, isUp ? 'rgba(0, 245, 160, 0.25)' : 'rgba(255, 79, 112, 0.25)');
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

    ctx.beginPath();
    data.forEach((val, i) => {
      const x = i * step;
      const y = h - ((val - min) / range) * (h - 32) - 16;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    (activePair.markers || []).forEach((m) => {
      const clampedIdx = Math.max(0, Math.min(data.length - 1, m.index));
      const mx = clampedIdx * step;
      const my = h - ((data[clampedIdx] - min) / range) * (h - 32) - 16;
      const isBuy = m.type === 'BUY';
      const markColor = isBuy ? '#00f5a0' : '#ff4f70';
      ctx.beginPath();
      ctx.arc(mx, my, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = markColor;
      ctx.fill();
    });
  }, [activePair, isOpen]);

  if (!isOpen) return null;

  const acct = liveAccount || {
    live: false,
    spotInr: 0,
    spotUsdt: 0,
    futuresInr: 0,
    futuresUsdt: 0,
    totalInr: balance,
    totalUsdt: 0,
    usdtInr: 87.5,
    holdings: [],
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[rgba(3,8,13,0.88)] backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#050e16] border border-[rgba(0,245,160,0.35)] shadow-[0_25px_70px_-20px_rgba(0,0,0,0.95)] flex flex-col font-mono text-[#a1c2d6]">
        {/* Header — 100% REAL LIVE MODE (ZERO DEMO) */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[rgba(79,210,255,0.18)] bg-[rgba(6,18,29,0.85)] sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[rgba(0,245,160,0.15)] border border-[#00f5a0] flex items-center justify-center text-[#00f5a0] text-lg font-bold">
              💹
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-white text-sm sm:text-base font-bold tracking-wider uppercase">
                  COINDCX REAL MONEY TRADING TERMINAL
                </span>
                <span
                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                    acct.live
                      ? 'bg-[rgba(0,245,160,0.18)] text-[#00f5a0] border border-[#00f5a0]'
                      : 'bg-[rgba(255,79,112,0.18)] text-[#ff6f8d] border border-[#ff4f70]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                  {acct.live ? 'REAL ACCOUNT LIVE (DEMO OFF)' : 'CONNECT KEYS'}
                </span>
              </div>
              <div className="text-[10px] text-[#6d98b4] flex flex-wrap items-center gap-2 mt-0.5">
                <span>100% Real Exchange Prices &amp; Balances</span>
                <span>·</span>
                <span>Spot + Futures Wallets Supported</span>
                <span>·</span>
                <span>Core Pulse: <b className="text-[#ffd13b]">{currentHeartRate} BPM</b></span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close Trading Terminal"
            className="w-8 h-8 rounded-lg border border-[rgba(79,210,255,0.2)] text-[#6d94af] hover:text-white hover:bg-[rgba(79,210,255,0.1)] flex items-center justify-center text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Real CoinDCX Spot + Futures Wallet Banner */}
          <div className="p-3.5 rounded-xl bg-[rgba(6,22,34,0.9)] border border-[rgba(0,245,160,0.32)] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00f5a0]" />
                  <span>Real CoinDCX Wallet Breakdown (Spot + Futures)</span>
                </div>
                <div className="text-[11px] text-[#9ec3db] flex flex-wrap gap-3 pt-1">
                  <span>
                    Spot INR: <b className="text-[#00f5a0]">₹{acct.spotInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                  </span>
                  <span>
                    Futures INR: <b className="text-[#00f5a0]">₹{acct.futuresInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                  </span>
                  <span>
                    Spot USDT: <b className="text-white">${acct.spotUsdt.toFixed(2)}</b>
                  </span>
                  <span>
                    Futures USDT: <b className="text-white">${acct.futuresUsdt.toFixed(2)}</b>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefreshWallet}
                  disabled={syncingWallet}
                  className="px-2.5 py-1 rounded bg-[rgba(0,245,160,0.14)] hover:bg-[rgba(0,245,160,0.25)] border border-[#00f5a0] text-[#00f5a0] text-[10px] font-bold cursor-pointer"
                >
                  {syncingWallet ? 'Syncing…' : '🔄 Refresh Balance'}
                </button>
                <button
                  onClick={() => setShowKeyForm((prev) => !prev)}
                  className="px-2.5 py-1 rounded bg-[rgba(79,210,255,0.15)] hover:bg-[rgba(79,210,255,0.25)] border border-[rgba(79,210,255,0.3)] text-[#4fd2ff] text-[10px] font-semibold cursor-pointer"
                >
                  {showKeyForm ? '✕ Close' : '🔑 API Keys'}
                </button>
              </div>
            </div>

            {/* Real Non-Zero Coin Holdings Chips */}
            {acct.holdings.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[rgba(79,210,255,0.1)]">
                {acct.holdings.map((h, i) => (
                  <span
                    key={`${h.wallet}-${h.currency}-${i}`}
                    className="text-[10px] px-2 py-0.5 rounded bg-[#04101a] border border-[rgba(79,210,255,0.2)] text-[#d7f1ff]"
                  >
                    <b className="text-[#4fd2ff]">[{h.wallet}]</b> {h.currency}: <b>{h.total.toFixed(4)}</b>{' '}
                    <span className="text-[#00f5a0]">(₹{h.valueInr.toFixed(2)})</span>
                  </span>
                ))}
              </div>
            )}

            {showKeyForm && (
              <div className="p-3 rounded-lg bg-[#040c14] border border-[rgba(79,210,255,0.2)] space-y-2.5 text-xs">
                <div className="text-[10px] text-[#8db1ca]">
                  Cloudflare Server Keys already active hain — chaaho to yahan alag CoinDCX API Key &amp; Secret override bhi kar sakte ho:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={coindcxKey}
                    onChange={(e) => setCoindcxKey(e.target.value)}
                    placeholder="CoinDCX API Key"
                    className="w-full bg-[#081726] border border-[rgba(79,210,255,0.2)] rounded px-2.5 py-1.5 text-white font-mono text-[11px]"
                  />
                  <input
                    type="password"
                    value={coindcxSecret}
                    onChange={(e) => setCoindcxSecret(e.target.value)}
                    placeholder="CoinDCX API Secret"
                    className="w-full bg-[#081726] border border-[rgba(79,210,255,0.2)] rounded px-2.5 py-1.5 text-white font-mono text-[11px]"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-[#00f5a0]">{connectMsg}</span>
                  <button
                    onClick={handleSaveKeys}
                    className="px-4 py-1.5 rounded bg-[#00f5a0] text-[#041610] text-[11px] font-bold uppercase cursor-pointer"
                  >
                    Save &amp; Sync Live Account
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* BIG 1-TAP 24x7 SMART AUTO-TRADER + INSTANT LIVE EXECUTION BANNER */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-[rgba(0,245,160,0.12)] via-[rgba(6,24,38,0.95)] to-[rgba(79,210,255,0.12)] border border-[#00f5a0] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div>
                <div className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${autoTrading ? 'bg-[#00f5a0] animate-ping' : 'bg-[#ffd13b]'}`} />
                  <span>
                    {autoTrading
                      ? `🤖 24×7 SMART AUTO-TRADING ACTIVE (₹${orderInrAmount}/trade)`
                      : '🤖 SMART AUTO-TRADER READY (1-Tap Start)'}
                  </span>
                </div>
                <div className="text-[10.5px] text-[#a7f3d0] mt-0.5">
                  {smartStatus || 'Auto Dip-Buy + +0.95% Take-Profit + -0.85% Stop-Loss (100% Real CoinDCX Spot INR)'}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={onToggleAutoTrading}
                  disabled={orderBusy}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer border transition-all ${
                    autoTrading
                      ? 'bg-[#ff3b5c] text-white border-[#ff6b84] shadow-[0_0_16px_rgba(255,59,92,0.5)]'
                      : 'bg-[#00f5a0] text-[#041a12] border-[#00f5a0] shadow-[0_0_18px_rgba(0,245,160,0.6)]'
                  }`}
                >
                  {autoTrading ? '⏹ STOP AUTO-TRADE' : '🚀 START AUTO-TRADE'}
                </button>

                {onSmartTradeNow && (
                  <button
                    onClick={onSmartTradeNow}
                    disabled={orderBusy}
                    className="px-3.5 py-2 rounded-xl bg-[#ffd13b] hover:brightness-105 disabled:opacity-50 text-[#121604] border border-[#ffe17d] text-xs font-extrabold uppercase tracking-wider cursor-pointer"
                  >
                    {orderBusy ? 'Executing…' : `⚡ ABHI SMART TRADE (₹${orderInrAmount})`}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 4 Live Real Account Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-[#081522] border border-[rgba(79,210,255,0.15)] flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#55819c]">Total Real Portfolio</span>
              <span className="text-lg sm:text-xl font-bold text-[#00f5a0] mt-1">
                ₹{acct.totalInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[9.5px] text-[#9ac0d9] mt-0.5">
                ≈ ${acct.totalUsdt.toFixed(2)} USDT (Live Value)
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#081522] border border-[rgba(79,210,255,0.15)] flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#55819c]">Open Positions PnL</span>
              <span className={`text-lg sm:text-xl font-bold mt-1 ${totalPnl >= 0 ? 'text-[#00f5a0]' : 'text-[#ff4f70]'}`}>
                {totalPnl >= 0 ? `+$${totalPnl.toFixed(2)}` : `-$${Math.abs(totalPnl).toFixed(2)}`}
              </span>
              <span className="text-[9.5px] text-[#6d96b0] mt-0.5">{positions.length} Real Active Positions</span>
            </div>

            <div className="p-3 rounded-xl bg-[#081522] border border-[rgba(79,210,255,0.15)] flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#55819c]">USDT / INR Rate</span>
              <span className="text-lg sm:text-xl font-bold text-white mt-1">₹{acct.usdtInr.toFixed(2)}</span>
              <span className="text-[9.5px] text-[#00f5a0] mt-0.5">CoinDCX Live Rate</span>
            </div>

            <div className="p-3 rounded-xl bg-[#081522] border border-[rgba(79,210,255,0.15)] flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#55819c]">Real Auto-Trade</span>
              <div className="flex items-center justify-between mt-1">
                <span className={`text-xs font-bold ${autoTrading ? 'text-[#00f5a0]' : 'text-[#ffd13b]'}`}>
                  {autoTrading ? '● LIVE AUTO ON' : '○ MANUAL SAFE'}
                </span>
                <button
                  onClick={onToggleAutoTrading}
                  className={`text-[9.5px] px-2 py-0.5 rounded cursor-pointer border ${
                    autoTrading
                      ? 'bg-[#ff4f70] text-white border-[#ff4f70] font-semibold'
                      : 'bg-[#00f5a0] text-[#041a12] border-[#00f5a0] font-semibold'
                  }`}
                >
                  {autoTrading ? 'Stop Auto' : 'Start Auto'}
                </button>
              </div>
              <span className="text-[9.5px] text-[#55819c] mt-0.5">RSI ≤ 32 Buy · RSI ≥ 68 Sell</span>
            </div>
          </div>

          {/* Real Live Market Pairs & Chart */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#081522] border border-[rgba(79,210,255,0.15)] space-y-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {pairs.map((p, idx) => (
                <button
                  key={p.symbol}
                  onClick={() => onSelectPairIndex(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider transition-all cursor-pointer whitespace-nowrap border flex items-center gap-2 ${
                    selectedPairIndex === idx
                      ? 'bg-[rgba(79,210,255,0.2)] border-[#4fd2ff] text-white'
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

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1 border-t border-[rgba(79,210,255,0.08)]">
              <div className="flex items-baseline gap-2.5">
                <span className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                  {activePair.price > 0
                    ? `${currencyPrefix}${activePair.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    : 'Loading Live Price…'}
                </span>
                <span className={`text-xs font-semibold ${activePair.change24h >= 0 ? 'text-[#00f5a0]' : 'text-[#ff4f70]'}`}>
                  {activePair.change24h >= 0 ? `+${activePair.change24h}% (24h)` : `${activePair.change24h}% (24h)`}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#658ba3]">
                <span>RSI(14): <b className="text-white">{activePair.rsi}</b></span>
                <span>Trend: <b className="text-[#00f5a0]">{activePair.macd}</b></span>
                <span>24h High: <b className="text-white">{currencyPrefix}{activePair.high24h.toLocaleString('en-IN')}</b></span>
                <span>24h Low: <b className="text-white">{currencyPrefix}{activePair.low24h.toLocaleString('en-IN')}</b></span>
              </div>
            </div>

            <div className="w-full h-44 bg-[#040a10] rounded-lg border border-[rgba(79,210,255,0.1)] p-1 relative overflow-hidden">
              <canvas ref={canvasRef} width={760} height={176} className="w-full h-full block" />
              <div className="absolute top-2 right-2 text-[9px] text-[#00f5a0] bg-[rgba(6,18,28,0.8)] px-2 py-0.5 rounded border border-[rgba(0,245,160,0.3)]">
                LIVE COINDCX TICKER STREAM
              </div>
            </div>
          </div>

          {/* 100% REAL LIVE ORDER EXECUTION CONTROLS */}
          <div className="p-3.5 rounded-xl bg-[rgba(6,22,34,0.78)] border border-[rgba(0,245,160,0.3)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] text-white font-bold">
                ⚡ Real Order Execution ({activePair.symbol}) — Direct CoinDCX API
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <label className="flex items-center gap-1 text-[#9ac0d9]">
                  <span>Amount (₹):</span>
                  <input
                    type="number"
                    min={100}
                    step={50}
                    value={orderInrAmount}
                    onChange={(e) => onChangeOrderAmount?.(Math.max(50, Number(e.target.value) || 100))}
                    className="w-20 bg-[#04101a] border border-[rgba(79,210,255,0.3)] rounded px-2 py-1 text-white font-bold"
                  />
                </label>

                <select
                  value={walletType}
                  onChange={(e) => onChangeWalletType?.(e.target.value as 'auto' | 'futures' | 'spot')}
                  className="bg-[#04101a] border border-[rgba(79,210,255,0.3)] rounded px-2 py-1 text-white"
                >
                  <option value="auto">Wallet: Auto (Spot/Futures)</option>
                  <option value="futures">Wallet: Futures (INR/USDT)</option>
                  <option value="spot">Wallet: Spot</option>
                </select>

                <select
                  value={leverage}
                  onChange={(e) => onChangeLeverage?.(Number(e.target.value) || 1)}
                  className="bg-[#04101a] border border-[rgba(79,210,255,0.3)] rounded px-2 py-1 text-white"
                >
                  <option value={1}>1x Safe</option>
                  <option value={2}>2x</option>
                  <option value={3}>3x</option>
                  <option value={5}>5x</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                disabled={orderBusy || activePair.price <= 0}
                onClick={() => onManualBuy(activePair.symbol)}
                className="flex-1 min-w-[140px] px-4 py-2 rounded-lg bg-[#00f5a0] hover:bg-[#00d88c] disabled:opacity-50 text-[#041a12] text-xs font-extrabold uppercase tracking-wider cursor-pointer"
              >
                {orderBusy ? 'Executing…' : `▲ LIVE BUY ${activePair.symbol} (₹${orderInrAmount})`}
              </button>
              <button
                disabled={orderBusy || activePair.price <= 0}
                onClick={() => onManualSell(activePair.symbol)}
                className="flex-1 min-w-[140px] px-4 py-2 rounded-lg bg-[#ff4f70] hover:bg-[#e63c5c] disabled:opacity-50 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer"
              >
                {orderBusy ? 'Executing…' : `▼ LIVE SELL ${activePair.symbol} (₹${orderInrAmount})`}
              </button>
              <button
                onClick={() => setIsNewsModalOpen(true)}
                className="px-3 py-2 rounded-lg bg-[rgba(79,210,255,0.18)] border border-[#4fd2ff] text-[#4fd2ff] hover:bg-[#4fd2ff] hover:text-[#041620] text-[10px] font-bold uppercase cursor-pointer"
              >
                📰 Live Market News
              </button>
            </div>
          </div>

          {/* Live AI Market Feed */}
          <div className="p-3.5 rounded-xl bg-[#081522] border border-[rgba(79,210,255,0.15)] space-y-2">
            <div className="flex items-center justify-between border-b border-[rgba(79,210,255,0.1)] pb-1.5">
              <span className="text-[11px] font-semibold text-white tracking-wider uppercase">
                📡 Real-Time CoinDCX Market Stream
              </span>
              <span className="text-[9.5px] text-[#00f5a0]">Live Exchange Data</span>
            </div>
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 text-[10px]">
              {analysisFeed.length === 0 ? (
                <div className="text-[#6d96b0] p-2">Connecting to live CoinDCX market ticker…</div>
              ) : (
                analysisFeed.map((item) => (
                  <div key={item.id} className="p-2 rounded-lg bg-[#050f18] border border-[rgba(79,210,255,0.08)]">
                    <span className="text-[#55819c] mr-2">{item.time}</span>
                    <b className="text-white mr-2">{item.pair}</b>
                    <span className="text-[#9ec3db]">{item.analysis}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <OrderGeoMap logs={tradeLogs} />

          {/* Bottom Grid: Real Active Positions & Real Exchange Order Audit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-[#081522] border border-[rgba(79,210,255,0.15)] space-y-2">
              <div className="flex items-center justify-between border-b border-[rgba(79,210,255,0.1)] pb-1.5">
                <span className="text-[11px] font-semibold text-white uppercase">Real Open Positions</span>
                <span className="text-[9.5px] text-[#55819c]">{positions.length} Active</span>
              </div>
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {positions.length === 0 ? (
                  <div className="p-4 text-center text-[10px] text-[#6d96b0]">
                    Abhi koi open futures position nahi hai.
                  </div>
                ) : (
                  positions.map((pos) => (
                    <div
                      key={pos.id}
                      className="p-2 rounded-lg bg-[#050f18] border border-[rgba(79,210,255,0.08)] flex items-center justify-between"
                    >
                      <div>
                        <b className="text-white text-[11px]">{pos.pair}</b>{' '}
                        <span className="text-[9px] px-1.5 rounded bg-[rgba(0,245,160,0.15)] text-[#00f5a0] font-bold">
                          {pos.type}
                        </span>
                        <div className="text-[9.5px] text-[#55819c] mt-0.5">
                          Entry: ${pos.entryPrice} · Qty: {pos.amount}
                        </div>
                      </div>
                      <div className={`font-bold text-[11px] ${pos.pnl >= 0 ? 'text-[#00f5a0]' : 'text-[#ff4f70]'}`}>
                        {pos.pnl >= 0 ? `+$${pos.pnl.toFixed(2)}` : `-$${Math.abs(pos.pnl).toFixed(2)}`}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#081522] border border-[rgba(79,210,255,0.15)] space-y-2">
              <div className="flex items-center justify-between border-b border-[rgba(79,210,255,0.1)] pb-1.5">
                <span className="text-[11px] font-semibold text-white uppercase">Real Exchange Order Log</span>
                <span className="text-[9.5px] text-[#00f5a0]">CoinDCX API</span>
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 text-[10px]">
                {tradeLogs.length === 0 ? (
                  <div className="p-4 text-center text-[#6d96b0]">
                    Real orders yahan live dikhenge (Demo / Fake logs 100% removed).
                  </div>
                ) : (
                  tradeLogs.map((log) => (
                    <div key={log.id} className="p-2 rounded bg-[#050f18] border border-[rgba(79,210,255,0.06)]">
                      <div className="flex items-center justify-between">
                        <span>
                          <span className="text-[#55819c] mr-1.5">{log.time}</span>
                          <b className="text-white mr-1.5">{log.pair}</b>
                          <b className={log.type.includes('BUY') ? 'text-[#00f5a0]' : 'text-[#ff4f70]'}>{log.type}</b>
                        </span>
                        <span className="text-[9px] text-[#ffd13b]">{log.sentimentTrigger}</span>
                      </div>
                      <div className="text-[9.5px] text-[#9ec3db] mt-0.5">{log.reason}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CryptoNewsModal isOpen={isNewsModalOpen} onClose={() => setIsNewsModalOpen(false)} />
    </div>
  );
};
