import { useState, useEffect, useRef, useCallback } from 'react';
import { MarketPairData, TradingPosition, TradeOrderLog, ChartTradeMarker, AutoAnalysisItem, MoodType } from '../types';

const INITIAL_PAIRS: MarketPairData[] = [
  {
    symbol: 'BTC/USDT',
    name: 'Bitcoin',
    price: 94250.0,
    change24h: 4.82,
    high24h: 95800,
    low24h: 89800,
    rsi: 68.4,
    macd: 'BULLISH',
    history: [91200, 91600, 92100, 92400, 91900, 92700, 93100, 93500, 93200, 93800, 94100, 94250],
    markers: [
      {
        id: 'init-m1',
        index: 2,
        price: 92100,
        type: 'BUY',
        time: '14:15:00',
        label: 'BUY $92.1k',
      },
      {
        id: 'init-m2',
        index: 7,
        price: 93500,
        type: 'SELL',
        time: '14:40:00',
        profit: 210,
        label: 'SELL +$210',
      },
    ],
  },
  {
    symbol: 'ETH/USDT',
    name: 'Ethereum',
    price: 3480.5,
    change24h: 6.15,
    high24h: 3560,
    low24h: 3260,
    rsi: 72.1,
    macd: 'BULLISH',
    history: [3280, 3310, 3340, 3320, 3370, 3390, 3420, 3400, 3440, 3460, 3450, 3480.5],
    markers: [
      {
        id: 'init-m3',
        index: 3,
        price: 3320,
        type: 'BUY',
        time: '14:20:00',
        label: 'BUY $3,320',
      },
      {
        id: 'init-m4',
        index: 9,
        price: 3460,
        type: 'SELL',
        time: '14:52:00',
        profit: 350,
        label: 'SELL +$350',
      },
    ],
  },
  {
    symbol: 'SOL/USDT',
    name: 'Solana',
    price: 218.4,
    change24h: 11.4,
    high24h: 226,
    low24h: 195,
    rsi: 77.8,
    macd: 'BULLISH',
    history: [196, 200, 204, 202, 208, 211, 209, 214, 216, 215, 217, 218.4],
    markers: [
      {
        id: 'init-m5',
        index: 1,
        price: 200,
        type: 'BUY',
        time: '14:05:00',
        label: 'BUY $200',
      },
      {
        id: 'init-m6',
        index: 8,
        price: 216,
        type: 'SELL',
        time: '14:48:00',
        profit: 400,
        label: 'SELL +$400',
      },
    ],
  },
  {
    symbol: 'APEX/USDT',
    name: 'Apex AI Token',
    price: 18.65,
    change24h: 24.3,
    high24h: 20.2,
    low24h: 14.8,
    rsi: 81.2,
    macd: 'BULLISH',
    history: [15.2, 15.8, 16.2, 15.9, 16.7, 17.2, 17.0, 17.8, 18.1, 18.0, 18.4, 18.65],
    markers: [
      {
        id: 'init-m7',
        index: 0,
        price: 15.2,
        type: 'BUY',
        time: '13:50:00',
        label: 'BUY $15.2',
      },
      {
        id: 'init-m8',
        index: 7,
        price: 17.8,
        type: 'SELL',
        time: '14:42:00',
        profit: 520,
        label: 'SELL +$520',
      },
    ],
  },
];

interface UseAutoTraderProps {
  currentMood: MoodType;
  currentHeartRate: number;
  onTriggerSentimentTrade?: (mood: MoodType, msg: string) => void;
  onTradeBurst?: (type: 'BUY' | 'SELL', details: { pair: string; price: number; profit?: number }) => void;
}

export const GEO_HUBS = [
  { city: 'Mumbai', country: 'India', lat: 19.0760, lng: 72.8777, label: 'CoinDCX Node (IN)' },
  { city: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198, label: 'Binance SG Hub' },
  { city: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503, label: 'BitFlyer Node (JP)' },
  { city: 'London', country: 'UK', lat: 51.5074, lng: -0.1278, label: 'LMAX Hub (UK)' },
  { city: 'New York', country: 'USA', lat: 40.7128, lng: -74.0060, label: 'Gemini NY Node' },
  { city: 'Dubai', country: 'UAE', lat: 25.2048, lng: 55.2708, label: 'Bybit MENA Hub' },
  { city: 'Frankfurt', country: 'Germany', lat: 50.1109, lng: 8.6821, label: 'Eurex Node (DE)' },
  { city: 'Zurich', country: 'Switzerland', lat: 47.3769, lng: 8.5417, label: 'Crypto Valley (CH)' },
];

export function useAutoTrader({
  currentMood,
  currentHeartRate,
  onTriggerSentimentTrade,
  onTradeBurst,
}: UseAutoTraderProps) {
  const [pairs, setPairs] = useState<MarketPairData[]>(INITIAL_PAIRS);
  const [selectedPairIndex, setSelectedPairIndex] = useState(0);
  const [autoTrading, setAutoTrading] = useState(true);
  const [balance, setBalance] = useState(28450.0);
  const [strategy, setStrategy] = useState<'SENTIMENT_ALPHA' | 'TREND_MOMENTUM' | 'GRID_SCALPER'>('SENTIMENT_ALPHA');

  const [positions, setPositions] = useState<TradingPosition[]>([
    {
      id: 'pos-1',
      pair: 'BTC/USDT',
      type: 'LONG',
      entryPrice: 93200,
      currentPrice: 94250,
      amount: 0.18,
      pnl: 189.0,
      pnlPercent: 1.13,
      timestamp: Date.now() - 1800000,
      status: 'OPEN',
    },
    {
      id: 'pos-2',
      pair: 'SOL/USDT',
      type: 'LONG',
      entryPrice: 209.5,
      currentPrice: 218.4,
      amount: 25,
      pnl: 222.5,
      pnlPercent: 4.25,
      timestamp: Date.now() - 900000,
      status: 'OPEN',
    },
  ]);

  const [tradeLogs, setTradeLogs] = useState<TradeOrderLog[]>([
    {
      id: 'log-1',
      time: '15:10:04',
      pair: 'BTC/USDT',
      type: 'BUY',
      price: 93200,
      amount: 0.18,
      reason: 'Auto-Analysis: EMA 20/50 Golden Cross + Apex Excitement spike',
      sentimentTrigger: 'EXCITED (92%)',
      geo: GEO_HUBS[0],
    },
    {
      id: 'log-2',
      time: '15:16:20',
      pair: 'SOL/USDT',
      type: 'BUY',
      price: 209.5,
      amount: 25,
      reason: 'Auto-Analysis: RSI 34.2 Oversold Bounce on 5m chart',
      sentimentTrigger: 'HAPPY (88%)',
      geo: GEO_HUBS[1],
    },
    {
      id: 'log-3',
      time: '15:22:45',
      pair: 'ETH/USDT',
      type: 'TAKE_PROFIT',
      price: 3480,
      amount: 2.0,
      profit: 320.0,
      reason: 'Auto-Analysis: Profit Target 2 reached (+5.8%)',
      sentimentTrigger: 'EUPHORIC (96%)',
      geo: GEO_HUBS[3],
    },
  ]);

  const [analysisFeed, setAnalysisFeed] = useState<AutoAnalysisItem[]>([
    {
      id: 'ana-1',
      time: '15:24:10',
      pair: 'BTC/USDT',
      analysis: 'Autonomous Scan: Consolidation near $94.2k ATH. Orderbook bid depth +14%. Bullish bias maintained.',
      signal: 'HOLD',
      confidence: 88,
    },
    {
      id: 'ana-2',
      time: '15:24:45',
      pair: 'SOL/USDT',
      analysis: 'Autonomous Scan: Volume surge +18%. RSI 77 approaching take-profit zone. Trailing stop armed at $214.',
      signal: 'PROFIT_TAKE',
      confidence: 94,
    },
  ]);

  // Keep refs for callbacks & intervals
  const pairsRef = useRef(pairs);
  pairsRef.current = pairs;
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const moodRef = useRef(currentMood);
  moodRef.current = currentMood;
  const heartRateRef = useRef(currentHeartRate);
  heartRateRef.current = currentHeartRate;
  const onTradeBurstRef = useRef(onTradeBurst);
  onTradeBurstRef.current = onTradeBurst;
  const onTriggerSentimentTradeRef = useRef(onTriggerSentimentTrade);
  onTriggerSentimentTradeRef.current = onTriggerSentimentTrade;

  // Real-time market price ticker (runs continuously in background)
  useEffect(() => {
    const interval = setInterval(() => {
      setPairs((prev) =>
        prev.map((p) => {
          // Micro price variation
          const moodFactor = moodRef.current === 'excited' || moodRef.current === 'happy' ? 0.08 : 0.0;
          const deltaPct = (Math.random() - 0.47 + moodFactor) * 0.42;
          const newPrice = Math.max(1, p.price * (1 + deltaPct / 100));
          const roundedPrice =
            p.symbol === 'APEX/USDT' ? parseFloat(newPrice.toFixed(3)) : parseFloat(newPrice.toFixed(1));

          // Keep up to 20 historical points for chart
          const updatedHistory = [...p.history.slice(-19), roundedPrice];

          // Calculate dynamic RSI
          const newRsi = Math.min(95, Math.max(15, parseFloat((p.rsi + (deltaPct > 0 ? 0.6 : -0.6)).toFixed(1))));

          return {
            ...p,
            price: roundedPrice,
            change24h: parseFloat((p.change24h + deltaPct * 0.1).toFixed(2)),
            high24h: Math.max(p.high24h, roundedPrice),
            low24h: Math.min(p.low24h, roundedPrice),
            rsi: newRsi,
            macd: newRsi > 55 ? 'BULLISH' : newRsi < 45 ? 'BEARISH' : 'NEUTRAL',
            history: updatedHistory,
          };
        })
      );

      // Re-evaluate positions PnL
      setPositions((prev) =>
        prev.map((pos) => {
          const pairData = pairsRef.current.find((p) => p.symbol === pos.pair);
          if (!pairData) return pos;
          const curr = pairData.price;
          const diff = pos.type === 'LONG' ? curr - pos.entryPrice : pos.entryPrice - curr;
          const pnl = diff * pos.amount;
          const pnlPercent = (diff / pos.entryPrice) * 100;
          return {
            ...pos,
            currentPrice: curr,
            pnl: parseFloat(pnl.toFixed(2)),
            pnlPercent: parseFloat(pnlPercent.toFixed(2)),
          };
        })
      );
    }, 2200);

    return () => clearInterval(interval);
  }, []);

  // Autonomous Trading & Market Analysis Engine (Runs in background!)
  useEffect(() => {
    if (!autoTrading) return;

    const botInterval = setInterval(() => {
      const currentPairs = pairsRef.current;
      const targetPair = currentPairs[Math.floor(Math.random() * currentPairs.length)];
      const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false });
      const currentPositions = positionsRef.current;

      // Decide trade action: BUY (open long) or SELL / TAKE_PROFIT (close position)
      const hasOpenPositionForPair = currentPositions.some((p) => p.pair === targetPair.symbol);
      const shouldTakeProfit = hasOpenPositionForPair && Math.random() > 0.4;
      const shouldBuy = !hasOpenPositionForPair || Math.random() > 0.55;

      if (shouldTakeProfit) {
        // Execute Fake SELL / Take-Profit
        const posToClose = currentPositions.find((p) => p.pair === targetPair.symbol);
        if (posToClose) {
          const realizedProfit = Math.max(85, parseFloat((posToClose.pnl > 0 ? posToClose.pnl : 120 + Math.random() * 240).toFixed(2)));
          setBalance((b) => parseFloat((b + realizedProfit).toFixed(2)));

          // Remove position
          setPositions((prev) => prev.filter((p) => p.id !== posToClose.id));

          // Log SELL trade
          const sellLog: TradeOrderLog = {
            id: `log-${Date.now()}`,
            time: nowStr,
            pair: targetPair.symbol,
            type: 'TAKE_PROFIT',
            price: targetPair.price,
            amount: posToClose.amount,
            profit: realizedProfit,
            reason: `Auto-Analysis: Target reached at $${targetPair.price} (+${posToClose.pnlPercent}%). Fake SELL marked.`,
            sentimentTrigger: `${moodRef.current.toUpperCase()} (${heartRateRef.current} BPM)`,
          };
          setTradeLogs((logs) => [sellLog, ...logs.slice(0, 9)]);

          // Add Fake SELL Marker to targetPair chart history
          const newMarker: ChartTradeMarker = {
            id: `marker-${Date.now()}`,
            index: targetPair.history.length - 1,
            price: targetPair.price,
            type: 'SELL',
            time: nowStr,
            profit: realizedProfit,
            label: `SELL +$${Math.round(realizedProfit)}`,
          };

          setPairs((prev) =>
            prev.map((p) =>
              p.symbol === targetPair.symbol
                ? { ...p, markers: [...(p.markers || []).slice(-6), newMarker] }
                : p
            )
          );

          // Add to Auto-Analysis Feed
          const analysisItem: AutoAnalysisItem = {
            id: `ana-${Date.now()}`,
            time: nowStr,
            pair: targetPair.symbol,
            analysis: `Auto-Analysis: Take-profit target achieved. Fake SELL marked at $${targetPair.price}. Realized +$${realizedProfit}.`,
            signal: 'PROFIT_TAKE',
            confidence: 96,
          };
          setAnalysisFeed((feed) => [analysisItem, ...feed.slice(0, 6)]);

          onTradeBurstRef.current?.('SELL', { pair: targetPair.symbol, price: targetPair.price, profit: realizedProfit });
          onTriggerSentimentTradeRef.current?.('happy', `Auto-Trader: Fake SELL on ${targetPair.symbol} took profit +$${Math.round(realizedProfit)}!`);
        }
      } else if (shouldBuy && currentPositions.length < 5) {
        // Execute Fake BUY
        const amount = targetPair.symbol.startsWith('BTC')
          ? 0.12
          : targetPair.symbol.startsWith('ETH')
          ? 1.5
          : targetPair.symbol.startsWith('SOL')
          ? 18
          : 120;

        const newPos: TradingPosition = {
          id: `pos-${Date.now()}`,
          pair: targetPair.symbol,
          type: 'LONG',
          entryPrice: targetPair.price,
          currentPrice: targetPair.price,
          amount,
          pnl: 0,
          pnlPercent: 0,
          timestamp: Date.now(),
          status: 'OPEN',
        };

        setPositions((prev) => [newPos, ...prev]);

        // Log BUY trade
        const buyLog: TradeOrderLog = {
          id: `log-${Date.now()}`,
          time: nowStr,
          pair: targetPair.symbol,
          type: 'BUY',
          price: targetPair.price,
          amount,
          reason: `Auto-Analysis: RSI oversold crossover (${targetPair.rsi}) + Bullish MACD. Fake BUY marked.`,
          sentimentTrigger: `${moodRef.current.toUpperCase()} (${heartRateRef.current} BPM)`,
        };
        setTradeLogs((logs) => [buyLog, ...logs.slice(0, 9)]);

        // Add Fake BUY Marker to targetPair chart history
        const newMarker: ChartTradeMarker = {
          id: `marker-${Date.now()}`,
          index: targetPair.history.length - 1,
          price: targetPair.price,
          type: 'BUY',
          time: nowStr,
          label: `BUY $${targetPair.symbol.startsWith('APEX') ? targetPair.price : Math.round(targetPair.price)}`,
        };

        setPairs((prev) =>
          prev.map((p) =>
            p.symbol === targetPair.symbol
              ? { ...p, markers: [...(p.markers || []).slice(-6), newMarker] }
              : p
          )
        );

        // Add to Auto-Analysis Feed
        const analysisItem: AutoAnalysisItem = {
          id: `ana-${Date.now()}`,
          time: nowStr,
          pair: targetPair.symbol,
          analysis: `Auto-Analysis: Algorithmic entry triggered on ${targetPair.symbol}. Fake BUY marked at $${targetPair.price}. Stop-Loss armed.`,
          signal: 'BUY_SIGNAL',
          confidence: 91,
        };
        setAnalysisFeed((feed) => [analysisItem, ...feed.slice(0, 6)]);

        onTradeBurstRef.current?.('BUY', { pair: targetPair.symbol, price: targetPair.price });
        onTriggerSentimentTradeRef.current?.('excited', `Auto-Trader: Fake BUY executed on ${targetPair.symbol} at $${targetPair.price}!`);
      } else {
        // Just an analysis pulse
        const analysisItem: AutoAnalysisItem = {
          id: `ana-${Date.now()}`,
          time: nowStr,
          pair: targetPair.symbol,
          analysis: `Auto-Analysis: ${targetPair.symbol} trading at $${targetPair.price}. RSI ${targetPair.rsi} in nominal band. Monitoring liquidity.`,
          signal: 'HOLD',
          confidence: 84,
        };
        setAnalysisFeed((feed) => [analysisItem, ...feed.slice(0, 6)]);
      }
    }, 7500);

    return () => clearInterval(botInterval);
  }, [autoTrading, onTriggerSentimentTrade]);

  // Manual Trigger: Force Fake BUY
  const manualBuy = useCallback(
    (symbol: string) => {
      const targetPair = pairsRef.current.find((p) => p.symbol === symbol) || pairsRef.current[0];
      const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false });
      const amount = targetPair.symbol.startsWith('BTC') ? 0.1 : 1.0;

      const newPos: TradingPosition = {
        id: `pos-${Date.now()}`,
        pair: targetPair.symbol,
        type: 'LONG',
        entryPrice: targetPair.price,
        currentPrice: targetPair.price,
        amount,
        pnl: 0,
        pnlPercent: 0,
        timestamp: Date.now(),
        status: 'OPEN',
      };
      setPositions((prev) => [newPos, ...prev]);

      const log: TradeOrderLog = {
        id: `log-${Date.now()}`,
        time: nowStr,
        pair: targetPair.symbol,
        type: 'BUY',
        price: targetPair.price,
        amount,
        reason: 'Manual Trigger: Fake BUY order placed & marked on chart',
        sentimentTrigger: 'USER_SIGNAL',
      };
      setTradeLogs((prev) => [log, ...prev.slice(0, 9)]);

      const marker: ChartTradeMarker = {
        id: `marker-${Date.now()}`,
        index: targetPair.history.length - 1,
        price: targetPair.price,
        type: 'BUY',
        time: nowStr,
        label: `BUY $${targetPair.price}`,
      };
      setPairs((prev) =>
        prev.map((p) => (p.symbol === targetPair.symbol ? { ...p, markers: [...(p.markers || []), marker] } : p))
      );

      const ana: AutoAnalysisItem = {
        id: `ana-${Date.now()}`,
        time: nowStr,
        pair: targetPair.symbol,
        analysis: `Manual Fake BUY executed on ${targetPair.symbol} at $${targetPair.price}. Trade marker pinned to chart.`,
        signal: 'BUY_SIGNAL',
        confidence: 99,
      };
      setAnalysisFeed((prev) => [ana, ...prev.slice(0, 6)]);
      onTradeBurstRef.current?.('BUY', { pair: targetPair.symbol, price: targetPair.price });
    },
    []
  );

  // Manual Trigger: Force Fake SELL
  const manualSell = useCallback(
    (symbol: string) => {
      const targetPair = pairsRef.current.find((p) => p.symbol === symbol) || pairsRef.current[0];
      const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false });
      const existingPos = positionsRef.current.find((p) => p.pair === targetPair.symbol);
      const profit = existingPos ? Math.max(110, existingPos.pnl) : 185;

      if (existingPos) {
        setPositions((prev) => prev.filter((p) => p.id !== existingPos.id));
      }
      setBalance((b) => parseFloat((b + profit).toFixed(2)));

      const log: TradeOrderLog = {
        id: `log-${Date.now()}`,
        time: nowStr,
        pair: targetPair.symbol,
        type: 'TAKE_PROFIT',
        price: targetPair.price,
        amount: existingPos ? existingPos.amount : 1,
        profit,
        reason: 'Manual Trigger: Fake SELL / Take-Profit order executed',
        sentimentTrigger: 'USER_SIGNAL',
      };
      setTradeLogs((prev) => [log, ...prev.slice(0, 9)]);

      const marker: ChartTradeMarker = {
        id: `marker-${Date.now()}`,
        index: targetPair.history.length - 1,
        price: targetPair.price,
        type: 'SELL',
        time: nowStr,
        profit,
        label: `SELL +$${Math.round(profit)}`,
      };
      setPairs((prev) =>
        prev.map((p) => (p.symbol === targetPair.symbol ? { ...p, markers: [...(p.markers || []), marker] } : p))
      );

      const ana: AutoAnalysisItem = {
        id: `ana-${Date.now()}`,
        time: nowStr,
        pair: targetPair.symbol,
        analysis: `Manual Fake SELL executed on ${targetPair.symbol} at $${targetPair.price}. Profit +$${profit} secured.`,
        signal: 'PROFIT_TAKE',
        confidence: 99,
      };
      setAnalysisFeed((prev) => [ana, ...prev.slice(0, 6)]);
      onTradeBurstRef.current?.('SELL', { pair: targetPair.symbol, price: targetPair.price, profit });
    },
    []
  );

  return {
    pairs,
    selectedPairIndex,
    setSelectedPairIndex,
    activePair: pairs[selectedPairIndex],
    autoTrading,
    setAutoTrading,
    balance,
    positions,
    tradeLogs,
    analysisFeed,
    strategy,
    setStrategy,
    manualBuy,
    manualSell,
  };
}
