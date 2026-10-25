/**
 * 📈 REAL DESK — asli paisa wala trading engine (purane paper/demo view se ALAG).
 *
 * ROUTES (dono device par chalta hai):
 *   1) 🛰️ Cloudflare Worker: POST /api/coindcx/balances · /api/coindcx/trade
 *      → iPhone Safari PWA par bhi kaam karta hai (native bridge ki zarurat nahi).
 *   2) 📱 Android native bridge (ApexAndroid) — agar app APK ho to direct TLS.
 *
 * SAFETY (kyunki yahan asli paisa hai):
 *   • Order tabhi jaata hai jab user ne literally "REAL" type kiya ho (confirm word).
 *   • Har order ka hard cap (default ₹500) + daily cap (default ₹2000) — localStorage me count.
 *   • Keys sirf device par (localStorage) ya worker secret me — kahin bhi log nahi hoti.
 *   • Kill switch: aage ke saare orders band (session-wide).
 *
 * IMAANDARI:
 *   • Agar CoinDCX key/secret nahi → `live:false` + exact reason. Koi fake number nahi.
 *   • Worker deploy purana hai aur route missing → saaf `worker route missing` error.
 *   • Ye engine apne aap trade NAHI karta — sirf jo tum button dabao (auto mode purane
 *     Trading Bot me hai, ye desk manual/real hai).
 */

import { hubFetch } from './api';

export interface RealBalance {
  live: boolean;
  spotInr: number;
  spotUsdt: number;
  futuresInr: number;
  futuresUsdt: number;
  totalInr: number;
  usdtInr: number;
  holdings: { coin: string; qty: number; inr?: number }[];
  positions: any[];
  error?: string;
  source: 'worker' | 'none';
}

export interface RealOrderResult {
  ok: boolean;
  live: boolean;
  market?: string;
  wallet?: string;
  side?: string;
  quantity?: number;
  price?: number;
  approxInr?: number;
  orderId?: string;
  error?: string;
  at: number;
}

export interface RealDeskLimits {
  maxOrderInr: number;
  maxDayInr: number;
  killSwitch: boolean;
}

const LIMITS_KEY = 'apex_real_desk_limits_v1';
const LOG_KEY = 'apex_real_desk_log_v1';
const DAY_KEY = 'apex_real_desk_day_v1';

export const DEFAULT_LIMITS: RealDeskLimits = { maxOrderInr: 500, maxDayInr: 2000, killSwitch: false };

export function loadLimits(): RealDeskLimits {
  try {
    const raw = localStorage.getItem(LIMITS_KEY);
    if (!raw) return { ...DEFAULT_LIMITS };
    const j = JSON.parse(raw) as Partial<RealDeskLimits>;
    return {
      maxOrderInr: Math.max(50, Math.min(100000, Number(j.maxOrderInr) || DEFAULT_LIMITS.maxOrderInr)),
      maxDayInr: Math.max(50, Math.min(500000, Number(j.maxDayInr) || DEFAULT_LIMITS.maxDayInr)),
      killSwitch: Boolean(j.killSwitch),
    };
  } catch {
    return { ...DEFAULT_LIMITS };
  }
}

export function saveLimits(patch: Partial<RealDeskLimits>): RealDeskLimits {
  const next = { ...loadLimits(), ...patch };
  try {
    localStorage.setItem(LIMITS_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function spentToday(): number {
  try {
    const raw = localStorage.getItem(DAY_KEY);
    if (!raw) return 0;
    const j = JSON.parse(raw) as { day: string; inr: number };
    return j.day === todayKey() ? Number(j.inr) || 0 : 0;
  } catch {
    return 0;
  }
}

function addSpent(inr: number) {
  try {
    const day = todayKey();
    const cur = spentToday();
    localStorage.setItem(DAY_KEY, JSON.stringify({ day, inr: cur + inr }));
  } catch {}
}

export function loadRealLog(): RealOrderResult[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr.slice(0, 40) : [];
  } catch {
    return [];
  }
}

function pushRealLog(r: RealOrderResult): RealOrderResult[] {
  const next = [r, ...loadRealLog()].slice(0, 40);
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function clearRealLog(): void {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {}
}

/** Worker live hai ya nahi + keys configured hain ya nahi. */
export async function realWorkerStatus(): Promise<{ ok: boolean; configured: boolean; mode?: string; error?: string }> {
  try {
    const r = await hubFetch('/api/coindcx/status');
    if (!r.ok) return { ok: false, configured: false, error: `worker ${r.status}` };
    const j: any = await r.json();
    return { ok: Boolean(j?.ok), configured: Boolean(j?.configured), mode: j?.mode };
  } catch (e: any) {
    return { ok: false, configured: false, error: String(e?.message || e).slice(0, 80) };
  }
}

/** ASLI balance — worker ke through (iPhone par bhi chalta hai). */
export async function fetchRealBalance(apiKey: string, apiSecret: string): Promise<RealBalance> {
  const empty: RealBalance = {
    live: false,
    spotInr: 0,
    spotUsdt: 0,
    futuresInr: 0,
    futuresUsdt: 0,
    totalInr: 0,
    usdtInr: 88,
    holdings: [],
    positions: [],
    source: 'none',
  };
  if (!apiKey || !apiSecret) return { ...empty, error: 'API key + secret chahiye (CoinDCX → API keys)' };
  try {
    const r = await hubFetch('/api/coindcx/balances', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apiKey, apiSecret }),
    });
    if (r.status === 404) return { ...empty, error: 'worker route missing — worker dobara deploy karo (cloudflare-bot/worker.js)' };
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || j?.ok === false) {
      return { ...empty, error: String(j?.error || `worker ${r.status}`).slice(0, 120) };
    }
    const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const holdings = Array.isArray(j?.holdings)
      ? j.holdings
          .map((h: any) => ({ coin: String(h.coin || h.currency || ''), qty: num(h.qty ?? h.balance), inr: num(h.inr ?? h.valueInr) }))
          .filter((h: any) => h.coin && h.qty > 0)
          .slice(0, 12)
      : [];
    const usdtInr = num(j?.usdtInr) || 88;
    const spotInr = num(j?.spotInr);
    const spotUsdt = num(j?.spotUsdt);
    const futuresInr = num(j?.futuresInr);
    const futuresUsdt = num(j?.futuresUsdt);
    return {
      live: Boolean(j?.live),
      spotInr,
      spotUsdt,
      futuresInr,
      futuresUsdt,
      totalInr: num(j?.totalInr) || spotInr + futuresInr + (spotUsdt + futuresUsdt) * usdtInr,
      usdtInr,
      holdings,
      positions: Array.isArray(j?.positions) ? j.positions.slice(0, 10) : [],
      source: 'worker',
    };
  } catch (e: any) {
    return { ...empty, error: `network: ${String(e?.message || e).slice(0, 80)}` };
  }
}

export interface PlaceRealOrderOpts {
  apiKey: string;
  apiSecret: string;
  market: string; // BTCINR / ETHUSDT
  side: 'buy' | 'sell';
  inrAmount: number;
  price: number;
  walletType?: 'auto' | 'futures' | 'spot';
  leverage?: number;
  /** user ne literally "REAL" type kiya ho */
  confirmWord: string;
  orderType?: 'market_order' | 'limit_order';
}

/** ASLI order — safety caps ke saath. Har attempt log hota hai. */
export async function placeRealOrder(opts: PlaceRealOrderOpts): Promise<RealOrderResult> {
  const at = Date.now();
  const limits = loadLimits();

  const deny = (error: string): RealOrderResult => {
    const r: RealOrderResult = { ok: false, live: false, error, at, market: opts.market, side: opts.side };
    pushRealLog(r);
    return r;
  };

  if (limits.killSwitch) return deny('🛑 KILL SWITCH ON hai — pehle off karo');
  if (String(opts.confirmWord || '').trim().toUpperCase() !== 'REAL') {
    return deny('confirm word galat — literally REAL type karo (asli paisa jaata hai)');
  }
  if (!opts.apiKey || !opts.apiSecret) return deny('API key/secret missing');
  const amount = Math.round(Number(opts.inrAmount) || 0);
  if (amount < 100) return deny('CoinDCX spot minimum ₹100 hai — amount badhao');
  if (amount > limits.maxOrderInr) return deny(`per-order cap ₹${limits.maxOrderInr} — limit badhaani ho to Limits me karo`);
  const spent = spentToday();
  if (spent + amount > limits.maxDayInr) {
    return deny(`aaj ka cap ₹${limits.maxDayInr} khatam (spent ₹${spent})`);
  }

  try {
    const res = await hubFetch('/api/coindcx/trade', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiKey: opts.apiKey,
        apiSecret: opts.apiSecret,
        side: opts.side,
        market: opts.market,
        inrAmount: amount,
        price: opts.price,
        walletType: opts.walletType || 'auto',
        leverage: Math.max(1, Math.min(20, opts.leverage || 1)),
        order_type: opts.orderType || 'market_order',
      }),
    });
    if (res.status === 404) return deny('worker route missing — worker dobara deploy karo');
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok || !j?.ok) {
      const r: RealOrderResult = {
        ok: false,
        live: false,
        error: String(j?.error || `exchange ${res.status}`).slice(0, 140),
        at,
        market: opts.market,
        side: opts.side,
      };
      pushRealLog(r);
      return r;
    }
    addSpent(amount);
    const okLog: RealOrderResult = {
      ok: true,
      live: Boolean(j?.live ?? true),
      market: String(j?.market || opts.market),
      wallet: String(j?.wallet || opts.walletType || 'auto'),
      side: opts.side,
      quantity: Number(j?.quantity) || undefined,
      price: Number(j?.price) || opts.price,
      approxInr: Number(j?.approxInr) || amount,
      orderId: String(j?.orderId || j?.id || '') || undefined,
      at,
    };
    pushRealLog(okLog);
    return okLog;
  } catch (e: any) {
    const r: RealOrderResult = {
      ok: false,
      live: false,
      error: `network: ${String(e?.message || e).slice(0, 100)}`,
      at,
      market: opts.market,
      side: opts.side,
    };
    pushRealLog(r);
    return r;
  }
}

/** Live price (order preview ke liye) — CoinDCX ticker worker se. */
export async function realTicker(symbols: string[] = ['BTCINR', 'ETHINR', 'SOLINR']): Promise<Record<string, number>> {
  try {
    const r = await hubFetch('/api/coindcx/ticker');
    if (!r.ok) return {};
    const j: any = await r.json();
    const list: any[] = Array.isArray(j?.data) ? j.data : [];
    const out: Record<string, number> = {};
    for (const s of symbols) {
      const hit = list.find((t) => String(t?.market || '').toUpperCase() === s.toUpperCase());
      if (hit) out[s.toUpperCase()] = Number(hit.last_price) || 0;
    }
    return out;
  } catch {
    return {};
  }
}

export function realDeskVerdict(b: RealBalance | null, status: { ok: boolean; configured: boolean; error?: string } | null): string {
  if (!status) return '⏳ worker check ho raha hai…';
  if (!status.ok) return `⚠️ worker se baat nahi hui (${status.error || 'offline'}) — real order tabhi lagega jab worker live ho`;
  if (!b) return '🔑 key daal ke TEST karo — tab asli balance dikhega';
  if (b.error) return `⚠️ ${b.error}`;
  if (!b.live) return '🔒 CoinDCX ne live=false diya — keys/permissions check karo (trade permission ON honi chahiye)';
  if (b.totalInr < 100) {
    return `⚠️ REAL LIVE hai (keys chal rahi hain) par account me sirf ₹${b.totalInr.toFixed(2)} hai — CoinDCX spot minimum ₹100, isliye order reject hoga. Paisa daalo tabhi 🔴 SEND REAL kaam karega.`;
  }
  return `✅ REAL LIVE · ₹${b.totalInr.toFixed(0)} total · spot ₹${b.spotInr.toFixed(0)} · futures ₹${b.futuresInr.toFixed(0)}`;
}
