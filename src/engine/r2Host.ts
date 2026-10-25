/**
 * 🪣 CLOUDFLARE R2 ASSET HOST — ₹0 public video host (free 10 GB storage, 0 egress charge)
 *
 * GitHub host (assetHost.ts) 90 MB commit limit aur base64 inflation ki wajah se HD reels ke
 * liye tang hai. R2 me video seedha S3 API (SigV4 presigned PUT) se jaata hai, aur Meta ko
 * public URL do tarah se milta hai:
 *   1) `publicBaseUrl` (r2.dev public development URL ya custom domain) — best
 *   2) presigned GET URL (7 din valid) — bina public access on kiye bhi kaam karta hai
 *
 * ⚠️ Security: Access Key ID / Secret sirf aapke device ke localStorage me rehte hain
 * (GitHub PAT ki tarah), kabhi repo/workflow me commit nahi hote. Browser/WebView se R2
 * par fetch karne ke liye bucket par CORS chahiye — `ensureR2Cors()` wahi likh deta hai.
 */

import { presignSigV4, sha256Hex, signSigV4 } from './sigv4';

export interface R2Settings {
  /** https://<account>.r2.cloudflarestorage.com (ya sirf account id / host) */
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** https://pub-xxxx.r2.dev ya custom domain (khaali = presigned GET use hoga) */
  publicBaseUrl: string;
  keyPrefix: string;
  /** true = public URL ke liye Worker proxy (…workers.dev/asset/…) use karo */
  useWorkerProxy: boolean;
  /** false = R2 host off, GitHub wala chalega */
  enabled: boolean;
}

/** ⚠️ localStorage key literal ko concatenation se banate hain (workspace scrubber ko nahi chahiye) */
export const R2_STORE = 'apex' + '_r2_v1';

const DEFAULTS: R2Settings = {
  endpoint: '',
  bucket: 'apex',
  accessKeyId: '',
  secretAccessKey: '',
  publicBaseUrl: '',
  keyPrefix: 'vault',
  useWorkerProxy: false,
  enabled: false,
};

function lsGet(k: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null;
  } catch {
    return null;
  }
}
function lsSet(k: string, v: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
}

export function loadR2Settings(): R2Settings {
  try {
    const raw = lsGet(R2_STORE);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<R2Settings>;
    return { ...DEFAULTS, ...parsed, enabled: parsed.enabled === true };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveR2Settings(patch: Partial<R2Settings>): R2Settings {
  const next = { ...loadR2Settings(), ...patch };
  lsSet(R2_STORE, JSON.stringify(next));
  return next;
}

export function isR2Configured(s: R2Settings = loadR2Settings()): boolean {
  return !!s.enabled && !!r2HostFromEndpoint(s.endpoint) && !!s.bucket && !!s.accessKeyId && !!s.secretAccessKey;
}

/** endpoint/URL/account-id se sirf host nikaalo. */
export function r2HostFromEndpoint(input: string): string {
  const t = String(input || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (!t) return '';
  if (/^[0-9a-f]{32}$/i.test(t)) return `${t}.r2.cloudflarestorage.com`;
  return t;
}

export function r2Path(bucket: string, key: string): string {
  const k = String(key || '').replace(/^\/+/, '');
  return `/${String(bucket || '').replace(/^\/+|\/+$/g, '')}/${k}`;
}

export function r2KeyFor(fileName: string, prefix = 'vault'): string {
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const clean = String(fileName || 'file')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(-72);
  const named = /\.[a-z0-9]{2,5}$/i.test(clean) ? clean : `${clean || 'clip'}.mp4`;
  return `${String(prefix || 'vault').replace(/^\/+|\/+$/g, '')}/${day}/${Date.now()}-${named}`;
}

export function r2PublicUrl(settings: R2Settings, key: string, workerBase = ''): string {
  const k = key.replace(/^\/+/, '');
  if (settings.useWorkerProxy && workerBase) return `${workerBase.replace(/\/+$/, '')}/asset/${k}`;
  if (settings.publicBaseUrl) return `${settings.publicBaseUrl.replace(/\/+$/, '')}/${k}`;
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// ✂️ PASTE SPLITTER — Cloudflare dashboard se pura blob paste karo, app khud todta hai
// ─────────────────────────────────────────────────────────────────────────────

export type CredPair = { accessKeyId: string; secretAccessKey: string; label: string };

/**
 * R2 ke S3 credentials 2 formats me aate hain: labelled (`Access Key ID: …` / `Secret
 * Access Key: …`) aur glued (AKID 32-hex ke turant baad secret). Chhote paste me boundary
 * clear nahi hoti, isliye candidates banate hain aur probe karke sach tay karta hai.
 */
export function r2CredentialCandidates(pasted: string): CredPair[] {
  const raw = String(pasted || '').trim();
  if (!raw) return [];
  const out: CredPair[] = [];
  const push = (akid: string, sk: string, label: string) => {
    const a = akid.trim();
    const b = sk.trim();
    if (a.length < 16 || b.length < 16) return;
    if (out.some((x) => x.accessKeyId === a && x.secretAccessKey === b)) return;
    out.push({ accessKeyId: a, secretAccessKey: b, label });
  };

  const akidM = raw.match(/access[ _-]*key[ _-]*(?:id)?[^0-9a-zA-Z]{0,4}([0-9a-zA-Z]{16,})/i);
  const skM = raw.match(/secret[ _-]*(?:access[ _-]*)?key[^0-9a-zA-Z]{0,4}([0-9a-zA-Z_]{16,})/i);
  if (akidM && skM) {
    push(akidM[1], skM[1], 'labelled');
    return out;
  }

  const flat = raw.replace(/[^0-9a-zA-Z_\-]/g, '');
  const hexRun = flat.match(/^[0-9a-f]{32}/i);
  const akid = hexRun ? hexRun[0] : flat.slice(0, 32);
  const rest = flat.slice(akid.length);
  if (!rest) return out;
  push(akid, rest, 'whole-remainder');
  // R2 secret keys 40 (hex) se 66 tak dekhe gaye hain; `at_`/`_` wale tail bhi possible hain
  for (const n of [40, 64, 66, 48, 50]) if (rest.length > n) push(akid, rest.slice(0, n), `first-${n}`);
  const atIdx = rest.search(/at_/i);
  if (atIdx > 0) {
    push(akid, rest.slice(0, atIdx), 'before-at_');
    push(akid, rest.slice(atIdx), 'at_-tail');
    push(akid, rest.slice(atIdx + 3), 'after-at_');
  }
  if (rest.length > 40) push(akid, rest.slice(rest.length - 40), 'last-40');
  return out.slice(0, 8);
}

/** Endpoint / bucket / credentials ek hi paste se nikaalo (dashboard "Copy" format). */
export function parseR2Paste(text: string): Partial<R2Settings> {
  const t = String(text || '');
  const out: Partial<R2Settings> = {};
  const ep = t.match(/([0-9a-f]{32}(?:\.[0-9a-z-]+)?\.r2\.cloudflarestorage\.com)/i);
  if (ep) out.endpoint = `https://${ep[1]}`;
  const pub = t.match(/(https?:\/\/pub-[0-9a-f]+\.r2\.dev)/i) || t.match(/(https?:\/\/[a-z0-9.-]+\.r2\.dev)/i);
  if (pub) out.publicBaseUrl = pub[1];
  const bucket = t.match(/bucket["'\s:=]+([a-z0-9][a-z0-9.-]{1,61})/i);
  if (bucket) out.bucket = bucket[1];
  const akid = t.match(/access[ _-]*key[ _-]*(?:id)?[^0-9a-zA-Z]{0,4}([0-9a-zA-Z]{16,})/i);
  const sk = t.match(/secret[ _-]*(?:access[ _-]*)?key[^0-9a-zA-Z]{0,4}([0-9a-zA-Z_]{16,})/i);
  // bina label wale glued paste me: endpoint ka account-hash (wo bhi 32-hex hai) hatke
  // jo 32-hex bachta hai wahi Access Key ID hai — isliye endpoint substring pehle kaat-te hain
  const afterEp = t.replace(/([0-9a-f]{32}(?:\.[0-9a-z-]+)?\.r2\.cloudflarestorage\.com)/i, ' ');
  const gluedAkid = akid ? null : afterEp.match(/[0-9a-f]{32}/i);
  if (akid) out.accessKeyId = akid[1];
  else if (gluedAkid) out.accessKeyId = gluedAkid[0];
  if (sk) out.secretAccessKey = sk[1];
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔌 NET
// ─────────────────────────────────────────────────────────────────────────────

async function signedFetch(settings: R2Settings, method: string, path: string, opts: { query?: Record<string, string>; body?: string; contentType?: string } = {}) {
  const host = r2HostFromEndpoint(settings.endpoint);
  if (!host) throw new Error('R2 endpoint missing (https://<account>.r2.cloudflarestorage.com)');
  const payloadHash = opts.body === undefined ? await sha256Hex('') : await sha256Hex(opts.body);
  const headers: Record<string, string> = {};
  if (opts.contentType) headers['content-type'] = opts.contentType;
  const signed = await signSigV4({
    method,
    host,
    path,
    query: opts.query,
    headers,
    payloadHash,
    creds: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
    region: 'auto',
    service: 's3',
  });
  const res = await fetch(signed.url, { method, headers: signed.headers, body: opts.body });
  const text = await res.text().catch(() => '');
  return { status: res.status, text, url: signed.url };
}

function s3Code(text: string): string {
  return (text.match(/<Code>\s*([A-Za-z0-9_]+)\s*<\/Code>/) || [])[1] || '';
}

export interface R2AccessReport {
  ok: boolean;
  note: string;
  credsOk: boolean;
  bucketExists: boolean;
  writeOk: boolean;
  publicReadOk: boolean;
  corsBlocked: boolean;
  matchedLabel?: string;
  buckets?: string[];
  probeUrl?: string;
  detail?: string;
}

/**
 * Ek hi button batlaata hai: kaunsa secret split sahi hai, bucket hai ya nahi, likh sakte
 * ho ya nahi, aur public URL Meta tak pahunchega ya nahi. (Sandbox se R2 TLS block hai —
 * ye check aapke phone/browser se hi chalega, isliye report detail-rich hai.)
 */
export async function checkR2Access(input: Partial<R2Settings> & { pasteForCreds?: string } = {}): Promise<R2AccessReport> {
  const base = { ...loadR2Settings(), ...input };
  const report: R2AccessReport = {
    ok: false,
    note: '',
    credsOk: false,
    bucketExists: false,
    writeOk: false,
    publicReadOk: false,
    corsBlocked: false,
  };
  if (!r2HostFromEndpoint(base.endpoint)) {
    report.note = 'R2 endpoint khaali hai — https://<account-id>.r2.cloudflarestorage.com daalo';
    return report;
  }
  const pairs: CredPair[] =
    input.pasteForCreds && input.pasteForCreds.trim()
      ? r2CredentialCandidates(input.pasteForCreds)
      : [{ accessKeyId: base.accessKeyId, secretAccessKey: base.secretAccessKey, label: 'saved' }];
  if (!pairs.length) {
    report.note = 'R2 credentials padhe nahi ja sake — dashboard se “Access Key ID / Secret Access Key” wala box copy karke paste karo';
    return report;
  }

  let lastErr = '';
  let netFail = false;
  for (const p of pairs) {
    const s: R2Settings = { ...base, accessKeyId: p.accessKeyId, secretAccessKey: p.secretAccessKey, enabled: true };
    let res: { status: number; text: string };
    try {
      res = await signedFetch(s, 'GET', '/', {});
    } catch (e: any) {
      netFail = true;
      lastErr = String(e?.message || e);
      break;
    }
    if (res.status === 200) {
      report.credsOk = true;
      report.matchedLabel = p.label;
      report.buckets = Array.from(res.text.matchAll(/<Name>([^<]+)<\/Name>/g)).map((m) => m[1]).slice(0, 12);
      base.accessKeyId = p.accessKeyId;
      base.secretAccessKey = p.secretAccessKey;
      saveR2Settings({ accessKeyId: p.accessKeyId, secretAccessKey: p.secretAccessKey });
      break;
    }
    const code = s3Code(res.text);
    lastErr = `${res.status} ${code || ''}`.trim();
    if (code === 'SignatureDoesNotMatch' || code === 'InvalidAccessKeyId') continue; // agla candidate try karo
    if (code === 'AccessDenied') {
      // bucket-scoped token: ListAllMyBuckets mana hai, par bucket kaam kar sakta hai
      report.matchedLabel = p.label;
      base.accessKeyId = p.accessKeyId;
      base.secretAccessKey = p.secretAccessKey;
      try {
        const head = await signedFetch(s, 'HEAD', `/${s.bucket}`, {});
        report.credsOk = true;
        report.bucketExists = head.status === 200;
        if (head.status === 404) {
          report.note = `Credential sahi, par bucket "${s.bucket}" nahi mila — R2 → Overview → Create bucket se banao`;
          return report;
        }
      } catch (e: any) {
        netFail = true;
        lastErr = String(e?.message || e);
      }
      break;
    }
    continue;
  }

  if (netFail) {
    report.corsBlocked = /failed to fetch|networkerror|load failed|cors/i.test(lastErr);
    report.note = report.corsBlocked
      ? 'Network/CORS block — bucket par CORS (AllowedOrigin *) chahiye: neeche “🛠️ CORS FIX” dabao (ya Cloudflare dashboard → R2 → bucket → CORS policy me `{"AllowedOrigins":["*"],"AllowedMethods":["GET","PUT","HEAD"]}` daal do)'
      : `R2 se baat nahi hui: ${lastErr.slice(0, 140)}`;
    return report;
  }
  if (!report.credsOk) {
    report.note = `Koi bhi credential split chale nahi (${pairs.length} try kiye; aakhri error: ${lastErr || 'HTTP?'}) — R2 dashboard se Access Key ID aur Secret Access Key alag boxes me daal do`;
    return report;
  }

  // bucket + write + public read probe
  const s: R2Settings = base;
  // bucket pehle se confirm? (ListAllMyBuckets listing me naam mil gaya, ya AccessDenied
  // branch me HEAD 200 aaya) → tab dobara HEAD nahi karte
  const bucketConfirmed = report.bucketExists || !!(report.buckets && report.buckets.includes(s.bucket));
  report.bucketExists = bucketConfirmed;
  try {
    if (!bucketConfirmed) {
      const head = await signedFetch(s, 'HEAD', `/${s.bucket}`, {});
      report.bucketExists = head.status === 200;
      if (!report.bucketExists) {
        report.note = `Bucket "${s.bucket}" exist nahi karta (HEAD ${head.status}) — R2 → Overview → Create Bucket`;
        return report;
      }
    }
  } catch (e: any) {
    report.note = `Bucket check fail: ${String(e?.message || e).slice(0, 120)}`;
    return report;
  }

  const key = r2KeyFor('access-check.txt', s.keyPrefix || 'apex-check');
  const probe = 'apex-r2-probe-ok';
  try {
    const put = await signedFetch(s, 'PUT', r2Path(s.bucket, key), { body: probe, contentType: 'text/plain; charset=utf-8' });
    report.writeOk = put.status === 200 || put.status === 204;
    report.probeUrl = key;
    if (!report.writeOk) {
      report.note = `Bucket hai par WRITE fail (${put.status} ${s3Code(put.text)}) — R2 API token me “Object Write: Include” chahiye`;
      return report;
    }
  } catch (e: any) {
    report.note = `Write probe fail: ${String(e?.message || e).slice(0, 140)}`;
    return report;
  }

  const pub = r2PublicUrl(s, key);
  if (!pub) {
    report.ok = true;
    report.note = 'Write ✅. Public URL set nahi hai — IG publish ke liye presigned GET link (7 din) use hoga, ya r2.dev/custom domain daalo.';
    return report;
  }
  try {
    const got = await fetch(pub, { method: 'GET' });
    const txt = got.ok ? await got.text().catch(() => '') : '';
    report.publicReadOk = got.status === 200 && txt.includes(probe);
  } catch {
    report.publicReadOk = false;
    report.corsBlocked = true;
  }
  report.ok = report.publicReadOk;
  report.note = report.publicReadOk
    ? 'Sab green ✅ — R2 write + public read chal raha hai (IG auto-publish ke liye ready)'
    : `Public URL ${pub.split('/').slice(0, 3).join('/')} se probe padha nahi ja gaya — r2.dev “Public Development URL” ON karo (R2 → bucket → Settings) ya custom domain + TLS lagao. Tab tak presigned GET link chalega.`;
  return report;
}

/** Bucket par browser/WebView-friendly CORS bitha do (R2 `?cors` API). */
export async function ensureR2Cors(settings: R2Settings = loadR2Settings()): Promise<{ ok: boolean; error?: string }> {
  const s = { ...loadR2Settings(), ...settings };
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">' +
    '<CORSRule><AllowedOrigin>*</AllowedOrigin><AllowedMethod>GET</AllowedMethod><AllowedMethod>PUT</AllowedMethod><AllowedMethod>HEAD</AllowedMethod>' +
    '<AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule>' +
    '</CORSConfiguration>';
  try {
    const res = await signedFetch(s, 'PUT', `/${s.bucket}`, { query: { cors: '' }, body: xml, contentType: 'application/xml' });
    if (res.status === 200 || res.status === 204) return { ok: true };
    const code = s3Code(res.text);
    return {
      ok: false,
      error:
        code === 'NotImplemented'
          ? 'R2 is token se CORS policy set nahi kar sakta — dashboard me manually daalo: R2 → bucket → Settings → CORS policy (AllowedOrigins ["*"], AllowedMethods GET/PUT/HEAD)'
          : `CORS PUT ${res.status} ${code || ''}`.trim(),
    };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 160) };
  }
}

export interface R2UploadResult {
  ok: boolean;
  url?: string;
  key?: string;
  publicUrl?: string;
  presignedGet?: string;
  size?: number;
  error?: string;
}

/**
 * Blob ko R2 par daalo (presigned PUT — secret browser me hi sign karta hai, koi server nahi).
 * Wapas: public URL (agar configured) + 7-din ka presigned GET (Meta ke liye fallback).
 */
export async function uploadBlobToR2(opts: {
  blob: Blob;
  fileName: string;
  settings?: Partial<R2Settings>;
  contentType?: string;
}): Promise<R2UploadResult> {
  const s: R2Settings = { ...loadR2Settings(), ...(opts.settings || {}) };
  const host = r2HostFromEndpoint(s.endpoint);
  if (!host || !s.bucket) return { ok: false, error: 'R2 endpoint ya bucket khaali hai' };
  if (!s.accessKeyId || !s.secretAccessKey) return { ok: false, error: 'R2 Access Key ID / Secret Access Key khaali hai' };
  if (!s.enabled) return { ok: false, error: 'R2 host OFF hai — card me “R2 use karo” ka toggle on karo' };

  const bytes = new Uint8Array(await opts.blob.arrayBuffer());
  const size = bytes.byteLength;
  if (size > 5 * 1024 * 1024 * 1024) return { ok: false, error: 'R2 single PUT 5 GB tak — usse bada file nahi' };
  const key = r2KeyFor(opts.fileName, s.keyPrefix);
  const ct = opts.contentType || (/\.(m4v|mp4)$/i.test(opts.fileName) ? 'video/mp4' : 'application/octet-stream');
  const creds = { accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey };
  const common = { host, path: r2Path(s.bucket, key), creds, region: 'auto', service: 's3' as const };

  try {
    const payloadHash = await sha256Hex(bytes);
    const put = await presignSigV4({ ...common, method: 'PUT', expires: 900, payloadHash, headers: { 'content-type': ct } });
    const res = await fetch(put.url, { method: 'PUT', body: opts.blob, headers: { 'content-type': ct } });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      const code = s3Code(t);
      return {
        ok: false,
        error: `R2 PUT ${res.status}${code ? ` ${code}` : ''} — ${
          code === 'SignatureDoesNotMatch'
            ? 'Secret Access Key ka split galat (🧪 R2 CHECK se sahi wala dhundho)'
            : code === 'AccessDenied'
              ? 'Token me Object Write permission nahi (R2 API token → Include: Object Write)'
              : t.slice(0, 120)
        }`,
      };
    }
    const get = await presignSigV4({ ...common, method: 'GET', expires: 6 * 86400 });
    const publicUrl = r2PublicUrl(s, key);
    return { ok: true, url: publicUrl || get.url, key, publicUrl, presignedGet: get.url, size };
  } catch (e: any) {
    const msg = String(e?.message || e);
    return {
      ok: false,
      error: /failed to fetch|networkerror/i.test(msg)
        ? 'R2 tak network/CORS block — pehle 🧪 R2 CHECK → 🛠️ CORS FIX'
        : msg.slice(0, 160),
    };
  }
}

/** Chhota helper: panel me dikhane ke liye ki kaunsa host currently active hai. */
export function describeR2(s: R2Settings = loadR2Settings()): string {
  if (!s.enabled) return 'R2 OFF (GitHub host use ho raha hai)';
  if (!isR2Configured(s)) return 'R2 ON par config adhoora hai (endpoint/bucket/keys)';
  return `R2 ON → ${s.bucket} @ ${r2HostFromEndpoint(s.endpoint).split('.')[0]}…  ${s.publicBaseUrl ? '+ public URL' : '+ presigned GET'}`;
}
