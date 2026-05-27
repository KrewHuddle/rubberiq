/**
 * Client-side principal — mirrors server `Principal`. Stored in localStorage
 * with the JWT. The server is source of truth — refetch on app boot.
 */
import { useEffect, useState } from 'react';

export type ShopPrincipal = {
  kind: 'user';
  role: 'owner' | 'manager' | 'counter' | 'intake';
  shopId: string;
};

export type PlatformPrincipal = {
  kind: 'platform';
  role: 'super_admin' | 'sales_agent' | 'support';
};

export type Principal = ShopPrincipal | PlatformPrincipal;

const TOKEN_KEY = 'rb_token';
const PRINCIPAL_KEY = 'rb_principal';
const PRINCIPAL_EVENT = 'rb-principal-change';

export function loadPrincipal(): Principal | null {
  try {
    const raw = localStorage.getItem(PRINCIPAL_KEY);
    return raw ? (JSON.parse(raw) as Principal) : null;
  } catch {
    return null;
  }
}

export function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function savePrincipal(token: string, principal: Principal): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(PRINCIPAL_KEY, JSON.stringify(principal));
  window.dispatchEvent(new Event(PRINCIPAL_EVENT));
}

export function clearPrincipal(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PRINCIPAL_KEY);
  window.dispatchEvent(new Event(PRINCIPAL_EVENT));
}

export function usePrincipal(): Principal | null {
  const [p, setP] = useState<Principal | null>(() => loadPrincipal());
  useEffect(() => {
    const refresh = () => setP(loadPrincipal());
    const onStorage = (e: StorageEvent) => {
      if (e.key === PRINCIPAL_KEY) refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(PRINCIPAL_EVENT, refresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(PRINCIPAL_EVENT, refresh);
    };
  }, []);
  return p;
}
