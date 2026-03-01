import { describe, it, expect } from 'vitest';
import { computeDecay, isDecayWarning } from '../../src/services/decay.js';

describe('computeDecay', () => {
  it('returns no decay on cold start (null last_interaction_at)', () => {
    const result = computeDecay(0.50, 1.0, null, '2026-03-01T14:00:00Z');
    expect(result.decay_applied).toBe(false);
    expect(result.post_decay_mastery).toBe(0.50);
    expect(result.decay_drop).toBe(0);
  });

  it('returns no decay when delta < 1 hour', () => {
    const result = computeDecay(
      0.80, 1.0,
      '2026-03-01T14:00:00Z',
      '2026-03-01T14:30:00Z'
    );
    expect(result.decay_applied).toBe(false);
    expect(result.post_decay_mastery).toBe(0.80);
    expect(result.delta_t_hours).toBeCloseTo(0.5, 1);
  });

  it('applies decay correctly for 24 hours, S=1.0, lambda=0.02', () => {
    // P(L) = 0.8 * e^(-0.02 * 24 / 1.0) = 0.8 * e^(-0.48) ≈ 0.8 * 0.6188 ≈ 0.4950
    const result = computeDecay(
      0.80, 1.0,
      '2026-03-01T00:00:00Z',
      '2026-03-02T00:00:00Z'
    );
    expect(result.decay_applied).toBe(true);
    expect(result.post_decay_mastery).toBeCloseTo(0.4950, 2);
    expect(result.delta_t_hours).toBeCloseTo(24, 0);
    expect(result.pre_decay_mastery).toBe(0.80);
  });

  it('higher stability reduces decay', () => {
    // S=2.0: P = 0.8 * e^(-0.02 * 24 / 2.0) = 0.8 * e^(-0.24) ≈ 0.8 * 0.7866 ≈ 0.6293
    const result = computeDecay(
      0.80, 2.0,
      '2026-03-01T00:00:00Z',
      '2026-03-02T00:00:00Z'
    );
    expect(result.post_decay_mastery).toBeCloseTo(0.6293, 2);
  });

  it('clamps to decay floor of 0.01', () => {
    // Very long time, low mastery → should clamp
    const result = computeDecay(
      0.02, 1.0,
      '2025-01-01T00:00:00Z',
      '2026-03-01T00:00:00Z'
    );
    expect(result.decay_applied).toBe(true);
    expect(result.post_decay_mastery).toBe(0.01);
  });

  it('computes decay_drop correctly', () => {
    const result = computeDecay(
      0.80, 1.0,
      '2026-03-01T00:00:00Z',
      '2026-03-02T00:00:00Z'
    );
    expect(result.decay_drop).toBeCloseTo(0.80 - result.post_decay_mastery, 4);
  });
});

describe('isDecayWarning', () => {
  it('returns true when drop > 0.15', () => {
    expect(isDecayWarning(0.20)).toBe(true);
  });

  it('returns false when drop <= 0.15', () => {
    expect(isDecayWarning(0.15)).toBe(false);
    expect(isDecayWarning(0.10)).toBe(false);
  });
});
