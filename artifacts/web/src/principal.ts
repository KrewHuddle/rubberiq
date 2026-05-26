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
}

export function clearPrincipal(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PRINCIPAL_KEY);
}

export function usePrincipal(): Principal | null {
  const [p, setP] = useState<Principal | null>(() => loadPrincipal());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PRINCIPAL_KEY) setP(loadPrincipal());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return p;
}
