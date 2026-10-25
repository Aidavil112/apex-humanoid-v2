// ═══════════════════════════════════════════════════════════════════════════
// 📊 DAY LOG (v6.6.11) — "saare din kya kaam kar raha hai aur KAISE kar raha hai"
// (Reel wala system: 19 saal ka ladka, company me akela human — baaki agents
//  24×7 kaam karte hain aur din bhar ka kaam dikhate hain.)
//
// APEX me har engine ka kaam yahan ek hi jagah girta hai (localStorage, koi
// server nahi): kaun (agent), kya (kaam), kaise (detail/duration/path), theek ya atka.
// UI: 🛰️ APEX CORE ke andar "📊 AAJ KYA KIYA" card. Voice: "aaj kya kiya".
// ═══════════════════════════════════════════════════════════════════════════

export interface DayEvent {
  /** epoch ms */
  t: number;
  /** agent/engine ka naam + emoji, e.g. '🎬 Motion Studio' */
  who: string;
  /** kya hua, e.g. 'reel render hui' */
  what: string;
  /** kaise hua — detail: size, duration, path, API, reason */
  how: string;
  /** true = kaam pura, false = atka/skip */
  ok: boolean;
}

export interface DaySummary {
  day: string;
  events: DayEvent[];
  total: number;
  good: number;
  stuck: number;
  byAgent: Array<{ who: string; n: number; ok: number; lastAt: number }>;
  /** 24 hour buckets (count) */
  hours: number[];
  firstAt: number;
  lastAt: number;
  verdict: string;
  report: string;
  /** emoji-free, voice ke liye */
  voice: string;
}

const KEY = 'apex' + '_day_log_v1';
const MAX_EVENTS = 400;
const KEEP_DAYS = 3;

function localDay(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function hhmm(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Purane din ka kachra hata ke naya event add karo (fire-and-forget, kabhi throw nahi). */
export function logDayEvent(who: string, what: string, how = '', ok = true): void {
  try {
    const now = Date.now();
    const raw = localStorage.getItem(KEY);
    const list: DayEvent[] = raw ? (JSON.parse(raw) as DayEvent[]) : [];
    const minDay = localDay(now - (KEEP_DAYS - 1) * 864e5);
    const kept = (Array.isArray(list) ? list : []).filter((e) => e && localDay(e.t) >= minDay);
    kept.push({ t: now, who: String(who || '🛰️ APEX'), what: String(what || ''), how: String(how || ''), ok: Boolean(ok) });
    const trimmed = kept.slice(-MAX_EVENTS);
    localStorage.setItem(KEY, JSON.stringify(trimmed));
    // UI ko turant taza karne ke liye (card ye event sunta hai)
    try { window.dispatchEvent(new CustomEvent('apex:day-log', { detail: { count: trimmed.length } })); } catch {}
  } catch {
    /* storage full/blocked → chhodo, kaam kabhi na mare */
  }
}

export function readDayLog(day?: string): DayEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list: DayEvent[] = raw ? (JSON.parse(raw) as DayEvent[]) : [];
    const target = day || localDay(Date.now());
    return (Array.isArray(list) ? list : []).filter((e) => e && localDay(e.t) === target).sort((a, b) => b.t - a.t);
  } catch {
    return [];
  }
}

export function listDayDays(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list: DayEvent[] = raw ? (JSON.parse(raw) as DayEvent[]) : [];
    const set = new Set<string>((Array.isArray(list) ? list : []).map((e) => localDay(e.t)));
    return [...set].sort().reverse();
  } catch {
    return [];
  }
}

/** Poora din ka hisaab: kitna kiya, kisne kiya, ghante-var kitna, kya atka. */
export function daySummary(day?: string): DaySummary {
  const events = readDayLog(day);
  const d = day || localDay(Date.now());
  const hours = new Array(24).fill(0) as number[];
  const map = new Map<string, { n: number; ok: number; lastAt: number }>();
  for (const e of events) {
    const h = new Date(e.t).getHours();
    if (h >= 0 && h < 24) hours[h] += 1;
    const cur = map.get(e.who) || { n: 0, ok: 0, lastAt: 0 };
    cur.n += 1;
    if (e.ok) cur.ok += 1;
    if (e.t > cur.lastAt) cur.lastAt = e.t;
    map.set(e.who, cur);
  }
  const byAgent = [...map.entries()]
    .map(([who, v]) => ({ who, n: v.n, ok: v.ok, lastAt: v.lastAt }))
    .sort((a, b) => b.n - a.n);
  const total = events.length;
  const good = events.filter((e) => e.ok).length;
  const stuck = total - good;
  const firstAt = events.length ? events[events.length - 1].t : 0;
  const lastAt = events.length ? events[0].t : 0;
  const bars = hours.map((n) => (n === 0 ? '·' : n < 2 ? '▁' : n < 4 ? '▃' : n < 7 ? '▅' : n < 11 ? '▇' : '█')).join('');
  const verdict = total === 0
    ? 'Aaj abhi koi kaam record nahi — ek cycle chalao ya CORE ON karo'
    : `Aaj ${total} kaam · ${good} theek${stuck ? ` · ${stuck} atke` : ''}`;
  const report = [
    `📊 APEX DAY LOG — ${d}`,
    verdict,
    total ? `Timing: ${hhmm(firstAt)} → ${hhmm(lastAt)}  |  active agents: ${byAgent.length}` : '',
    `Hours : ${bars}`,
    '',
    'Agents:',
    ...byAgent.map((a) => `  ${a.who} → ${a.n} kaam (${a.ok} ok) · last ${hhmm(a.lastAt)}`),
    '',
    'Last events:',
    ...events.slice(0, 25).map((e) => `  ${hhmm(e.t)} ${e.ok ? '✅' : '⚠️'} ${e.who} — ${e.what}${e.how ? ` · ${e.how}` : ''}`),
  ].filter(Boolean).join('\n');
  const voice = total === 0
    ? 'Aaj abhi koi kaam record nahi hua. Jarvis Core ON karo ya ek research cycle chalao.'
    : `Aaj ab tak ${total} kaam kiye. ${good} theek${stuck ? ` aur ${stuck} atke` : ''}. Sabse zyada kaam ${byAgent[0].who} ne kiya, ${byAgent[0].n} baar. ${byAgent[0].lastAt ? `Aakhri kaam ${hhmm(byAgent[0].lastAt)} baje.` : ''}`;
  return { day: d, events, total, good, stuck, byAgent, hours, firstAt, lastAt, verdict, report, voice };
}

/** Test/dev: sab clear. */
export function clearDayLog(): void {
  try { localStorage.removeItem(KEY); } catch {}
}
