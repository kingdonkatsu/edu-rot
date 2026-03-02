import type {
  LMSEvent,
  MasteryLevel,
  PipelineResponse,
  StudentConceptState,
  AnalyticsFlags,
  ErrorClassification,
  InteractionRecord,
} from '../types.js';
import type { IStateStore } from '../adapters/state-store.js';
import { createInitialState } from '../adapters/state-store.js';
import { computeDecay } from './decay.js';
import { computeBKT } from './bkt.js';
import { computeEMA } from './ema.js';
import { evaluateFlags } from './flags.js';
import { computeIntervention } from './intervention.js';
import { generateBrainRotVideo } from './video-service.js';
import {
  STABILITY_CORRECT_INCREMENT,
  STABILITY_INCORRECT_DECREMENT,
  STABILITY_MIN,
  RAPID_FIRE_SECONDS,
  EMA_RAPID_IMPROVEMENT_WINDOW,
  MASTERY_NOVICE_MAX,
  MASTERY_DEVELOPING_MAX,
  MASTERY_PROFICIENT_MAX,
  ANALYTICS_HISTORY_MAX_EVENTS,
} from '../utils/constants.js';

export async function runPipeline(
  event: LMSEvent,
  store: IStateStore
): Promise<PipelineResponse> {
  const state = await loadOrInitState(event, store);
  const rapidFireCounter = detectRapidFire(state, event.timestamp);

  const decay = computeDecay(
    state.p_mastery,
    state.stability,
    state.last_interaction_at,
    event.timestamp
  );

  const bkt = computeBKT(decay.post_decay_mastery, event.is_correct, rapidFireCounter);
  const ema = computeEMA(state.ema, event.is_correct);

  const updatedRecentResults = updateRecentResults(state.recent_results, event.is_correct);
  const stateWithResults = { ...state, recent_results: updatedRecentResults };

  const flags = evaluateFlags(bkt, decay, ema.ema_current, stateWithResults);
  const masteryLevel = determineMasteryLevel(bkt.updated_mastery);
  const intervention = computeIntervention(flags, stateWithResults, masteryLevel, ema.ema_current);

  const updatedState = buildUpdatedState(
    state, event, bkt, ema, rapidFireCounter, updatedRecentResults, flags
  );
  await store.upsert(updatedState);

  let videoUrl: string | undefined;
  if (intervention.priority === 'critical' || intervention.priority === 'high') {
    try {
      videoUrl = await generateBrainRotVideo(intervention.recommended_action, event.student_id);
    } catch (error) {
      console.error('Failed to generate brain rot video:', error);
    }
  }

  return composeResponse(event, decay, bkt, ema, flags, intervention, updatedState, videoUrl);
}

async function loadOrInitState(
  event: LMSEvent,
  store: IStateStore
): Promise<StudentConceptState> {
  const existing = await store.get(event.student_id, event.concept_tag);
  return existing ?? createInitialState(event.student_id, event.concept_tag, event.timestamp);
}

function detectRapidFire(state: StudentConceptState, currentTimestamp: string): number {
  if (!state.last_interaction_at) return 0;

  const gapMs = Date.parse(currentTimestamp) - Date.parse(state.last_interaction_at);
  const gapSeconds = gapMs / 1000;

  if (gapSeconds < RAPID_FIRE_SECONDS) {
    return state.rapid_fire_counter + 1;
  }
  return 0;
}

function updateRecentResults(existing: boolean[], isCorrect: boolean): boolean[] {
  const updated = [...existing, isCorrect];
  if (updated.length > EMA_RAPID_IMPROVEMENT_WINDOW * 2) {
    return updated.slice(-EMA_RAPID_IMPROVEMENT_WINDOW * 2);
  }
  return updated;
}

function buildUpdatedState(
  original: StudentConceptState,
  event: LMSEvent,
  bkt: { updated_mastery: number },
  ema: { ema_current: number },
  rapidFireCounter: number,
  recentResults: boolean[],
  flags: AnalyticsFlags
): StudentConceptState {
  const newStability = event.is_correct
    ? original.stability + STABILITY_CORRECT_INCREMENT
    : Math.max(STABILITY_MIN, original.stability - STABILITY_INCORRECT_DECREMENT);
  const errorClassification = deriveErrorClassification(flags);
  const interactionRecord: InteractionRecord = {
    timestamp: event.timestamp,
    concept_tag: event.concept_tag,
    is_correct: event.is_correct,
    p_mastery: bkt.updated_mastery,
    ema: ema.ema_current,
    error_classification: errorClassification,
  };
  const interactionHistory = [...original.interaction_history, interactionRecord];
  const boundedHistory = interactionHistory.length > ANALYTICS_HISTORY_MAX_EVENTS
    ? interactionHistory.slice(-ANALYTICS_HISTORY_MAX_EVENTS)
    : interactionHistory;

  return {
    ...original,
    p_mastery: bkt.updated_mastery,
    stability: newStability,
    last_interaction_at: event.timestamp,
    first_interaction_at: original.first_interaction_at ?? event.timestamp,
    ema: ema.ema_current,
    attempt_count: original.attempt_count + 1,
    correct_count: original.correct_count + (event.is_correct ? 1 : 0),
    streak_correct: event.is_correct ? original.streak_correct + 1 : 0,
    streak_incorrect: event.is_correct ? 0 : original.streak_incorrect + 1,
    recent_results: recentResults,
    interaction_history: boundedHistory,
    rapid_fire_counter: rapidFireCounter,
    last_event_id: event.event_id,
    updated_at: event.timestamp,
  };
}

function deriveErrorClassification(flags: AnalyticsFlags): ErrorClassification {
  if (flags.careless_mistake) return 'careless_mistake';
  if (flags.lucky_guess) return 'lucky_guess';
  if (flags.decay_warning) return 'decay';
  if (flags.stagnation) return 'stagnation';
  return 'none';
}

export function determineMasteryLevel(pMastery: number): MasteryLevel {
  if (pMastery < MASTERY_NOVICE_MAX) return 'novice';
  if (pMastery < MASTERY_DEVELOPING_MAX) return 'developing';
  if (pMastery < MASTERY_PROFICIENT_MAX) return 'proficient';
  return 'mastered';
}

function composeResponse(
  event: LMSEvent,
  decay: ReturnType<typeof computeDecay>,
  bkt: ReturnType<typeof computeBKT>,
  ema: ReturnType<typeof computeEMA>,
  flags: ReturnType<typeof evaluateFlags>,
  intervention: ReturnType<typeof computeIntervention>,
  state: StudentConceptState,
  videoUrl?: string
): PipelineResponse {
  return {
    event_id: event.event_id,
    student_id: event.student_id,
    concept_tag: event.concept_tag,
    timestamp: event.timestamp,
    is_correct: event.is_correct,
    mastery: {
      p_mastery_prior: decay.post_decay_mastery,
      p_mastery_posterior: bkt.updated_mastery,
      p_mastery_delta: bkt.updated_mastery - decay.post_decay_mastery,
      mastery_level: determineMasteryLevel(bkt.updated_mastery),
    },
    momentum: {
      ema_score: ema.ema_current,
      ema_prior: ema.ema_previous,
      trend: ema.trend,
    },
    decay: {
      hours_since_last: decay.delta_t_hours,
      decay_applied: decay.decay_applied,
      pre_decay_mastery: decay.pre_decay_mastery,
      decay_magnitude: decay.decay_drop,
    },
    flags,
    intervention,
    interaction_summary: {
      total_attempts: state.attempt_count,
      total_correct: state.correct_count,
      accuracy_rate: state.attempt_count > 0
        ? state.correct_count / state.attempt_count
        : 0,
      streak_correct: state.streak_correct,
      streak_incorrect: state.streak_incorrect,
    },
    video_url: videoUrl,
  };
}
