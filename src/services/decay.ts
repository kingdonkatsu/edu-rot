import type { DecayResult } from '../types.js';
import {
  LAMBDA,
  DECAY_MIN_HOURS,
  DECAY_FLOOR,
  DECAY_WARNING_THRESHOLD,
} from '../utils/constants.js';

export function computeDecay(
  pMastery: number,
  stability: number,
  lastInteractionAt: string | null,
  currentTimestamp: string
): DecayResult {
  if (!lastInteractionAt) {
    return noDecayResult(pMastery);
  }

  const deltaHours = computeDeltaHours(lastInteractionAt, currentTimestamp);

  if (deltaHours < DECAY_MIN_HOURS) {
    return noDecayResult(pMastery, deltaHours);
  }

  const decayed = applyDecayFormula(pMastery, LAMBDA, deltaHours, stability);
  const clamped = Math.max(DECAY_FLOOR, decayed);
  const drop = pMastery - clamped;

  return {
    pre_decay_mastery: pMastery,
    post_decay_mastery: clamped,
    delta_t_hours: deltaHours,
    decay_applied: true,
    decay_drop: drop,
  };
}

export function isDecayWarning(decayDrop: number): boolean {
  return decayDrop > DECAY_WARNING_THRESHOLD;
}

function noDecayResult(pMastery: number, deltaHours = 0): DecayResult {
  return {
    pre_decay_mastery: pMastery,
    post_decay_mastery: pMastery,
    delta_t_hours: deltaHours,
    decay_applied: false,
    decay_drop: 0,
  };
}

function computeDeltaHours(last: string, current: string): number {
  const lastMs = Date.parse(last);
  const currentMs = Date.parse(current);
  return (currentMs - lastMs) / 3_600_000;
}

function applyDecayFormula(
  p: number,
  lambda: number,
  deltaT: number,
  s: number
): number {
  return p * Math.exp(-lambda * deltaT / s);
}
