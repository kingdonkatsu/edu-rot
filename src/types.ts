// --- Input ---

export interface LMSEvent {
  event_id: string;
  student_id: string;
  timestamp: string;
  concept_tag: string;
  is_correct: boolean;
}

// --- Persisted State ---

export interface StudentConceptState {
  student_id: string;
  concept_tag: string;
  p_mastery: number;
  stability: number;
  last_interaction_at: string | null;
  ema: number;
  attempt_count: number;
  correct_count: number;
  streak_correct: number;
  streak_incorrect: number;
  recent_results: boolean[];
  rapid_fire_counter: number;
  last_event_id: string | null;
  updated_at: string;
}

// --- Algorithm Results ---

export interface DecayResult {
  pre_decay_mastery: number;
  post_decay_mastery: number;
  delta_t_hours: number;
  decay_applied: boolean;
  decay_drop: number;
}

export interface BKTResult {
  prior: number;
  posterior: number;
  updated_mastery: number;
  careless_mistake: boolean;
  lucky_guess: boolean;
}

export interface EMAResult {
  ema_previous: number;
  ema_current: number;
  trend: Trend;
}

export type Trend = 'improving' | 'declining' | 'stable' | 'stagnant';

// --- Flags ---

export interface AnalyticsFlags {
  careless_mistake: boolean;
  lucky_guess: boolean;
  decay_warning: boolean;
  stagnation: boolean;
  rapid_improvement: boolean;
  mastery_achieved: boolean;
}

// --- Intervention ---

export type InterventionPriority = 'critical' | 'high' | 'medium' | 'low' | 'none';

export interface InterventionResult {
  priority: InterventionPriority;
  recommended_action: string;
  context: Record<string, string | number | boolean>;
}

// --- Mastery Level ---

export type MasteryLevel = 'novice' | 'developing' | 'proficient' | 'mastered';

// --- API Response ---

export interface PipelineResponse {
  event_id: string;
  student_id: string;
  concept_tag: string;
  timestamp: string;
  is_correct: boolean;
  mastery: {
    p_mastery_prior: number;
    p_mastery_posterior: number;
    p_mastery_delta: number;
    mastery_level: MasteryLevel;
  };
  momentum: {
    ema_score: number;
    ema_prior: number;
    trend: Trend;
  };
  decay: {
    hours_since_last: number;
    decay_applied: boolean;
    pre_decay_mastery: number;
    decay_magnitude: number;
  };
  flags: AnalyticsFlags;
  intervention: InterventionResult;
  interaction_summary: {
    total_attempts: number;
    total_correct: number;
    accuracy_rate: number;
    streak_correct: number;
    streak_incorrect: number;
  };
}
