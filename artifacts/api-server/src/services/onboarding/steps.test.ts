import { describe, expect, it } from 'vitest';
import {
  STEP_ORDER,
  isTerminal,
  nextStep,
  validatePayload,
} from './steps.js';

describe('onboarding/steps — order + transitions', () => {
  it('STEP_ORDER ends in done', () => {
    expect(STEP_ORDER[STEP_ORDER.length - 1]).toBe('done');
  });

  it('nextStep walks the order', () => {
    expect(nextStep('details')).toBe('agreement');
    expect(nextStep('agreement')).toBe('payment');
    expect(nextStep('payment')).toBe('config');
    expect(nextStep('config')).toBe('invite_staff');
    expect(nextStep('invite_staff')).toBe('done');
  });

  it('done is terminal', () => {
    expect(isTerminal('done')).toBe(true);
    expect(isTerminal('details')).toBe(false);
    expect(nextStep('done')).toBe('done');
  });
});

describe('onboarding/steps — payload validation', () => {
  it('details requires slug, state(2), shopName, owner', () => {
    expect(() =>
      validatePayload('details', {
        shopName: 'Big Used Tires',
        slug: 'big-used-tires',
        state: 'NC',
        ownerName: 'Pat Owner',
        ownerEmail: 'pat@example.com',
      }),
    ).not.toThrow();

    expect(() =>
      validatePayload('details', {
        shopName: 'X',
        slug: 'Bad Slug', // uppercase + space
        state: 'NCC',
        ownerName: 'Pat',
        ownerEmail: 'not-an-email',
      }),
    ).toThrow();
  });

  it('agreement requires version + signedName', () => {
    expect(() =>
      validatePayload('agreement', { agreementVersion: 'v1', signedName: 'Pat Owner' }),
    ).not.toThrow();
    expect(() => validatePayload('agreement', { agreementVersion: 'v1' })).toThrow();
  });

  it('payment requires stripeAccountId', () => {
    expect(() =>
      validatePayload('payment', { stripeAccountId: 'acct_123', stripeConnectStatus: 'enabled' }),
    ).not.toThrow();
    expect(() => validatePayload('payment', { stripeConnectStatus: 'enabled' })).toThrow();
  });

  it('config defaults apply', () => {
    const parsed = validatePayload('config', {});
    expect(parsed.disposalFeeCents).toBe(300);
    expect(parsed.pricingFloorMarginBps).toBe(2000);
  });

  it('invite_staff accepts empty list and rejects bad roles', () => {
    expect(() => validatePayload('invite_staff', {})).not.toThrow();
    expect(() =>
      validatePayload('invite_staff', {
        invites: [{ name: 'Sam', email: 'sam@y.com', role: 'manager' }],
      }),
    ).not.toThrow();
    expect(() =>
      validatePayload('invite_staff', {
        invites: [{ name: 'X', email: 'x@y.com', role: 'janitor' }],
      }),
    ).toThrow();
  });
});
