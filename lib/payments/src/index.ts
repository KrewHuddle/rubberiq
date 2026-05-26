/**
 * Stripe wiring — TWO surfaces:
 *
 *   1. Connect (online card payments) — per-shop connected accounts, platform
 *      fee on top, same pattern as other Guru Boxz apps (@guruboxz/payments).
 *
 *   2. Terminal (in-person tap-to-pay) — Tap to Pay on iPhone/Android on
 *      compatible devices, optional Stripe Reader hardware. Money still routes
 *      to each shop's connected account.
 *
 * ⚠️ VERIFY CURRENT STRIPE DOCS before building Module 10's in-person layer:
 *    Terminal capabilities, Tap to Pay device support, and fee structure
 *    change over time. Pull live docs — do not assume.
 */
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not set');
    _stripe = new Stripe(key, { apiVersion: '2025-10-16.acacia' as Stripe.LatestApiVersion });
  }
  return _stripe;
}

export type PlatformFeeBps = number;

export type ChargeInput = {
  amountCents: number;
  currency: string; // 'usd'
  connectedAccountId: string;
  platformFeeBps: PlatformFeeBps;
  description?: string;
  metadata?: Record<string, string>;
};

/**
 * Compute the application fee from a bps rate.
 *   1000 bps = 10%
 */
export function applicationFeeFromBps(amountCents: number, bps: PlatformFeeBps): number {
  return Math.round((amountCents * bps) / 10_000);
}
