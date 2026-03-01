import { describe, it, expect } from 'vitest';
import { computeEMA, detectStagnation, detectRapidImprovement } from '../../src/services/ema.js';

describe('computeEMA', () => {
  it('computes EMA for correct answer from cold start', () => {
    // EMA = 0.3 * 1.0 + 0.7 * 0.5 = 0.65
    const result = computeEMA(0.5, true);
    expect(result.ema_current).toBeCloseTo(0.65, 4);
    expect(result.ema_previous).toBe(0.5);
  });

  it('computes EMA for incorrect answer from cold start', () => {
    // EMA = 0.3 * 0.0 + 0.7 * 0.5 = 0.35
    const result = computeEMA(0.5, false);
    expect(result.ema_current).toBeCloseTo(0.35, 4);
  });

  it('trends improving when EMA increases significantly', () => {
    const result = computeEMA(0.3, true);
    expect(result.trend).toBe('improving');
  });

  it('trends declining when EMA decreases significantly', () => {
    const result = computeEMA(0.8, false);
    expect(result.trend).toBe('declining');
  });

  it('trends stable when change is < 0.02', () => {
    // EMA = 0.3 * 1.0 + 0.7 * 0.99 = 0.3 + 0.693 = 0.993
    // delta = 0.993 - 0.99 = 0.003 → stable
    const result = computeEMA(0.99, true);
    expect(result.trend).toBe('stable');
  });
});

describe('detectStagnation', () => {
  it('returns true when attempts >= 10 and EMA in stagnation range', () => {
    expect(detectStagnation(0.50, 10)).toBe(true);
    expect(detectStagnation(0.45, 12)).toBe(true);
    expect(detectStagnation(0.55, 15)).toBe(true);
  });

  it('returns false when attempts < 10', () => {
    expect(detectStagnation(0.50, 9)).toBe(false);
  });

  it('returns false when EMA outside stagnation range', () => {
    expect(detectStagnation(0.44, 10)).toBe(false);
    expect(detectStagnation(0.56, 10)).toBe(false);
  });
});

describe('detectRapidImprovement', () => {
  it('returns false with insufficient data', () => {
    expect(detectRapidImprovement([true, true, true])).toBe(false);
  });

  it('detects rapid improvement from poor to good performance', () => {
    // Old results: all wrong; recent 5: all correct
    const results = [
      false, false, false, false, false,
      true, true, true, true, true,
    ];
    expect(detectRapidImprovement(results)).toBe(true);
  });

  it('does not flag when improvement is gradual', () => {
    // Mixed old results (40%) → mixed recent (60%) = delta 0.20 < 0.25
    const results = [
      false, true, false, true, false,
      true, true, false, true, false,
    ];
    expect(detectRapidImprovement(results)).toBe(false);
  });
});
