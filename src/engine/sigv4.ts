/**
 * 🔐 AWS Signature V4 (S3-compatible) — sirf Web Crypto se, koi dependency nahi.
 * Browser (APEX WebView), Node (harness) aur Cloudflare Worker — teeno me chalta hai.
 *
 * Kyun chahiye: Cloudflare R2 (free 10 GB) ek public asset host hai — video seedha
 * R2 par PUT karne ke liye (presigned URL) aur padhne ke liye (signed GET) sign karna
 * padta hai. Is file me sirf signing hai, koi fetch nahi — isliye test vectors se
 * verify kiya ja sakta hai (AWS ka official aws4_testsuite).
 */

export interface SigV4Creds {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface SigV4Input {
  method: string;
  /** bina scheme ke host, e.g. `abcd….r2.cloudflarestorage.com` */
  host: string;
  /** '/bucket/key' — jaisa hai waisa (R2/S3 path me bucket aata hai) */
  path: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  /** hex sha256 ya 'UNSIGNED-PAYLOAD' (S3/IG ke liye default = empty body ka hash) */
  payloadHash?: string;
  /** S3/R2 me x-amz-content-sha256 sign hota hai; generic AWS service vectors me nahi. */
  signPayloadHash?: boolean;
  creds: SigV4Creds;
  /** R2 = 'auto' */
  region?: string;
  service?: string;
  /** '20150830T123600Z' — fix karoge to test vector reproduce hota hai */
  amzDate?: string;
  date?: Date;
}

export interface SigV4Result {
  url: string;
  headers: Record<string, string>;
  canonicalRequest: string;
  stringToSign: string;
  signature: string;
  credentialScope: string;
  signedHeaders: string;
}

const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

const textEnc = new TextEncoder();

function subtle(): SubtleCrypto {
  const c: any = (globalThis as any).crypto;
  if (!c || !c.subtle) throw new Error('Web Crypto (crypto.subtle) nahi mila — HTTPS/secure context chahiye');
  return c.subtle as SubtleCrypto;
}

function bytesToHex(buf: ArrayBuffer | Uint8Array): string {
  const v = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < v.length; i++) out += v[i].toString(16).padStart(2, '0');
  return out;
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? textEnc.encode(data) : data;
  return bytesToHex(await subtle().digest('SHA-256', bytes as BufferSource));
}

async function hmacBytes(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const k = key instanceof Uint8Array ? key : new Uint8Array(key);
  const cryptoKey = await subtle().importKey('raw', k as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return subtle().sign('HMAC', cryptoKey, textEnc.encode(message) as BufferSource);
}

/** RFC 3986 encoding (SigV4 rules): unreserved = A–Z a–z 0–9 - _ . ~ */
export function uriEncode(s: string, encodeSlash = true): string {
  let out = '';
  for (const ch of String(s)) {
    if (/[A-Za-z0-9\-_.~]/.test(ch)) out += ch;
    else if (ch === '/' && !encodeSlash) out += ch;
    else {
      const bytes = textEnc.encode(ch);
      for (let i = 0; i < bytes.length; i++) out += `%${bytes[i].toString(16).toUpperCase()}`;
    }
  }
  return out;
}

/** '/bucket/a b.txt' → '/bucket/a%20b.txt' (slash safe rahe) */
export function encodeCanonicalUri(path: string): string {
  const p = String(path || '') || '/';
  const withoutQuery = p.split('?')[0];
  return withoutQuery
    .split('/')
    .map((seg) => uriEncode(seg))
    .join('/');
}

/** percent-encoded input ko pehle decode phir dobara encode (AWS SDKs yahi karti hain) —
 *  warna `%E1%88%B4` → `%25E1%2588%25B4` jaisa double-encode signature tod deta. */
function normEncode(v: string): string {
  const raw = String(v ?? '');
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
    if (/%[0-9A-Fa-f]{2}/.test(decoded)) decoded = raw; // double-decode safe mat karo
  } catch {
    /* malformed % — jaisa hai waisa rakho */
  }
  return uriEncode(decoded);
}

export function canonicalQuery(query?: Record<string, string>): string {
  const pairs: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(query || {})) pairs.push([normEncode(k), normEncode(v === undefined ? '' : v)]);
  pairs.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
  return pairs.map(([k, v]) => `${k}=${v}`).join('&');
}

function stamp(d?: Date): string {
  const t = (d || new Date()).toISOString().replace(/[-:]|\.\d{3}/g, '');
  return t.slice(0, 8) + 'T' + t.slice(9, 15) + 'Z';
}

export function buildCanonicalRequest(i: {
  method: string;
  path: string;
  query?: Record<string, string>;
  headers: Record<string, string>;
  payloadHash: string;
}): { canonicalRequest: string; signedHeaders: string } {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(i.headers)) lower[k.toLowerCase()] = String(v ?? '');
  const names = Object.keys(lower).sort();
  // SigV4: value ke andar ke extra spaces collapse + trim hote hain
  const canonHeaders = names.map((n) => `${n}:${lower[n].replace(/ {2,}/g, ' ').trim()}\n`).join('');
  const signedHeaders = names.join(';');
  const canonicalRequest = [
    i.method.toUpperCase(),
    encodeCanonicalUri(i.path),
    canonicalQuery(i.query),
    canonHeaders,
    signedHeaders,
    i.payloadHash,
  ].join('\n');
  return { canonicalRequest, signedHeaders };
}

/** Header-based signing (fetch me bhejne layaq Authorization + x-amz-* headers). */
export async function signSigV4(i: SigV4Input): Promise<SigV4Result> {
  const region = i.region || 'auto';
  const service = i.service || 's3';
  const amzDate = i.amzDate || stamp(i.date);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = i.payloadHash || EMPTY_SHA256;

  const signPayloadHash = i.signPayloadHash !== false;
  const headers: Record<string, string> = { host: i.host, ...lowerKeys(i.headers) };
  headers['x-amz-date'] = amzDate;
  if (signPayloadHash) headers['x-amz-content-sha256'] = payloadHash;
  else headers['x-amz-content-sha256'] = payloadHash; // bheja jaata hai par signed nahi (non-S3)
  if (i.creds.sessionToken) headers['x-amz-security-token'] = i.creds.sessionToken;

  const signed: Record<string, string> = { ...headers };
  if (!signPayloadHash) delete signed['x-amz-content-sha256'];
  const { canonicalRequest, signedHeaders } = buildCanonicalRequest({
    method: i.method,
    path: i.path,
    query: i.query,
    headers: signed,
    payloadHash,
  });
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;

  let k: ArrayBuffer | Uint8Array = textEnc.encode(`AWS4${i.creds.secretAccessKey}`);
  k = await hmacBytes(k, dateStamp);
  k = await hmacBytes(k, region);
  k = await hmacBytes(k, service);
  k = await hmacBytes(k, 'aws4_request');
  const signature = bytesToHex(await hmacBytes(k, stringToSign));

  // ⚠️ 'host' wapas NAHI bhejte: browser/WebView me Host header set karna forbidden hai —
  //    wo khud same value bhejta hai, isliye signature valid rehta hai (sign to ho gaya).
  const out: Record<string, string> = {};
  for (const [n, v] of Object.entries(headers)) if (n !== 'host') out[n] = v;
  out['Authorization'] =
    `AWS4-HMAC-SHA256 Credential=${i.creds.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const qs = i.query && Object.keys(i.query).length ? `?${canonicalQuery(i.query)}` : '';
  return { url: `https://${i.host}${encodeCanonicalUri(i.path)}${qs}`, headers: out, canonicalRequest, stringToSign, signature, credentialScope, signedHeaders };
}

/** Presigned URL (query-string auth) — browser se direct PUT/GET bina custom header ke. */
export async function presignSigV4(i: SigV4Input & { expires?: number }): Promise<{ url: string; canonicalRequest: string; signedHeaders: string; signature: string }> {
  const region = i.region || 'auto';
  const service = i.service || 's3';
  const amzDate = i.amzDate || stamp(i.date);
  const dateStamp = amzDate.slice(0, 8);
  const expires = Math.max(60, Math.min(604800, i.expires ?? 3600));
  const payloadHash = i.payloadHash || 'UNSIGNED-PAYLOAD';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const signedHeaderNames = ['host', ...Object.keys(i.headers || {}).map((n) => n.toLowerCase())].sort();
  const headerMap: Record<string, string> = { host: i.host, ...lowerKeys(i.headers) };

  const query: Record<string, string> = {
    ...(i.query || {}),
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${i.creds.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': signedHeaderNames.join(';'),
  };
  if (i.creds.sessionToken) query['X-Amz-Security-Token'] = i.creds.sessionToken;
  if (payloadHash !== 'UNSIGNED-PAYLOAD') query['X-Amz-Content-Sha256'] = payloadHash;

  const { canonicalRequest } = buildCanonicalRequest({ method: i.method, path: i.path, query, headers: headerMap, payloadHash });
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;
  let k: ArrayBuffer | Uint8Array = textEnc.encode(`AWS4${i.creds.secretAccessKey}`);
  k = await hmacBytes(k, dateStamp);
  k = await hmacBytes(k, region);
  k = await hmacBytes(k, service);
  k = await hmacBytes(k, 'aws4_request');
  const signature = bytesToHex(await hmacBytes(k, stringToSign));

  const url = `https://${i.host}${encodeCanonicalUri(i.path)}?${canonicalQuery(query)}&X-Amz-Signature=${signature}`;
  return { url, canonicalRequest, signedHeaders: signedHeaderNames.join(';'), signature };
}

function lowerKeys(o?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o || {})) out[k.toLowerCase()] = v;
  return out;
}
