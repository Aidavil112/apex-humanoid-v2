/**
 * 🆓 FREE PUBLIC ASSET HOST — GitHub Contents API se video upload karke
 * ek PUBLIC raw URL banata hai (₹0). Yeh URL Instagram Graph API ko chahiye,
 * kyunki Meta browser se direct file upload allow NAHI karta.
 *
 * ⚠️ Aap jis repo me daalenge woh public ho toh video bhi public rahega
 * (Google me nahi dikhega, par link jannewale dekh sakte hain). Private repo
 * chahiye toh IG auto-publish band rahega — us case me 1-tap handoff use karein.
 */

export interface GithubHostResult {
  ok: boolean;
  url?: string;
  error?: string;
}

function uint8ToBase64Gh(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]);
  }
  return btoa(binary);
}

export function parseGithubRepo(input: string, fallbackOwner = ''): { owner: string; repo: string } | null {
  const txt = (input || '').trim().replace(/\/+$/, '');
  const m = txt.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (m) return { owner: m[1], repo: m[2].replace(/\.git$/i, '') };
  const two = txt.split('/');
  if (two.length === 2 && two[0] && two[1]) return { owner: two[0], repo: two[1] };
  if (fallbackOwner && two.length === 1 && two[0]) return { owner: fallbackOwner, repo: two[0] };
  return null;
}

/** Blob ko repo ke `vault/` path par daalo → raw.githubusercontent.com ka public link wapas. */
export async function uploadBlobToGithub(opts: {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
  folder?: string;
  fileName: string;
  blob: Blob;
}): Promise<GithubHostResult> {
  const { token, owner, repo, fileName } = opts;
  if (!owner || !repo)
    return {
      ok: false,
      error:
        'GitHub username + repo dono chahiye (aapka jo handle use ho raha hai wo GitHub par 404 hai — asli username daalein, jaise "mere-username/apex-brain")',
    };
  if (!token) return { ok: false, error: 'GitHub PAT khaali — fine-grained token chahiye jisme "Contents: Read and write" ho' };
  const branch = opts.branch || 'main';
  const folder = (opts.folder || 'apex-vault').replace(/^\/+|\/+$/g, '');
  const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 90);
  const path = `${folder}/${Date.now()}-${safeName}`;

  try {
    const buf = new Uint8Array(await opts.blob.arrayBuffer());
    if (buf.byteLength > 90_000_000) return { ok: false, error: `File ${(buf.byteLength / 1e6).toFixed(1)} MB — GitHub contents API 90 MB se badi nahi le jaata` };
    const content = uint8ToBase64Gh(buf);

    // existing file ka sha nikaalo (overwrite ke liye)
    let sha = '';
    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${branch}`;
    const g = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'apex-ai' } });
    if (g.ok) sha = String((await g.json())?.sha || '');

    const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`;
    const body: any = {
      message: `🛰️ APEX Jarvis auto-upload ${safeName}`,
      content,
      branch,
    };
    if (sha) body.sha = sha;

    const r = await fetch(putUrl, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'apex-ai' }, body: JSON.stringify(body) });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = String(j?.message || `HTTP ${r.status}`);
      const hint =
        /Bad credentials|Requires authentication/i.test(msg)
          ? `${msg} — PAT me "Contents: Read and write" scope chahiye`
          : /Not Found/i.test(msg)
          ? `${msg} — repo naam ya branch (main) galat lag raha hai`
          : msg;
      return { ok: false, error: hint.slice(0, 220) };
    }
    const raw = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    return { ok: true, url: raw };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧪 ACCESS CHECK — repo exist karta hai? PAT me write chalta hai? raw URL
//    public padha ja sakta hai? (teesra sawaal hi IG auto-publish ki jaan hai —
//    Meta ko public URL chahiye, private repo par hamesha fail hota hai)
// ─────────────────────────────────────────────────────────────────────────────

export interface GithubAccessReport {
  ok: boolean;
  note: string;
  repoExists: boolean;
  writeOk: boolean;
  publicReadOk: boolean;
  defaultBranch?: string;
  isPublic?: boolean;
  rawUrl?: string;
  detail?: string;
}

export async function checkGithubAccess(opts: {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
  writeProbe?: boolean;
}): Promise<GithubAccessReport> {
  const { token, owner, repo } = opts;
  const branch = opts.branch || 'main';
  const base: GithubAccessReport = {
    ok: false,
    note: '',
    repoExists: false,
    writeOk: false,
    publicReadOk: false,
  };
  if (!owner || !repo) return { ...base, note: 'GitHub username + repo daalein (dono)' };
  if (!token) return { ...base, note: 'PAT khaali — pehle token daalein' };

  const H = { Authorization: `Bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'apex-ai' };
  try {
    const g = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: H, cache: 'no-store' });
    if (g.status === 404)
      return { ...base, note: `github.com/${owner}/${repo} 404 hai — username ya repo galat (ya repo aapke account par hai hi nahi)` };
    if (g.status === 401) return { ...base, note: 'PAT reject ho gaya (401) — expired/revoked? Naya fine-grained token banao' };
    if (!g.ok) return { ...base, note: `GitHub API error HTTP ${g.status}` };
    const j: any = await g.json().catch(() => ({}));
    base.repoExists = true;
    base.defaultBranch = String(j?.default_branch || branch);
    base.isPublic = Boolean(j?.public);
    if (j?.public === false)
      return {
        ...base,
        note: `Repo ${owner}/${repo} PRIVATE hai — IG auto-publish aur brain CLAUDE.md ke liye PUBLIC repo chahiye (Meta ko bina login link kholna hota hai). Settings → Danger zone → Change visibility.`,
      };

    let sha = '';
    const path = 'apex-vault/.apex-access-check';
    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${base.defaultBranch}`;
    const gu = await fetch(getUrl, { headers: H });
    if (gu.ok) sha = String(((await gu.json().catch(() => ({}))) as any)?.sha || '');

    if (opts.writeProbe !== false) {
      const content = btoa(`APEX access check ${new Date().toISOString()}\n`);
      const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
        method: 'PUT',
        headers: H,
        body: JSON.stringify({ message: '🧪 APEX access check', content, branch: base.defaultBranch, ...(sha ? { sha } : {}) }),
      });
      base.writeOk = r.ok;
      if (!r.ok) {
        const m = String(((await r.json().catch(() => ({}))) as any)?.message || `HTTP ${r.status}`);
        base.detail = m;
        if (/access|permission|resource protected|403/i.test(m))
          return { ...base, note: `Repo mila par LICENSE/PAT me write nahi chal raha — "Contents: Read and write" permission dekar dobara` };
        return { ...base, note: `Repo mila, write fail: ${m.slice(0, 90)}` };
      }
    }

    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${base.defaultBranch}/${path}`;
    const raw = await fetch(`${rawUrl}?t=${Date.now()}`, { cache: 'no-store' });
    base.publicReadOk = raw.ok;
    base.rawUrl = rawUrl;
    if (!base.publicReadOk)
      return {
        ...base,
        note: 'Repo + write ✅ par raw.githubusercontent ❌ — repo PRIVATE hai. IG auto-publish ke liye PUBLIC repo chahiye (Meta ko link kholna hota hai).',
      };
    return {
      ...base,
      ok: true,
      note: `Sab thik: repo ✅ write ✅ public read ✅${opts.writeProbe === false ? '' : ' (ek chhota test file apex-vault/.apex-access-check ban gaya)'}`,
    };
  } catch (e: any) {
    return { ...base, note: `Network: ${String(e?.message || e).slice(0, 120)}` };
  }
}
