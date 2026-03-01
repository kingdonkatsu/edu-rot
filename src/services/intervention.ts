import type {
  AnalyticsFlags,
  InterventionPriority,
  InterventionResult,
  MasteryLevel,
  StudentConceptState,
} from '../types.js';
import { STAGNATION_ESCALATION_ATTEMPTS } from '../utils/constants.js';

export function computeIntervention(
  flags: AnalyticsFlags,
  state: StudentConceptState,
  masteryLevel: MasteryLevel,
  emaScore: number
): InterventionResult {
  const priority = determinePriority(flags, state);
  const action = selectRecommendedAction(priority, flags);
  const context = buildContext(flags, state, masteryLevel, emaScore);

  return { priority, recommended_action: action, context };
}

function determinePriority(
  flags: AnalyticsFlags,
  state: StudentConceptState
): InterventionPriority {
  if (flags.mastery_achieved) return 'none';

  if (flags.stagnation && state.attempt_count + 1 >= STAGNATION_ESCALATION_ATTEMPTS) {
    return 'critical';
  }
  if (flags.decay_warning && state.p_mastery < 0.40) {
    return 'high';
  }
  if (flags.lucky_guess || flags.stagnation) {
    return 'medium';
  }
  if (flags.careless_mistake) {
    return 'low';
  }
  return 'none';
}

function selectRecommendedAction(
  priority: InterventionPriority,
  flags: AnalyticsFlags
): string {
  switch (priority) {
    case 'critical':
      return 'escalate_to_instructor';
    case 'high':
      return 'trigger_spaced_review';
    case 'medium':
      return 'assign_reinforcement';
    case 'low':
      return 'prompt_attention_check';
    case 'none':
      return flags.mastery_achieved
        ? 'advance_to_next_concept'
        : 'continue_learning_path';
  }
}

function buildContext(
  flags: AnalyticsFlags,
  state: StudentConceptState,
  masteryLevel: MasteryLevel,
  emaScore: number
): Record<string, string | number | boolean> {
  const activeFlag = getActiveFlag(flags);
  return {
    concept_tag: state.concept_tag,
    mastery_level: masteryLevel,
    specific_flag: activeFlag,
    attempts_on_concept: state.attempt_count + 1,
    recent_accuracy: emaScore,
    suggested_tone: getSuggestedTone(flags),
  };
}

function getActiveFlag(flags: AnalyticsFlags): string {
  if (flags.mastery_achieved) return 'mastery_achieved';
  if (flags.stagnation) return 'stagnation';
  if (flags.decay_warning) return 'decay_warning';
  if (flags.lucky_guess) return 'lucky_guess';
  if (flags.careless_mistake) return 'careless_mistake';
  if (flags.rapid_improvement) return 'rapid_improvement';
  return 'none';
}

function getSuggestedTone(flags: AnalyticsFlags): string {
  if (flags.mastery_achieved || flags.rapid_improvement) return 'encouraging';
  if (flags.stagnation) return 'supportive';
  if (flags.careless_mistake) return 'gentle_reminder';
  return 'neutral';
}
