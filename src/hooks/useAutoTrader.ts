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
  { symbol: 'BTC/INR', name: 'Bitcoin (INR)', price: 0, change24h: 0, high24h: 0, low24h: 0, rsi: 50, macd: 'NEUTRAL', history: [], markers: [] },
  { symbol: 'ETH/INR', name: 'Ethereum (INR)', price: 0, change24h: 0, high24h: 0, low24h: 0, rsi: 50, macd: 'NEUTRAL', history: [], markers: [] },
  { symbol: 'SOL/INR', name: 'Solana (INR)', price: 0, change24h: 0, high24h: 0, low24h: 0, rsi: 50, macd: 'NEUTRAL', history: [], markers: [] },
  { symbol: 'BTC/USDT', name: 'Bitcoin (USDT)', price: 0, change24h: 0, high24h: 0, low24h: 0, rsi: 50, macd: 'NEUTRAL', history: [], markers: [] },
  { symbol: 'ETH/USDT', name: 'Ethereum (USDT)', price: 0, change24h: 0, high24h: 0, low24h: 0, rsi: 50, macd: 'NEUTRAL', history: [], markers: [] },
  { symbol: 'SOL/USDT', name: 'Solana (USDT)', price: 0, change24h: 0, high24h: 0, low24h: 0, rsi: 50, macd: 'NEUTRAL', history: [], markers: [] },
  { symbol: 'XRP/USDT', name: 'XRP (USDT)', price: 0, change24h: 0, high24h: 0, low24h: 0, rsi: 50, macd: 'NEUTRAL', history: [], markers: [] },
];

function computeSmartRsi(history: number[], livePrice: number, low24h: number, high24h: number): number {
  const realTicks = history.filter((x) => x > 0);
  if (realTicks.length >= 6) {
    let gains = 0;
    let losses = 0;
    for (let i = 1; i < realTicks.length; i++) {
      const diff = realTicks[i] - realTicks[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    if (gains + losses > 0) {
      if (losses === 0) return 72;
      const rs = gains / losses;
      return parseFloat((100 - 100 / (1 + rs)).toFixed(1));
    }
  }
  if (high24h > low24h && livePrice > 0) {
    const pos = Math.max(0, Math.min(1, (livePrice - low24h) / (high24h - low24h)));
    return parseFloat((22 + pos * 56).toFixed(1));
  }
  return 50;
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
  const [autoTrading, setAutoTradingState] = useState<boolean>(() => localStorage.getItem('apex_auto_trading') === '1');
  const [smartStatus, setSmartStatus] = useState<string>(() =>
    localStorage.getItem('apex_auto_trading') === '1'
      ? '🤖 24×7 Smart Auto-Trader Active — scanning real CoinDCX markets…'
      : 'Tap "Start Smart Auto-Trade" ya "⚡ Instant Smart Trade" to trade real CoinDCX INR'
  );
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
  const [tradeLogs, setTradeLogs] = useState<TradeOrderLog[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('apex_real_trade_logs') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [analysisFeed, setAnalysisFeed] = useState<AutoAnalysisItem[]>([]);
  const [orderInrAmount, setOrderInrAmountState] = useState<number>(() => {
    const v = Number(localStorage.getItem('apex_order_inr') || 150);
    return v >= 110 ? v : 150;
  });
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

  const setOrderInrAmount = useCallback((v: number) => {
    const clean = Math.max(115, Number(v) || 150);
    setOrderInrAmountState(clean);
    localStorage.setItem('apex_order_inr', String(clean));
  }, []);

  const pushRealLog = useCallback((entry: TradeOrderLog) => {
    setTradeLogs((prev) => {
      const next = [entry, ...prev.slice(0, 19)];
      try {
        localStorage.setItem('apex_real_trade_logs', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

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
        const totalInr = Number(j.totalInr || 0);
        const spotInr = Number(j.spotInr || 0);
        const spotUsdt = Number(j.spotUsdt || 0);
        const futuresInr = Number(j.futuresInr || 0);
        const futuresUsdt = Number(j.futuresUsdt || 0);
        const usdtInr = Number(j.usdtInr || 87.5);
        const holdings: LiveHoldingItem[] = Array.isArray(j.holdings) ? j.holdings : [];

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

        let savedEntries: Record<string, { entryPrice: number }> = {};
        try {
          savedEntries = JSON.parse(localStorage.getItem('apex_entry_prices') || '{}') || {};
        } catch {}

        const combinedPositions: TradingPosition[] = Array.isArray(j.positions) ? [...j.positions] : [];
        for (const h of holdings) {
          if (h.currency === 'INR' || h.currency === 'USDT' || h.valueInr < 1) continue;
          const unitInr = h.total > 0 ? h.valueInr / h.total : 0;
          const symKey = `${h.currency}INR`;
          const entryPx = savedEntries[symKey]?.entryPrice || unitInr;
          const pnlInr = (unitInr - entryPx) * h.total;
          const pnlPct = entryPx > 0 ? ((unitInr - entryPx) / entryPx) * 100 : 0;
          combinedPositions.push({
            id: `spot-${h.currency}`,
            pair: `${h.currency}/INR`,
            type: 'LONG',
            entryPrice: parseFloat(entryPx.toFixed(2)),
            currentPrice: parseFloat(unitInr.toFixed(2)),
            amount: parseFloat(h.total.toFixed(5)),
            pnl: parseFloat(pnlInr.toFixed(2)),
            pnlPercent: parseFloat(pnlPct.toFixed(2)),
            status: 'OPEN',
            timestamp: Date.now(),
          });
        }
        setPositions(combinedPositions);
        return j;
      }
    } catch {}
    return null;
  }, []);

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

          const prevHist = p.history.length > 0 ? p.history : [livePrice, livePrice];
          const updatedHistory = [...prevHist.slice(-29), livePrice];
          const rsi = computeSmartRsi(updatedHistory, livePrice, low24h, high24h);
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
            analysis: `CoinDCX Live Stream: BTC/INR ₹${px.toLocaleString('en-IN')} (${chg >= 0 ? '+' : ''}${chg}% 24h) · RSI ${computeSmartRsi([], px, parseFloat(btcInr.low) || px, parseFloat(btcInr.high) || px)}`,
            signal: chg <= -1.0 || chg >= 0.5 ? 'BUY_SIGNAL' : 'HOLD',
            confidence: 94,
          };
          return [item, ...feed.slice(0, 7)];
        });
      }
    } catch {}
  }, []);

  // Run 1 Smart AI Portfolio Check / Execution on CoinDCX Live API
  const runSmartTradeNow = useCallback(
    async (forceEntry: boolean = false) => {
      if (orderBusy) return null;
      setOrderBusy(true);
      const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false });
      const apiKey = localStorage.getItem('coindcx_key') || '';
      const apiSecret = localStorage.getItem('coindcx_secret') || '';
      let savedEntries: Record<string, any> = {};
      try {
        savedEntries = JSON.parse(localStorage.getItem('apex_entry_prices') || '{}') || {};
      } catch {}

      try {
        setSmartStatus(forceEntry ? '⚡ Executing Live CoinDCX Smart Trade…' : '🤖 Checking Live TP/SL & Smart Entry…');
        const res = await hubFetch('/api/coindcx/smart-tick', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            apiKey,
            apiSecret,
            tradeInr: orderInrAmount,
            forceEntry,
            entries: savedEntries,
          }),
        });
        const j = await res.json();
        if (j?.entries) {
          localStorage.setItem('apex_entry_prices', JSON.stringify(j.entries));
        }
        if (j?.ok && j?.traded && j?.order) {
          const ord = j.order;
          const side: 'BUY' | 'SELL' = String(ord.side).toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
          const prettyPair = ord.market.replace(/(INR|USDT)$/, '/$1');
          const msg = `✅ LIVE ${ord.side} ${prettyPair}: ${ord.quantity} @ ₹${Number(ord.price).toLocaleString('en-IN')} (₹${ord.approxInr}) — ${j.reason}`;
          setSmartStatus(msg);
          pushRealLog({
            id: `smart-${Date.now()}`,
            time: nowStr,
            pair: prettyPair,
            type: side,
            price: Number(ord.price),
            amount: Number(ord.quantity),
            reason: msg,
            sentimentTrigger: 'AI_SMART_AUTO',
            geo: GEO_HUBS[0],
          });
          onTradeBurstRef.current?.(side, { pair: prettyPair, price: Number(ord.price) });
          onTriggerSentimentTradeRef.current?.('excited', msg);
          await syncLiveAccount();
          return j;
        }
        const statusTxt = j?.reason || j?.error || 'Live market scanned';
        setSmartStatus(`🤖 ${statusTxt}`);
        if (!j?.ok && j?.error) {
          pushRealLog({
            id: `smart-err-${Date.now()}`,
            time: nowStr,
            pair: 'COINDCX',
            type: 'BUY',
            price: 0,
            amount: 0,
            reason: `⚠️ ${j.error}`,
            sentimentTrigger: 'AI_SMART_AUTO',
            geo: GEO_HUBS[0],
          });
        }
        await syncLiveAccount();
        return j;
      } catch (e: any) {
        const em = e?.message || 'Network check failed';
        setSmartStatus(`⚠️ ${em}`);
        return { ok: false, error: em };
      } finally {
        setOrderBusy(false);
      }
    },
    [orderBusy, orderInrAmount, pushRealLog, syncLiveAccount]
  );

  const setAutoTrading = useCallback(
    (updater: boolean | ((prev: boolean) => boolean)) => {
      setAutoTradingState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        localStorage.setItem('apex_auto_trading', next ? '1' : '0');
        hubFetch('/api/coindcx/auto-state', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ enabled: next, tradeInr: orderInrAmount }),
        }).catch(() => {});
        if (next) {
          setSmartStatus('🟢 24×7 Smart Auto-Trader ON — placing smart entry / checking positions…');
          setTimeout(() => {
            runSmartTradeNow(true);
          }, 250);
        } else {
          setSmartStatus('⏹ Auto-Trading OFF — Safe Manual Mode');
        }
        return next;
      });
    },
    [orderInrAmount, runSmartTradeNow]
  );

  // Respect single Master Power button: when APEX powered OFF, immediately silence cloud auto-trader too!
  useEffect(() => {
    if (!enabled) {
      hubFetch('/api/coindcx/auto-state', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      }).catch(() => {});
      return;
    }
    syncLiveTickers();
    syncLiveAccount();
    if (autoTrading) {
      hubFetch('/api/coindcx/auto-state', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: true, tradeInr: orderInrAmount }),
      }).catch(() => {});
    }
    const tInt = setInterval(syncLiveTickers, 4000);
    const bInt = setInterval(() => syncLiveAccount(), 12000);
    return () => {
      clearInterval(tInt);
      clearInterval(bInt);
    };
  }, [enabled, autoTrading, orderInrAmount, syncLiveTickers, syncLiveAccount]);

  // Continuous Smart Auto-Trader loop while enabled & autoTrading is ON (checks TP/SL + setups every 45s)
  useEffect(() => {
    if (!enabled || !autoTrading) return;
    const autoTimer = setInterval(() => {
      runSmartTradeNow(false);
    }, 45000);
    return () => clearInterval(autoTimer);
  }, [enabled, autoTrading, runSmartTradeNow]);

  // Manual 1-tap Real Exchange Order (Precision-exact & auto-INR routed!)
  const executeLiveOrder = useCallback(
    async (side: 'BUY' | 'SELL', symbol: string, sourceLabel: string) => {
      if (orderBusy) return;
      const targetPair = pairsRef.current.find((p) => p.symbol === symbol) || pairsRef.current[0];
      if (!targetPair) return;

      setOrderBusy(true);
      const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false });
      const isInrPair = targetPair.symbol.endsWith('/INR');
      const usdtRate = liveAccount.usdtInr || 87.5;
      const priceInInr = isInrPair ? targetPair.price : targetPair.price * usdtRate;
      const rawQty = priceInInr > 0 ? Math.max(0.00001, parseFloat((orderInrAmount / priceInInr).toFixed(5))) : 0.001;

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
            inrAmount: orderInrAmount,
            quantity: rawQty,
            price: targetPair.price,
            walletType,
            leverage,
            order_type: 'market_order',
          }),
        });
        const j = await res.json();
        if (!res.ok || !j.ok) {
          const errMsg = j?.error || 'Exchange rejected order';
          setSmartStatus(`❌ ${errMsg}`);
          pushRealLog({
            id: `err-${Date.now()}`,
            time: nowStr,
            pair: targetPair.symbol,
            type: side === 'BUY' ? 'BUY' : 'SELL',
            price: targetPair.price,
            amount: rawQty,
            reason: `❌ CoinDCX Live: ${errMsg}`,
            sentimentTrigger: 'LIVE_EXCHANGE',
            geo: GEO_HUBS[0],
          });
          onTriggerSentimentTradeRef.current?.('sad', `CoinDCX: ${errMsg}`);
          return;
        }

        const execMarket = String(j.market || targetPair.symbol).replace(/(INR|USDT)$/, '/$1');
        const execQty = Number(j.quantity || rawQty);
        const execPx = Number(j.price || targetPair.price);
        const execInr = Number(j.approxInr || orderInrAmount);
        setSmartStatus(`✅ LIVE ${side} ${execMarket} Executed: ${execQty} (₹${execInr})`);

        if (side === 'BUY' && j.market) {
          try {
            const saved = JSON.parse(localStorage.getItem('apex_entry_prices') || '{}') || {};
            saved[j.market] = { entryPrice: execPx, ts: Date.now(), qty: execQty };
            localStorage.setItem('apex_entry_prices', JSON.stringify(saved));
          } catch {}
        }

        pushRealLog({
          id: `live-ord-${Date.now()}`,
          time: nowStr,
          pair: execMarket,
          type: side,
          price: execPx,
          amount: execQty,
          reason: `✅ REAL ${j.wallet || 'SPOT'} ${side} Executed (${execQty} @ ₹${execPx.toLocaleString('en-IN')} · ₹${execInr})`,
          sentimentTrigger: sourceLabel,
          geo: GEO_HUBS[0],
        });

        const marker: ChartTradeMarker = {
          id: `mk-${Date.now()}`,
          index: Math.max(0, targetPair.history.length - 1),
          price: execPx,
          type: side,
          time: nowStr,
          label: `${side} ${execQty}`,
        };
        setPairs((prev) =>
          prev.map((p) => (p.symbol === targetPair.symbol ? { ...p, markers: [...(p.markers || []).slice(-6), marker] } : p))
        );

        onTradeBurstRef.current?.(side, { pair: execMarket, price: execPx });
        onTriggerSentimentTradeRef.current?.('excited', `LIVE CoinDCX ${side} order executed on ${execMarket}!`);
        await syncLiveAccount();
      } finally {
        setOrderBusy(false);
      }
    },
    [orderBusy, orderInrAmount, walletType, leverage, liveAccount.usdtInr, pushRealLog, syncLiveAccount]
  );

  const manualBuy = useCallback((symbol: string) => executeLiveOrder('BUY', symbol, 'LIVE_MANUAL'), [executeLiveOrder]);
  const manualSell = useCallback((symbol: string) => executeLiveOrder('SELL', symbol, 'LIVE_MANUAL'), [executeLiveOrder]);

  return {
    pairs,
    selectedPairIndex,
    setSelectedPairIndex,
    activePair: pairs[selectedPairIndex] || pairs[0],
    autoTrading,
    setAutoTrading,
    smartStatus,
    runSmartTradeNow,
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
