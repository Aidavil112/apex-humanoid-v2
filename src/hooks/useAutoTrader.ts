import { useState, useEffect, useRef, useCallback } from 'react';
import { MarketPairData, TradingPosition, TradeOrderLog, ChartTradeMarker, AutoAnalysisItem, MoodType } from '../types';
import { hubFetch } from '../engine/api';

export interface LiveHoldingItem {
  wallet: 'SPOT' | 'FUTURES';
  currency: string;
  balance: number;
  locked_balance: number;
  total: number;
  valueInr: number;
  valueUsdt: number;
}

export interface LiveAccountSummary {
  live: boolean;
  spotInr: number;
  spotUsdt: number;
  futuresInr: number;
  futuresUsdt: number;
  totalInr: number;
  totalUsdt: number;
  usdtInr: number;
  holdings: LiveHoldingItem[];
}

const LIVE_PAIRS_TEMPLATE: MarketPairData[] = [
  {
    symbol: 'BTC/INR',
    name: 'Bitcoin (INR)',
    price: 0,
    change24h: 0,
    high24h: 0,
    low24h: 0,
    rsi: 50,
    macd: 'NEUTRAL',
    history: [],
    markers: [],
  },
  {
    symbol: 'ETH/INR',
    name: 'Ethereum (INR)',
    price: 0,
    change24h: 0,
    high24h: 0,
    low24h: 0,
    rsi: 50,
    macd: 'NEUTRAL',
    history: [],
    markers: [],
  },
  {
    symbol: 'SOL/INR',
    name: 'Solana (INR)',
    price: 0,
    change24h: 0,
    high24h: 0,
    low24h: 0,
    rsi: 50,
    macd: 'NEUTRAL',
    history: [],
    markers: [],
  },
  {
    symbol: 'BTC/USDT',
    name: 'Bitcoin (USDT)',
    price: 0,
    change24h: 0,
    high24h: 0,
    low24h: 0,
    rsi: 50,
    macd: 'NEUTRAL',
    history: [],
    markers: [],
  },
  {
    symbol: 'ETH/USDT',
    name: 'Ethereum (USDT)',
    price: 0,
    change24h: 0,
    high24h: 0,
    low24h: 0,
    rsi: 50,
    macd: 'NEUTRAL',
    history: [],
    markers: [],
  },
  {
    symbol: 'SOL/USDT',
    name: 'Solana (USDT)',
    price: 0,
    change24h: 0,
    high24h: 0,
    low24h: 0,
    rsi: 50,
    macd: 'NEUTRAL',
    history: [],
    markers: [],
  },
  {
    symbol: 'XRP/USDT',
    name: 'XRP (USDT)',
    price: 0,
    change24h: 0,
    high24h: 0,
    low24h: 0,
    rsi: 50,
    macd: 'NEUTRAL',
    history: [],
    markers: [],
  },
];

function computeRsi(history: number[]): number {
  if (history.length < 3) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < history.length; i++) {
    const diff = history[i] - history[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  if (gains === 0 && losses === 0) return 50;
  if (losses === 0) return 75;
  const rs = gains / losses;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(1));
}

interface UseAutoTraderProps {
  enabled?: boolean;
  currentMood: MoodType;
  currentHeartRate: number;
  onTriggerSentimentTrade?: (mood: MoodType, msg: string) => void;
  onTradeBurst?: (type: 'BUY' | 'SELL', details: { pair: string; price: number; profit?: number }) => void;
}

export const GEO_HUBS = [
  { city: 'Mumbai', country: 'India', lat: 19.076, lng: 72.8777, label: 'CoinDCX Primary Exchange (IN)' },
  { city: 'Bengaluru', country: 'India', lat: 12.9716, lng: 77.5946, label: 'APEX Live Execution Relay (IN)' },
  { city: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198, label: 'Asia Liquidity Feed' },
  { city: 'London', country: 'UK', lat: 51.5074, lng: -0.1278, label: 'Global FX Reference' },
];

export function useAutoTrader({
  enabled = true,
  currentMood,
  currentHeartRate,
  onTriggerSentimentTrade,
  onTradeBurst,
}: UseAutoTraderProps) {
  const [pairs, setPairs] = useState<MarketPairData[]>(LIVE_PAIRS_TEMPLATE);
  const [selectedPairIndex, setSelectedPairIndex] = useState(0);
  // Safe default: Manual ON, Auto-Pilot waits for explicit user activation because REAL MONEY is live!
  const [autoTrading, setAutoTrading] = useState(false);
  // Real portfolio value in INR (₹) — ZERO fake demo defaults!
  const [balance, setBalance] = useState(0);
  const [liveAccount, setLiveAccount] = useState<LiveAccountSummary>({
    live: false,
    spotInr: 0,
    spotUsdt: 0,
    futuresInr: 0,
    futuresUsdt: 0,
    totalInr: 0,
    totalUsdt: 0,
    usdtInr: 87.5,
    holdings: [],
  });
  const [strategy, setStrategy] = useState<'SENTIMENT_ALPHA' | 'TREND_MOMENTUM' | 'GRID_SCALPER'>('TREND_MOMENTUM');
  const [positions, setPositions] = useState<TradingPosition[]>([]);
  const [tradeLogs, setTradeLogs] = useState<TradeOrderLog[]>([]);
  const [analysisFeed, setAnalysisFeed] = useState<AutoAnalysisItem[]>([]);
  const [orderInrAmount, setOrderInrAmount] = useState<number>(200);
  const [walletType, setWalletType] = useState<'auto' | 'futures' | 'spot'>('auto');
  const [leverage, setLeverage] = useState<number>(1);
  const [orderBusy, setOrderBusy] = useState<boolean>(false);

  const pairsRef = useRef(pairs);
  pairsRef.current = pairs;
  const moodRef = useRef(currentMood);
  moodRef.current = currentMood;
  const heartRateRef = useRef(currentHeartRate);
  heartRateRef.current = currentHeartRate;
  const onTradeBurstRef = useRef(onTradeBurst);
  onTradeBurstRef.current = onTradeBurst;
  const onTriggerSentimentTradeRef = useRef(onTriggerSentimentTrade);
  onTriggerSentimentTradeRef.current = onTriggerSentimentTrade;

  // Sync 100% REAL CoinDCX Account Balances + Live Open Positions (Spot + Futures)
  const syncLiveAccount = useCallback(async (overrideKey?: string, overrideSecret?: string) => {
    const apiKey = overrideKey !== undefined ? overrideKey : localStorage.getItem('coindcx_key') || '';
    const apiSecret = overrideSecret !== undefined ? overrideSecret : localStorage.getItem('coindcx_secret') || '';
    try {
      const r = await hubFetch('/api/coindcx/balances', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apiKey, apiSecret }),
      });
      const j = await r.json();
      if (j && j.ok) {
        let totalInr = Number(j.totalInr || 0);
        let spotInr = Number(j.spotInr || 0);
        let spotUsdt = Number(j.spotUsdt || 0);
        const futuresInr = Number(j.futuresInr || 0);
        const futuresUsdt = Number(j.futuresUsdt || 0);
        const usdtInr = Number(j.usdtInr || 87.5);
        let holdings: LiveHoldingItem[] = Array.isArray(j.holdings) ? j.holdings : [];

        // Backward compatibility if Cloud Hub still returns raw Spot array prior to deploy
        if (holdings.length === 0 && Array.isArray(j.balances)) {
          holdings = j.balances
            .map((b: any) => {
              const avail = parseFloat(b.balance) || 0;
              const locked = parseFloat(b.locked_balance) || 0;
              const total = avail + locked;
              const cur = String(b.currency || '').toUpperCase();
              if (cur === 'INR') spotInr = total;
              if (cur === 'USDT') spotUsdt = total;
              const valInr = cur === 'INR' ? total : cur === 'USDT' ? total * usdtInr : 0;
              return {
                wallet: 'SPOT' as const,
                currency: cur,
                balance: avail,
                locked_balance: locked,
                total,
                valueInr: valInr,
                valueUsdt: valInr / usdtInr,
              };
            })
            .filter((h: LiveHoldingItem) => h.total > 0);
          totalInr = holdings.reduce((s, h) => s + h.valueInr, 0);
        }

        setBalance(parseFloat(totalInr.toFixed(2)));
        setLiveAccount({
          live: Boolean(j.live),
          spotInr,
          spotUsdt,
          futuresInr,
          futuresUsdt,
          totalInr,
          totalUsdt: Number(j.totalUsdt ?? totalInr / usdtInr),
          usdtInr,
          holdings,
        });

        if (Array.isArray(j.positions)) {
          setPositions(j.positions);
        }
        return j;
      }
    } catch {}
    return null;
  }, []);

  // Poll 100% REAL CoinDCX Live Market Tickers every 4s (ZERO random/fake prices!)
  const syncLiveTickers = useCallback(async () => {
    try {
      const r = await hubFetch('/api/coindcx/ticker');
      const j = await r.json();
      if (!j?.ok || !Array.isArray(j.data)) return;

      const byMarket = new Map<string, any>();
      for (const item of j.data) {
        byMarket.set(String(item.market).toUpperCase(), item);
      }

      const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false });

      setPairs((prev) =>
        prev.map((p) => {
          const code = p.symbol.replace('/', '');
          const raw = byMarket.get(code);
          if (!raw) return p;

          const livePrice = parseFloat(raw.last_price) || p.price;
          const high24h = parseFloat(raw.high) || livePrice;
          const low24h = parseFloat(raw.low) || livePrice;
          const change24h = parseFloat(parseFloat(raw.change_24_hour || '0').toFixed(2));

          // Seed flat real history on first tick so chart renders cleanly from real market price
          const prevHist =
            p.history.length > 0
              ? p.history
              : Array.from({ length: 12 }, (_, idx) => {
                  const span = high24h - low24h;
                  const base = low24h + span * (idx / 11);
                  return idx === 11 ? livePrice : parseFloat(((base + livePrice) / 2).toFixed(4));
                });

          const updatedHistory = [...prevHist.slice(-23), livePrice];
          const rsi = computeRsi(updatedHistory);
          const macd: 'BULLISH' | 'BEARISH' | 'NEUTRAL' =
            change24h > 0.35 ? 'BULLISH' : change24h < -0.35 ? 'BEARISH' : 'NEUTRAL';

          return {
            ...p,
            price: livePrice,
            change24h,
            high24h,
            low24h,
            rsi,
            macd,
            history: updatedHistory,
          };
        })
      );

      const btcInr = byMarket.get('BTCINR');
      if (btcInr) {
        const px = parseFloat(btcInr.last_price) || 0;
        const chg = parseFloat(parseFloat(btcInr.change_24_hour || '0').toFixed(2));
        setAnalysisFeed((feed) => {
          if (feed.length > 0 && feed[0].analysis.includes(px.toLocaleString('en-IN'))) return feed;
          const item: AutoAnalysisItem = {
            id: `live-${Date.now()}`,
            time: nowStr,
            pair: 'BTC/INR',
            analysis: `CoinDCX Live Stream: BTC/INR trading at ₹${px.toLocaleString('en-IN')} (${chg >= 0 ? '+' : ''}${chg}% 24h). Real exchange feed synced.`,
            signal: chg >= 0.5 ? 'BUY_SIGNAL' : 'HOLD',
            confidence: 92,
          };
          return [item, ...feed.slice(0, 7)];
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!enabled) return;
    syncLiveTickers();
    syncLiveAccount();
    const tInt = setInterval(syncLiveTickers, 4000);
    const bInt = setInterval(() => syncLiveAccount(), 12000);
    return () => {
      clearInterval(tInt);
      clearInterval(bInt);
    };
  }, [enabled, syncLiveTickers, syncLiveAccount]);

  // Execute 100% REAL Order on CoinDCX Exchange (Spot or Futures — NO DEMO!)
  const executeLiveOrder = useCallback(
    async (side: 'BUY' | 'SELL', symbol: string, sourceLabel: string) => {
      if (orderBusy) return;
      const targetPair = pairsRef.current.find((p) => p.symbol === symbol) || pairsRef.current[0];
      if (!targetPair || targetPair.price <= 0) return;

      setOrderBusy(true);
      const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false });
      const isInrPair = targetPair.symbol.endsWith('/INR');
      const usdtRate = liveAccount.usdtInr || 87.5;
      const priceInInr = isInrPair ? targetPair.price : targetPair.price * usdtRate;
      const rawQty = Math.max(0.0001, parseFloat((orderInrAmount / Math.max(priceInInr, 0.0001)).toFixed(5)));

      const apiKey = localStorage.getItem('coindcx_key') || '';
      const apiSecret = localStorage.getItem('coindcx_secret') || '';

      try {
        const res = await hubFetch('/api/coindcx/trade', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            apiKey,
            apiSecret,
            side: side.toLowerCase(),
            market: targetPair.symbol.replace('/', ''),
            quantity: rawQty,
            price: targetPair.price,
            walletType,
            leverage,
            order_type: 'market_order',
          }),
        });
        const j = await res.json();
        if (!res.ok || !j.ok) {
          const errMsg = j?.error || 'Exchange rejected order (check balance / minimum lot size)';
          const failLog: TradeOrderLog = {
            id: `err-${Date.now()}`,
            time: nowStr,
            pair: targetPair.symbol,
            type: side === 'BUY' ? 'BUY' : 'SELL',
            price: targetPair.price,
            amount: rawQty,
            reason: `❌ CoinDCX Live Rejection: ${errMsg}`,
            sentimentTrigger: 'LIVE_EXCHANGE',
            geo: GEO_HUBS[0],
          };
          setTradeLogs((prev) => [failLog, ...prev.slice(0, 14)]);
          onTriggerSentimentTradeRef.current?.('sad', `CoinDCX Live: ${errMsg}`);
          return;
        }

        const log: TradeOrderLog = {
          id: `live-ord-${Date.now()}`,
          time: nowStr,
          pair: targetPair.symbol,
          type: side,
          price: targetPair.price,
          amount: rawQty,
          reason: `✅ REAL ${j.wallet || 'COINDCX'} ${side} Executed (${rawQty} @ ${isInrPair ? '₹' : '$'}${targetPair.price.toLocaleString()})`,
          sentimentTrigger: sourceLabel,
          geo: GEO_HUBS[0],
        };
        setTradeLogs((prev) => [log, ...prev.slice(0, 14)]);

        const marker: ChartTradeMarker = {
          id: `mk-${Date.now()}`,
          index: Math.max(0, targetPair.history.length - 1),
          price: targetPair.price,
          type: side,
          time: nowStr,
          label: `${side} ${rawQty}`,
        };
        setPairs((prev) =>
          prev.map((p) => (p.symbol === targetPair.symbol ? { ...p, markers: [...(p.markers || []).slice(-6), marker] } : p))
        );

        onTradeBurstRef.current?.(side, { pair: targetPair.symbol, price: targetPair.price });
        onTriggerSentimentTradeRef.current?.(
          'excited',
          `LIVE CoinDCX ${side} order executed on ${targetPair.symbol}!`
        );
        await syncLiveAccount();
      } finally {
        setOrderBusy(false);
      }
    },
    [orderBusy, orderInrAmount, walletType, leverage, liveAccount.usdtInr, syncLiveAccount]
  );

  // Real Live Auto-Trading Loop (ONLY runs when user explicitly turns Auto-Trading ON!)
  useEffect(() => {
    if (!enabled || !autoTrading) return;
    const autoTimer = setInterval(() => {
      const active = pairsRef.current[selectedPairIndex] || pairsRef.current[0];
      if (!active || active.price <= 0) return;
      if (active.rsi <= 32) {
        executeLiveOrder('BUY', active.symbol, `AUTO RSI ${active.rsi}`);
      } else if (active.rsi >= 68) {
        executeLiveOrder('SELL', active.symbol, `AUTO RSI ${active.rsi}`);
      }
    }, 20000);
    return () => clearInterval(autoTimer);
  }, [enabled, autoTrading, selectedPairIndex, executeLiveOrder]);

  const manualBuy = useCallback(
    (symbol: string) => {
      executeLiveOrder('BUY', symbol, 'LIVE_MANUAL');
    },
    [executeLiveOrder]
  );

  const manualSell = useCallback(
    (symbol: string) => {
      executeLiveOrder('SELL', symbol, 'LIVE_MANUAL');
    },
    [executeLiveOrder]
  );

  return {
    pairs,
    selectedPairIndex,
    setSelectedPairIndex,
    activePair: pairs[selectedPairIndex] || pairs[0],
    autoTrading,
    setAutoTrading,
    balance,
    liveAccount,
    syncLiveAccount,
    positions,
    tradeLogs,
    analysisFeed,
    strategy,
    setStrategy,
    orderInrAmount,
    setOrderInrAmount,
    walletType,
    setWalletType,
    leverage,
    setLeverage,
    orderBusy,
    manualBuy,
    manualSell,
  };
}
