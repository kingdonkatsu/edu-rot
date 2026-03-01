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

// --- Agent Inputs ---

export type ErrorClassification =
  | 'careless_mistake'
  | 'lucky_guess'
  | 'conceptual_gap'
  | 'procedural_error'
  | 'misread_question'
  | 'stagnation'
  | 'decay'
  | 'none';

export interface CrashCourseRAGContext {
  concept_explanations: string[];
  misconception_data: string[];
  analogies: string[];
  worked_examples: string[];
}

export interface CrashCourseAgentInput {
  student_id: string;
  topic: string;
  subtopic: string;
  error_classification: ErrorClassification;
  mastery_level: MasteryLevel;
  known_strengths: string[];
  rag: CrashCourseRAGContext;
}

export interface WeeklyTopicTrend {
  topic: string;
  attempts: number;
  accuracy_rate: number;
  mastery_delta: number;
}

export interface WeeklyErrorPattern {
  pattern: ErrorClassification | string;
  count: number;
}

export interface WeeklyBehaviorWindow {
  label: string;
  accuracy_rate: number;
  sessions: number;
}

export interface WeeklyLearningState {
  student_id: string;
  week_start: string;
  week_end: string;
  improved_topics: WeeklyTopicTrend[];
  declined_topics: WeeklyTopicTrend[];
  untouched_topics: Array<{ topic: string; estimated_decay: number }>;
  recurring_error_patterns: WeeklyErrorPattern[];
  behavior_windows: WeeklyBehaviorWindow[];
  avg_session_minutes: number;
  sessions_count: number;
  days_active: number;
  previous_week_quest_completion_rate: number;
}

// --- Agent Outputs ---

export type CrashCourseCardStage =
  | 'specific_mistake'
  | 'intuition_analogy'
  | 'actual_concept'
  | 'worked_example'
  | 'practice_question'
  | 'reinforcement';

export interface CrashCourseCard {
  stage: CrashCourseCardStage;
  title: string;
  body: string;
}

export interface CrashCourseMakerOutput {
  cards: CrashCourseCard[];
}

export interface AgentCheckerIssue {
  message: string;
  fix_instruction: string;
  card_index?: number;
}

export interface AgentCheckerResult {
  passed: boolean;
  issues: AgentCheckerIssue[];
}

export interface CrashCourseAgentOutput {
  cards: CrashCourseCard[];
  attempts: number;
  checker_history: AgentCheckerResult[];
}

export interface MainCharacterSection {
  topic: string;
  mastery_delta: number;
  attempts: number;
  narrative: string;
}

export interface FlopEraSection {
  topic: string;
  error_pattern: string;
  accuracy_rate: number;
  narrative: string;
}

export interface GhostTopicSection {
  topic: string;
  estimated_decay: number;
}

export interface PlotTwistSection {
  insight: string;
  metric_label: string;
  metric_value: number;
}

export interface WeeklyQuestItem {
  action: string;
  rationale: string;
}

export interface WeeklyInsightsRecap {
  main_character: MainCharacterSection;
  flop_era: FlopEraSection;
  ghost_topics: GhostTopicSection[];
  plot_twist: PlotTwistSection;
  weekly_quest: WeeklyQuestItem[];
}

export interface WeeklyInsightsAgentOutput {
  recap: WeeklyInsightsRecap;
  attempts: number;
  checker_history: AgentCheckerResult[];
}
