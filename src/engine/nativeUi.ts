// ═══════════════════════════════════════════════════════════════════════════
// 📱 APEX Native UI helpers (v6.6.9)
// Android WebView me ye 3 cheezein chup-chaap fail hoti hain — isliye user ko
// lagta tha "button click hi nahi hota":
//   1) window.open(...)        → popup support na ho to kuch nahi hota
//   2) navigator.clipboard     → file:// / permission par undefined ya throw
//   3) clipboard.readText()    → WebView me allowed nahi (paste button dead)
// Ab sab pehle native bridge (ApexAndroid) try karte hain, phir browser,
// phir purana execCommand — aur kabhi throw nahi karte.
// ═══════════════════════════════════════════════════════════════════════════

type ApexWin = Window & { ApexAndroid?: Record<string, unknown> };

function bridge(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  const b = (window as ApexWin).ApexAndroid;
  return b && typeof b === 'object' ? b : null;
}

/** 🔗 Link/app kholo. Android par Intent, browser me naya tab, phir same tab. */
export function apexOpen(url: string): boolean {
  const u = String(url || '').trim();
  if (!u) return false;
  const b = bridge();
  const openUrl = b && (b.openUrl as ((x: string) => void) | undefined);
  if (typeof openUrl === 'function') {
    try {
      openUrl(u);
      return true;
    } catch {
      /* bridge fail → browser path try karo */
    }
  }
  try {
    const w = window.open(u, '_blank', 'noopener,noreferrer');
    if (w) return true;
  } catch {
    /* ignored */
  }
  try {
    window.location.href = u;
    return true;
  } catch {
    return false;
  }
}

/** 📋 Text copy — hamesha safe; return true = copy ho gaya. */
export async function apexCopy(text: string): Promise<boolean> {
  const t = String(text ?? '');
  if (!t) return false;
  const b = bridge();
  const copyText = b && (b.copyText as ((x: string) => void) | undefined);
  if (typeof copyText === 'function') {
    try {
      copyText(t);
      return true;
    } catch {
      /* fallthrough */
    }
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {
    /* fallthrough */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.setAttribute('readonly', 'readonly');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** 📋 Clipboard padho (na milne par khaali string — kabhi throw nahi). */
export async function apexPaste(): Promise<string> {
  const b = bridge();
  const readText = b && (b.readText as (() => string) | undefined);
  if (typeof readText === 'function') {
    try {
      const v = readText();
      if (typeof v === 'string' && v.trim()) return v;
    } catch {
      /* fallthrough */
    }
  }
  try {
    if (navigator.clipboard?.readText) return (await navigator.clipboard.readText()) || '';
  } catch {
    /* ignored */
  }
  return '';
}

/** ⌨️ Chhota in-app input box (PIN jaisa). WebView me prompt() kabhi dab jaata
 *  hai — isliye pehle prompt try, na mile to apna box. Cancel = null. */
export function apexAskText(title: string, hint = ''): Promise<string | null> {
  const ask = hint ? `${title} — ${hint}` : title;
  return new Promise((resolve) => {
    try {
      const wrap = document.createElement('div');
      wrap.setAttribute('style', 'position:fixed;inset:0;z-index:2147483000;background:rgba(2,6,16,.88);display:flex;align-items:center;justify-content:center;padding:20px');
      const card = document.createElement('div');
      card.setAttribute('style', 'width:100%;max-width:340px;background:#0b1420;border:1px solid rgba(125,211,252,.35);border-radius:18px;padding:16px;font-family:system-ui;color:#e8f4ff');
      const h = document.createElement('div');
      h.setAttribute('style', 'font-size:13px;font-weight:800;margin-bottom:10px;line-height:1.45');
      h.textContent = title;
      const inp = document.createElement('input');
      inp.type = 'password';
      inp.setAttribute('style', 'width:100%;box-sizing:border-box;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:10px 12px;font-size:14px;color:#fff;outline:none');
      if (hint) inp.placeholder = hint;
      const row = document.createElement('div');
      row.setAttribute('style', 'display:flex;gap:8px;margin-top:12px');
      const mk = (txt: string, bg: string, fg: string) => {
        const b = document.createElement('button');
        b.textContent = txt;
        b.setAttribute('style', `flex:1;cursor:pointer;border:0;border-radius:12px;padding:10px;font-size:12px;font-weight:900;background:${bg};color:${fg}`);
        return b;
      };
      const okB = mk('OK', '#00f5d4', '#032019');
      const noB = mk('Cancel', 'rgba(255,255,255,.14)', '#dceaf6');
      row.appendChild(noB); row.appendChild(okB);
      card.appendChild(h); card.appendChild(inp); card.appendChild(row);
      wrap.appendChild(card); document.body.appendChild(wrap);
      const done = (v: string | null) => {
        try { document.body.removeChild(wrap); } catch {}
        resolve(v);
      };
      okB.onclick = () => done(inp.value || '');
      noB.onclick = () => done(null);
      wrap.onclick = (e) => { if (e.target === wrap) done(null); };
      inp.onkeydown = (e) => { if (e.key === 'Enter') done(inp.value || ''); if (e.key === 'Escape') done(null); };
      setTimeout(() => { try { inp.focus(); } catch {} }, 30);
    } catch {
      // overlay bhi na ban sake → tabhi purana prompt, warna null
      try {
        if (typeof window !== 'undefined' && typeof window.prompt === 'function') resolve(window.prompt(ask));
        else resolve(null);
      } catch {
        resolve(null);
      }
    }
  });
}

/** 📱 Kya hum APEX Android shell ke andar hain? */
export function apexInNativeApp(): boolean {
  return bridge() !== null;
}
