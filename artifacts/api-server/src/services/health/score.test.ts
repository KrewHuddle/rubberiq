import { describe, expect, it } from 'vitest';
import {
  bandFor,
  computeHealth,
  scoreIntakeVolume,
  scoreLoginRecency,
  scorePaymentHealth,
  scoreSalesActivity,
  scoreSupportLoad,
} from './score.js';

describe('health/score — subscores', () => {
  it('loginRecency tiers', () => {
    expect(scoreLoginRecency(0)).toBe(25);
    expect(scoreLoginRecency(7)).toBe(25);
    expect(scoreLoginRecency(8)).toBe(15);
    expect(scoreLoginRecency(14)).toBe(15);
    expect(scoreLoginRecency(20)).toBe(5);
    expect(scoreLoginRecency(30)).toBe(5);
    expect(scoreLoginRecency(31)).toBe(0);
    expect(scoreLoginRecency(null)).toBe(0);
  });

  it('intakeVolume tiers', () => {
    expect(scoreIntakeVolume(0)).toBe(0);
    expect(scoreIntakeVolume(1)).toBe(3);
    expect(scoreIntakeVolume(3)).toBe(8);
    expect(scoreIntakeVolume(10)).toBe(15);
    expect(scoreIntakeVolume(20)).toBe(25);
    expect(scoreIntakeVolume(999)).toBe(25);
  });

  it('salesActivity tiers', () => {
    expect(scoreSalesActivity(0)).toBe(0);
    expect(scoreSalesActivity(2)).toBe(3);
    expect(scoreSalesActivity(7)).toBe(8);
    expect(scoreSalesActivity(8)).toBe(15);
    expect(scoreSalesActivity(15)).toBe(25);
  });

  it('paymentHealth signs', () => {
    expect(scorePaymentHealth(false)).toBe(15);
    expect(scorePaymentHealth(true)).toBe(-10);
  });

  it('supportLoad tiers', () => {
    expect(scoreSupportLoad(0)).toBe(10);
    expect(scoreSupportLoad(1)).toBe(5);
    expect(scoreSupportLoad(2)).toBe(5);
    expect(scoreSupportLoad(3)).toBe(-5);
  });
});

describe('health/score — bandFor', () => {
  it('classifies thresholds correctly', () => {
    expect(bandFor(0)).toBe('red');
    expect(bandFor(39)).toBe('red');
    expect(bandFor(40)).toBe('yellow');
    expect(bandFor(69)).toBe('yellow');
    expect(bandFor(70)).toBe('green');
    expect(bandFor(100)).toBe('green');
  });
});

describe('health/score — computeHealth', () => {
  it('healthy shop scores green', () => {
    const r = computeHealth({
      daysSinceLastLogin: 1,
      intakeVolume28d: 25,
      salesActivity28d: 12,
      paymentFailed: false,
      supportFlags: 0,
    });
    // 25 + 25 + 15 + 15 + 10 = 90
    expect(r.score).toBe(90);
    expect(r.band).toBe('green');
  });

  it('dormant shop scores red', () => {
    const r = computeHealth({
      daysSinceLastLogin: 60,
      intakeVolume28d: 0,
      salesActivity28d: 0,
      paymentFailed: false,
      supportFlags: 0,
    });
    // 0 + 0 + 0 + 15 + 10 = 25 → red
    expect(r.score).toBe(25);
    expect(r.band).toBe('red');
  });

  it('payment failure pulls a yellow into red territory', () => {
    const r = computeHealth({
      daysSinceLastLogin: 20,
      intakeVolume28d: 1,
      salesActivity28d: 1,
      paymentFailed: true,
      supportFlags: 4,
    });
    // 5 + 3 + 3 + -10 + -5 = -4 → clamped to 0
    expect(r.score).toBe(0);
    expect(r.band).toBe('red');
  });

  it('clamps score to 0..100', () => {
    const r = computeHealth({
      daysSinceLastLogin: 0,
      intakeVolume28d: 1000,
      salesActivity28d: 1000,
      paymentFailed: false,
      supportFlags: 0,
    });
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it('mid-engagement scores yellow', () => {
    const r = computeHealth({
      daysSinceLastLogin: 10,
      intakeVolume28d: 4,
      salesActivity28d: 4,
      paymentFailed: false,
      supportFlags: 1,
    });
    // 15 + 8 + 8 + 15 + 5 = 51 → yellow
    expect(r.score).toBe(51);
    expect(r.band).toBe('yellow');
  });

  it('returns the full parts breakdown', () => {
    const r = computeHealth({
      daysSinceLastLogin: 5,
      intakeVolume28d: 10,
      salesActivity28d: 3,
      paymentFailed: false,
      supportFlags: 0,
    });
    expect(r.parts).toEqual({
      loginRecency: 25,
      intakeVolume: 15,
      salesActivity: 8,
      paymentHealth: 15,
      supportLoad: 10,
    });
  });
});
