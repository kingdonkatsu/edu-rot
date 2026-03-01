import type {
  AnalyticsFlags,
  BKTResult,
  DecayResult,
  StudentConceptState,
} from '../types.js';
import { MASTERY_ACHIEVED_THRESHOLD, MASTERY_ACHIEVED_MIN_ATTEMPTS } from '../utils/constants.js';
import { isDecayWarning } from './decay.js';
import { detectStagnation, detectRapidImprovement } from './ema.js';

export function evaluateFlags(
  bktResult: BKTResult,
  decayResult: DecayResult,
  emaScore: number,
  state: StudentConceptState
): AnalyticsFlags {
  const attemptCount = state.attempt_count + 1;

  return {
    careless_mistake: bktResult.careless_mistake,
    lucky_guess: bktResult.lucky_guess,
    decay_warning: isDecayWarning(decayResult.decay_drop),
    stagnation: detectStagnation(emaScore, attemptCount),
    rapid_improvement: detectRapidImprovement(state.recent_results),
    mastery_achieved:
      bktResult.updated_mastery >= MASTERY_ACHIEVED_THRESHOLD &&
      attemptCount >= MASTERY_ACHIEVED_MIN_ATTEMPTS,
  };
}
