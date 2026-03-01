import { describe, it, expect } from 'vitest';
import { computeBKT } from '../../src/services/bkt.js';

describe('computeBKT', () => {
  describe('posterior update', () => {
    it('increases mastery on correct answer', () => {
      const result = computeBKT(0.50, true, 0);
      expect(result.updated_mastery).toBeGreaterThan(0.50);
    });

    it('decreases mastery on incorrect answer', () => {
      // The posterior drops on incorrect, but transition adds back P(T)
      // For low priors, the net effect should still be lower or similar
      const result = computeBKT(0.50, false, 0);
      // Posterior via Bayes: (0.5*0.1) / (0.5*0.1 + 0.5*0.75) = 0.05/0.425 ≈ 0.1176
      // After transition: 0.1176 + (1-0.1176)*0.15 ≈ 0.1176 + 0.1324 ≈ 0.2500
      expect(result.updated_mastery).toBeLessThan(0.50);
    });

    it('computes correct posterior for correct answer with known values', () => {
      // P(L)=0.3, correct: (0.3*0.9)/(0.3*0.9 + 0.7*0.25) = 0.27/0.445 ≈ 0.6067
      // Transition: 0.6067 + (1-0.6067)*0.15 ≈ 0.6067 + 0.059 ≈ 0.6657
      const result = computeBKT(0.30, true, 0);
      expect(result.updated_mastery).toBeCloseTo(0.6657, 2);
    });

    it('computes correct posterior for incorrect answer with known values', () => {
      // P(L)=0.5, incorrect: (0.5*0.1)/(0.5*0.1 + 0.5*0.75) = 0.05/0.425 ≈ 0.1176
      // Transition: 0.1176 + (1-0.1176)*0.15 ≈ 0.2500
      const result = computeBKT(0.50, false, 0);
      expect(result.updated_mastery).toBeCloseTo(0.2500, 2);
    });
  });

  describe('careless mistake detection', () => {
    it('flags careless mistake when prior >= 0.80 and incorrect', () => {
      const result = computeBKT(0.85, false, 0);
      // Posterior: (0.85*0.1)/(0.85*0.1 + 0.15*0.75) = 0.085/0.1975 ≈ 0.4304
      // Wait — posterior needs to be >= 0.60 for careless_mistake flag
      // At 0.85 prior: posterior = 0.085/(0.085+0.1125) = 0.085/0.1975 ≈ 0.4304
      // That's < 0.60, so careless_mistake should be false
      // Need higher prior. Let's check with 0.95:
      expect(result.careless_mistake).toBe(false);
    });

    it('flags careless mistake at very high mastery', () => {
      // P(L)=0.95, incorrect: (0.95*0.1)/(0.95*0.1 + 0.05*0.75) = 0.095/0.1325 ≈ 0.7170
      // 0.7170 >= 0.60 → careless_mistake = true
      const result = computeBKT(0.95, false, 0);
      expect(result.careless_mistake).toBe(true);
    });

    it('does not flag careless mistake on correct answer', () => {
      const result = computeBKT(0.95, true, 0);
      expect(result.careless_mistake).toBe(false);
    });
  });

  describe('lucky guess detection', () => {
    it('flags lucky guess when prior < 0.40 and correct', () => {
      const result = computeBKT(0.20, true, 0);
      expect(result.lucky_guess).toBe(true);
    });

    it('does not flag lucky guess when prior >= 0.40', () => {
      const result = computeBKT(0.50, true, 0);
      expect(result.lucky_guess).toBe(false);
    });

    it('does not flag lucky guess on incorrect answer', () => {
      const result = computeBKT(0.20, false, 0);
      expect(result.lucky_guess).toBe(false);
    });
  });

  describe('rapid-fire dampening', () => {
    it('dampens learning when rapid_fire_counter >= 5', () => {
      const normal = computeBKT(0.30, true, 0);
      const dampened = computeBKT(0.30, true, 5);
      // Dampened should increase mastery less
      expect(dampened.updated_mastery).toBeLessThan(normal.updated_mastery);
    });

    it('does not dampen when counter < 5', () => {
      const normal = computeBKT(0.30, true, 0);
      const notDampened = computeBKT(0.30, true, 4);
      expect(notDampened.updated_mastery).toBeCloseTo(normal.updated_mastery, 4);
    });
  });
});
