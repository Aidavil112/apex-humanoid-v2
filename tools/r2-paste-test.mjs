// ═══════════════════════════════════════════════════════════════════════════
// 🪣 R2 PASTE PARSER TEST — asli engine function (parseR2Paste +
//    r2CredentialCandidates) esbuild se bundle karke, wahi CLI jo
//    jsdom-harness use karta hai. Shipped code chalta hai, nakal nahi.
// Use: node tools/r2-paste-test.mjs   (ya bash tools/ui-test.sh ke baad)
// ═══════════════════════════════════════════════════════════════════════════
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import path from 'node:path';
const REPO = path.resolve(import.meta.dirname, '..');
const entry = path.join(REPO, '.r2-entry.ts');
const out = path.join(REPO, 'tools/.r2-bundle.mjs');
writeFileSync(entry, `export { parseR2Paste, r2CredentialCandidates, describeR2, isR2Configured } from './src/engine/r2Host';\n`);
try {
  execSync(`./node_modules/.bin/esbuild .r2-entry.ts --bundle --format=esm --platform=node --outfile=tools/.r2-bundle.mjs --log-level=error`, { cwd: REPO, stdio: 'pipe' });
} catch (e) {
  console.error('❌ esbuild fail:', String(e.stdout || e.message).slice(0, 400));
  process.exit(2);
} finally {
  try { unlinkSync(entry); } catch {}
}
const mod = await import('file://' + out);
const P = mod.parseR2Paste, CAND = mod.r2CredentialCandidates;
let pass = 0, fail = 0;
const t = (n, ok, extra = '') => { ok ? pass++ : fail++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : `  · ${extra}`)); };
const EP = 'https://94ea16c0091301b4c04df6ba9a98c0f9.r2.cloudflarestorage.com';
const PUB = 'https://pub-879f71683a7a403aa61fa1fb120f90d7.r2.dev';
const AK = 'A1B2C3D4E5F60718293A4B5C6D7E8F90';
const SK = '9f3Kz7Qp1Lm4Rt8Yw2Xc5Vb0Nh6Jd3Gs7Fk2Pq9Z';

console.log('═══ R2 PASTE PARSER ═══');
const a = P(`endpoint: ${EP}\nbucket: apex\naccess key id: ${AK}\nsecret access key: ${SK}\npublic: ${PUB}`);
t('Cloudflare-style labels → endpoint+bucket+keys+public', a.endpoint === EP && a.bucket === 'apex' && a.accessKeyId === AK && a.secretAccessKey === SK && a.publicBaseUrl === PUB, JSON.stringify(a));
const b = P(`endpoint: ${EP}\nbucket: apex\naccess: ${AK}\nsecret: ${SK}\npublic: ${PUB}`);
t('chhota colon form (access:/secret:) — v6.6.15 fix', b.accessKeyId === AK && b.secretAccessKey === SK, JSON.stringify(b));
const c = P(`aws_access_key_id = ${AK}\naws_secret_access_key = ${SK}\nendpoint_url = ${EP}`);
t('AWS-CLI style block se bhi keys + endpoint nikle', c.endpoint === EP && !!CAND(`aws_access_key_id = ${AK}\naws_secret_access_key = ${SK}`)[0], JSON.stringify(c));
const d = P(`endpoint: ${EP}\npublic: ${PUB}`);
t('keys gaib ho to galat value na bhar de (undefined hi rahe)', !d.accessKeyId && !d.secretAccessKey && d.publicBaseUrl === PUB, JSON.stringify(d));
const e = P(`bucket:   apex\nAccess Key ID: ${AK}\nSecret Access Key: ${SK}`);
t('extra spaces + Capital labels (Access Key ID:) → parse', e.accessKeyId === AK && e.secretAccessKey === SK && e.bucket === 'apex', JSON.stringify(e));
// user ke asli screenshot wali values (endpoint + public URL) — 5-line template ka end-to-end
const real = P(`endpoint: ${EP}\nbucket: apex\naccess key id: ${AK}\nsecret access key: ${SK}\npublic: ${PUB}`);
t('apex bucket ke asli endpoint/public ke saath isR2Configured → true', mod.isR2Configured({ ...real, keyPrefix: 'vault', useWorkerProxy: false, enabled: true }));
console.log(`\nRESULT ${pass}/${pass + fail}` + (fail ? ' ❌' : ' ✅'));
try { unlinkSync(out); } catch {}
process.exit(fail ? 1 : 0);
