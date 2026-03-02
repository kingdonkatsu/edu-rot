// --- Input ---

export interface LMSEvent {
  event_id: string;
  student_id: string;
  timestamp: string;
  concept_tag: string;
  is_correct: boolean;
}

// --- Mastery and Errors ---

export type MasteryLevel = 'novice' | 'developing' | 'proficient' | 'mastered';

export type ErrorClassification =
  | 'careless_mistake'
  | 'lucky_guess'
  | 'conceptual_gap'
  | 'procedural_error'
  | 'misread_question'
  | 'stagnation'
  | 'decay'
  | 'none';

// --- Persisted State ---

export interface InteractionRecord {
  timestamp: string;
  concept_tag: string;
  is_correct: boolean;
  p_mastery: number;
  ema: number;
  error_classification: ErrorClassification;
}

export interface StudentConceptState {
  student_id: string;
  concept_tag: string;
  p_mastery: number;
  stability: number;
  last_interaction_at: string | null;
  first_interaction_at: string | null;
  ema: number;
  attempt_count: number;
  correct_count: number;
  streak_correct: number;
  streak_incorrect: number;
  recent_results: boolean[];
  interaction_history: InteractionRecord[];
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

export type Trend = 'improving' | 'declining' | 'stable' | 'stagnant';

export interface EMAResult {
  ema_previous: number;
  ema_current: number;
  trend: Trend;
}

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

// --- Agent Types ---

export type VoiceoverSectionLabel =
  | 'hook'
  | 'misconception_callout'
  | 'intuition_bridge'
  | 'concept_explanation'
  | 'worked_example'
  | 'practice_cta';

export interface VoiceoverScriptSection {
  label: VoiceoverSectionLabel;
  text: string;
}

export interface VoiceoverScript {
  title: string;
  target_duration_seconds: number;
  sections: VoiceoverScriptSection[];
  full_script: string;
  word_count: number;
}

export interface AgentCheckerIssue {
  gate: string;
  message: string;
}

export interface AgentCheckerResult {
  passed: boolean;
  issues: AgentCheckerIssue[];
  attempt: number;
}

export interface CrashCourseAgentInput {
  student_id: string;
  topic: string;
  subtopic: string;
  error_classification: ErrorClassification;
  mastery_level: MasteryLevel;
  known_strengths: string[];
  rag: {
    concept_explanations: string[];
    misconception_data: string[];
    analogies: string[];
    worked_examples: string[];
  };
}

export interface CrashCourseAgentOutput {
  script: VoiceoverScript;
  attempts: number;
  checker_history: AgentCheckerResult[];
  video_url?: string;
}

export interface WeeklyTopicTrend {
  topic: string;
  attempts: number;
  accuracy_rate: number;
  mastery_delta: number;
}

export interface WeeklyErrorPattern {
  pattern: string;
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

export interface WeeklyInsightsSummaryKPIs {
  top_topic: string;
  top_gain: number;
  accuracy_this_week: number;
  days_active: number;
  sessions_count: number;
  quest_count: number;
}

export interface WeeklyInsightsAgentOutput {
  recap: WeeklyInsightsRecap;
  summary_kpis: WeeklyInsightsSummaryKPIs;
  attempts: number;
  checker_history: AgentCheckerResult[];
}

// --- Analytics ---

export interface ConceptVelocity {
  concept_tag: string;
  mastery_delta: number;
  elapsed_hours: number;
  velocity_per_hour: number;
}

export interface LearningVelocityResult {
  student_id: string;
  window_hours: number;
  mastery_delta: number;
  elapsed_hours: number;
  velocity_per_hour: number;
  by_concept: ConceptVelocity[];
}

export interface EngagementScoreResult {
  student_id: string;
  score: number;
  components: {
    frequency: number;
    duration: number;
    streak: number;
    consistency: number;
  };
  weighted: {
    frequency: number;
    duration: number;
    streak: number;
    consistency: number;
  };
}

export interface ForgettingProjectionPoint {
  days: number;
  projected_mastery: number;
}

export interface ForgettingProjectionSeries {
  concept_tag: string;
  current_mastery: number;
  points: ForgettingProjectionPoint[];
}

export interface ForgettingProjectionResult {
  student_id: string;
  days: number[];
  projections: ForgettingProjectionSeries[];
}

export interface ReviewScheduleItem {
  concept_tag: string;
  current_mastery: number;
  threshold: number;
  recommended_review_at: string;
  hours_until_review: number;
}

export interface SpacedRepetitionScheduleResult {
  student_id: string;
  threshold: number;
  recommendations: ReviewScheduleItem[];
}

export interface ErrorHeatmapCell {
  concept_tag: string;
  error_classification: ErrorClassification;
  count: number;
}

export interface ErrorHeatmapResult {
  student_id: string;
  concepts: string[];
  error_labels: ErrorClassification[];
  cells: ErrorHeatmapCell[];
}

export interface MasteryTimelinePoint {
  timestamp: string;
  concept_tag: string;
  p_mastery: number;
}

export interface EMATimelinePoint {
  timestamp: string;
  concept_tag: string;
  ema: number;
}

export interface AccuracyTimelinePoint {
  timestamp: string;
  cumulative_accuracy: number;
}

export interface ActivityHeatmapCell {
  day_of_week: number;
  hour_of_day: number;
  count: number;
}

export interface TopicMasteryPoint {
  concept_tag: string;
  p_mastery: number;
}

export interface SummaryKPIs {
  total_attempts: number;
  overall_accuracy: number;
  current_streak: number;
  best_streak: number;
  concepts_attempted: number;
  concepts_mastered: number;
}

export interface DashboardAnalyticsResponse {
  student_id: string;
  learning_velocity: LearningVelocityResult;
  engagement: EngagementScoreResult;
  forgetting_curves: ForgettingProjectionResult;
  review_schedule: SpacedRepetitionScheduleResult;
  error_heatmap: ErrorHeatmapResult;
  mastery_timeline: MasteryTimelinePoint[];
  ema_timeline: EMATimelinePoint[];
  topic_mastery: TopicMasteryPoint[];
  cumulative_accuracy: AccuracyTimelinePoint[];
  weekly_activity_heatmap: ActivityHeatmapCell[];
  summary_kpis: SummaryKPIs;
}

// --- Media ---

export interface TTSRequest {
  script: string | VoiceoverScript;
  student_id?: string;
  topic?: string;
  output_basename?: string;
}

export interface TTSResult {
  audio_url: string;
  duration_seconds: number;
  blob_path: string;
}

export interface VideoAssemblyRequest {
  audio_url: string;
  background_key: string;
  output_basename?: string;
}

export interface VideoAssemblyResult {
  video_url: string;
  duration_seconds: number;
  blob_path: string;
}

export interface CrashCourseVideoPipelineResponse {
  script: VoiceoverScript;
  audio: TTSResult;
  video: VideoAssemblyResult;
  attempts: number;
  checker_history: AgentCheckerResult[];
  video_url?: string;
}

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
  video_url?: string;
}
