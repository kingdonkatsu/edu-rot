import type { BKTResult } from '../types.js';
import {
  BKT_P_TRANSIT,
  BKT_P_SLIP,
  BKT_P_GUESS,
  BKT_CARELESS_PRIOR_THRESHOLD,
  BKT_CARELESS_POSTERIOR_THRESHOLD,
  BKT_LUCKY_GUESS_THRESHOLD,
  RAPID_FIRE_MIN_COUNT,
  RAPID_FIRE_TRANSIT_DAMPEN,
  RAPID_FIRE_GUESS_AMPLIFY,
  RAPID_FIRE_GUESS_CAP,
} from '../utils/constants.js';

interface BKTParams {
  pTransit: number;
  pSlip: number;
  pGuess: number;
}

export function computeBKT(
  pMasteryAfterDecay: number,
  isCorrect: boolean,
  rapidFireCounter: number
): BKTResult {
  const params = getEffectiveParams(rapidFireCounter);

  const posterior = computePosterior(pMasteryAfterDecay, isCorrect, params);
  const updatedMastery = computeTransition(posterior, params.pTransit);

  const carelessMistake = detectCarelessMistake(
    pMasteryAfterDecay,
    posterior,
    isCorrect
  );
  const luckyGuess = detectLuckyGuess(pMasteryAfterDecay, isCorrect);

  return {
    prior: pMasteryAfterDecay,
    posterior: updatedMastery,
    updated_mastery: updatedMastery,
    careless_mistake: carelessMistake,
    lucky_guess: luckyGuess,
  };
}

function getEffectiveParams(rapidFireCounter: number): BKTParams {
  if (rapidFireCounter >= RAPID_FIRE_MIN_COUNT) {
    return {
      pTransit: BKT_P_TRANSIT * RAPID_FIRE_TRANSIT_DAMPEN,
      pSlip: BKT_P_SLIP,
      pGuess: Math.min(BKT_P_GUESS * RAPID_FIRE_GUESS_AMPLIFY, RAPID_FIRE_GUESS_CAP),
    };
  }
  return {
    pTransit: BKT_P_TRANSIT,
    pSlip: BKT_P_SLIP,
    pGuess: BKT_P_GUESS,
  };
}

function computePosterior(
  pL: number,
  isCorrect: boolean,
  params: BKTParams
): number {
  if (isCorrect) {
    const numerator = pL * (1 - params.pSlip);
    const denominator = numerator + (1 - pL) * params.pGuess;
    return numerator / denominator;
  }
  const numerator = pL * params.pSlip;
  const denominator = numerator + (1 - pL) * (1 - params.pGuess);
  return numerator / denominator;
}

function computeTransition(pPosterior: number, pTransit: number): number {
  return pPosterior + (1 - pPosterior) * pTransit;
}

function detectCarelessMistake(
  prior: number,
  posterior: number,
  isCorrect: boolean
): boolean {
  return (
    !isCorrect &&
    prior >= BKT_CARELESS_PRIOR_THRESHOLD &&
    posterior >= BKT_CARELESS_POSTERIOR_THRESHOLD
  );
}

function detectLuckyGuess(prior: number, isCorrect: boolean): boolean {
  return isCorrect && prior < BKT_LUCKY_GUESS_THRESHOLD;
}
