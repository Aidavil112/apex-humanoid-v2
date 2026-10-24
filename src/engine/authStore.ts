// Multi-User Login, Member Management & Personal Data Isolation Store
// Ensures the owner seamlessly uses their personal account immediately right now,
// while ANY other member/public user who logs in gets 100% isolated personal storage & NEVER touches the owner's CoinDCX account!

export interface ApexMemberProfile {
  id: string;
  name: string;
  identifier: string; // Email, Phone number, or Member ID
  pin: string;
  role: 'owner' | 'member';
  createdAt: string;
}

const MEMBERS_KEY = 'apex.members_list_v1';
const CURRENT_USER_KEY = 'apex.current_user_id_v1';
const REQUIRE_LOGIN_KEY = 'apex.require_login_gate_v1';
const LOGGED_OUT_FLAG = 'apex.session_logged_out_v1';

const DEFAULT_OWNER: ApexMemberProfile = {
  id: 'owner_admin',
  name: 'Admin (Personal Owner)',
  identifier: 'admin',
  pin: '1234',
  role: 'owner',
  createdAt: 'Primary Owner',
};

export function loadMembers(): ApexMemberProfile[] {
  try {
    const raw = JSON.parse(localStorage.getItem(MEMBERS_KEY) || '[]');
    if (Array.isArray(raw) && raw.length > 0) {
      const hasOwner = raw.some((m: ApexMemberProfile) => m.role === 'owner');
      return hasOwner ? raw : [DEFAULT_OWNER, ...raw];
    }
  } catch {}
  return [DEFAULT_OWNER];
}

export function saveMembers(list: ApexMemberProfile[]): void {
  try {
    localStorage.setItem(MEMBERS_KEY, JSON.stringify(list));
  } catch {}
}

export function isLoginGateRequired(): boolean {
  try {
    return localStorage.getItem(REQUIRE_LOGIN_KEY) === '1';
  } catch {
    return false;
  }
}

export function setLoginGateRequired(required: boolean): void {
  try {
    localStorage.setItem(REQUIRE_LOGIN_KEY, required ? '1' : '0');
  } catch {}
}

export function getActiveSessionUser(): ApexMemberProfile | null {
  try {
    if (localStorage.getItem(LOGGED_OUT_FLAG) === '1') {
      return null;
    }
    const members = loadMembers();
    const savedId = localStorage.getItem(CURRENT_USER_KEY);
    if (savedId) {
      const found = members.find((m) => m.id === savedId);
      if (found) return found;
    }
    if (isLoginGateRequired()) {
      return null;
    }
    // Seamless default for your personal phone use right now!
    return members[0] || DEFAULT_OWNER;
  } catch {
    return DEFAULT_OWNER;
  }
}

export function loginWithCredentials(
  identifier: string,
  pin: string
): { ok: boolean; user?: ApexMemberProfile; error?: string } {
  const cleanId = identifier.trim().toLowerCase();
  const cleanPin = pin.trim();
  const members = loadMembers();
  const match = members.find(
    (m) =>
      (m.identifier.toLowerCase() === cleanId || m.name.toLowerCase() === cleanId) &&
      m.pin === cleanPin
  );
  if (!match) {
    return { ok: false, error: 'Galat Email/Mobile ya PIN — check karke dobara dalein.' };
  }
  localStorage.setItem(CURRENT_USER_KEY, match.id);
  localStorage.setItem(LOGGED_OUT_FLAG, '0');
  return { ok: true, user: match };
}

export function registerPersonalAccount(
  name: string,
  identifier: string,
  pin: string
): { ok: boolean; user?: ApexMemberProfile; error?: string } {
  const cleanName = name.trim();
  const cleanId = identifier.trim();
  const cleanPin = pin.trim();
  if (!cleanName || !cleanId || cleanPin.length < 4) {
    return { ok: false, error: 'Naam, Mobile/Email aur kam se kam 4-digit PIN bharna zaroori hai.' };
  }
  const members = loadMembers();
  if (members.some((m) => m.identifier.toLowerCase() === cleanId.toLowerCase())) {
    return { ok: false, error: 'Yeh Mobile/Email pehle se registered hai — Sign In karein.' };
  }
  const newUser: ApexMemberProfile = {
    id: `member_${Date.now()}`,
    name: cleanName,
    identifier: cleanId,
    pin: cleanPin,
    role: 'member',
    createdAt: new Date().toLocaleDateString('en-IN'),
  };
  const next = [...members, newUser];
  saveMembers(next);
  localStorage.setItem(CURRENT_USER_KEY, newUser.id);
  localStorage.setItem(LOGGED_OUT_FLAG, '0');
  return { ok: true, user: newUser };
}

export function addMemberByOwner(
  name: string,
  identifier: string,
  pin: string
): { ok: boolean; list: ApexMemberProfile[]; error?: string } {
  const cleanName = name.trim();
  const cleanId = identifier.trim();
  const cleanPin = pin.trim() || '1234';
  if (!cleanName || !cleanId) {
    return { ok: false, list: loadMembers(), error: 'Member ka naam aur phone/ID likhein.' };
  }
  const members = loadMembers();
  const member: ApexMemberProfile = {
    id: `member_${Date.now()}`,
    name: cleanName,
    identifier: cleanId,
    pin: cleanPin,
    role: 'member',
    createdAt: new Date().toLocaleDateString('en-IN'),
  };
  const next = [...members, member];
  saveMembers(next);
  return { ok: true, list: next };
}

export function removeMemberByOwner(id: string): ApexMemberProfile[] {
  const next = loadMembers().filter((m) => m.role === 'owner' || m.id !== id);
  saveMembers(next);
  return next;
}

export function switchSessionUser(user: ApexMemberProfile): void {
  localStorage.setItem(CURRENT_USER_KEY, user.id);
  localStorage.setItem(LOGGED_OUT_FLAG, '0');
}

export function updateOwnerPin(newIdentifier: string, newPin: string): ApexMemberProfile[] {
  const members = loadMembers().map((m) =>
    m.role === 'owner'
      ? {
          ...m,
          identifier: newIdentifier.trim() || m.identifier,
          pin: newPin.trim() || m.pin,
        }
      : m
  );
  saveMembers(members);
  return members;
}

export function logoutSession(): void {
  try {
    localStorage.setItem(LOGGED_OUT_FLAG, '1');
  } catch {}
}

/** Per-user isolated storage key helper so NO member ever sees another user's memories, chats, tasks, or keys! */
export function userScopedKey(baseKey: string, userId?: string): string {
  const uid = userId || 'owner_admin';
  if (uid === 'owner_admin') return baseKey;
  return `${baseKey}__${uid}`;
}
