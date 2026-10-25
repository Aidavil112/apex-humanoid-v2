// ═══════════════════════════════════════════════════════════════════════════
// 🧪 CLICK SWEEP — App ka har button (aur naye khulne wale buttons) real click.
//    Report: 💥 THREW/ERROR = dead button jaisa; 😴 NO-EFFECT = suspect.
//    Lakhshya: 0 error. (v6.6.9 me isse hi 21 errors 0 par laaye the.)
// Use: bash tools/ui-test.sh    ·    node tools/click-sweep.mjs
// ═══════════════════════════════════════════════════════════════════════════
import { mountApp, buildBundle, els, norm, byText, bodyText, click, sleep, trackErrors } from './jsdom-harness.mjs';

buildBundle();
const { errors } = await mountApp();
trackErrors(errors);

const SEL_KEY = (el) => (norm(el.textContent) || el.getAttribute('aria-label') || el.getAttribute('href') || 'x').slice(0, 46) + '|' + String(el.className || '').slice(0, 34);
const seen = new Set();
const rows = [];
for (let pass = 0; pass < 5; pass++) {
  const list = els();
  const fresh = list.filter((el) => el.isConnected && !seen.has(SEL_KEY(el)));
  if (!fresh.length) break;
  for (const stale of fresh) {
    const key = SEL_KEY(stale);
    if (seen.has(key)) continue;
    seen.add(key);
    const el = stale;
    const label = norm(el.textContent) || el.getAttribute('aria-label') || '(icon)';
    if (el.disabled) { rows.push({ label, state: 'disabled' }); continue; }
    const before = errors.length;
    const snap = document.body.innerHTML.length;
    const r = click(el);
    await sleep(60);
    const newErr = errors.length > before;
    rows.push({
      label: label.slice(0, 44),
      state: !r.ok ? 'THREW' : newErr ? 'ERROR' : Math.abs(document.body.innerHTML.length - snap) > 0 ? 'ok' : 'NO-EFFECT',
      detail: !r.ok ? r.why : newErr ? errors.slice(before).join(' | ').slice(0, 150) : '',
    });
  }
  await sleep(60);
}
const c = {};
for (const x of rows) c[x.state] = (c[x.state] || 0) + 1;
console.log('═══ CLICK SWEEP ═══');
console.log(`buttons clicked: ${rows.length} · summary: ${JSON.stringify(c)}`);
const bad = rows.filter((x) => x.state === 'THREW' || x.state === 'ERROR');
if (bad.length) console.log(bad.map((x) => `   💥 ${x.label}${x.detail ? ' — ' + x.detail : ''}`).join('\n'));
const noEff = rows.filter((x) => x.state === 'NO-EFFECT');
if (noEff.length) console.log('   😴 no-effect (check karo): ' + noEff.map((x) => x.label).join(' · '));
if (errors.length) console.log('errors:\n' + [...new Set(errors)].slice(0, 10).map((e) => '   • ' + e).join('\n'));
console.log(bad.length === 0 && errors.length === 0 ? '\n✅ VERDICT: koi button exception nahi de raha' : '\n❌ VERDICT: upar wale button thike karo');
process.exit(bad.length === 0 && errors.length === 0 ? 0 : 1);
