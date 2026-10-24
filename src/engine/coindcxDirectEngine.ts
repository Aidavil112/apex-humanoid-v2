// Direct Phone-to-CoinDCX Real Spot + Futures Engine (Native TLS 1.3 + WebCrypto HMAC-SHA256)
// Syncs ALL manual trades & open positions from Official CoinDCX Mobile App (Spot + Futures INR/USDT)
// AND executes real autonomous Futures (LONG / SHORT / EXIT) + Spot (BUY / SELL) trades with ZERO confirmation popups!

import { TradingPosition, TradeOrderLog } from '../types';
import { LiveHoldingItem } from '../hooks/useAutoTrader';

const FUTURES_STEP_SIZE: Record<string, { step: number; prec: number }> = {
  'B-BTC_USDT': { step: 0.001, prec: 3 },
  'B-ETH_USDT': { step: 0.01, prec: 2 },
  'B-SOL_USDT': { step: 0.1, prec: 1 },
  'B-XRP_USDT': { step: 1, prec: 0 },
  'B-DOGE_USDT': { step: 10, prec: 0 },
};

const SPOT_PRECISION: Record<string, { prec: number; minInr: number }> = {
  BTCINR: { prec: 5, minInr: 105 },
  ETHINR: { prec: 4, minInr: 105 },
  SOLINR: { prec: 3, minInr: 105 },
  XRPINR: { prec: 1, minInr: 105 },
  DOGEINR: { prec: 0, minInr: 105 },
  BTCUSDT: { prec: 5, minInr: 105 },
  ETHUSDT: { prec: 4, minInr: 105 },
  SOLUSDT: { prec: 3, minInr: 105 },
  XRPUSDT: { prec: 1, minInr: 105 },
};

async function webHmacHex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret.trim()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Calls CoinDCX API directly via Native Android TLS (supports GET-with-body for Futures Wallets!) or Web fetch */
export async function callCoinDcxDirect(
  method: 'GET' | 'POST',
  path: string,
  payload: Record<string, any>,
  apiKey: string,
  apiSecret: string
): Promise<any> {
  const bodyJson = JSON.stringify(payload);
  const bridge = (window as any).ApexAndroid;

  if (bridge?.coindcxSignedCall) {
    const rawStr = bridge.coindcxSignedCall(method, path, bodyJson, apiKey.trim(), apiSecret.trim());
    if (typeof rawStr === 'string' && rawStr.trim()) {
      return JSON.parse(rawStr);
    }
  }

  // Browser fallback for POST endpoints when testing on web preview
  if (method === 'POST') {
    const sig = await webHmacHex(apiSecret, bodyJson);
    const r = await fetch(`https://api.coindcx.com${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-AUTH-APIKEY': apiKey.trim(),
        'X-AUTH-SIGNATURE': sig,
      },
      body: bodyJson,
    });
    return await r.json();
  }
  return [];
}

export function hasDirectCoinDcxBridge(): boolean {
  return Boolean((window as any).ApexAndroid?.coindcxSignedCall);
}

/**
 * Full Two-Way Sync with Official CoinDCX App (Spot + Futures INR & USDT Wallets + Open Positions + Recent Trades!)
 */
export async function fetchFullDirectCoinDcxPortfolio(apiKey: string, apiSecret: string) {
  const nowTs = Math.floor(Date.now());
  const [
    spotRaw,
    futWalletsRaw,
    futPosInrRaw,
    futPosUsdtRaw,
    futOpenOrdersRaw,
    spotTradesRaw,
    tickersRaw,
  ] = await Promise.all([
    callCoinDcxDirect('POST', '/exchange/v1/users/balances', { timestamp: nowTs }, apiKey, apiSecret).catch(() => []),
    callCoinDcxDirect('GET', '/exchange/v1/derivatives/futures/wallets', { timestamp: nowTs }, apiKey, apiSecret).catch(() => []),
    callCoinDcxDirect(
      'POST',
      '/exchange/v1/derivatives/futures/positions',
      { timestamp: nowTs, page: '1', size: '30', margin_currency_short_name: ['INR'] },
      apiKey,
      apiSecret
    ).catch(() => []),
    callCoinDcxDirect(
      'POST',
      '/exchange/v1/derivatives/futures/positions',
      { timestamp: nowTs, page: '1', size: '30', margin_currency_short_name: ['USDT'] },
      apiKey,
      apiSecret
    ).catch(() => []),
    callCoinDcxDirect(
      'POST',
      '/exchange/v1/derivatives/futures/orders',
      { timestamp: nowTs, status: 'open,init,filled', side: 'buy', page: '1', size: '12' },
      apiKey,
      apiSecret
    ).catch(() => []),
    callCoinDcxDirect('POST', '/exchange/v1/orders/trade_history', { timestamp: nowTs, limit: 10 }, apiKey, apiSecret).catch(
      () => []
    ),
    fetch('https://api.coindcx.com/exchange/ticker')
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
  ]);

  const priceMap = new Map<string, number>();
  for (const t of Array.isArray(tickersRaw) ? tickersRaw : []) {
    const px = parseFloat(t.last_price);
    if (px > 0) priceMap.set(String(t.market).toUpperCase(), px);
  }
  const usdtInr = priceMap.get('USDTINR') || 88.0;

  const toInr = (cur: string, amt: number) => {
    const c = String(cur || '').toUpperCase();
    if (!amt || amt <= 0) return 0;
    if (c === 'INR') return amt;
    if (c === 'USDT') return amt * usdtInr;
    if (priceMap.has(`${c}INR`)) return amt * (priceMap.get(`${c}INR`) || 0);
    if (priceMap.has(`${c}USDT`)) return amt * (priceMap.get(`${c}USDT`) || 0) * usdtInr;
    return 0;
  };

  let spotInr = 0;
  let spotUsdt = 0;
  const holdings: LiveHoldingItem[] = [];

  for (const b of Array.isArray(spotRaw) ? spotRaw : []) {
    const avail = parseFloat(b.balance) || 0;
    const locked = parseFloat(b.locked_balance) || 0;
    const total = avail + locked;
    const cur = String(b.currency || '').toUpperCase();
    if (cur === 'INR') spotInr += total;
    if (cur === 'USDT') spotUsdt += total;
    if (total > 0) {
      const valueInr = toInr(cur, total);
      holdings.push({
        wallet: 'SPOT',
        currency: cur,
        balance: avail,
        locked_balance: locked,
        total,
        valueInr,
        valueUsdt: valueInr / usdtInr,
      });
    }
  }

  let futuresInr = 0;
  let futuresUsdt = 0;
  for (const w of Array.isArray(futWalletsRaw) ? futWalletsRaw : []) {
    const avail = parseFloat(w.balance) || 0;
    const locked = parseFloat(w.locked_balance) || 0;
    const crossOrd = parseFloat(w.cross_order_margin) || 0;
    const crossUsr = parseFloat(w.cross_user_margin) || 0;
    const total = avail + locked + crossOrd + crossUsr;
    const cur = String(w.currency_short_name || w.currency || '').toUpperCase();
    if (cur === 'INR') futuresInr += total;
    if (cur === 'USDT') futuresUsdt += total;
    if (total > 0) {
      const valueInr = toInr(cur, total);
      holdings.push({
        wallet: 'FUTURES',
        currency: cur,
        balance: avail,
        locked_balance: locked + crossOrd + crossUsr,
        total,
        valueInr,
        valueUsdt: valueInr / usdtInr,
      });
    }
  }

  // Merge active Futures positions across BOTH INR & USDT margin!
  const seenPosIds = new Set<string>();
  const allRawFutPos = [
    ...(Array.isArray(futPosInrRaw) ? futPosInrRaw : []),
    ...(Array.isArray(futPosUsdtRaw) ? futPosUsdtRaw : []),
  ];

  const positions: TradingPosition[] = [];
  for (const p of allRawFutPos) {
    const qty = parseFloat(p.active_pos) || 0;
    if (Math.abs(qty) <= 0) continue;
    const pid = String(p.id || p.pair);
    if (seenPosIds.has(pid)) continue;
    seenPosIds.add(pid);

    const cleanPair = String(p.pair || '').replace(/^B-/, '').replace('_', '/');
    const baseSym = cleanPair.replace('/', '') || 'BTCUSDT';
    const entry = parseFloat(p.avg_price) || 0;
    const liveMark = parseFloat(p.mark_price) || priceMap.get(baseSym) || entry;
    const lev = parseFloat(p.leverage) || 1;
    const marginCur = String(p.margin_currency_short_name || 'INR').toUpperCase();
    const diff = qty > 0 ? liveMark - entry : entry - liveMark;
    const rawPnlUsdt = diff * Math.abs(qty);
    const pnlInr = marginCur === 'INR' && cleanPair.endsWith('/INR') ? rawPnlUsdt : rawPnlUsdt * usdtInr;

    positions.push({
      id: pid,
      pair: `⚡ FUTURES ${lev}x · ${cleanPair} (${marginCur})`,
      type: qty > 0 ? 'LONG' : 'SHORT',
      entryPrice: entry,
      currentPrice: liveMark,
      amount: Math.abs(qty),
      pnl: parseFloat(pnlInr.toFixed(2)),
      pnlPercent: entry > 0 ? parseFloat((((diff / entry) * 100) * lev).toFixed(2)) : 0,
      status: 'OPEN',
      timestamp: Date.now(),
    });
  }

  // Also include ALL live non-cash Spot coin holdings bought in CoinDCX App or APEX!
  for (const h of holdings) {
    if (h.wallet !== 'SPOT' || h.currency === 'INR' || h.currency === 'USDT' || h.valueInr < 5) continue;
    const unitInr = h.total > 0 ? h.valueInr / h.total : 0;
    positions.push({
      id: `spot-${h.currency}`,
      pair: `🪙 SPOT · ${h.currency}/INR`,
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

  // Build real exchange history from CoinDCX App manual + bot orders!
  const syncedLogs: TradeOrderLog[] = [];
  for (const fo of Array.isArray(futOpenOrdersRaw) ? futOpenOrdersRaw.slice(0, 6) : []) {
    const pairLabel = String(fo.pair || '').replace(/^B-/, '').replace('_', '/');
    syncedLogs.push({
      id: `fut-${fo.id}`,
      time: new Date(fo.updated_at || fo.created_at || Date.now()).toLocaleTimeString('en-IN', { hour12: false }),
      pair: `${pairLabel} [FUTURES]`,
      type: String(fo.side || 'buy').toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
      price: Number(fo.avg_price || fo.price || 0),
      amount: Number(fo.total_quantity || 0),
      reason: `Synced from CoinDCX Futures (${String(fo.status || 'live').toUpperCase()} · ${fo.leverage || 1}x)`,
      sentimentTrigger: 'COINDCX_FUTURES_SYNC',
    });
  }
  for (const st of Array.isArray(spotTradesRaw) ? spotTradesRaw.slice(0, 6) : []) {
    syncedLogs.push({
      id: `spot-tr-${st.id || Math.random()}`,
      time: new Date(st.timestamp || Date.now()).toLocaleTimeString('en-IN', { hour12: false }),
      pair: `${st.symbol || 'SPOT'} [SPOT]`,
      type: String(st.side || 'buy').toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
      price: Number(st.price || 0),
      amount: Number(st.quantity || 0),
      reason: `Synced from CoinDCX Spot Exchange`,
      sentimentTrigger: 'COINDCX_SPOT_SYNC',
    });
  }

  const totalInr = holdings.reduce((s, h) => s + (h.valueInr || 0), 0);
  return {
    ok: true,
    live: Array.isArray(spotRaw) || Array.isArray(futWalletsRaw),
    spotInr,
    spotUsdt,
    futuresInr,
    futuresUsdt,
    totalInr,
    totalUsdt: totalInr / usdtInr,
    usdtInr,
    holdings,
    positions,
    syncedLogs,
  };
}

/** Exits an open CoinDCX Futures position immediately (1-tap or Auto TP/SL!) */
export async function exitCoinDcxFuturesPositionDirect(positionId: string, apiKey: string, apiSecret: string) {
  return await callCoinDcxDirect(
    'POST',
    '/exchange/v1/derivatives/futures/positions/exit',
    { timestamp: Math.floor(Date.now()), id: positionId },
    apiKey,
    apiSecret
  );
}

/** Executes a REAL CoinDCX FUTURES Order (LONG or SHORT in INR or USDT Margin!) */
export async function executeDirectFuturesOrder(opts: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
  side: 'buy' | 'sell';
  inrAmount: number;
  leverage: number;
  futuresInr: number;
  futuresUsdt: number;
  usdtInr: number;
}) {
  const base = opts.symbol
    .toUpperCase()
    .replace(/⚡|🪙|FUTURES|SPOT|\(.*?\)|\d+X|·/g, '')
    .replace(/[^A-Z]/g, '')
    .replace(/(INR|USDT)$/, '') || 'SOL';

  const futPair = FUTURES_STEP_SIZE[`B-${base}_USDT`] ? `B-${base}_USDT` : 'B-SOL_USDT';
  const stepCfg = FUTURES_STEP_SIZE[futPair] || { step: 0.1, prec: 1 };

  const tickers = await fetch('https://api.coindcx.com/exchange/ticker').then((r) => r.json());
  const usdtSym = `${futPair.replace(/^B-/, '').replace('_', '')}`;
  const tick = Array.isArray(tickers) ? tickers.find((x: any) => String(x.market).toUpperCase() === usdtSym) : null;
  const markUsdt = parseFloat(tick?.last_price || '0');
  if (!markUsdt || markUsdt <= 0) {
    throw new Error(`Futures price unavailable for ${futPair}`);
  }

  const lev = Math.max(1, Math.min(20, Math.round(opts.leverage || 3)));
  const useInrMargin = opts.futuresInr >= opts.futuresUsdt * opts.usdtInr;
  const marginCurrency = useInrMargin ? 'INR' : 'USDT';
  const availMarginInr = useInrMargin ? opts.futuresInr : opts.futuresUsdt * opts.usdtInr;
  if (availMarginInr < 25) {
    throw new Error(
      `Futures Wallet balance (₹${availMarginInr.toFixed(2)}) kam hai — CoinDCX App me Futures Wallet me ₹100+ rakhein ya Spot use karein`
    );
  }

  const marginToUseInr = Math.min(availMarginInr * 0.92, Math.max(50, opts.inrAmount));
  const notionalUsdt = (marginToUseInr * lev) / (opts.usdtInr || 88);
  const rawQty = notionalUsdt / markUsdt;
  const steppedQty = Math.max(stepCfg.step, Math.floor(rawQty / stepCfg.step) * stepCfg.step);
  const finalQty = Number(steppedQty.toFixed(stepCfg.prec));

  const payload = {
    timestamp: Math.floor(Date.now()),
    order: {
      side: opts.side,
      pair: futPair,
      order_type: 'market_order',
      total_quantity: finalQty,
      leverage: lev,
      notification: 'no_notification',
      time_in_force: 'good_till_cancel',
      hidden: false,
      post_only: false,
      margin_currency_short_name: marginCurrency,
    },
  };

  const res = await callCoinDcxDirect('POST', '/exchange/v1/derivatives/futures/orders/create', payload, opts.apiKey, opts.apiSecret);
  if (res?.message && !Array.isArray(res) && !res?.id) {
    throw new Error(String(res.message));
  }

  return {
    ok: true,
    live: true,
    wallet: `FUTURES (${marginCurrency} ${lev}x)`,
    market: futPair.replace(/^B-/, '').replace('_', '/'),
    side: opts.side.toUpperCase(),
    quantity: finalQty,
    price: markUsdt,
    approxInr: Math.round(marginToUseInr),
  };
}

/** Executes a REAL CoinDCX SPOT Order directly from Phone */
export async function executeDirectSpotOrder(opts: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
  side: 'buy' | 'sell';
  inrAmount: number;
  spotInr: number;
  holdings: LiveHoldingItem[];
}) {
  const base = opts.symbol
    .toUpperCase()
    .replace(/⚡|🪙|FUTURES|SPOT|\(.*?\)|\d+X|·/g, '')
    .replace(/[^A-Z]/g, '')
    .replace(/(INR|USDT)$/, '') || 'BTC';
  const market = SPOT_PRECISION[`${base}INR`] ? `${base}INR` : 'BTCINR';
  const cfg = SPOT_PRECISION[market];

  const tickers = await fetch('https://api.coindcx.com/exchange/ticker').then((r) => r.json());
  const tick = Array.isArray(tickers) ? tickers.find((x: any) => String(x.market).toUpperCase() === market) : null;
  const px = parseFloat(tick?.last_price || '0');
  if (!px || px <= 0) throw new Error(`Spot price unavailable for ${market}`);

  let qty = 0;
  const factor = Math.pow(10, cfg.prec);
  if (opts.side === 'buy') {
    if (opts.spotInr < cfg.minInr) {
      throw new Error(`Spot INR balance (₹${opts.spotInr.toFixed(2)}) minimum ₹${cfg.minInr} se kam hai`);
    }
    const spend = Math.min(opts.spotInr * 0.99, Math.max(cfg.minInr * 1.05, opts.inrAmount));
    qty = Math.floor((spend / px) * factor) / factor;
  } else {
    const held = opts.holdings.find((h) => h.wallet === 'SPOT' && h.currency === base);
    if (!held || held.balance <= 0) {
      throw new Error(`Spot me ${base} coin available nahi hai`);
    }
    qty = Math.floor(held.balance * factor) / factor;
  }
  qty = Number(qty.toFixed(cfg.prec));
  if (qty <= 0) throw new Error('Order quantity step se kam hai');

  const res = await callCoinDcxDirect(
    'POST',
    '/exchange/v1/orders/create',
    {
      side: opts.side,
      order_type: 'market_order',
      market,
      total_quantity: qty,
      timestamp: Math.floor(Date.now()),
    },
    opts.apiKey,
    opts.apiSecret
  );
  if (res?.message && !res?.orders) {
    throw new Error(String(res.message));
  }

  return {
    ok: true,
    live: true,
    wallet: 'SPOT',
    market,
    side: opts.side.toUpperCase(),
    quantity: qty,
    price: px,
    approxInr: Math.round(qty * px),
  };
}
