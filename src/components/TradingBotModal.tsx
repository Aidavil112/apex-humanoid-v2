import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { MarketPairData, TradingPosition, TradeOrderLog, AutoAnalysisItem, MoodType } from '../types';
import {
  LiveAccountSummary,
  RealTargetPlan,
  BuyWithTargetOptions,
  SpecialistBotStatus,
} from '../hooks/useAutoTrader';
import { CryptoNewsModal } from './CryptoNewsModal';
import { DayTraderSkillsPanel } from './DayTraderSkillsPanel';
import { userScopedKey } from '../engine/authStore';

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
          🌍 CoinDCX Direct Spot + Futures Routing (India Live)
        </span>
        <span className="text-[9.5px] text-[#00f5a0]">🟢 4s Live App Sync Active</span>
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
  userId?: string;
  isOwner?: boolean;
  currentHeartRate: number;
  pairs: MarketPairData[];
  selectedPairIndex: number;
  onSelectPairIndex: (index: number) => void;
  autoTrading: boolean;
  onToggleAutoTrading: () => void;
  bossDirective?: string;
  botTeamRoles?: SpecialistBotStatus[];
  onSendHeadBotCommand?: (cmd: string) => Promise<string>;
  onSpeakReply?: (text: string) => void;
  onClosePositionNow?: (pos: TradingPosition) => Promise<void>;
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
  onManualBuy: (symbol: string, opts?: BuyWithTargetOptions) => void | Promise<any>;
  onManualSell: (symbol: string) => void | Promise<any>;
  activeTargets?: Record<string, RealTargetPlan>;
  onSaveTargetPlan?: (
    symbol: string,
    entryPrice: number,
    targetPrice: number,
    stopLossPrice: number,
    qty?: number,
    source?: string
  ) => void;
  onClearTargetPlan?: (symbol: string) => void;
  onTriggerSentimentTrade?: (mood: MoodType, msg: string) => void;
}

export const TradingBotModal: React.FC<TradingBotModalProps> = ({
  isOpen,
  onClose,
  userId = 'owner_admin',
  currentHeartRate,
  pairs,
  selectedPairIndex,
  onSelectPairIndex,
  autoTrading,
  onToggleAutoTrading,
  bossDirective = 'Smart Mode: Futures + Spot dono check karo — jisme accha profit mile khud BUY/SELL karo!',
  botTeamRoles = [],
  onSendHeadBotCommand,
  onSpeakReply,
  onClosePositionNow,
  smartStatus,
  onSmartTradeNow,
  balance,
  liveAccount,
  onSyncAccount,
  orderInrAmount = 150,
  onChangeOrderAmount,
  walletType = 'auto',
  onChangeWalletType,
  leverage = 3,
  onChangeLeverage,
  orderBusy = false,
  positions,
  tradeLogs,
  analysisFeed,
  onManualBuy,
  onManualSell,
  activeTargets = {},
  onSaveTargetPlan,
  onClearTargetPlan,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activePair = pairs[selectedPairIndex] || pairs[0];
  const isInrPair = activePair.symbol.endsWith('/INR');
  const currencyPrefix = isInrPair ? '₹' : '$';
  const [targetPctInput, setTargetPctInput] = useState<number>(1.35);
  const [slPctInput, setSlPctInput] = useState<number>(0.9);
  const activeMarketCode = activePair.symbol.replace('/', '').toUpperCase();
  const currentArmedPlan = activeTargets[activeMarketCode];
  const computedLiveTarget =
    activePair.price > 0 ? parseFloat((activePair.price * (1 + targetPctInput / 100)).toFixed(2)) : 0;
  const computedLiveStop =
    activePair.price > 0 ? parseFloat((activePair.price * (1 - slPctInput / 100)).toFixed(2)) : 0;
  const totalPnlInr = positions.reduce((acc, p) => acc + p.pnl, 0);

  const [coindcxKey, setCoindcxKey] = useState<string>(
    () => localStorage.getItem(userScopedKey('coindcx_key', userId)) || ''
  );
  const [coindcxSecret, setCoindcxSecret] = useState<string>(
    () => localStorage.getItem(userScopedKey('coindcx_secret', userId)) || ''
  );
  const [showKeyForm, setShowKeyForm] = useState<boolean>(
    () => !localStorage.getItem(userScopedKey('coindcx_key', userId))
  );
  const [connectMsg, setConnectMsg] = useState<string | null>(null);
  const [isNewsModalOpen, setIsNewsModalOpen] = useState<boolean>(false);
  const [syncingWallet, setSyncingWallet] = useState<boolean>(false);

  // Dedicated 👑 Head Bot Voice & Chat State!
  const [headListening, setHeadListening] = useState<boolean>(false);
  const [headLiveHeard, setHeadLiveHeard] = useState<string>('');
  const [headBotReply, setHeadBotReply] = useState<string>(
    '👑 Main Head Bot hoon Boss! Mic dabayein aur mujhe batayein: Futures me karna hai, Spot me, ya Smart Auto — main baaki charon bots ko khud chalaunga!'
  );
  const [headTypedInput, setHeadTypedInput] = useState<string>('');

  useEffect(() => {
    setCoindcxKey(localStorage.getItem(userScopedKey('coindcx_key', userId)) || '');
    setCoindcxSecret(localStorage.getItem(userScopedKey('coindcx_secret', userId)) || '');
  }, [userId]);

  const dispatchToHeadBot = async (spokenOrTyped: string) => {
    const clean = spokenOrTyped.trim();
    if (!clean || !onSendHeadBotCommand) return;
    setHeadLiveHeard(clean);
    const reply = await onSendHeadBotCommand(clean);
    setHeadBotReply(reply);
    onSpeakReply?.(reply);
  };

  const toggleHeadBotMic = () => {
    const bridge = (window as any).ApexAndroid;
    if (headListening) {
      setHeadListening(false);
      try {
        bridge?.stopNativeListen?.();
      } catch {}
      return;
    }

    // Primary #1: Android Google Native SpeechRecognizer right inside Trading Terminal!
    if (bridge?.hasNativeStt?.()) {
      setHeadListening(true);
      setHeadLiveHeard('🎙️ Head Bot dhyan se sun raha hai — abhi boliye…');
      let partialText = '';
      let handled = false;
      const done = (txt: string) => {
        if (handled) return;
        handled = true;
        setHeadListening(false);
        try {
          bridge.stopNativeListen?.();
          bridge.setSpeakerphone?.(true);
        } catch {}
        if (txt.trim()) {
          dispatchToHeadBot(txt.trim());
        } else {
          setHeadLiveHeard('');
        }
      };
      (window as any).__onApexSpeechReady = () => setHeadListening(true);
      (window as any).__onApexSpeechPartial = (p: string) => {
        if (p?.trim()) {
          partialText = p.trim();
          setHeadLiveHeard(`🎙️ "${partialText}"`);
        }
      };
      (window as any).__onApexSpeechFinal = (f: string) => done(f || partialText);
      (window as any).__onApexSpeechError = () => done(partialText);
      bridge.startNativeListen('hi-IN');
      return;
    }

    // Secondary #2: Chrome Browser Native SpeechRecognition
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      try {
        const rec = new SR();
        rec.lang = 'hi-IN';
        rec.interimResults = true;
        setHeadListening(true);
        setHeadLiveHeard('🎙️ Head Bot sun raha hai — boliye…');
        let best = '';
        rec.onresult = (ev: any) => {
          let s = '';
          for (let i = 0; i < ev.results.length; i++) s += ev.results[i][0]?.transcript || '';
          best = s.trim();
          if (best) setHeadLiveHeard(`🎙️ "${best}"`);
        };
        rec.onend = () => {
          setHeadListening(false);
          if (best) dispatchToHeadBot(best);
        };
        rec.onerror = () => setHeadListening(false);
        rec.start();
      } catch {
        setHeadListening(false);
      }
    }
  };

  const handleRefreshWallet = async () => {
    if (!onSyncAccount) return;
    setSyncingWallet(true);
    const j = await onSyncAccount(coindcxKey.trim() || undefined, coindcxSecret.trim() || undefined);
    setSyncingWallet(false);
    if (j?.live) setConnectMsg('✅ Real CoinDCX Spot + Futures Synced!');
  };

  useEffect(() => {
    if (isOpen && onSyncAccount) {
      onSyncAccount();
    }
  }, [isOpen, onSyncAccount]);

  const handleSaveKeys = async () => {
    localStorage.setItem(userScopedKey('coindcx_key', userId), coindcxKey.trim());
    localStorage.setItem(userScopedKey('coindcx_secret', userId), coindcxSecret.trim());
    setConnectMsg('🔄 Syncing Spot + Futures Wallets & Open Positions directly from CoinDCX…');
    const j = await onSyncAccount?.(coindcxKey.trim(), coindcxSecret.trim());
    if (j?.live) {
      setConnectMsg('✅ Connected! CoinDCX Spot + Futures Positions Live Sync Active!');
      setShowKeyForm(false);
    } else {
      setConnectMsg('⚠️ Check API Key / Secret & Read+Trade+Futures permission');
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
    usdtInr: 88.0,
    holdings: [],
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-[rgba(3,8,13,0.92)] backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[93vh] overflow-y-auto rounded-2xl bg-[#050e16] border border-[rgba(0,245,160,0.35)] shadow-[0_25px_70px_-20px_rgba(0,0,0,0.95)] flex flex-col font-mono text-[#a1c2d6]">
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-[rgba(79,210,255,0.18)] bg-[rgba(6,18,29,0.94)] sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[rgba(0,245,160,0.15)] border border-[#00f5a0] flex items-center justify-center text-[#00f5a0] text-lg font-bold">
              💹
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-white text-sm sm:text-base font-bold tracking-wider uppercase">
                  APEX AUTONOMOUS COINDCX DESK (FUTURES + SPOT)
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 bg-[rgba(0,245,160,0.18)] text-[#00f5a0] border border-[#00f5a0]">
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                  LIVE 2-WAY COINDCX APP SYNC
                </span>
              </div>
              <div className="text-[10px] text-[#6d98b4]">
                👑 1 Head Bot (Voice Mic) + 4 Autonomous Trading Bots · Zero Confirmation Delay
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close Trading Terminal"
            className="w-8 h-8 rounded-lg border border-[rgba(79,210,255,0.2)] text-[#6d94af] hover:text-white flex items-center justify-center text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-3.5 sm:p-5 space-y-4">
          {/* ========================================================================= */}
          {/* 👑 HEAD BOT — CHIEF AI TRADING COMMANDER WITH DEDICATED VOICE MIC!        */}
          {/* ========================================================================= */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#0c1f33] via-[#071524] to-[#08241d] border-2 border-[#ffd166]/65 shadow-[0_0_28px_rgba(255,209,102,0.16)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={toggleHeadBotMic}
                  className={`cursor-pointer px-4 py-2 rounded-full font-extrabold text-xs flex items-center gap-2 transition-all shadow-lg ${
                    headListening
                      ? 'bg-[#00f5a0] text-[#041a12] animate-pulse scale-105'
                      : 'bg-[#ffd166] text-[#1a1200] hover:brightness-105'
                  }`}
                >
                  <span className="text-base">🎙️</span>
                  <span>{headListening ? 'SUN RAHA HAI… BOLIYE!' : 'HEAD BOT MIC (Bolkar Samjhao)'}</span>
                </button>
                <div>
                  <div className="text-xs font-bold text-[#ffd166] uppercase">
                    👑 Head Bot — Chief Trading Commander
                  </div>
                  <div className="text-[10px] text-slate-300">
                    Active Rule: <span className="text-emerald-300">{bossDirective}</span>
                  </div>
                </div>
              </div>
            </div>

            {headLiveHeard && (
              <div className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-xs text-emerald-200 font-semibold">
                🧑 Aapne kaha: {headLiveHeard}
              </div>
            )}

            <div className="px-3 py-2 rounded-xl bg-black/45 border border-white/12 text-xs text-white leading-relaxed flex items-start justify-between gap-2">
              <span>🤖 {headBotReply}</span>
              {onSpeakReply && (
                <button
                  type="button"
                  onClick={() => onSpeakReply(headBotReply)}
                  className="shrink-0 px-2 py-0.5 rounded bg-white/10 text-amber-300 text-[11px] cursor-pointer"
                >
                  🔊
                </button>
              )}
            </div>

            {/* Quick 1-Tap Instructions to Head Bot */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[10px]">
              {[
                'Smart mode rakho — Futures aur Spot dono dekh kar jisme accha ho khud buy sell karo',
                'Futures 5x mode me trade chalu karo',
                'Spot mode me safe dip buy karo',
                'Mera real position aur wallet balance batao',
                'Abhi hold karo naya buy mat karo',
              ].map((qCmd) => (
                <button
                  key={qCmd}
                  type="button"
                  onClick={() => dispatchToHeadBot(qCmd)}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-amber-200 cursor-pointer"
                >
                  {qCmd}
                </button>
              ))}
            </div>

            {/* Direct Text Command to Head Bot */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!headTypedInput.trim()) return;
                const c = headTypedInput.trim();
                setHeadTypedInput('');
                dispatchToHeadBot(c);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={headTypedInput}
                onChange={(e) => setHeadTypedInput(e.target.value)}
                placeholder="Head Bot ko samjhayein: e.g. 'Futures 5x me SOL buy karo ₹200 aur 1.5% profit par bech dena'…"
                className="flex-1 bg-[#040c14] border border-white/20 rounded-full px-3.5 py-2 text-xs text-white"
              />
              <button
                type="submit"
                className="cursor-pointer px-4 py-2 rounded-full bg-[#38bdf8] text-[#03131e] font-black text-xs shrink-0"
              >
                Order Head Bot ➤
              </button>
            </form>

            {/* 4 Role-Assigned Specialist Trading Bots Working Live */}
            {botTeamRoles.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {botTeamRoles.map((b) => (
                  <div
                    key={b.id}
                    className="p-2.5 rounded-xl bg-[#040e17]/90 border border-sky-400/20 space-y-0.5"
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-white">
                      <span>
                        {b.icon} {b.name}
                      </span>
                      <span className={b.active ? 'text-[#00f5a0] text-[9.5px]' : 'text-amber-300 text-[9.5px]'}>
                        {b.active ? '● WORKING' : '○ STANDBY'}
                      </span>
                    </div>
                    <div className="text-[9.5px] text-slate-400">{b.role}</div>
                    <div className="text-[10px] text-sky-300 font-semibold pt-0.5">{b.liveAction}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Real CoinDCX Spot + Futures Wallet Banner */}
          <div className="p-3.5 rounded-xl bg-[rgba(6,22,34,0.9)] border border-[rgba(0,245,160,0.32)] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00f5a0]" />
                  <span>Real CoinDCX Wallet Breakdown (Direct Spot + Futures Sync)</span>
                </div>
                <div className="text-[11px] text-[#9ec3db] flex flex-wrap gap-3 pt-1">
                  <span>
                    Spot INR:{' '}
                    <b className="text-[#00f5a0]">
                      ₹{acct.spotInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </b>
                  </span>
                  <span>
                    Futures INR:{' '}
                    <b className="text-[#ffd166]">
                      ₹{acct.futuresInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </b>
                  </span>
                  <span>
                    Spot USDT: <b className="text-white">${acct.spotUsdt.toFixed(2)}</b>
                  </span>
                  <span>
                    Futures USDT: <b className="text-[#ffd166]">${acct.futuresUsdt.toFixed(2)}</b>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefreshWallet}
                  disabled={syncingWallet}
                  className="px-2.5 py-1 rounded bg-[rgba(0,245,160,0.14)] hover:bg-[rgba(0,245,160,0.25)] border border-[#00f5a0] text-[#00f5a0] text-[10px] font-bold cursor-pointer"
                >
                  {syncingWallet ? 'Syncing…' : '🔄 Sync CoinDCX App'}
                </button>
                <button
                  onClick={() => setShowKeyForm((prev) => !prev)}
                  className="px-2.5 py-1 rounded bg-[rgba(255,209,102,0.2)] border border-[#ffd166] text-[#ffd166] text-[10px] font-bold cursor-pointer"
                >
                  {showKeyForm ? '✕ Hide Keys' : '🔑 Futures + Spot API Keys'}
                </button>
              </div>
            </div>

            {acct.holdings.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[rgba(79,210,255,0.1)]">
                {acct.holdings.map((h, i) => (
                  <span
                    key={`${h.wallet}-${h.currency}-${i}`}
                    className="text-[10px] px-2 py-0.5 rounded bg-[#04101a] border border-[rgba(79,210,255,0.2)] text-[#d7f1ff]"
                  >
                    <b className={h.wallet === 'FUTURES' ? 'text-[#ffd166]' : 'text-[#4fd2ff]'}>[{h.wallet}]</b>{' '}
                    {h.currency}: <b>{h.total.toFixed(4)}</b>{' '}
                    <span className="text-[#00f5a0]">(₹{h.valueInr.toFixed(2)})</span>
                  </span>
                ))}
              </div>
            )}

            {showKeyForm && (
              <div className="p-3 rounded-lg bg-[#040c14] border border-[#ffd166]/45 space-y-2.5 text-xs">
                <div className="text-[10.5px] text-[#ffe8a3]">
                  ⚡ <b>Important for Real Futures + CoinDCX App Live Position Sync:</b> Yahan apna CoinDCX API Key &amp; Secret save karein (sirf aapke phone me private save rehta hai — Futures Wallet + Open Positions + Direct Futures/Spot Orders turant live khul jayenge!):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={coindcxKey}
                    onChange={(e) => setCoindcxKey(e.target.value)}
                    placeholder="Paste CoinDCX API Key"
                    className="w-full bg-[#081726] border border-[rgba(79,210,255,0.25)] rounded px-2.5 py-1.5 text-white font-mono text-[11px]"
                  />
                  <input
                    type="password"
                    value={coindcxSecret}
                    onChange={(e) => setCoindcxSecret(e.target.value)}
                    placeholder="Paste CoinDCX API Secret"
                    className="w-full bg-[#081726] border border-[rgba(79,210,255,0.25)] rounded px-2.5 py-1.5 text-white font-mono text-[11px]"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-[#00f5a0]">{connectMsg}</span>
                  <button
                    onClick={handleSaveKeys}
                    className="px-4 py-1.5 rounded bg-[#00f5a0] text-[#041610] text-[11px] font-bold uppercase cursor-pointer"
                  >
                    ✅ Connect Futures + Spot Live
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* BIG 1-TAP 24x7 AUTONOMOUS AUTO-TRADER BANNER */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-[rgba(0,245,160,0.12)] via-[rgba(6,24,38,0.95)] to-[rgba(79,210,255,0.12)] border border-[#00f5a0] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div>
                <div className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${autoTrading ? 'bg-[#00f5a0] animate-ping' : 'bg-[#ffd13b]'}`} />
                  <span>
                    {autoTrading
                      ? `🤖 AUTONOMOUS FUTURES + SPOT AUTO-TRADING ON (₹${orderInrAmount} · ${leverage}x)`
                      : '🤖 AUTONOMOUS AUTO-TRADER READY (Zero Permission Mode)'}
                  </span>
                </div>
                <div className="text-[10.5px] text-[#a7f3d0] mt-0.5">
                  {smartStatus || 'Khud best setup dekh kar Futures LONG/SHORT ya Spot BUY/SELL execute karta hai!'}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={onToggleAutoTrading}
                  disabled={orderBusy}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer border transition-all ${
                    autoTrading
                      ? 'bg-[#ff3b5c] text-white border-[#ff6b84]'
                      : 'bg-[#00f5a0] text-[#041a12] border-[#00f5a0]'
                  }`}
                >
                  {autoTrading ? '⏹ PAUSE AUTO-TRADE' : '🚀 START AUTO-TRADE'}
                </button>

                {onSmartTradeNow && (
                  <button
                    onClick={onSmartTradeNow}
                    disabled={orderBusy}
                    className="px-3.5 py-2 rounded-xl bg-[#ffd13b] hover:brightness-105 disabled:opacity-50 text-[#121604] border border-[#ffe17d] text-xs font-extrabold uppercase tracking-wider cursor-pointer"
                  >
                    {orderBusy ? 'Executing…' : `⚡ INSTANT AI TRADE (₹${orderInrAmount})`}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* REAL OPEN POSITIONS (COINDCX APP MANUAL TRADES + BOT TRADES — FUTURES & SPOT!) */}
          <div className="p-3.5 rounded-xl bg-[#081522] border-2 border-sky-400/35 space-y-2.5">
            <div className="flex items-center justify-between border-b border-[rgba(79,210,255,0.14)] pb-2">
              <div>
                <span className="text-xs font-extrabold text-white uppercase">
                  📊 Live Active Positions (CoinDCX App + APEX Bot — Futures &amp; Spot)
                </span>
                <div className="text-[10px] text-sky-300">
                  CoinDCX App me jo bhi Futures ya Spot buy/sell karenge woh 4 second me yahan live reflect hoga!
                </div>
              </div>
              <span className={`text-xs font-bold ${totalPnlInr >= 0 ? 'text-[#00f5a0]' : 'text-[#ff4f70]'}`}>
                Live PnL: {totalPnlInr >= 0 ? `+₹${totalPnlInr.toFixed(2)}` : `-₹${Math.abs(totalPnlInr).toFixed(2)}`}
              </span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {positions.length === 0 ? (
                <div className="p-3.5 text-center text-[11px] text-[#8db1ca]">
                  Abhi koi open Futures ya Spot coin position nahi hai. (Upar 🔑 API Keys connect rakhein taaki CoinDCX App ke Futures + Spot trades turant dikhein!)
                </div>
              ) : (
                positions.map((pos) => (
                  <div
                    key={pos.id}
                    className="p-2.5 rounded-xl bg-[#050f18] border border-sky-400/25 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <b className="text-white text-xs">{pos.pair}</b>{' '}
                      <span
                        className={`text-[9.5px] px-2 py-0.5 rounded font-extrabold ${
                          pos.type === 'LONG'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {pos.type}
                      </span>
                      <div className="text-[10px] text-slate-300 mt-0.5">
                        Entry: <b>{pos.entryPrice}</b> · Live Mark: <b>{pos.currentPrice}</b> · Qty: <b>{pos.amount}</b>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className={`font-extrabold text-xs ${pos.pnl >= 0 ? 'text-[#00f5a0]' : 'text-[#ff4f70]'}`}>
                        {pos.pnl >= 0 ? `+₹${pos.pnl.toFixed(2)}` : `-₹${Math.abs(pos.pnl).toFixed(2)}`}{' '}
                        {pos.pnlPercent !== 0 ? `(${pos.pnlPercent >= 0 ? '+' : ''}${pos.pnlPercent}%)` : ''}
                      </div>
                      {onClosePositionNow && (
                        <button
                          type="button"
                          onClick={() => onClosePositionNow(pos)}
                          className="cursor-pointer px-2.5 py-1 rounded-lg bg-[#ff4f70] text-white font-bold text-[10px]"
                        >
                          ⚡ EXIT / SELL
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 11-SKILL AI DAY TRADER SCANNER */}
          <DayTraderSkillsPanel
            realInrBalance={acct.totalInr}
            orderInrAmount={orderInrAmount}
            orderBusy={orderBusy}
            onApproveTrade={async (setup) => {
              await onManualBuy(setup.market || setup.symbol, {
                customInr: setup.tradeInr,
                targetPrice: setup.target,
                stopLossPrice: setup.stopLoss,
                source: '🎯 AI_REAL_TARGET_PLAN',
              });
            }}
            onApproveSetup={(sym) => onManualBuy(sym)}
          />

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
              </div>
            </div>

            <div className="w-full h-40 bg-[#040a10] rounded-lg border border-[rgba(79,210,255,0.1)] p-1 relative overflow-hidden">
              <canvas ref={canvasRef} width={760} height={160} className="w-full h-full block" />
            </div>
          </div>

          {/* Manual Direct Execution Controls (Futures / Spot / Leverage) */}
          <div className="p-3.5 rounded-xl bg-[rgba(6,22,34,0.78)] border border-[rgba(0,245,160,0.3)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] text-white font-bold">
                ⚡ Direct Futures / Spot Execution ({activePair.symbol})
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <label className="flex items-center gap-1 text-[#9ac0d9]">
                  <span>Margin/Order (₹):</span>
                  <input
                    type="number"
                    min={60}
                    step={50}
                    value={orderInrAmount}
                    onChange={(e) => onChangeOrderAmount?.(Math.max(50, Number(e.target.value) || 100))}
                    className="w-20 bg-[#04101a] border border-[rgba(79,210,255,0.3)] rounded px-2 py-1 text-white font-bold"
                  />
                </label>

                <select
                  value={walletType}
                  onChange={(e) => onChangeWalletType?.(e.target.value as 'auto' | 'futures' | 'spot')}
                  className="bg-[#04101a] border border-[#ffd166]/60 rounded px-2 py-1 text-white font-bold"
                >
                  <option value="auto">Smart Auto (Futures + Spot Best)</option>
                  <option value="futures">⚡ Only CoinDCX FUTURES (LONG/SHORT)</option>
                  <option value="spot">🪙 Only CoinDCX SPOT (Coin)</option>
                </select>

                <select
                  value={leverage}
                  onChange={(e) => onChangeLeverage?.(Number(e.target.value) || 3)}
                  className="bg-[#04101a] border border-[rgba(79,210,255,0.3)] rounded px-2 py-1 text-white font-bold"
                >
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={3}>3x Smart</option>
                  <option value={5}>5x</option>
                  <option value={10}>10x</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                disabled={orderBusy || activePair.price <= 0}
                onClick={() =>
                  onManualBuy(activePair.symbol, {
                    customInr: orderInrAmount,
                    targetPrice: computedLiveTarget,
                    stopLossPrice: computedLiveStop,
                    source: '⚡ DIRECT_BUY_LONG',
                  })
                }
                className="flex-1 min-w-[160px] px-4 py-2 rounded-lg bg-[#00f5a0] hover:bg-[#00d88c] disabled:opacity-50 text-[#041a12] text-xs font-extrabold uppercase tracking-wider cursor-pointer"
              >
                {orderBusy ? 'Executing…' : `▲ LIVE BUY / LONG ${activePair.symbol} (₹${orderInrAmount})`}
              </button>
              <button
                disabled={orderBusy || activePair.price <= 0}
                onClick={() => onManualSell(activePair.symbol)}
                className="flex-1 min-w-[140px] px-4 py-2 rounded-lg bg-[#ff4f70] hover:bg-[#e63c5c] disabled:opacity-50 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer"
              >
                {orderBusy ? 'Executing…' : `▼ LIVE SELL / SHORT ${activePair.symbol} (₹${orderInrAmount})`}
              </button>
              <button
                onClick={() => setIsNewsModalOpen(true)}
                className="px-3 py-2 rounded-lg bg-[rgba(79,210,255,0.18)] border border-[#4fd2ff] text-[#4fd2ff] text-[10px] font-bold uppercase cursor-pointer"
              >
                📰 News
              </button>
            </div>
          </div>

          <OrderGeoMap logs={tradeLogs} />

          {/* Real Exchange Audit Log */}
          <div className="p-3.5 rounded-xl bg-[#081522] border border-[rgba(79,210,255,0.15)] space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-[rgba(79,210,255,0.1)] pb-1.5">
              <span className="text-[11px] font-semibold text-white uppercase">
                📜 Real CoinDCX Trade &amp; Sync Log (Futures + Spot)
              </span>
              <span className="text-[9.5px] text-[#00f5a0]">Live Exchange History</span>
            </div>
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 text-[10px]">
              {tradeLogs.length === 0 ? (
                <div className="p-3 text-center text-[#6d96b0]">
                  CoinDCX orders yahan real time me dikhenge.
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

      <CryptoNewsModal isOpen={isNewsModalOpen} onClose={() => setIsNewsModalOpen(false)} />
    </div>
  );
};
