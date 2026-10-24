/**
 * 👁️ OUTSIDE EYE — "One more eye on the project, from the outside"
 * ---------------------------------------------------------------------------
 * Reel (Reznikov Engineering): project ko bahar se dekhne wala ek extra reviewer.
 * APEX me: brain file + Jarvis ka apna core log uthao, senior-engineer/PM ki
 * tarah bahar se review karo — 3 risk, 3 next step, 1 cheez jo chhod deni chahiye.
 * Result chat me bubble banta hai, bola jaata hai, aur brain file me OPEN
 * section me chala jaata hai → agle slot me Jarvis usse deal kar sakta hai.
 */

import { askGeminiWithUserKey } from './geminiLive';
import { brainDigest, autoRemember } from './brainMemory';
import { loadState } from './jarvisCore';
import { hubFetch } from './api';

export interface OutsideEyeResult {
  ok: boolean;
  text: string;
  source: 'gemini' | 'worker' | 'none';
  note?: string;
}

function recentLog(max = 14): string {
  try {
    const st = loadState();
    return st.log
      .slice(-max)
      .map((l) => `- ${new Date(l.t).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} ${l.line}`)
      .join('\n');
  } catch {
    return '';
  }
}

export function buildOutsideEyePrompt(focus?: string): string {
  const digest = brainDigest(1500) || '(brain file abhi khaali hai)';
  const log = recentLog() || '(koi auto-kaam log nahi hua)';
  return [
    `You are an outside senior engineer + product reviewer looking at someone's personal AI assistant project ("APEX AI" Android Jarvis). You did NOT build it. Be blunt, specific, short.`,
    focus ? `FOCUS: ${focus}` : '',
    `PROJECT BRAIN FILE:\n${digest}`,
    `AGENT'S OWN RECENT LOG:\n${log}`,
    `Reply ONLY in this shape, in Hinglish (Roman script), max 850 characters, no markdown symbols, no emoji:`,
    `RISK: 3 lines (sabse bada pehle)`,
    `NEXT: 3 lines (aaj karne jaisa, concrete)`,
    `STOP: 1 line (ek aisi aadat/feature jo nuksaan de rahi hai)`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function clean(t: string): string {
  return String(t || '')
    .replace(/[*_`#>]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 1400);
}

export async function runOutsideEye(focus?: string): Promise<OutsideEyeResult> {
  const prompt = buildOutsideEyePrompt(focus);

  const viaGemini = clean((await askGeminiWithUserKey(prompt, []).catch(() => null)) || '');
  if (viaGemini.length > 40) {
    rememberReview(viaGemini, 'gemini');
    return { ok: true, text: viaGemini, source: 'gemini' };
  }

  try {
    const r = await hubFetch('/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: prompt, message: prompt }),
    });
    if (!r || !r.ok) {
      return { ok: false, text: '', source: 'none', note: 'Na Gemini key hai na server reachable — review nahi ho paya' };
    }
    const txt = await r.text();
    let j: any = {};
    try {
      j = JSON.parse(txt);
    } catch {
      return { ok: false, text: clean(txt).slice(0, 300), source: 'none', note: 'Server ne JSON nahi diya (worker purana/deploy nahi?)' };
    }
    const out = clean(String(j.reply || j.text || j.message || j.output || ''));
    if (out.length < 40) return { ok: false, text: out, source: 'none', note: 'Review khali aaya' };
    rememberReview(out, 'worker');
    return { ok: true, text: out, source: 'worker' };
  } catch (e: any) {
    return { ok: false, text: '', source: 'none', note: String(e?.message || 'network error') };
  }
}

function rememberReview(text: string, src: string): void {
  const risks = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^(NEXT|STOP)[:\s]/i.test(l))
    .slice(0, 4);
  for (const line of risks) autoRemember('open', `👁️ Outside eye (${src}): ${line}`);
}
