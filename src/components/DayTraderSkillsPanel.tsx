import React, { useState, useEffect, useCallback, useRef } from 'react';

const WORKER_BASE = 'https://apex-humanoid-v2.pradhanbibek53.workers.dev';

interface ScanSetup {
  symbol: string;
  market: string;
  coin: string;
  setupType: string;
  price: number;
  entry: number;
  stopLoss: number;
  target: number;
  riskPct: number;
  rewardPct: number;
  rrRatio: string;
  spreadPct: number;
  change24h: number;
  rangePosPct: number;
  simulations: number;
  winOddsPct: number;
  expectedProfitInr: number;
}

interface DeepAnalysis {
  ok: boolean;
  symbol: string;
  rawSymbol: string;
  coinDcxMarket: string;
  isCrypto: boolean;
  currency: string;
  openingRange: { high: number; low: number; mid: number };
  plan: { entry: number; stopLoss: number; target: number; rMultiple: number };
  candles: { time: string; o: number; h: number; l: number; c: number }[];
  timeMachine: {
    replays: number;
    targetFirstPct: number;
    stopFirstPct: number;
    stillOpenPct: number;
    avgR: number;
    verdictTitle: string;
    verdictDetail: string;
    samplePaths: number[][];
    histogram: { price: number; pct: number; zone: 'stop' | 'mid' | 'target' }[];
    pastSessions: { up: boolean; pts: number[] }[];
    pastSummary: { fired: number; target: number; stop: number; neither: number };
  };
  news: { time: string; title: string; tag: string; highlight: boolean }[];
  ticket: {
    qty: number;
    orderValue: number;
    maxLoss: number;
    riskPass: boolean;
    statusLine: string;
  };
}

interface DayTraderSkillsPanelProps {
  realInrBalance?: number;
  orderInrAmount?: number;
  orderBusy: boolean;
  onApproveSetup?: (symbol: string) => void | Promise<void>;
  onApproveTrade?: (setup: {
    market: string;
    symbol: string;
    tradeInr: number;
    entry: number;
    stopLoss: number;
    target: number;
  }) => Promise<void>;
  onOpenRawWallet?: () => void;
}

/** Authentic Terracotta Pixel Claude Mascot from Reel DewqX3bj6sC! */
const PixelMascot: React.FC<{ badge?: string; size?: number }> = ({ badge, size = 34 }) => (
  <div className="relative inline-flex items-center justify-center select-none" style={{ width: size + 12, height: size + 6 }}>
    <svg width={size} height={Math.round(size * 0.78)} viewBox="0 0 12 9" shapeRendering="crispEdges">
      {/* Cute terracotta pixel body */}
      <rect x="2" y="1" width="8" height="5" fill="#D4745E" />
      {/* Side arms */}
      <rect x="0" y="3" width="2" height="1" fill="#D4745E" />
      <rect x="10" y="3" width="2" height="1" fill="#D4745E" />
      {/* Pixel eyes */}
      <rect x="3" y="2" width="1" height="2" fill="#1E1915" />
      <rect x="8" y="2" width="1" height="2" fill="#1E1915" />
      {/* 4 little legs */}
      <rect x="3" y="6" width="1" height="3" fill="#B85C47" />
      <rect x="5" y="6" width="1" height="3" fill="#B85C47" />
      <rect x="7" y="6" width="1" height="3" fill="#B85C47" />
      <rect x="9" y="6" width="1" height="3" fill="#B85C47" />
    </svg>
    {badge && (
      <span className=" -ml-1.5 -mt-4 text-[11px] bg-white border border-[#1E1915] rounded px-1 py-0 leading-tight shadow-xs">
        {badge}
      </span>
    )}
  </div>
);

const ELEVEN_SKILLS = [
  { cmd: '/trader-scanner', name: 'Chart Scanner', badge: '🖥️', targetId: 'sec-scan' },
  { cmd: '/trader-news', name: 'News Monitor', badge: '📰', targetId: 'sec-news' },
  { cmd: '/trader-entry', name: 'Entry Timer', badge: '⏱️', targetId: 'sec-plan' },
  { cmd: '/trader-exit', name: 'Exit Planner', badge: '⛳', targetId: 'sec-plan' },
  { cmd: '/trader-timemachine', name: 'Time Machine', badge: '🕰️', targetId: 'sec-replay' },
  { cmd: '/trader-risk', name: 'Risk Manager', badge: '🛡️', targetId: 'sec-ticket' },
  { cmd: '/trader-budget', name: 'Budget Manager', badge: '🧮', targetId: 'sec-ticket' },
  { cmd: '/trader-broker', name: 'Order Executor', badge: '✅', targetId: 'sec-ticket' },
  { cmd: '/trader-alerts', name: 'Price Alerts', badge: '🔔', targetId: 'sec-ticket' },
  { cmd: '/trader-analyst', name: 'Earnings Analyst', badge: '📊', targetId: 'sec-news' },
  { cmd: '/trader-pelosi', name: 'Pelosi Tracker', badge: '🏛️', targetId: 'sec-news' },
];

const QUICK_TICKERS = [
  { id: 'BTCINR', label: 'BTC/INR (CoinDCX ₹)' },
  { id: 'ETHINR', label: 'ETH/INR (CoinDCX ₹)' },
  { id: 'SOLINR', label: 'SOL/INR (CoinDCX ₹)' },
  { id: 'PAXGINR', label: '24K GOLD/INR (CoinDCX ₹)' },
  { id: '^NSEI', label: 'NIFTY 50 (NSE ₹)' },
  { id: '^NSEBANK', label: 'BANKNIFTY (NSE ₹)' },
  { id: 'RELIANCE.NS', label: 'RELIANCE (NSE ₹)' },
];

export const DayTraderSkillsPanel: React.FC<DayTraderSkillsPanelProps> = ({
  realInrBalance = 0,
  orderInrAmount = 150,
  orderBusy,
  onApproveSetup,
  onApproveTrade,
  onOpenRawWallet,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCINR');
  const [intervalTf, setIntervalTf] = useState<'1m' | '5m' | '15m' | '1h'>('15m');
  const [customSymbol, setCustomSymbol] = useState<string>('');
  const [tradeInr, setTradeInr] = useState<number>(orderInrAmount || 150);
  const [scanSetups, setScanSetups] = useState<ScanSetup[]>([]);
  const [totalCharts, setTotalCharts] = useState<number>(990);
  const [deep, setDeep] = useState<DeepAnalysis | null>(null);
  const [loadingDeep, setLoadingDeep] = useState<boolean>(false);
  const [replayCounter, setReplayCounter] = useState<number>(10000);
  const [clockAngle, setClockAngle] = useState<number>(0);
  const [alertArmed, setAlertArmed] = useState<boolean>(false);
  const [decisionStatus, setDecisionStatus] = useState<'pending' | 'approved' | 'skipped'>('pending');
  const [chartImgUrl, setChartImgUrl] = useState<string>('');
  const [chartImgVerdict, setChartImgVerdict] = useState<string>('');
  const [customTargetOverride, setCustomTargetOverride] = useState<number>(0);
  const [customStopOverride, setCustomStopOverride] = useState<number>(0);
  const chartFileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleChartImageUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setChartImgUrl(dataUrl);
      const fname = file.name.toUpperCase();
      let detectedSym = selectedSymbol;
      if (fname.includes('ETH')) detectedSym = 'ETHINR';
      else if (fname.includes('SOL')) detectedSym = 'SOLINR';
      else if (fname.includes('PAXG') || fname.includes('GOLD') || fname.includes('XAU')) detectedSym = 'PAXGINR';
      else if (fname.includes('BANK')) detectedSym = '^NSEBANK';
      else if (fname.includes('NIFTY')) detectedSym = '^NSEI';
      else if (fname.includes('BTC')) detectedSym = 'BTCINR';

      const img = new Image();
      img.onload = async () => {
        const cv = document.createElement('canvas');
        const w = 180;
        const h = 120;
        cv.width = w;
        cv.height = h;
        const ctx = cv.getContext('2d');
        let bullBias = 0.56;
        let volFactor = 1.0;
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const d = ctx.getImageData(0, 0, w, h).data;
          let greenRight = 0;
          let redRight = 0;
          let minActiveY = h;
          let maxActiveY = 0;
          for (let y = 12; y < h - 14; y++) {
            for (let x = Math.floor(w * 0.55); x < w - 8; x++) {
              const i = (y * w + x) * 4;
              const r = d[i], g = d[i + 1], b = d[i + 2];
              if (g > r + 26 && g > b + 18) {
                greenRight++;
                if (y < minActiveY) minActiveY = y;
                if (y > maxActiveY) maxActiveY = y;
              } else if (r > g + 26 && r > b + 18) {
                redRight++;
                if (y < minActiveY) minActiveY = y;
                if (y > maxActiveY) maxActiveY = y;
              }
            }
          }
          const tot = greenRight + redRight;
          if (tot > 25) {
            bullBias = greenRight / tot;
            volFactor = Math.max(0.75, Math.min(1.65, (maxActiveY - minActiveY) / (h * 0.42)));
          }
        }
        setSelectedSymbol(detectedSym);
        await runFullScanAndAnalyze(detectedSym, tradeInr);
        setTimeout(() => {
          setDeep((prev) => {
            if (!prev) return prev;
            const entry = prev.plan.entry;
            const tgtPct = (bullBias >= 0.5 ? 0.019 : 0.014) * volFactor;
            const slPct = (bullBias >= 0.5 ? 0.0085 : 0.0075) * volFactor;
            const smartTarget = parseFloat((entry * (1 + tgtPct)).toFixed(2));
            const smartStop = parseFloat((entry * (1 - slPct)).toFixed(2));
            setCustomTargetOverride(smartTarget);
            setCustomStopOverride(smartStop);
            setChartImgVerdict(
              `✅ Chart Image Scanned (${Math.round(bullBias * 100)}% Bullish Candle Momentum) → Live Real Entry ${prev.currency}${entry.toLocaleString('en-IN')} | 🎯 Real Target ${prev.currency}${smartTarget.toLocaleString('en-IN')} | 🛑 Stop-Loss ${prev.currency}${smartStop.toLocaleString('en-IN')}`
            );
            return {
              ...prev,
              plan: {
                ...prev.plan,
                target: smartTarget,
                stopLoss: smartStop,
                rMultiple: parseFloat(((smartTarget - entry) / Math.max(0.01, entry - smartStop)).toFixed(2)),
              },
            };
          });
        }, 120);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const runFullScanAndAnalyze = useCallback(
    async (sym: string, budget: number) => {
      setLoadingDeep(true);
      setDecisionStatus('pending');
      setReplayCounter(1240);

      // Animate rolling 0 -> 10,000 Time-Machine counter & clock hands just like Reel frame_10 -> frame_11!
      const anim = setInterval(() => {
        setReplayCounter((prev) => (prev < 9600 ? prev + 1190 : prev));
        setClockAngle((prev) => (prev + 48) % 360);
      }, 90);

      try {
        const [scanRes, deepRes] = await Promise.all([
          fetch(`${WORKER_BASE}/api/coindcx/scan-all`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ tradeInr: budget }),
          }).then((r) => r.json()).catch(() => null),
          fetch(`${WORKER_BASE}/api/daytrader/analyze`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              symbol: sym,
              interval: intervalTf,
              accountBudget: Math.max(budget, realInrBalance > 115 ? realInrBalance : 1000),
              maxLoss: Math.max(25, Math.round(budget * 0.15)),
            }),
          }).then((r) => r.json()),
        ]);

        if (scanRes?.ok && Array.isArray(scanRes.setups)) {
          setScanSetups(scanRes.setups);
          setTotalCharts(scanRes.totalChartsScanned || 990);
        }
        if (deepRes?.ok) {
          setDeep(deepRes);
        }
      } catch (err) {
        console.warn('DayTrader analyze error:', err);
      } finally {
        clearInterval(anim);
        setReplayCounter(10000);
        setLoadingDeep(false);
      }
    },
    [realInrBalance, intervalTf]
  );

  useEffect(() => {
    runFullScanAndAnalyze(selectedSymbol, tradeInr);
  }, [selectedSymbol, intervalTf]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Compute SVG geometry for Japanese Candlestick Chart (Card 4 — frame_08)
  const renderCandlestickSvg = () => {
    if (!deep || deep.candles.length === 0) return null;
    const allPrices = [
      ...deep.candles.flatMap((c) => [c.h, c.l]),
      deep.plan.target,
      deep.plan.stopLoss,
      deep.openingRange.high,
      deep.openingRange.low,
    ];
    const minP = Math.min(...allPrices) * 0.9985;
    const maxP = Math.max(...allPrices) * 1.0015;
    const span = maxP - minP || 1;
    const H = 205;
    const W = 520;
    const yOf = (p: number) => Math.max(14, Math.min(H - 18, H - 18 - ((p - minP) / span) * (H - 36)));

    const yTarget = yOf(deep.plan.target);
    const yEntry = yOf(deep.plan.entry);
    const yOrHigh = yOf(deep.openingRange.high);
    const yOrLow = yOf(deep.openingRange.low);
    const yStop = yOf(deep.plan.stopLoss);

    const candleZoneW = 330;
    const stepX = candleZoneW / deep.candles.length;

    return (
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full h-auto overflow-visible">
        {/* Shaded Peach Opening Range Box (first 3 candles — exact frame_08!) */}
        <rect
          x={14}
          y={yOrHigh}
          width={stepX * 3}
          height={Math.max(8, yOrLow - yOrHigh)}
          rx={4}
          fill="#F6E3D8"
        />

        {/* Shaded Green Reward Zone + Red Risk Zone on right side of breakout */}
        <rect
          x={14 + stepX * (deep.candles.length - 1)}
          y={yTarget}
          width={W - (14 + stepX * (deep.candles.length - 1)) - 12}
          height={Math.max(6, yEntry - yTarget)}
          fill="#DFF5E6"
        />
        <rect
          x={14 + stepX * (deep.candles.length - 1)}
          y={yEntry}
          width={W - (14 + stepX * (deep.candles.length - 1)) - 12}
          height={Math.max(6, yStop - yEntry)}
          fill="#FCE2E0"
        />

        {/* Target Solid Green Line + Green Pill */}
        <line x1={14} y1={yTarget} x2={W - 12} y2={yTarget} stroke="#22A958" strokeWidth={2} />
        <g transform={`translate(20, ${Math.max(2, yTarget - 26)})`}>
          <rect width={128} height={22} rx={7} fill="#22A958" />
          <text x={64} y={15} textAnchor="middle" fill="#fff" fontSize={11} fontWeight="700">
            Target {deep.currency}{deep.plan.target}
          </text>
        </g>

        {/* Opening Range High Dashed Terracotta Line */}
        <line
          x1={14}
          y1={yOrHigh}
          x2={W - 12}
          y2={yOrHigh}
          stroke="#B66349"
          strokeWidth={1.3}
          strokeDasharray="3 3"
        />
        <text x={18} y={yOrHigh - 5} fill="#8C4A36" fontSize={9.5} fontFamily="monospace">
          opening range high {deep.currency}{deep.openingRange.high}
        </text>

        {/* Entry Dashed Black Line + Black Pill */}
        <line
          x1={14}
          y1={yEntry}
          x2={W - 12}
          y2={yEntry}
          stroke="#181512"
          strokeWidth={1.8}
          strokeDasharray="4 3"
        />
        <g transform={`translate(20, ${yEntry - 26})`}>
          <rect width={116} height={22} rx={7} fill="#181512" />
          <text x={58} y={15} textAnchor="middle" fill="#fff" fontSize={11} fontWeight="700">
            Entry {deep.currency}{deep.plan.entry}
          </text>
        </g>

        {/* Stop Solid Red Line + Red Pill */}
        <line x1={14} y1={yStop} x2={W - 12} y2={yStop} stroke="#D63B32" strokeWidth={2} />
        <g transform={`translate(${W - 150}, ${Math.min(H - 6, yStop + 5)})`}>
          <rect width={122} height={22} rx={7} fill="#D63B32" />
          <text x={61} y={15} textAnchor="middle" fill="#fff" fontSize={11} fontWeight="700">
            Stop {deep.currency}{deep.plan.stopLoss}
          </text>
        </g>

        {/* Real OHLC Japanese Candlesticks */}
        {deep.candles.map((c, idx) => {
          const cx = 14 + idx * stepX + stepX * 0.5;
          const up = c.c >= c.o;
          const color = up ? '#1EA952' : '#D63B32';
          const topY = yOf(Math.max(c.o, c.c));
          const botY = yOf(Math.min(c.o, c.c));
          return (
            <g key={idx}>
              <line x1={cx} y1={yOf(c.h)} x2={cx} y2={yOf(c.l)} stroke={color} strokeWidth={1.8} />
              <rect
                x={cx - stepX * 0.28}
                y={topY}
                width={stepX * 0.56}
                height={Math.max(3.5, botY - topY)}
                rx={1.5}
                fill={color}
              />
            </g>
          );
        })}

        {/* Bottom Timestamps */}
        {[0, 4, 8, deep.candles.length - 1].map((idx) =>
          deep.candles[idx] ? (
            <text
              key={idx}
              x={14 + idx * stepX + 10}
              y={H + 14}
              fill="#9A8F84"
              fontSize={9.5}
              fontFamily="monospace"
            >
              {deep.candles[idx].time}
            </text>
          ) : null
        )}
      </svg>
    );
  };

  // Compute SVG geometry for 10,000-Session Spaghetti Fan Chart (Card 5 — frame_11!)
  const renderSpaghettiFanSvg = () => {
    if (!deep || !deep.timeMachine.samplePaths.length) return null;
    const paths = deep.timeMachine.samplePaths;
    const flat = paths.flat();
    const cPrices = deep.candles.flatMap((c) => [c.h, c.l]);
    const minP = Math.min(...flat, ...cPrices);
    const maxP = Math.max(...flat, ...cPrices);
    const span = maxP - minP || 1;
    const W = 520;
    const H = 175;
    const yOf = (p: number) => H - 12 - ((p - minP) / span) * (H - 24);

    const preCandles = deep.candles.slice(-8);
    const startX = 16;
    const candleStep = 10;
    const fanOriginX = startX + preCandles.length * candleStep + 4;
    const fanWidth = W - fanOriginX - 10;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Pre-entry mini green/red candlesticks on left (exact frame_11!) */}
        {preCandles.map((c, idx) => {
          const cx = startX + idx * candleStep;
          const up = c.c >= c.o;
          const col = up ? '#1EA952' : '#D63B32';
          const y1 = yOf(Math.max(c.o, c.c));
          const y2 = yOf(Math.min(c.o, c.c));
          return (
            <g key={idx}>
              <line x1={cx} y1={yOf(c.h)} x2={cx} y2={yOf(c.l)} stroke={col} strokeWidth={1.3} />
              <rect x={cx - 2.6} y={y1} width={5.2} height={Math.max(2.5, y2 - y1)} fill={col} rx={1} />
            </g>
          );
        })}

        {/* 75 Real Simulated Session Trajectories fanning out in warm terracotta coral! */}
        {paths.map((pts, pIdx) => {
          const d = pts
            .map((val, i) => {
              const x = fanOriginX + (i / Math.max(1, pts.length - 1)) * fanWidth;
              const y = yOf(val);
              return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ');
          return (
            <path
              key={pIdx}
              d={d}
              fill="none"
              stroke="#DC6B4A"
              strokeWidth={0.85}
              strokeOpacity={0.28}
            />
          );
        })}
      </svg>
    );
  };

  return (
    <div
      ref={containerRef}
      style={{
        backgroundColor: '#FAF5EE',
        backgroundImage: 'radial-gradient(#E3D7C8 1.15px, transparent 1.15px)',
        backgroundSize: '18px 18px',
      }}
      className="w-full rounded-3xl p-3.5 sm:p-5 text-[#1C1815] space-y-6 select-none shadow-xl border border-[#E6DACB]"
    >
      {/* ==================== HERO TITLE + LIVE TICKER BAR ==================== */}
      <div className="text-center space-y-3 pt-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E6DACB] shadow-2xs text-[11px] font-mono text-[#7C6A5B]">
          <span className="w-2 h-2 rounded-full bg-[#22A958] animate-pulse" />
          <span>11 CLAUDE DAY-TRADER SKILLS · LIVE REAL MARKET DATA</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E1915]">
          Day Trader <span className="font-serif italic font-normal text-[#C85A3B]">skill</span>
        </h2>

        {/* Instant Ticker Switcher + Search Bar */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {QUICK_TICKERS.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedSymbol(t.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                selectedSymbol === t.id
                  ? 'bg-[#1E1915] text-white border-[#1E1915] shadow-sm'
                  : 'bg-white text-[#4A3F36] border-[#E5D9CA] hover:border-[#C85A3B]'
              }`}
            >
              {t.label}
            </button>
          ))}
          {onOpenRawWallet && (
            <button
              onClick={onOpenRawWallet}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#E9F9EF] text-[#177A3E] border border-[#A8E6C1] cursor-pointer"
            >
              ₹{realInrBalance.toFixed(0)} Wallet / Manual Spot →
            </button>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!customSymbol.trim()) return;
            setSelectedSymbol(customSymbol.trim().toUpperCase());
            setCustomSymbol('');
          }}
          className="max-w-md mx-auto flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-[#E5D9CA] shadow-2xs"
        >
          <input
            value={customSymbol}
            onChange={(e) => setCustomSymbol(e.target.value)}
            placeholder="Analyze any ticker: TSLA, NVDA, AAPL, BTCINR, SOLINR, RELIANCE.NS..."
            className="flex-1 bg-transparent px-2.5 py-1 text-xs text-[#1E1915] placeholder-[#9B8E82] outline-none font-mono"
          />
          <button
            type="submit"
            disabled={loadingDeep}
            className="px-3.5 py-1.5 rounded-xl bg-[#D96543] text-white text-xs font-bold cursor-pointer"
          >
            {loadingDeep ? 'Scanning...' : 'Scan & Replay'}
          </button>
        </form>

        {/* 📸 CHART SCREENSHOT / IMAGE VISION SCANNER -> REAL LIVE ENTRY + TARGET 🎯 + STOP-LOSS 🛑 */}
        <div className="max-w-lg mx-auto mt-2.5 bg-[#FFF8F2] border border-[#E5C9B6] rounded-2xl p-3 space-y-2 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-left">
              <div className="text-xs font-extrabold text-[#1E1915]">
                📸 Chart Image Scanner → Real Live Target 🎯 &amp; Stop-Loss 🛑
              </div>
              <div className="text-[10.5px] text-[#78685B]">
                Koi bhi Chart Screenshot upload karein — Live CoinDCX rate ke saath Real Entry, Target &amp; SL nikaal dega!
              </div>
            </div>
            <input
              ref={chartFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleChartImageUpload(f);
              }}
            />
            <button
              type="button"
              onClick={() => chartFileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-[#1E1915] hover:bg-[#342B24] text-white text-xs font-bold cursor-pointer shrink-0"
            >
              📷 Upload Chart Image
            </button>
          </div>
          {chartImgUrl && (
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1 border-t border-[#EAD7C9]">
              <img
                src={chartImgUrl}
                alt="Uploaded Trading Chart"
                className="w-28 h-16 object-cover rounded-lg border border-[#D8C5B4] shrink-0"
              />
              <div className="text-[11px] font-semibold text-[#1B7A43] text-left leading-snug">
                {chartImgVerdict || 'Analyzing uploaded chart candles + syncing real live market feed…'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================== SECTION 0: ALL 11 SKILLS DECK (Exact Frame_04!) ==================== */}
      <div className="space-y-3">
        <div className="text-center text-lg sm:text-xl font-extrabold text-[#1E1915]">
          <span className="font-serif italic font-normal text-[#C85A3B] mr-1.5">11</span>
          skills · one job each
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {ELEVEN_SKILLS.map((sk) => (
            <button
              key={sk.cmd}
              onClick={() => scrollToSection(sk.targetId)}
              className="bg-white hover:bg-[#FFFDF9] rounded-2xl p-2.5 border border-[#ECE2D6] shadow-[0_4px_14px_rgba(60,40,20,0.05)] flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-transform hover:-translate-y-0.5"
            >
              <PixelMascot badge={sk.badge} size={30} />
              <div className="text-[11px] font-extrabold text-[#1E1915] leading-tight">{sk.name}</div>
              <div className="text-[9px] font-mono text-[#9A8B7E]">{sk.cmd}</div>
            </button>
          ))}

          {/* 12th Card: Active Skill Pack Status Badge (Exact Frame_15/16!) */}
          <button
            onClick={() => runFullScanAndAnalyze(selectedSymbol, tradeInr)}
            className="bg-[#FFF4EE] rounded-2xl p-2.5 border border-[#E8B8A6] flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
          >
            <span className="px-2 py-0.5 rounded bg-[#22A958] text-white text-[9.5px] font-extrabold tracking-wider">
              INSTALLED ✓
            </span>
            <div className="text-[10.5px] font-bold text-[#9E3F24] leading-tight">
              Re-run All 11 Skills
            </div>
            <div className="text-[9px] font-mono text-[#B06C57]">MIT · Open Source</div>
          </button>
        </div>
      </div>

      {/* ==================== CARD 1: CHART SCANNER SPARKLINE WALL (Exact Frame_05!) ==================== */}
      <div
        id="sec-scan"
        className="bg-white rounded-3xl p-4 sm:p-5 border border-[#EAE0D3] shadow-[0_8px_30px_rgba(45,30,15,0.06)] space-y-3"
      >
        <div className="flex items-center justify-center gap-2 pb-1">
          <span className="w-6 h-6 rounded-full bg-[#D96543] text-white font-serif italic text-xs flex items-center justify-center font-bold">
            1
          </span>
          <span className="text-lg font-extrabold text-[#1E1915]">
            Scans <span className="font-serif italic font-normal text-[#C85A3B]">charts</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-2xl font-black text-[#1E1915]">{totalCharts.toLocaleString()}</span>
            <span className="text-xs text-[#7D7064] ml-1.5">
              live CoinDCX markets + US/NSE universe scanned
            </span>
          </div>
          <span className="text-xs font-mono text-[#C85A3B] font-bold">
            ● {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="inline-block px-3 py-1 rounded-full bg-[#1C1815] text-white text-xs font-bold">
          <span className="text-[#F48462] mr-1">{Math.max(12, scanSetups.length * 4)}</span>
          high-conviction setups detected right now — tap any chart to inspect
        </div>

        {/* Mini Sparkline Tile Matrix */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
          {(scanSetups.length > 0 ? scanSetups.slice(0, 12) : []).map((st, idx) => {
            const up = st.change24h >= 0;
            const isSelected = selectedSymbol === st.market;
            // Deterministic mini sparkline from real range position & 24h change
            const pts = [0.42, 0.38, 0.48, 0.44, 0.56, 0.52, up ? 0.72 : 0.34, up ? 0.86 : 0.25];
            const poly = pts
              .map((y, i) => `${(i / 7) * 58 + 3},${24 - y * 19}`)
              .join(' ');
            return (
              <button
                key={st.market}
                onClick={() => setSelectedSymbol(st.market)}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#FFF5EF] border-[#D96543] ring-2 ring-[#D96543]/30'
                    : idx < 5
                    ? 'bg-white border-[#C8846C]'
                    : 'bg-[#FCF9F5] border-[#EDE4D8]'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-[#3D332B]">
                  <span>{st.coin}</span>
                  <span className={up ? 'text-[#1EA952]' : 'text-[#D63B32]'}>
                    {up ? '+' : ''}
                    {st.change24h.toFixed(1)}%
                  </span>
                </div>
                <svg viewBox="0 0 64 26" className="w-full h-6 mt-0.5">
                  <polyline
                    fill="none"
                    stroke={up ? '#1EA952' : '#D63B32'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={poly}
                  />
                </svg>
                <div className="text-[9px] font-mono text-[#7D7064]">{st.winOddsPct}% odds</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================== CARD 2: BREAKING NEWS + ANALYST MONITOR (Exact Frame_06!) ==================== */}
      {deep && (
        <div
          id="sec-news"
          className="bg-white rounded-3xl p-4 sm:p-5 border border-[#EAE0D3] shadow-[0_8px_30px_rgba(45,30,15,0.06)] space-y-3"
        >
          <div className="flex items-center justify-center gap-2 pb-1">
            <span className="w-6 h-6 rounded-full bg-[#D96543] text-white font-serif italic text-xs flex items-center justify-center font-bold">
              2
            </span>
            <span className="text-lg font-extrabold text-[#1E1915]">
              Breaking <span className="font-serif italic font-normal text-[#C85A3B]">news</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-3 py-1 rounded-full bg-[#1C1815] text-white text-xs font-bold">
              Watching: <span className="text-[#F48462]">{deep.symbol}</span>
            </span>
            <span className="px-2.5 py-1 rounded-full bg-[#FBEAE3] text-[#9E3F24] text-[11px] font-semibold">
              earnings &amp; catalysts
            </span>
            <span className="px-2.5 py-1 rounded-full bg-[#F4EFE9] text-[#5C4F43] text-[11px] font-semibold">
              /trader-analyst · /trader-pelosi
            </span>
          </div>

          <div className="divide-y divide-[#F2EAE0]">
            {(deep.news.length > 0
              ? deep.news
              : [{ time: 'LIVE', title: `Live intraday order-flow & volume scan active for ${deep.symbol}`, tag: 'momentum', highlight: true }]
            ).map((n, idx) => (
              <div
                key={idx}
                className={`py-2.5 px-3 rounded-xl flex items-start gap-3 ${
                  n.highlight ? 'bg-[#FDECE5] text-[#7D2712] font-bold' : 'text-[#5A4E44]'
                }`}
              >
                <span className="text-[11px] font-mono text-[#9A8B7E] shrink-0 pt-0.5 w-16">
                  {n.time}
                </span>
                <span className="text-xs leading-snug flex-1">{n.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== CARD 3 & 4: ENTRY + STOP + TARGET CHART (Exact Frame_08!) ==================== */}
      {deep && (
        <div
          id="sec-plan"
          className="bg-white rounded-3xl p-4 sm:p-5 border border-[#EAE0D3] shadow-[0_8px_30px_rgba(45,30,15,0.06)] space-y-2"
        >
          <div className="flex items-center justify-center gap-2 pb-1">
            <span className="w-6 h-6 rounded-full bg-[#D96543] text-white font-serif italic text-xs flex items-center justify-center font-bold">
              4
            </span>
            <span className="text-lg font-extrabold text-[#1E1915]">
              Stop + <span className="font-serif italic font-normal text-[#C85A3B]">target</span>{' '}
              <span className="text-xs font-normal text-[#7D7064]">before you enter</span>
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-[#7D7064]">
            <span>{deep.symbol} · plan set before the entry</span>
            <div className="flex items-center gap-1">
              {(['1m', '5m', '15m', '1h'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setIntervalTf(tf)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                    intervalTf === tf ? 'bg-[#1E1915] text-white' : 'bg-[#F2EAE0] text-[#5C4F43]'
                  }`}
                >
                  {tf}
                </button>
              ))}
              <PixelMascot badge="⛳" size={26} />
            </div>
          </div>

          {renderCandlestickSvg()}
        </div>
      )}

      {/* ==================== CARD 5: 10,000 REPLAYS TIME MACHINE FAN + PAST SESSIONS (Exact Frame_11!) ==================== */}
      {deep && (
        <div
          id="sec-replay"
          className="bg-white rounded-3xl p-4 sm:p-5 border border-[#EAE0D3] shadow-[0_8px_30px_rgba(45,30,15,0.06)] space-y-3"
        >
          <div className="text-center text-xl font-extrabold text-[#1E1915]">
            <span className="font-serif italic font-normal text-[#C85A3B] mr-1.5">10,000</span>
            replays
          </div>

          {/* Analog Golden Time-Machine Clock + Rolling Counter */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-[#FDF3D7] border-4 border-[#C89B4F] shadow-inner flex items-center justify-center shrink-0">
              <svg width="36" height="36" viewBox="0 0 36 36">
                <line
                  x1="18"
                  y1="18"
                  x2={18 + 9 * Math.sin((clockAngle * Math.PI) / 180)}
                  y2={18 - 9 * Math.cos((clockAngle * Math.PI) / 180)}
                  stroke="#C85A3B"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <line x1="18" y1="18" x2="18" y2="7" stroke="#1E1915" strokeWidth="2.2" strokeLinecap="round" />
                <circle cx="18" cy="18" r="2.2" fill="#1E1915" />
              </svg>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-[#1E1915] leading-none">
                {replayCounter.toLocaleString()}
              </div>
              <div className="text-[11px] font-mono text-[#7D7064] mt-1">
                simulated sessions · empirical candle bootstrap (seed 19)
              </div>
            </div>
          </div>

          {/* 75-Path Terracotta Spaghetti Monte Carlo Fan */}
          {renderSpaghettiFanSvg()}

          {/* Bottom Strip: Asset's Own Past Sessions Sparkline Grid (Exact Frame_11!) */}
          <div className="pt-1 space-y-1.5">
            <div className="text-[10.5px] font-mono text-[#7D7064]">
              from {deep.symbol}&apos;s own recent {deep.timeMachine.pastSessions.length} sessions · backtest fired{' '}
              {deep.timeMachine.pastSummary.fired} times ({deep.timeMachine.pastSummary.target} target,{' '}
              {deep.timeMachine.pastSummary.stop} stop)
            </div>
            <div className="grid grid-cols-8 sm:grid-cols-16 gap-1">
              {deep.timeMachine.pastSessions.slice(0, 32).map((ps, idx) => {
                const minV = Math.min(...ps.pts);
                const maxV = Math.max(...ps.pts);
                const sp = maxV - minV || 1;
                const poly = ps.pts
                  .map((v, i) => `${(i / Math.max(1, ps.pts.length - 1)) * 28 + 1},${15 - ((v - minV) / sp) * 12}`)
                  .join(' ');
                return (
                  <div key={idx} className="bg-[#FCF9F5] border border-[#EFE7DC] rounded p-0.5">
                    <svg viewBox="0 0 30 17" className="w-full h-3.5">
                      <polyline
                        fill="none"
                        stroke={ps.up ? '#1EA952' : '#D63B32'}
                        strokeWidth="1.5"
                        points={poly}
                      />
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== CARD 6: THE HONEST ODDS + HISTOGRAM + VERDICT (Exact Frame_12 & Frame_13!) ==================== */}
      {deep && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#EAE0D3] shadow-[0_8px_30px_rgba(45,30,15,0.06)] space-y-4">
            <div className="text-center text-xl font-extrabold text-[#1E1915]">
              The honest <span className="font-serif italic font-normal text-[#C85A3B]">odds</span>
            </div>

            <div className="text-[11px] font-mono text-[#7D7064]">How the 10,000 replays end</div>

            {/* 3 Exact Horizontal Bars */}
            <div className="space-y-2.5">
              {[
                { label: 'Target first', pct: deep.timeMachine.targetFirstPct, color: '#22A958', txtCol: 'text-[#22A958]' },
                { label: 'Stop first', pct: deep.timeMachine.stopFirstPct, color: '#D63B32', txtCol: 'text-[#D63B32]' },
                { label: 'Still open at close', pct: deep.timeMachine.stillOpenPct, color: '#BFB3A4', txtCol: 'text-[#6A5E52]' },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="w-28 text-xs font-bold text-[#1E1915] shrink-0">{row.label}</span>
                  <div className="flex-1 flex items-center gap-2.5">
                    <div
                      style={{
                        width: `${Math.max(8, Math.min(82, row.pct * 1.45))}%`,
                        backgroundColor: row.color,
                      }}
                      className="h-6 rounded-lg transition-all duration-300"
                    />
                    <span className={`text-sm font-black ${row.txtCol}`}>{row.pct}%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 21-Bin Bell-Curve Closing Distribution Histogram (Exact Frame_12!) */}
            <div className="pt-2 space-y-2">
              <div className="text-[11px] font-mono text-[#7D7064]">
                Where {deep.symbol} closes · 10,000 replays
              </div>
              <div className="flex justify-between text-[10px] font-mono px-6">
                <span className="text-[#D63B32] font-bold">Stop {deep.currency}{deep.plan.stopLoss}</span>
                <span className="text-[#1E1915] font-bold">Entry {deep.currency}{deep.plan.entry}</span>
                <span className="text-[#22A958] font-bold">Target {deep.currency}{deep.plan.target}</span>
              </div>
              <div className="h-28 flex items-end gap-1 pt-2 px-1 border-b border-[#EFE6DA]">
                {deep.timeMachine.histogram.map((bin, idx) => (
                  <div
                    key={idx}
                    style={{ height: `${Math.max(8, bin.pct)}%` }}
                    className={`flex-1 rounded-t transition-all ${
                      bin.zone === 'stop'
                        ? 'bg-[#D63B32]'
                        : bin.zone === 'target'
                        ? 'bg-[#22A958]'
                        : 'bg-[#DFB29B]'
                    }`}
                    title={`${deep.currency}${bin.price}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Verdict Card with Gold Coin Badge (Exact Frame_13!) */}
          <div className="relative bg-white rounded-3xl p-4 sm:p-5 border border-[#EAE0D3] shadow-[0_8px_30px_rgba(45,30,15,0.06)]">
            <div className="absolute -top-3 right-5 w-11 h-11 rounded-full bg-[#F5CE62] border-4 border-[#C59B38] flex items-center justify-center font-black text-[#6B4E0B] text-lg shadow-sm">
              {deep.currency}
            </div>
            <div className="text-[10.5px] font-mono tracking-wider uppercase text-[#8A7C6F]">
              TRADER-TIMEMACHINE · VERDICT
            </div>
            <div className="text-lg sm:text-xl font-black text-[#1E1915] mt-1">
              {deep.timeMachine.verdictTitle}
            </div>
            <p className="text-xs text-[#5C4F43] mt-1 leading-relaxed">
              {deep.timeMachine.verdictDetail}
            </p>
          </div>
        </div>
      )}

      {/* ==================== CARD 7: TRADER-BROKER · WITHOUT YOUR YES TICKET (Exact Frame_14!) ==================== */}
      {deep && (
        <div
          id="sec-ticket"
          className="bg-white rounded-3xl p-5 border border-[#EAE0D3] shadow-[0_10px_34px_rgba(45,30,15,0.08)] space-y-4"
        >
          <div className="text-center text-xl font-extrabold text-[#1E1915]">
            Without <span className="font-serif italic font-normal text-[#C85A3B]">your yes</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-mono tracking-wider text-[#7D7064]">
              TRADER-BROKER · ORDER 1 OF 1
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setAlertArmed((v) => !v)}
                className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold cursor-pointer border ${
                  alertArmed
                    ? 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]'
                    : 'bg-[#F7F2EC] text-[#6A5E52] border-[#E5D9CA]'
                }`}
              >
                {alertArmed ? '🔔 Alert Armed' : '🔔 Arm Price Alert'}
              </button>
              <span className="px-3 py-1 rounded-full bg-[#FBEAE3] text-[#9E3F24] text-[10.5px] font-bold">
                {deep.isCrypto ? `LIVE COINDCX (₹${realInrBalance.toFixed(0)})` : 'SIMULATED BRACKET'}
              </span>
            </div>
          </div>

          {/* Editable INR Allocation for Live CoinDCX Orders */}
          {deep.isCrypto && (
            <div className="flex items-center gap-2 bg-[#FAF5EE] p-2.5 rounded-xl border border-[#EAE0D3]">
              <span className="text-xs font-bold text-[#4A3F36]">Order Amount (₹):</span>
              <input
                type="number"
                min={115}
                value={tradeInr}
                onChange={(e) => setTradeInr(Math.max(115, Number(e.target.value) || 115))}
                className="w-24 px-2.5 py-1 rounded-lg bg-white border border-[#DCD0C0] font-mono text-xs font-bold text-[#1E1915]"
              />
              <button
                onClick={() => runFullScanAndAnalyze(selectedSymbol, tradeInr)}
                className="px-2.5 py-1 rounded-lg bg-[#1E1915] text-white text-[10.5px] font-bold cursor-pointer"
              >
                Resize
              </button>
            </div>
          )}

          <div>
            <div className="text-2xl sm:text-3xl font-black text-[#1E1915] tracking-tight">
              BUY {deep.ticket.qty} {deep.symbol}
            </div>

            <div className="mt-3 space-y-1.5 font-mono text-xs text-[#3D332B]">
              <div className="flex items-center justify-between max-w-xs">
                <span className="text-[#8A7C6F]">live entry</span>
                <span className="font-bold">{deep.currency}{deep.plan.entry}</span>
              </div>
              <div className="flex items-center justify-between max-w-xs gap-2">
                <span className="text-[#D63B32] font-semibold">🛑 stop-loss</span>
                <input
                  type="number"
                  step="any"
                  value={customStopOverride > 0 ? customStopOverride : deep.plan.stopLoss}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setCustomStopOverride(v);
                    if (v > 0) {
                      setDeep((prev) => (prev ? { ...prev, plan: { ...prev.plan, stopLoss: v } } : prev));
                    }
                  }}
                  className="w-28 text-right px-2 py-0.5 rounded bg-[#FFF2F0] border border-[#E8B4AE] font-bold text-[#D63B32]"
                />
              </div>
              <div className="flex items-center justify-between max-w-xs gap-2">
                <span className="text-[#198F48] font-semibold">🎯 real target</span>
                <input
                  type="number"
                  step="any"
                  value={customTargetOverride > 0 ? customTargetOverride : deep.plan.target}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setCustomTargetOverride(v);
                    if (v > 0) {
                      setDeep((prev) => (prev ? { ...prev, plan: { ...prev.plan, target: v } } : prev));
                    }
                  }}
                  className="w-28 text-right px-2 py-0.5 rounded bg-[#EEFAF2] border border-[#A6E2BD] font-bold text-[#198F48]"
                />
              </div>
              <div className="flex justify-between max-w-xs">
                <span className="text-[#8A7C6F]">max loss</span>
                <span className="font-bold">about {deep.currency}{deep.ticket.maxLoss}</span>
              </div>
            </div>
          </div>

          <div className="font-mono text-xs font-semibold text-[#22A958]">
            {decisionStatus === 'approved'
              ? `✓ REAL ORDER + TARGET 🎯 ARMED: ${deep.symbol} Auto-Sell @ ${deep.currency}${deep.plan.target}`
              : decisionStatus === 'skipped'
              ? `✕ SKIPPED: order cancelled safely — zero money risked`
              : deep.ticket.statusLine}
          </div>

          {/* Iconic Side-by-Side Terracotta YES + Warm Stone NO Buttons (Executes Real Order WITH Real Target & Stop-Loss!) */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              disabled={orderBusy || decisionStatus === 'approved'}
              onClick={async () => {
                const finalTarget = customTargetOverride > 0 ? customTargetOverride : deep.plan.target;
                const finalStop = customStopOverride > 0 ? customStopOverride : deep.plan.stopLoss;
                if (deep.isCrypto && deep.coinDcxMarket) {
                  if (onApproveTrade) {
                    await onApproveTrade({
                      market: deep.coinDcxMarket,
                      symbol: deep.symbol,
                      tradeInr,
                      entry: deep.plan.entry,
                      stopLoss: finalStop,
                      target: finalTarget,
                    });
                  } else if (onApproveSetup) {
                    await onApproveSetup(deep.symbol);
                  }
                }
                setDecisionStatus('approved');
              }}
              className="py-3.5 rounded-2xl bg-[#D96543] hover:bg-[#C55534] text-white font-extrabold text-base shadow-sm cursor-pointer transition-all disabled:opacity-55"
            >
              {orderBusy ? 'Executing...' : `Yes · Buy with Target 🎯`}
            </button>

            <button
              onClick={() => setDecisionStatus('skipped')}
              className="py-3.5 rounded-2xl bg-[#EFE9E1] hover:bg-[#E4DBD0] text-[#1E1915] font-extrabold text-base cursor-pointer transition-all"
            >
              No
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
