import type { EMAResult, Trend } from '../types.js';
import {
  EMA_ALPHA,
  EMA_STAGNATION_MIN_ATTEMPTS,
  EMA_STAGNATION_LOWER,
  EMA_STAGNATION_UPPER,
  EMA_RAPID_IMPROVEMENT_DELTA,
  EMA_RAPID_IMPROVEMENT_WINDOW,
} from '../utils/constants.js';

export function computeEMA(
  previousEMA: number,
  isCorrect: boolean
): EMAResult {
  const observation = isCorrect ? 1.0 : 0.0;
  const current = EMA_ALPHA * observation + (1 - EMA_ALPHA) * previousEMA;
  const trend = computeTrend(previousEMA, current);

  return {
    ema_previous: previousEMA,
    ema_current: current,
    trend,
  };
}

export function detectStagnation(ema: number, attemptCount: number): boolean {
  return (
    attemptCount >= EMA_STAGNATION_MIN_ATTEMPTS &&
    ema >= EMA_STAGNATION_LOWER &&
    ema <= EMA_STAGNATION_UPPER
  );
}

export function detectRapidImprovement(recentResults: boolean[]): boolean {
  if (recentResults.length < EMA_RAPID_IMPROVEMENT_WINDOW) {
    return false;
  }

  const window = recentResults.slice(-EMA_RAPID_IMPROVEMENT_WINDOW);
  const oldResults = recentResults.slice(0, -EMA_RAPID_IMPROVEMENT_WINDOW);

  const currentRate = window.filter(Boolean).length / window.length;

  if (oldResults.length === 0) {
    return currentRate >= EMA_RAPID_IMPROVEMENT_DELTA + 0.5;
  }

  const oldRate = oldResults.filter(Boolean).length / oldResults.length;
  return (currentRate - oldRate) >= EMA_RAPID_IMPROVEMENT_DELTA;
}

function computeTrend(previous: number, current: number): Trend {
  const delta = current - previous;
  if (Math.abs(delta) < 0.02) return 'stable';
  return delta > 0 ? 'improving' : 'declining';
}
