import { useEffect, useState } from 'react';
import {
  clearRealLog,
  fetchRealBalance,
  loadLimits,
  loadRealLog,
  placeRealOrder,
  realDeskVerdict,
  realTicker,
  realWorkerStatus,
  saveLimits,
  spentToday,
  type RealBalance,
  type RealOrderResult,
} from '../engine/realDesk';
import { userScopedKey } from '../engine/authStore';

/**
 * 📈 REAL DESK — asli paisa. Purana Trading Bot (paper view) bilkul waisa hi rehta hai;
 * ye ALAG screen sirf real orders/balance ke liye hai.
 */
export function RealTradingDesk({
  isOpen,
  onClose,
  onToast,
  userId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onToast: (m: string) => void;
  userId: string;
}) {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showKeys, setShowKeys] = useState(false);
  const [busy, setBusy] = useState('');
  const [bal, setBal] = useState<RealBalance | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; configured: boolean; mode?: string; error?: string } | null>(null);
  const [verdict, setVerdict] = useState('⏳ check ho raha hai…');
  const [limits, setLimits] = useState(() => loadLimits());
  const [log, setLog] = useState<RealOrderResult[]>(() => loadRealLog());
  const [market, setMarket] = useState('BTCINR');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState(200);
  const [wallet, setWallet] = useState<'auto' | 'futures' | 'spot'>('auto');
  const [lev, setLev] = useState(1);
  const [confirm, setConfirm] = useState('');
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [spent, setSpent] = useState(0);

  // page khulte hi keys + worker status
  useEffect(() => {
    if (!isOpen) return;
    const k = localStorage.getItem(userScopedKey('coindcx_key', userId)) || '';
    const s = localStorage.getItem(userScopedKey('coindcx_secret', userId)) || '';
    setApiKey(k);
    setApiSecret(s);
    setLimits(loadLimits());
    setLog(loadRealLog());
    setSpent(spentToday());
    (async () => {
      const st = await realWorkerStatus();
      setStatus(st);
      if (k && s) {
        const b = await fetchRealBalance(k, s);
        setBal(b);
        setVerdict(realDeskVerdict(b, st));
      } else {
        setVerdict(realDeskVerdict(null, st));
      }
      setPrices(await realTicker());
    })();
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const saveKeys = () => {
    try {
      localStorage.setItem(userScopedKey('coindcx_key', userId), apiKey.trim());
      localStorage.setItem(userScopedKey('coindcx_secret', userId), apiSecret.trim());
      onToast('🔑 Keys device par save (kahin bheji nahi gayi)');
    } catch {
      onToast('⚠️ localStorage block');
    }
  };

  const test = async () => {
    setBusy('test');
    try {
      saveKeys();
      const st = await realWorkerStatus();
      setStatus(st);
      const b = await fetchRealBalance(apiKey.trim(), apiSecret.trim());
      setBal(b);
      setVerdict(realDeskVerdict(b, st));
      setPrices(await realTicker());
      onToast(b.live ? '✅ REAL LIVE — CoinDCX balance aa gaya' : `⚠️ ${b.error || 'live=false'}`);
    } finally {
      setBusy('');
    }
  };

  const fire = async () => {
    setBusy('order');
    try {
      const r = await placeRealOrder({
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
        market,
        side,
        inrAmount: amount,
        price: prices[market] || 0,
        walletType: wallet,
        leverage: lev,
        confirmWord: confirm,
      });
      setLog(loadRealLog());
      setSpent(spentToday());
      if (r.ok) {
        onToast(`✅ REAL ${side.toUpperCase()} ${r.market}: ${r.quantity ?? '?'} @ ₹${r.price ?? '?'}`);
        setConfirm('');
        const b = await fetchRealBalance(apiKey.trim(), apiSecret.trim());
        setBal(b);
        setVerdict(realDeskVerdict(b, status));
      } else {
        onToast(`⚠️ ${r.error || 'order reject'}`);
      }
    } finally {
      setBusy('');
    }
  };

  const patchLimits = (p: Partial<typeof limits>) => {
    const next = saveLimits(p);
    setLimits(next);
    onToast('🛡️ limits save');
  };

  const tone = (r: RealOrderResult) => (r.ok ? 'text-emerald-300' : 'text-rose-300');

  return (
    <div className="fixed inset-0 z-[86] bg-black/88 backdrop-blur-sm flex items-end sm:items-center justify-center p-1 sm:p-3">
      <div className="w-full max-w-lg max-h-[95vh] overflow-y-auto rounded-2xl border border-emerald-400/30 bg-[#060c14] shadow-[0_20px_60px_rgba(0,0,0,0.92)]">
        <div className="sticky top-0 z-10 px-2.5 py-2 border-b border-white/10 bg-[#060c14]/96 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-black text-emerald-200">📈 REAL DESK — asli paisa (CoinDCX)</div>
              <div className="text-[8px] font-bold text-amber-200/90">
                ⚠️ yahan asli order jaata hai · purana Trading Bot (paper view) waisa hi hai
              </div>
            </div>
            <button onClick={onClose} className="cursor-pointer w-7 h-7 rounded-full bg-white/10 text-white/80 text-xs font-black shrink-0">
              ✕
            </button>
          </div>
          <div className="mt-1.5 text-[8.5px] font-bold rounded-lg px-2 py-1 bg-black/50 border border-white/10 text-slate-200">{verdict}</div>
        </div>

        <div className="p-2 space-y-2">
          {/* keys */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <div className="text-[9.5px] font-black text-slate-100">🔑 CoinDCX API keys</div>
              <span className={`ml-auto px-1.5 py-0.5 rounded-md text-[7.5px] font-black ${apiKey && apiSecret ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-200'}`}>
                {apiKey && apiSecret ? 'saved on device' : 'missing'}
              </span>
              <button onClick={() => setShowKeys((v) => !v)} className="px-1.5 py-0.5 rounded-md bg-white/10 text-[7.5px] font-black text-slate-200 cursor-pointer">
                {showKeys ? 'hide' : 'show'}
              </button>
            </div>
            {showKeys && (
              <>
                <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API Key" className="w-full bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[9.5px] font-mono text-slate-100" />
                <input value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} type="password" placeholder="API Secret" className="w-full bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1.5 text-[9.5px] font-mono text-slate-100" />
                <div className="text-[7.5px] font-bold text-slate-400 leading-snug">
                  CoinDCX → Profile → API Keys → nayi key banao (permission: <b>trade ON</b>, withdraw OFF). Keys sirf is device me
                  (localStorage) rehti hain; order worker ke through jaata hai.
                </div>
              </>
            )}
            <div className="flex gap-1.5">
              <button onClick={saveKeys} className="flex-1 py-1.5 rounded-lg text-[9px] font-black bg-white/10 text-slate-100 cursor-pointer">💾 SAVE</button>
              <button disabled={busy === 'test'} onClick={test} className="flex-1 py-1.5 rounded-lg text-[9px] font-black bg-gradient-to-r from-emerald-600 to-cyan-600 text-white cursor-pointer">
                {busy === 'test' ? '⏳ TEST…' : '🧪 TEST + BALANCE'}
              </button>
            </div>
          </div>

          {/* real balance */}
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] p-2">
            <div className="flex items-center gap-2">
              <div className="text-[9.5px] font-black text-emerald-100">💰 ASLI BALANCE</div>
              <span className="ml-auto text-[8px] font-black text-warm-200 text-slate-300">{bal?.source === 'worker' ? 'worker' : '—'}</span>
            </div>
            {bal && !bal.error ? (
              <>
                <div className="grid grid-cols-3 gap-1 mt-1">
                  {[
                    ['Total ₹', bal.totalInr],
                    ['Spot ₹', bal.spotInr],
                    ['Futures ₹', bal.futuresInr],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="rounded-lg bg-black/40 border border-white/10 px-1.5 py-1">
                      <div className="text-[7px] font-black text-slate-400">{k}</div>
                      <div className="text-[10px] font-black text-slate-100">₹{Number(v).toFixed(0)}</div>
                    </div>
                  ))}
                </div>
                <div className="text-[7.5px] font-bold text-slate-400 mt-1">
                  USDT spot {bal.spotUsdt.toFixed(2)} · futures {bal.futuresUsdt.toFixed(2)} · rate ₹{bal.usdtInr.toFixed(1)}
                  {bal.holdings.length ? ` · coins: ${bal.holdings.map((h) => h.coin).slice(0, 5).join(', ')}` : ''}
                </div>
              </>
            ) : (
              <div className="text-[8px] font-bold text-slate-400 mt-1">{bal?.error || 'key save karke 🧪 TEST dabao — tab asli numbers aayenge'}</div>
            )}
          </div>

          {/* order */}
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/[0.06] p-2 space-y-1.5">
            <div className="text-[9.5px] font-black text-rose-100">⚡ ASLI ORDER</div>
            <div className="flex flex-wrap gap-1">
              {['BTCINR', 'ETHINR', 'SOLINR', 'BTCUSDT'].map((m) => (
                <button key={m} onClick={() => setMarket(m)} className={`px-1.5 py-1 rounded-lg text-[8px] font-black cursor-pointer ${market === m ? 'bg-rose-500/30 text-rose-100' : 'bg-white/[0.06] text-slate-300'}`}>
                  {m} {prices[m] ? `₹${prices[m].toFixed(0)}` : ''}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setSide('buy')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black cursor-pointer ${side === 'buy' ? 'bg-emerald-500/30 text-emerald-100' : 'bg-white/[0.06] text-slate-300'}`}>BUY</button>
              <button onClick={() => setSide('sell')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black cursor-pointer ${side === 'sell' ? 'bg-rose-500/30 text-rose-100' : 'bg-white/[0.06] text-slate-300'}`}>SELL</button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-black text-slate-400">₹</span>
              <input value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} type="number" className="w-20 bg-[#0b1220] border border-white/10 rounded-lg px-2 py-1 text-[9.5px] font-black text-slate-100" />
              {[100, 200, 500].map((v) => (
                <button key={v} onClick={() => setAmount(v)} className="px-1.5 py-1 rounded-lg text-[8px] font-black bg-white/[0.06] text-slate-300 cursor-pointer">₹{v}</button>
              ))}
              <button
                onClick={() => {
                  const order = ['auto', 'spot', 'futures'];
                  setWallet(order[(order.indexOf(wallet) + 1) % order.length] as any);
                }}
                className="ml-auto px-1.5 py-1 rounded-lg text-[8px] font-black bg-white/[0.06] text-slate-300 cursor-pointer"
              >
                {wallet === 'auto' ? '🎯 AUTO' : wallet === 'spot' ? '🏦 SPOT' : '⚡ FUT'}
              </button>
              {(wallet === 'futures' || wallet === 'auto') && (
                <button onClick={() => setLev((l) => (l >= 10 ? 1 : l + 1))} className="px-1.5 py-1 rounded-lg text-[8px] font-black bg-white/[0.06] text-slate-300 cursor-pointer">
                  {lev}x
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="literal REAL type karo"
                className="flex-1 bg-[#0b1220] border border-rose-400/30 rounded-lg px-2 py-1.5 text-[9.5px] font-black text-rose-100 uppercase"
              />
              <button
                disabled={busy === 'order' || limits.killSwitch}
                onClick={fire}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black cursor-pointer ${busy === 'order' || limits.killSwitch ? 'bg-white/10 text-slate-400' : 'bg-gradient-to-r from-rose-600 to-orange-600 text-white'}`}
              >
                {busy === 'order' ? '⏳' : limits.killSwitch ? '🛑 OFF' : '🔴 SEND REAL'}
              </button>
            </div>
            <div className="text-[7.5px] font-bold text-slate-400">
              aaj kharch: ₹{spent} / cap ₹{limits.maxDayInr} · per-order cap ₹{limits.maxOrderInr}
            </div>
          </div>

          {/* safety */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <div className="text-[9.5px] font-black text-slate-100">🛡️ SAFETY</div>
              <button
                onClick={() => patchLimits({ killSwitch: !limits.killSwitch })}
                className={`ml-auto px-2 py-1 rounded-lg text-[8.5px] font-black cursor-pointer ${limits.killSwitch ? 'bg-rose-500/30 text-rose-100' : 'bg-white/10 text-slate-200'}`}
              >
                {limits.killSwitch ? '🛑 KILL SWITCH ON' : 'KILL SWITCH OFF'}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-bold text-slate-400">per order ₹</span>
              <input value={limits.maxOrderInr} onChange={(e) => patchLimits({ maxOrderInr: Number(e.target.value) || 500 })} type="number" className="w-16 bg-[#0b1220] border border-white/10 rounded-lg px-1.5 py-1 text-[9px] font-black text-slate-100" />
              <span className="text-[8px] font-bold text-slate-400">per day ₹</span>
              <input value={limits.maxDayInr} onChange={(e) => patchLimits({ maxDayInr: Number(e.target.value) || 2000 })} type="number" className="w-20 bg-[#0b1220] border border-white/10 rounded-lg px-1.5 py-1 text-[9px] font-black text-slate-100" />
            </div>
          </div>

          {/* real log */}
          <div className="rounded-xl border border-white/10 bg-[#04090e] p-1.5 max-h-36 overflow-y-auto space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className="text-[8px] font-black text-slate-400">📜 ASLI ORDERS (device log)</div>
              <button onClick={() => { clearRealLog(); setLog([]); onToast('🧹 log saaf'); }} className="ml-auto px-1.5 py-0.5 rounded bg-white/10 text-[7.5px] font-black text-slate-300 cursor-pointer">clear</button>
            </div>
            {log.length === 0 && <div className="text-[8px] font-bold text-slate-500">abhi koi real order nahi</div>}
            {log.map((r, i) => (
              <div key={i} className={`text-[8px] font-semibold leading-snug ${tone(r)}`}>
                {new Date(r.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                {r.ok ? `✅ ${r.side?.toUpperCase()} ${r.market} ${r.quantity ?? ''} @ ₹${r.price ?? ''} (${r.wallet})` : `❌ ${r.market || ''} ${r.error}`}
              </div>
            ))}
          </div>

          <div className="text-[7.5px] font-bold text-slate-500 leading-snug">
            ⚠️ Sach: order Cloudflare Worker ke through CoinDCX par jaata hai (iPhone par bhi chalta hai, native bridge ki zarurat nahi).
            Worker band / route missing → order nahi lagega (saaf error milega). Ye desk khud-ba-khud trade <b>nahi</b> karta — sirf 🔴 SEND REAL dabane par.
          </div>
        </div>
      </div>
    </div>
  );
}
