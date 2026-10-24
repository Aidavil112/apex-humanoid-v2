import { useState, useEffect, useRef, useCallback } from 'react';
import { MarketPairData, TradingPosition, TradeOrderLog, ChartTradeMarker, AutoAnalysisItem, MoodType } from '../types';
import { hubFetch } from '../engine/api';
import {
  bumpTradesToday,
  effectiveLossCapInr,
  canTradeMore,
  jarvisLog,
  loadState as loadJarvisState,
  registerTradingExecutor,
  saveState as saveJarvisState,
} from '../engine/jarvisCore';
import { userScopedKey } from '../engine/authStore';
import {
  fetchFullDirectCoinDcxPortfolio,
  executeDirectFuturesOrder,
  executeDirectSpotOrder,
  exitCoinDcxFuturesPositionDirect,
} from '../engine/coindcxDirectEngine';

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

export interface RealTargetPlan {
  market: string;
  symbol: string;
  entryPrice: number;
  targetPrice: number;
  stopLossPrice: number;
  qty: number;
  ts: number;
  source?: string;
}

export interface BuyWithTargetOptions {
  customInr?: number;
  targetPrice?: number;
  stopLossPrice?: number;
  forceSide?: 'buy' | 'sell';
  source?: string;
}

export interface SpecialistBotStatus {
  id: string;
  icon: string;
  name: string;
  role: string;
  liveAction: string;
  active: boolean;
}

const LIVE_PAIRS_TEMPLATE: MarketPairData[] = [
  { symbol: 'BTC/INR', name: 'Bitcoin (INR)', price: 0, change24h: 0, high24h: 0, low24h: 0, rsi: 50, macd: 'NEUTRAL', history: [], markers: [] },
  { symbol: 'ETH/INR', name: 'Ethereum (INR)', price: 0, change24h: 0, high24h: 0, low24h: 0, rsi: 50, macd: 'NEUTRAL', history: [], markers: [] },
  { symbol: 'SOL/INR', name: 'Solana (INR)', price: 0, change24h: 0, high24h: 0, low24h: 0, rsi: 50, macd: 'NEUTRAL', history: [], markers: [] },
  { symbol: 'PAXG/INR', name: '24K Real Gold (INR)', price: 0, change24h: 0, high24h: 0, low24h: 0, rsi: 50, macd: 'NEUTRAL', history: [], markers: [] },
  { symbol: 'BTC/USDT', name: 'Bitcoin Futures/USDT', price: 0, change24h: 0, high24h: 0, low24h: 0, rsi: 50, macd: 'NEUTRAL', history: [], markers: [] },
  { symbol: 'ETH/USDT', name: 'Ethereum Futures/USDT', price: 0, change24h: 0, high24h: 0, low24h: 0, rsi: 50, macd: 'NEUTRAL', history: [], markers: [] },
  { symbol: 'SOL/USDT', name: 'Solana Futures/USDT', price: 0, change24h: 0, high24h: 0, low24h: 0, rsi: 50, macd: 'NEUTRAL', history: [], markers: [] },
  { symbol: 'XRP/USDT', name: 'XRP Futures/USDT', price: 0, change24h: 0, high24h: 0, low24h: 0, rsi: 50, macd: 'NEUTRAL', history: [], markers: [] },
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
  userId?: string;
  isOwner?: boolean;
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
  userId = 'owner_admin',
  isOwner = true,
  currentMood,
  currentHeartRate,
  onTriggerSentimentTrade,
  onTradeBurst,
}: UseAutoTraderProps) {
  const [pairs, setPairs] = useState<MarketPairData[]>(LIVE_PAIRS_TEMPLATE);
  const [selectedPairIndex, setSelectedPairIndex] = useState(0);
  const [autoTrading, setAutoTradingState] = useState<boolean>(() => localStorage.getItem('apex_auto_trading') === '1');
  const [bossDirective, setBossDirectiveState] = useState<string>(
    () =>
      localStorage.getItem('apex_headbot_directive') ||
      'Smart Mode: Futures + Spot dono check karo — jisme best profit setup mile khud BUY/SELL karo (No Permission Needed)'
  );
  const [allowedCoinsFilter, setAllowedCoinsFilter] = useState<string[]>([]);
  const [targetProfitPct, setTargetProfitPct] = useState<number>(() => {
    const v = parseFloat(localStorage.getItem('apex_tp_pct') || '1.35');
    return v > 0.2 ? v : 1.35;
  });
  const [stopLossPct, setStopLossPct] = useState<number>(() => {
    const v = parseFloat(localStorage.getItem('apex_sl_pct') || '0.9');
    return v > 0.2 ? v : 0.9;
  });

  const [smartStatus, setSmartStatus] = useState<string>(() =>
    localStorage.getItem('apex_auto_trading') === '1'
      ? '🤖 Autonomous 5-Bot Desk Active — Futures + Spot real-time scan चालू…'
      : '👑 Head Bot Ready — Mic daba kar command dein ya Start Auto-Trade ON karein'
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
    usdtInr: 88.0,
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
    return v >= 60 ? v : 150;
  });
  const [walletType, setWalletTypeState] = useState<'auto' | 'futures' | 'spot'>(
    () => (localStorage.getItem('apex_wallet_pref') as 'auto' | 'futures' | 'spot') || 'auto'
  );
  const [leverage, setLeverageState] = useState<number>(() => Number(localStorage.getItem('apex_leverage_pref') || 3));
  const [orderBusy, setOrderBusy] = useState<boolean>(false);
  const [activeTargets, setActiveTargets] = useState<Record<string, RealTargetPlan>>(() => {
    try {
      return JSON.parse(localStorage.getItem('apex_entry_prices') || '{}') || {};
    } catch {
      return {};
    }
  });

  const setWalletType = useCallback((w: 'auto' | 'futures' | 'spot') => {
    setWalletTypeState(w);
    localStorage.setItem('apex_wallet_pref', w);
  }, []);

  const setLeverage = useCallback((lev: number) => {
    const clean = Math.max(1, Math.min(20, Number(lev) || 3));
    setLeverageState(clean);
    localStorage.setItem('apex_leverage_pref', String(clean));
  }, []);

  const activeTargetsRef = useRef(activeTargets);
  activeTargetsRef.current = activeTargets;
  const liveAccountRef = useRef(liveAccount);
  liveAccountRef.current = liveAccount;
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const pairsRef = useRef(pairs);
  pairsRef.current = pairs;
  const triggerLockRef = useRef<Record<string, number>>({});
  const onTradeBurstRef = useRef(onTradeBurst);
  onTradeBurstRef.current = onTradeBurst;
  const onTriggerSentimentTradeRef = useRef(onTriggerSentimentTrade);
  onTriggerSentimentTradeRef.current = onTriggerSentimentTrade;

  const setOrderInrAmount = useCallback((v: number) => {
    const clean = Math.max(60, Number(v) || 150);
    setOrderInrAmountState(clean);
    localStorage.setItem('apex_order_inr', String(clean));
  }, []);

  const pushRealLog = useCallback((entry: TradeOrderLog) => {
    setTradeLogs((prev) => {
      if (prev.some((x) => x.id === entry.id)) return prev;
      const next = [entry, ...prev.slice(0, 24)];
      try {
        localStorage.setItem('apex_real_trade_logs', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const saveTargetPlan = useCallback(
    (symbol: string, entryPrice: number, targetPrice: number, stopLossPrice: number, qty = 0, source = 'REAL_TARGET') => {
      const cleanSym = symbol.includes('/') ? symbol : symbol.replace(/(INR|USDT)$/, '/$1');
      const market = cleanSym.replace('/', '').toUpperCase();
      const plan: RealTargetPlan = {
        market,
        symbol: cleanSym,
        entryPrice: Number(entryPrice),
        targetPrice: Number(targetPrice),
        stopLossPrice: Number(stopLossPrice),
        qty: Number(qty || 0),
        ts: Date.now(),
        source,
      };
      setActiveTargets((prev) => {
        const next = { ...prev, [market]: plan };
        try {
          localStorage.setItem('apex_entry_prices', JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    []
  );

  const clearTargetPlan = useCallback((symbol: string) => {
    const market = symbol.replace('/', '').toUpperCase();
    setActiveTargets((prev) => {
      const next = { ...prev };
      delete next[market];
      try {
        localStorage.setItem('apex_entry_prices', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  /**
   * TWO-WAY REAL-TIME COINDCX APP <-> APEX SYNC (Runs every 4 seconds!)
   * Any trade you place directly in the CoinDCX mobile app (Futures OR Spot) immediately shows up here!
   */
  const syncLiveAccount = useCallback(
    async (overrideKey?: string, overrideSecret?: string) => {
      const apiKey =
        overrideKey !== undefined ? overrideKey : localStorage.getItem(userScopedKey('coindcx_key', userId)) || '';
      const apiSecret =
        overrideSecret !== undefined
          ? overrideSecret
          : localStorage.getItem(userScopedKey('coindcx_secret', userId)) || '';

      // 1) DIRECT PHONE TLS ENGINE (Supports BOTH Futures GET-with-body Wallets + Futures Positions + Spot!)
      if (apiKey.trim() && apiSecret.trim()) {
        try {
          const direct = await fetchFullDirectCoinDcxPortfolio(apiKey.trim(), apiSecret.trim());
          if (direct?.ok) {
            setBalance(parseFloat(direct.totalInr.toFixed(2)));
            setLiveAccount({
              live: true,
              spotInr: direct.spotInr,
              spotUsdt: direct.spotUsdt,
              futuresInr: direct.futuresInr,
              futuresUsdt: direct.futuresUsdt,
              totalInr: direct.totalInr,
              totalUsdt: direct.totalUsdt,
              usdtInr: direct.usdtInr,
              holdings: direct.holdings,
            });
            setPositions(direct.positions);
            if (Array.isArray(direct.syncedLogs) && direct.syncedLogs.length > 0) {
              setTradeLogs((prev) => {
                const existingIds = new Set(prev.map((x) => x.id));
                const fresh = direct.syncedLogs.filter((x) => !existingIds.has(x.id));
                if (fresh.length === 0) return prev;
                const merged = [...fresh, ...prev].slice(0, 25);
                try {
                  localStorage.setItem('apex_real_trade_logs', JSON.stringify(merged));
                } catch {}
                return merged;
              });
            }
            return direct;
          }
        } catch {}
      }

      if (!isOwner && (!apiKey.trim() || !apiSecret.trim())) {
        return null;
      }

      // 2) CLOUD WORKER SYNC FALLBACK
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
          const usdtInr = Number(j.usdtInr || 88.0);
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

          const combinedPositions: TradingPosition[] = Array.isArray(j.positions) ? [...j.positions] : [];
          for (const h of holdings) {
            if (h.currency === 'INR' || h.currency === 'USDT' || h.valueInr < 5) continue;
            const unitInr = h.total > 0 ? h.valueInr / h.total : 0;
            combinedPositions.push({
              id: `spot-${h.currency}`,
              pair: `${h.wallet === 'FUTURES' ? '⚡ FUTURES' : '🪙 SPOT'} · ${h.currency}/INR`,
              type: 'LONG',
              entryPrice: parseFloat(unitInr.toFixed(2)),
              currentPrice: parseFloat(unitInr.toFixed(2)),
              amount: parseFloat(h.total.toFixed(5)),
              pnl: 0,
              pnlPercent: 0,
              status: 'OPEN',
              timestamp: Date.now(),
            });
          }
          setPositions(combinedPositions);
          return j;
        }
      } catch {}
      return null;
    },
    [isOwner, userId]
  );

  /** Immediately exits any open Futures or Spot position (called automatically on TP/SL OR 1-tap Exit button!) */
  const closePositionNow = useCallback(
    async (pos: TradingPosition, reasonTag = '⚡ LIVE_EXIT') => {
      const apiKey = localStorage.getItem(userScopedKey('coindcx_key', userId)) || '';
      const apiSecret = localStorage.getItem(userScopedKey('coindcx_secret', userId)) || '';
      const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false });

      if (pos.id && !pos.id.startsWith('spot-') && apiKey && apiSecret) {
        try {
          setOrderBusy(true);
          await exitCoinDcxFuturesPositionDirect(pos.id, apiKey, apiSecret);
          const msg = `✅ Closed ${pos.pair} (${reasonTag}) · PnL ₹${pos.pnl.toFixed(2)}`;
          setSmartStatus(msg);
          pushRealLog({
            id: `exit-${Date.now()}`,
            time: nowStr,
            pair: pos.pair,
            type: 'SELL',
            price: pos.currentPrice,
            amount: pos.amount,
            reason: msg,
            sentimentTrigger: reasonTag,
            geo: GEO_HUBS[0],
          });
          await syncLiveAccount();
          return;
        } catch (e: any) {
          setSmartStatus(`⚠️ Exit check: ${e?.message || 'failed'}`);
        } finally {
          setOrderBusy(false);
        }
      }
      const rawCoin = pos.pair.replace(/⚡|🪙|FUTURES|SPOT|\(.*?\)|\d+x|·/gi, '').trim().split('/')[0];
      if (rawCoin) {
        await executeLiveOrderRef.current?.('SELL', `${rawCoin}/INR`, reasonTag);
      }
    },
    [userId, pushRealLog, syncLiveAccount]
  );

  const executeLiveOrderRef = useRef<any>(null);

  const syncLiveTickers = useCallback(async () => {
    try {
      const pubTickers = await fetch('https://api.coindcx.com/exchange/ticker')
        .then((res) => (res.ok ? res.json() : []))
        .catch(() => []);
      if (!Array.isArray(pubTickers) || pubTickers.length === 0) return;

      const byMarket = new Map<string, any>();
      for (const item of pubTickers) {
        if (item?.market) byMarket.set(String(item.market).toUpperCase(), item);
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
            analysis: `Scanner Bot: BTC ₹${px.toLocaleString('en-IN')} (${chg >= 0 ? '+' : ''}${chg}% 24h) · Checking Futures & Spot setups`,
            signal: chg <= -1.0 || chg >= 0.5 ? 'BUY_SIGNAL' : 'HOLD',
            confidence: 95,
          };
          return [item, ...feed.slice(0, 9)];
        });
      }

      // AUTONOMOUS POSITION TP/SL GUARD (Auto-books profit or protects SL on open Futures/Spot positions with ZERO permission delay!)
      for (const pos of positionsRef.current) {
        if (!pos.id.startsWith('spot-') && Math.abs(pos.pnlPercent) > 0) {
          const lockKey = `pos-${pos.id}`;
          if (Date.now() - (triggerLockRef.current[lockKey] || 0) < 25000) continue;
          if (pos.pnlPercent >= targetProfitPct) {
            triggerLockRef.current[lockKey] = Date.now();
            closePositionNow(pos, `🎯 AUTO_TP_+${pos.pnlPercent.toFixed(1)}%`);
            break;
          }
          if (pos.pnlPercent <= -Math.max(1.2, stopLossPct * leverage)) {
            triggerLockRef.current[lockKey] = Date.now();
            closePositionNow(pos, `🛑 AUTO_SL_${pos.pnlPercent.toFixed(1)}%`);
            break;
          }
          // 🚨 v6.6.0 EMERGENCY EXIT — SL 1.6x cross ho gaya (gap/crash) toh bina wait kiye bahar niklo
          const jst = loadJarvisState();
          const emMul = Math.max(1.1, Math.min(4, jst.limits.emergencySlMultiplier || 1.6));
          if (pos.pnlPercent <= -Math.max(1.2, stopLossPct * leverage) * emMul) {
            triggerLockRef.current[lockKey] = Date.now();
            closePositionNow(pos, `🚨 EMERGENCY_EXIT_${pos.pnlPercent.toFixed(1)}%`);
            break;
          }
          // 🚨 Poore din ka loss cap cross → sabse bura position turant band
          const totalOpenPnl = positionsRef.current.reduce((a, x) => a + (Number(x.pnl) || 0), 0);
          const cap = effectiveLossCapInr(liveAccountRef.current.futuresInr + liveAccountRef.current.spotInr);
          if (totalOpenPnl <= -cap && pos.pnl < 0) {
            const worst = positionsRef.current.filter((x) => x.pnl < 0).sort((a, b) => a.pnl - b.pnl)[0];
            if (worst && worst.id === pos.id) {
              triggerLockRef.current[lockKey] = Date.now();
              closePositionNow(worst, `🚨 DAILY_LOSS_CAP_₹${totalOpenPnl.toFixed(0)}`);
              break;
            }
          }
        }
      }
    } catch {}
  }, [closePositionNow, leverage, stopLossPct, targetProfitPct]);

  /**
   * REAL ORDER EXECUTION (AUTOMATICALLY ROUTES TO FUTURES OR SPOT DEPENDING ON WALLET PREF + AVAILABLE BALANCE + BEST SETUP!)
   */
  const executeLiveOrder = useCallback(
    async (side: 'BUY' | 'SELL', symbol: string, sourceLabel: string, opts?: BuyWithTargetOptions) => {
      if (orderBusy) return;
      setOrderBusy(true);
      const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false });
      const apiKey = localStorage.getItem(userScopedKey('coindcx_key', userId)) || '';
      const apiSecret = localStorage.getItem(userScopedKey('coindcx_secret', userId)) || '';
      const useInrAmount = opts?.customInr && opts.customInr >= 50 ? opts.customInr : orderInrAmount;
      const acct = liveAccountRef.current;

      try {
        // Decide SMART WALLET: Futures vs Spot!
        const futTotalInr = acct.futuresInr + acct.futuresUsdt * (acct.usdtInr || 88);
        const spotTotalInr = acct.spotInr + acct.spotUsdt * (acct.usdtInr || 88);

        const preferFutures =
          walletType === 'futures' ||
          (walletType === 'auto' && (futTotalInr >= 50 || (spotTotalInr < 105 && futTotalInr > 0)));

        // Direct Phone Execution when local API keys are stored (supports 100% Real CoinDCX Futures + Spot!)
        if (apiKey.trim() && apiSecret.trim()) {
          let execRes: any;
          if (preferFutures) {
            execRes = await executeDirectFuturesOrder({
              apiKey,
              apiSecret,
              symbol,
              side: side.toLowerCase() as 'buy' | 'sell',
              inrAmount: useInrAmount,
              leverage,
              futuresInr: acct.futuresInr,
              futuresUsdt: acct.futuresUsdt,
              usdtInr: acct.usdtInr || 88,
            });
          } else {
            execRes = await executeDirectSpotOrder({
              apiKey,
              apiSecret,
              symbol,
              side: side.toLowerCase() as 'buy' | 'sell',
              inrAmount: useInrAmount,
              spotInr: acct.spotInr,
              holdings: acct.holdings,
            });
          }

          const msg = `✅ LIVE ${execRes.wallet} ${execRes.side} ${execRes.market}: ${execRes.quantity} @ ${execRes.price} (₹${execRes.approxInr}) [${sourceLabel}]`;
          setSmartStatus(msg);
          pushRealLog({
            id: `direct-${Date.now()}`,
            time: nowStr,
            pair: `${execRes.market} [${execRes.wallet}]`,
            type: side,
            price: Number(execRes.price),
            amount: Number(execRes.quantity),
            reason: msg,
            sentimentTrigger: sourceLabel,
            geo: GEO_HUBS[0],
          });
          onTradeBurstRef.current?.(side, { pair: execRes.market, price: Number(execRes.price) });
          onTriggerSentimentTradeRef.current?.('excited', msg);
          await syncLiveAccount();
          return execRes;
        }

        // Fallback to Cloud Worker when keys are stored only on Cloudflare server
        const normalizedSym = symbol.includes('/') ? symbol : symbol.replace(/(INR|USDT)$/i, '/$1').toUpperCase();
        const targetPair =
          pairsRef.current.find((p) => p.symbol.toUpperCase() === normalizedSym.toUpperCase()) || pairsRef.current[0];

        const res = await hubFetch('/api/coindcx/trade', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            apiKey,
            apiSecret,
            side: side.toLowerCase(),
            market: targetPair.symbol.replace('/', ''),
            inrAmount: useInrAmount,
            price: targetPair.price,
            walletType,
            leverage,
            order_type: 'market_order',
          }),
        });
        const j = await res.json();
        if (!res.ok || !j.ok) {
          const hint =
            walletType === 'futures' || (acct.spotInr < 105 && !apiKey)
              ? `${j?.error || 'Order info'} — 💡 Tip: Futures trading ke liye upar "🔑 API Keys" me CoinDCX Key+Secret save karein!`
              : j?.error || 'Exchange rejected order';
          setSmartStatus(`⚠️ ${hint}`);
          return;
        }

        const execMarket = String(j.market || targetPair.symbol).replace(/(INR|USDT)$/, '/$1');
        const msg = `✅ LIVE ${j.wallet || 'SPOT'} ${side} ${execMarket}: ${j.quantity} @ ₹${j.price} (₹${j.approxInr})`;
        setSmartStatus(msg);
        pushRealLog({
          id: `srv-${Date.now()}`,
          time: nowStr,
          pair: execMarket,
          type: side,
          price: Number(j.price),
          amount: Number(j.quantity),
          reason: msg,
          sentimentTrigger: sourceLabel,
          geo: GEO_HUBS[0],
        });
        onTradeBurstRef.current?.(side, { pair: execMarket, price: Number(j.price) });
        await syncLiveAccount();
        return j;
      } catch (e: any) {
        const errTxt = e?.message || 'Order check failed';
        setSmartStatus(`⚠️ ${errTxt}`);
        pushRealLog({
          id: `err-${Date.now()}`,
          time: nowStr,
          pair: symbol,
          type: side,
          price: 0,
          amount: 0,
          reason: `⚠️ ${errTxt}`,
          sentimentTrigger: sourceLabel,
          geo: GEO_HUBS[0],
        });
      } finally {
        setOrderBusy(false);
      }
    },
    [userId, orderBusy, orderInrAmount, walletType, leverage, pushRealLog, syncLiveAccount]
  );

  executeLiveOrderRef.current = executeLiveOrder;

  /**
   * 100% AUTONOMOUS MULTI-AGENT TRADE ENGINE (NO PERMISSION ASKED — DECIDES FUTURES VS SPOT & EXECUTES ITSELF!)
   */
  const runSmartTradeNow = useCallback(
    async (forceEntry: boolean = false) => {
      if (orderBusy) return null;
      await syncLiveAccount();

      const apiKey = localStorage.getItem(userScopedKey('coindcx_key', userId)) || '';
      const apiSecret = localStorage.getItem(userScopedKey('coindcx_secret', userId)) || '';
      const acct = liveAccountRef.current;

      // Pick best pair across live market (respecting Head Bot coin filter if any!)
      const candidates = pairsRef.current.filter((p) => {
        if (p.price <= 0 || p.symbol.startsWith('PAXG')) return false;
        if (allowedCoinsFilter.length > 0) {
          const c = p.symbol.split('/')[0];
          return allowedCoinsFilter.includes(c);
        }
        return p.symbol.endsWith('/USDT') || p.symbol.endsWith('/INR');
      });

      let bestPair = candidates[0] || pairsRef.current[0];
      let bestScore = -999;
      let chosenSide: 'BUY' | 'SELL' = 'BUY';

      for (const p of candidates) {
        let score = 0;
        let side: 'BUY' | 'SELL' = 'BUY';
        if (p.rsi <= 36) {
          score = (40 - p.rsi) * 3 + 25;
          side = 'BUY';
        } else if (p.rsi >= 70 && (walletType === 'futures' || (walletType === 'auto' && acct.futuresInr + acct.futuresUsdt * 88 >= 50))) {
          // Overbought reversal — Futures Bot can profit via SHORT!
          score = (p.rsi - 65) * 3 + 22;
          side = 'SELL';
        } else if (p.change24h >= 0.6 && p.rsi < 66) {
          score = p.change24h * 8 + 15;
          side = 'BUY';
        } else {
          score = 50 - Math.abs(p.rsi - 42);
          side = 'BUY';
        }
        if (score > bestScore) {
          bestScore = score;
          bestPair = p;
          chosenSide = side;
        }
      }

      if (apiKey.trim() && apiSecret.trim()) {
        if (!forceEntry && positionsRef.current.length >= 3) {
          setSmartStatus(`🛡️ Risk Bot: ${positionsRef.current.length} open positions monitor ho rahe hain (Auto TP +${targetProfitPct}%)`);
          return { ok: true, traded: false };
        }
        if (forceEntry || bestScore >= 16) {
          const res = await executeLiveOrder(
            chosenSide,
            bestPair.symbol,
            chosenSide === 'SELL' ? '⚡ AI_FUTURES_SHORT_BOT' : '🚀 AI_AUTONOMOUS_ENTRY_BOT',
            { customInr: orderInrAmount }
          );
          return { ok: Boolean(res), traded: Boolean(res), order: res };
        }
        setSmartStatus(`🔍 Scanner Bot: Watching ${bestPair.symbol} (RSI ${bestPair.rsi}) — best entry ka wait…`);
        return { ok: true, traded: false };
      }

      // Server auto-tick fallback
      setOrderBusy(true);
      try {
        const res = await hubFetch('/api/coindcx/smart-tick', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            apiKey,
            apiSecret,
            tradeInr: orderInrAmount,
            forceEntry,
            entries: activeTargetsRef.current,
          }),
        });
        const j = await res.json();
        setSmartStatus(`🤖 ${j?.reason || j?.error || 'Live market scanned'}`);
        await syncLiveAccount();
        return j;
      } catch (e: any) {
        return { ok: false, error: e?.message };
      } finally {
        setOrderBusy(false);
      }
    },
    [orderBusy, userId, allowedCoinsFilter, walletType, orderInrAmount, targetProfitPct, executeLiveOrder, syncLiveAccount]
  );


  /**
   * 🛰️ JARVIS RESEARCH CYCLE — sub-bots bahar jaake LIVE research karte hain
   * (crypto headlines + CoinDCX technicals), 👑 Head Bot khud symbol / side /
   * quantity decide karta hai aur order seedha chala deta hai — Boss se poochhe bina.
   * Sirf safety caps ke andar: ₹/trade, open positions, din ke trades, confidence floor.
   */
  const runResearchTradeCycle = useCallback(
    async (reason = 'manual'): Promise<{ traded: boolean; note: string }> => {
      const gate = canTradeMore();
      if (!gate.ok) return { traded: false, note: `⏸️ ${gate.reason}` };
      if (orderBusy) return { traded: false, note: '⏳ Ek order already chal raha hai — next cycle me dekh lena' };

      const jstate = loadJarvisState();
      const acct = liveAccountRef.current;
      const snapshots = pairsRef.current
        .filter((p) => p.price > 0 && !p.symbol.startsWith('PAXG'))
        .slice(0, 8)
        .map((p) => ({
          symbol: p.symbol,
          price: Math.round(p.price * 100) / 100,
          change24h: Math.round((p.change24h || 0) * 100) / 100,
          rsi: Math.round(p.rsi || 50),
          macd: p.macd,
          rangePct: p.high24h > 0 ? Math.round(((p.high24h - p.low24h) / p.high24h) * 1000) / 10 : 0,
        }));
      if (!snapshots.length) return { traded: false, note: '⚠️ Live prices nahi mile (network check karein)' };

      const futInr = acct.futuresInr + acct.futuresUsdt * (acct.usdtInr || 88);
      const spotInr = acct.spotInr + acct.spotUsdt * (acct.usdtInr || 88);
      const usableInr =
        walletType === 'futures' ? futInr : walletType === 'spot' ? spotInr : Math.max(futInr, spotInr);

      setSmartStatus(`🛰️ Jarvis: ${snapshots.length} coins par live news + technical research ho raha hai…`);

      try {
        const res = await hubFetch('/api/coindcx/research-plan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            snapshots,
            walletType,
            leverage,
            trigger: reason,
            limits: {
              maxInrPerTrade: jstate.limits.maxInrPerTrade,
              maxOpenPositions: jstate.limits.maxOpenPositions,
              maxTradesPerDay: jstate.limits.maxTradesPerDay,
              dailyLossCapInr: effectiveLossCapInr(usableInr > 0 ? usableInr : 0),
              snapshotPrices: snapshots.reduce((acc: Record<string, number>, x) => {
                acc[x.symbol] = x.price;
                return acc;
              }, {} as Record<string, number>),
            },
          }),
        });
        const rawTxt = await res.text().catch(() => '');
        let j: any = {};
        try {
          j = JSON.parse(rawTxt);
        } catch {
          j = null;
        }
        if (!j || !res.ok || !Array.isArray(j?.plan) || !j.plan.length) {
          const why = j ? String(j?.error || `HTTP ${res.status}`).slice(0, 90) : 'worker par /api/coindcx/research-plan abhi deploy nahi hua — `npx wrangler deploy` chalao';
          const note = `🛰️ Research plan empty — ${why}`;
          setSmartStatus(note);
          jarvisLog(note, 'warn');
          return { traded: false, note };
        }

        const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false });
        const plan: any[] = j.plan;
        setAnalysisFeed((feed) => [
          ...plan.slice(0, 3).map((x, i): AutoAnalysisItem => ({
            id: `research-${Date.now()}-${i}`,
            time: nowStr,
            pair: String(x.symbol),
            analysis: `🛰️ Head Bot Research: ${x.side} ${x.symbol} · conf ${x.confidence}% · size ${x.sizePct}% · ${x.reason}`,
            signal: x.side === 'SELL' || x.side === 'SHORT' ? 'SELL_SIGNAL' : x.side === 'NONE' ? 'HOLD' : 'BUY_SIGNAL',
            confidence: Number(x.confidence) || 0,
            timestamp: Date.now(),
          })),
          ...feed,
        ].slice(0, 40));
        saveJarvisState({ lastPlanSummary: String(j.summary || '').slice(0, 400) });
        jarvisLog(`🛰️ ${String(j.summary || 'Research cycle done').slice(0, 220)}`, 'ok');

        const best = plan
          .filter((x) => ['LONG', 'SHORT', 'BUY', 'SELL'].includes(String(x.side).toUpperCase()))
          .sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))[0];

        if (!best) {
          const note = `🧠 Head Bot ne entry NAHI li — sabse achha confidence ${Math.max(
            ...plan.map((x) => Number(x.confidence || 0))
          )}% < ${jstate.limits.minConfidence}% floor. ${String(j.veto || '').slice(0, 90)}`;
          setSmartStatus(note);
          return { traded: false, note };
        }
        if (Number(best.confidence || 0) < jstate.limits.minConfidence) {
          const note = `🧠 ${best.symbol} ${best.side} signal aaya par confidence ${best.confidence}% floor se kam — skip (paisa risk nahi)`;
          setSmartStatus(note);
          return { traded: false, note };
        }

        const side: 'BUY' | 'SELL' = best.side === 'SELL' || best.side === 'SHORT' ? 'SELL' : 'BUY';
        const openCount = positionsRef.current.length;
        if (side === 'BUY' && openCount >= jstate.limits.maxOpenPositions) {
          const note = `🛡️ Risk Bot: ${openCount} positions already open (cap ${jstate.limits.maxOpenPositions}) — naya BUY skip, exit allowed`;
          setSmartStatus(note);
          return { traded: false, note };
        }

        // 🛡️ v6.6.0 GUARD 1 — SLIPPAGE / SPREAD: research ke baad price tezi se hila toh entry NAHI
        const liveSym = String(best.symbol).toUpperCase();
        const livePair = pairsRef.current.find(
          (x) => x.symbol.toUpperCase().replace('/', '') === liveSym.replace('/', '') || x.symbol.toUpperCase() === liveSym
        );
        const snapPrice = Number(snapshots.find((x) => x.symbol.toUpperCase().includes(liveSym.split('/')[0]))?.price || 0);
        const slipPct = livePair && snapPrice > 0 ? Math.abs(livePair.price - snapPrice) / snapPrice : 0;
        if (slipPct > (jstate.limits.maxSlipPct || 0.9) / 100) {
          const note = `🛡️ Slippage Guard: ${best.symbol} research ke baad ${(slipPct * 100).toFixed(2)}% hil gaya (cap ${(jstate.limits.maxSlipPct || 0.9).toFixed(2)}%) — entry skip`;
          setSmartStatus(note);
          jarvisLog(note, 'warn');
          return { traded: false, note };
        }

        // 🛡️ v6.6.0 GUARD 2 — FAKE/THIN NEWS: news backing na ho aur RSI extreme na ho toh skip
        const rsiNow = Number(livePair?.rsi || 50);
        const extremeRsi = rsiNow <= 32 || rsiNow >= 74;
        const newsOk = Boolean(best.newsBacked) && Array.isArray(j.headlines) && j.headlines.length > 0;
        if ((jstate.limits.requireNewsOrExtremeRsi ?? true) && !newsOk && !extremeRsi) {
          const note = `🛡️ News Guard: ${best.symbol} ${best.side} par koi solid live headline nahi (RSI ${Math.round(rsiNow)}) — fake-pump risk, entry skip`;
          setSmartStatus(note);
          jarvisLog(note, 'warn');
          return { traded: false, note };
        }

        // 🛡️ v6.6.0 GUARD 3 — DAILY LOSS CAP (wallet ke % se auto-tight) → loss me ho toh naya trade NAHI
        const openPnlInr = positionsRef.current.reduce((a, x) => a + (Number(x.pnl) || 0), 0);
        const lossCap = effectiveLossCapInr(usableInr > 0 ? usableInr : 0);
        if (openPnlInr <= -lossCap) {
          const note = `🛡️ Loss Cap: open PnL ₹${openPnlInr.toFixed(0)} ≤ -₹${lossCap.toFixed(0)} (cap) — aaj ke liye naye entry band, sirf exit`;
          setSmartStatus(note);
          jarvisLog(note, 'warn');
          return { traded: false, note };
        }

        const pctSize = Math.round((usableInr > 0 ? usableInr : jstate.limits.maxInrPerTrade) * (Number(best.sizePct) || 25) / 100);
        const inr = Math.max(60, Math.min(jstate.limits.maxInrPerTrade, pctSize > 0 ? pctSize : jstate.limits.maxInrPerTrade));

        const cleanSym = String(best.symbol).toUpperCase().replace('/', '').includes('INR') || String(best.symbol).toUpperCase().includes('USDT')
          ? String(best.symbol).toUpperCase()
          : `${String(best.symbol).toUpperCase().split('/')[0]}/INR`;

        const exec = await executeLiveOrder(side, cleanSym, `🛰️ RESEARCH_${best.side}`, { customInr: inr });
        if (exec) {
          bumpTradesToday(1);
          const entry = Number(exec?.price) || 0;
          const tpPct = Math.max(0.2, Math.min(50, Number(best.tpPct) || targetProfitPct));
          const slPct = Math.max(0.2, Math.min(50, Number(best.slPct) || stopLossPct));
          if (entry > 0) {
            const dir = side === 'BUY' ? 1 : -1;
            saveTargetPlan(
              cleanSym,
              entry,
              Math.round(entry * (1 + (dir * tpPct) / 100) * 100) / 100,
              Math.round(entry * (1 - (dir * slPct) / 100) * 100) / 100,
              Number(exec?.quantity) || 0,
              'JARVIS_RESEARCH'
            );
          }
          const note = `🚀 Head Bot ne KHUD liya: ${best.side} ${cleanSym} ₹${inr} (size ${best.sizePct}% · ${best.leverage}x · TP +${tpPct}% / SL -${slPct}%) — ${String(best.reason || '').slice(0, 120)}`;
          setSmartStatus(note);
          jarvisLog(note, 'ok');
          return { traded: true, note };
        }
        return { traded: false, note: '⚠️ Order execute nahi hua (busy ya API error) — positions/TP-SL log check karein' };
      } catch (e: any) {
        const note = `⚠️ Research cycle error: ${String(e?.message || e).slice(0, 140)}`;
        setSmartStatus(note);
        jarvisLog(note, 'warn');
        return { traded: false, note };
      }
    },
    [orderBusy, userId, walletType, leverage, targetProfitPct, stopLossPct, executeLiveOrder, saveTargetPlan]
  );

  // 🛰️ Jarvis Core ko real executor de do + autonomous 12-min research cadence
  useEffect(() => {
    registerTradingExecutor((why: string) => runResearchTradeCycle(why));
  }, [runResearchTradeCycle]);

  useEffect(() => {
    if (!autoTrading) return;
    const t = window.setInterval(() => {
      void runResearchTradeCycle('auto_12min');
    }, 12 * 60 * 1000);
    return () => window.clearInterval(t);
  }, [autoTrading, runResearchTradeCycle]);

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
          setSmartStatus('🟢 Autonomous Team ON — Bina puche best Futures/Spot trade khud execute karega!');
          setTimeout(() => {
            runSmartTradeNow(true);
          }, 250);
        } else {
          setSmartStatus('⏹ Auto-Trading Paused by Boss — Open positions live sync जारी है');
        }
        return next;
      });
    },
    [orderInrAmount, runSmartTradeNow]
  );

  /**
   * 👑 HEAD BOT NATURAL VOICE / TEXT COMMAND PROCESSOR!
   * User talks to ONLY Head Bot — Head Bot immediately updates team rules & triggers sub-bots without asking permission!
   */
  const sendCommandToHeadBot = useCallback(
    async (rawText: string): Promise<string> => {
      const clean = rawText.trim();
      const low = clean.toLowerCase();
      setBossDirectiveState(clean);
      localStorage.setItem('apex_headbot_directive', clean);

      // Parse leverage if mentioned (e.g., "5x", "10x", "3x")
      const levMatch = low.match(/\b(\d{1,2})\s*x\b/);
      if (levMatch) {
        setLeverage(Number(levMatch[1]));
      }

      // Parse rupee amount if mentioned (e.g., "200 rupay", "₹300", "500 lagao")
      const amtMatch = low.match(/(?:₹|rs\.?\s*)(\d{2,6})|(\d{2,6})\s*(?:rupay|rupee|inr|ka\s+trade|lagao)/i);
      const parsedAmt = amtMatch ? Number(amtMatch[1] || amtMatch[2]) : null;
      if (parsedAmt && parsedAmt >= 60) {
        setOrderInrAmount(parsedAmt);
      }

      // Parse target % if mentioned (e.g., "2% profit", "1.5 percent")
      const pctMatch = low.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)/);
      if (pctMatch) {
        const pv = parseFloat(pctMatch[1]);
        if (pv >= 0.2 && pv <= 50) {
          setTargetProfitPct(pv);
          localStorage.setItem('apex_tp_pct', String(pv));
        }
      }

      // Coin filter check
      const coinsFound = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'].filter((c) =>
        new RegExp(`\\b${c}\\b`, 'i').test(clean)
      );
      if (/\bsirf\b|\bonly\b/i.test(low) && coinsFound.length > 0) {
        setAllowedCoinsFilter(coinsFound);
      } else if (/\bsab\s*coin|\ball\s*coins?/i.test(low)) {
        setAllowedCoinsFilter([]);
      }

      // Stop / Hold rule
      if (/\b(stop|band\s*karo|mat\s*karo|hold|pause|ruk\s*jao)\b/i.test(low)) {
        setAutoTrading(false);
        return 'Ji Boss! Maine saare trading bots ko HOLD mode par daal diya hai. Naya buy nahi hoga, sirf aapke positions live dikhenge.';
      }

      // Close / Exit all open positions
      if (/\b(close\s*all|exit\s*all|sab\s*(?:bech|sell|exit|close)|position\s*(?:close|exit|kat))\b/i.test(low)) {
        if (positionsRef.current.length === 0) {
          await syncLiveAccount();
        }
        for (const p of positionsRef.current) {
          await closePositionNow(p, '👑 HEAD_BOT_EXIT');
        }
        return 'Ji Boss! Open positions exit order bhej diya gaya hai aur live wallet sync kar liya hai.';
      }

      // Wallet preference switching: Futures vs Spot vs Smart Auto!
      if (/\b(future|futures|chashme)\b/i.test(low) && !/\bspot\b/i.test(low)) {
        setWalletType('futures');
        const useLev = levMatch ? Number(levMatch[1]) : leverage;
        if (/\b(buy|long|trade|shuru|start|chalu|lagao)\b/i.test(low)) {
          const targetSym = coinsFound[0] ? `${coinsFound[0]}/USDT` : 'SOL/USDT';
          setAutoTradingState(true);
          localStorage.setItem('apex_auto_trading', '1');
          executeLiveOrder('BUY', targetSym, '👑 HEAD_BOT_FUTURES', { customInr: parsedAmt || orderInrAmount });
          return `Samajh gaya Boss! Maine Futures Bot ko ${useLev}x leverage par laga diya hai aur ${targetSym} me direct Futures trade chalu kar diya hai — bina aapse baar-baar puche!`;
        }
        return `Samajh gaya Boss! Ab team sirf CoinDCX FUTURES (${useLev}x) me hi trade karegi aur har position yahan live dikhayegi.`;
      }

      if (/\bspot\b/i.test(low) && !/\bfuture/i.test(low)) {
        setWalletType('spot');
        return 'Theek hai Boss! Ab team CoinDCX SPOT wallet me safe coin buy aur profit sell karegi.';
      }

      if (/\b(smart|dono|achha|acha|best|khud\s*dekh)\b/i.test(low)) {
        setWalletType('auto');
        setAutoTrading(true);
        return 'Bilkul Boss! Smart Autonomous Mode chalu hai — mere 4 bots Futures aur Spot dono live check karke jisme sabse accha setup hoga usme khud buy aur profit par khud sell karenge!';
      }

      // Direct immediate BUY / SHORT / SELL order told to Head Bot
      if (/\b(short|sell|bech)\b/i.test(low) && coinsFound.length > 0) {
        const sym = `${coinsFound[0]}/USDT`;
        executeLiveOrder('SELL', sym, '👑 HEAD_BOT_DIRECT');
        return `Ji Boss! ${sym} par turant SELL / SHORT order bhej diya hai!`;
      }
      if (/\b(buy|long|kharid)\b/i.test(low)) {
        const sym = coinsFound[0] ? `${coinsFound[0]}/USDT` : pairsRef.current[selectedPairIndex]?.symbol || 'SOL/USDT';
        executeLiveOrder('BUY', sym, '👑 HEAD_BOT_DIRECT', { customInr: parsedAmt || orderInrAmount });
        return `Ji Boss! ${sym} par ₹${parsedAmt || orderInrAmount} ka direct order execute kar diya hai!`;
      }

      // Live portfolio & position status report
      if (/\b(position|balance|wallet|kya\s*hai|kitna|status|hisab|profit)\b/i.test(low)) {
        await syncLiveAccount();
        const a = liveAccountRef.current;
        const posCount = positionsRef.current.length;
        return `Boss, aapka Total CoinDCX Portfolio ₹${a.totalInr.toFixed(2)} hai — Spot me ₹${a.spotInr.toFixed(2)}, Futures me ₹${(a.futuresInr + a.futuresUsdt * a.usdtInr).toFixed(2)}, aur abhi ${posCount} active position chalu hai.`;
      }

      // Default: turn Auto-Trade ON with Boss's updated rule!
      setAutoTrading(true);
      return `Hukm mil gaya Boss! Maine aapka rule save kar liya hai aur charon trading bots ko kaam par laga diya hai — woh khud best Futures ya Spot setup dekh kar buy-sell karenge!`;
    },
    [
      leverage,
      orderInrAmount,
      selectedPairIndex,
      setLeverage,
      setOrderInrAmount,
      setWalletType,
      setAutoTrading,
      executeLiveOrder,
      closePositionNow,
      syncLiveAccount,
    ]
  );

  // Sync tickers every 3.5s & sync real CoinDCX account/positions every 4.5s so manual CoinDCX App trades appear LIVE immediately!
  useEffect(() => {
    if (!enabled) return;
    syncLiveTickers();
    syncLiveAccount();
    const tInt = setInterval(syncLiveTickers, 3500);
    const bInt = setInterval(() => syncLiveAccount(), 4500);
    return () => {
      clearInterval(tInt);
      clearInterval(bInt);
    };
  }, [enabled, syncLiveTickers, syncLiveAccount]);

  // Continuous Autonomous Trading Loop (Every 35s checks setups & executes WITHOUT asking permission!)
  useEffect(() => {
    if (!enabled || !autoTrading) return;
    const autoTimer = setInterval(() => {
      runSmartTradeNow(false);
    }, 35000);
    return () => clearInterval(autoTimer);
  }, [enabled, autoTrading, runSmartTradeNow]);

  const manualBuy = useCallback(
    (symbol: string, opts?: BuyWithTargetOptions) =>
      executeLiveOrder('BUY', symbol, opts?.source || '⚡ DIRECT_LIVE_ORDER', opts),
    [executeLiveOrder]
  );
  const manualSell = useCallback(
    (symbol: string) => executeLiveOrder('SELL', symbol, '⚡ DIRECT_LIVE_SELL'),
    [executeLiveOrder]
  );

  const botTeamRoles: SpecialistBotStatus[] = [
    {
      id: 'scanner',
      icon: '🔍',
      name: 'Bot #1 · Market & RSI Scanner',
      role: 'BTC, ETH, SOL, XRP live 3.5s RSI & breakout scan',
      liveAction: pairs[0]?.price
        ? `BTC ₹${pairs[0].price.toLocaleString('en-IN')} (RSI ${pairs[0].rsi}) · SOL RSI ${pairs[2]?.rsi ?? 50}`
        : 'Scanning CoinDCX live pairs…',
      active: enabled,
    },
    {
      id: 'selector',
      icon: '⚡',
      name: 'Bot #2 · Smart Futures vs Spot Brain',
      role: 'Khud decide karta hai Futures (LONG/SHORT) best hai ya Spot',
      liveAction:
        walletType === 'futures'
          ? `Locked on FUTURES (${leverage}x Leverage · INR/USDT Margin)`
          : walletType === 'spot'
          ? 'Locked on SPOT Coin Accumulation (0% Liquidation)'
          : `AUTO SMART (${leverage}x Futures + Spot — best opportunity mode)`,
      active: enabled,
    },
    {
      id: 'executor',
      icon: '🚀',
      name: 'Bot #3 · Autonomous Order Executor',
      role: 'Bina permission maange khud BUY / LONG / SHORT / SELL karta hai',
      liveAction: autoTrading
        ? `🟢 24×7 Autonomous ON (₹${orderInrAmount}/trade · No Confirmation Delay)`
        : 'Standby — Start Auto-Trade ya Head Bot ko bolte hi active',
      active: autoTrading,
    },
    {
      id: 'sync_guard',
      icon: '🛡️',
      name: 'Bot #4 · CoinDCX App Live Sync & TP/SL',
      role: 'CoinDCX App ke manual Futures/Spot trades har 4s me live sync + Auto TP/SL',
      liveAction: `${positions.length} Live Position Synced · Auto TP +${targetProfitPct}% / SL -${stopLossPct}%`,
      active: enabled,
    },
  ];

  return {
    pairs,
    selectedPairIndex,
    setSelectedPairIndex,
    activePair: pairs[selectedPairIndex] || pairs[0],
    autoTrading,
    setAutoTrading,
    bossDirective,
    sendCommandToHeadBot,
    botTeamRoles,
    closePositionNow,
    targetProfitPct,
    setTargetProfitPct,
    stopLossPct,
    setStopLossPct,
    smartStatus,
    runSmartTradeNow,
    runResearchTradeCycle,
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
    activeTargets,
    saveTargetPlan,
    clearTargetPlan,
  };
}
