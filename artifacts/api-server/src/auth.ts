/**
 * Auth + role middleware.
 *
 * Two principal types live side-by-side:
 *   - "user"     — staff at a shop (role: owner|manager|counter|intake). shopId-scoped.
 *   - "platform" — Guru Boxz internal (role: super_admin|sales_agent|support).
 *
 * Middleware:
 *   requireUser()              — any logged-in shop user
 *   requireUserRole(...roles)  — shop user with at least one of the listed roles
 *   requirePlatform(...roles)  — platform user (defaults to super_admin)
 *   requireShopScope()         — locks request to req.principal.shopId
 *
 * Sales-agent scoping (Module 14) is enforced inside the /api/sales/* routes
 * by always filtering by req.principal.agentId — never by query param.
 */
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from './env.js';

export type ShopPrincipal = {
  kind: 'user';
  userId: string;
  shopId: string;
  role: 'owner' | 'manager' | 'counter' | 'intake';
  language: string;
};

export type PlatformPrincipal = {
  kind: 'platform';
  platformUserId: string;
  role: 'super_admin' | 'sales_agent' | 'support';
  agentId?: string; // present when role === 'sales_agent'
  language: string;
};

export type Principal = ShopPrincipal | PlatformPrincipal;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}

export function signToken(p: Principal, ttlSeconds = 60 * 60 * 12): string {
  return jwt.sign(p, env.JWT_SECRET, { expiresIn: ttlSeconds });
}

export function verifyToken(token: string): Principal {
  return jwt.verify(token, env.JWT_SECRET) as Principal;
}

function readBearer(req: Request): string | null {
  const h = req.header('authorization');
  if (h?.startsWith('Bearer ')) return h.slice(7);
  // cookie-parser populates req.cookies
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cookies = (req as any).cookies as Record<string, string> | undefined;
  return cookies?.rb_token ?? null;
}

export function attachPrincipal(req: Request, _res: Response, next: NextFunction): void {
  const token = readBearer(req);
  if (!token) return next();
  try {
    req.principal = verifyToken(token);
  } catch {
    // invalid token -> treated as anonymous
  }
  next();
}

export function requireUser() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.principal?.kind === 'user') return next();
    res.status(401).json({ error: 'unauthorized' });
  };
}

export function requireUserRole(...roles: ShopPrincipal['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const p = req.principal;
    if (p?.kind === 'user' && roles.includes(p.role)) return next();
    res.status(403).json({ error: 'forbidden' });
  };
}

export function requirePlatform(...roles: PlatformPrincipal['role'][]) {
  const allowed = roles.length ? roles : (['super_admin'] as const);
  return (req: Request, res: Response, next: NextFunction) => {
    const p = req.principal;
    if (p?.kind === 'platform' && (allowed as readonly string[]).includes(p.role)) return next();
    res.status(403).json({ error: 'forbidden' });
  };
}

/** Sales agents see only their own book — always derive agentId from principal. */
export function requireSalesAgent() {
  return (req: Request, res: Response, next: NextFunction) => {
    const p = req.principal;
    if (p?.kind === 'platform' && p.role === 'sales_agent' && p.agentId) return next();
    if (p?.kind === 'platform' && p.role === 'super_admin') return next(); // super can view any
    res.status(403).json({ error: 'forbidden' });
  };
}
