// Ebbinghaus Decay
export const LAMBDA = 0.02;
export const STABILITY_INITIAL = 1.0;
export const STABILITY_CORRECT_INCREMENT = 0.1;
export const STABILITY_INCORRECT_DECREMENT = 0.3;
export const STABILITY_MIN = 1.0;
export const DECAY_MIN_HOURS = 1.0;
export const DECAY_FLOOR = 0.01;
export const DECAY_WARNING_THRESHOLD = 0.15;

// BKT
export const BKT_P_L0 = 0.10;
export const BKT_P_TRANSIT = 0.15;
export const BKT_P_SLIP = 0.10;
export const BKT_P_GUESS = 0.25;
export const BKT_CARELESS_PRIOR_THRESHOLD = 0.80;
export const BKT_CARELESS_POSTERIOR_THRESHOLD = 0.60;
export const BKT_LUCKY_GUESS_THRESHOLD = 0.40;

// Rapid-fire detection
export const RAPID_FIRE_SECONDS = 3;
export const RAPID_FIRE_MIN_COUNT = 5;
export const RAPID_FIRE_TRANSIT_DAMPEN = 0.1;
export const RAPID_FIRE_GUESS_AMPLIFY = 1.5;
export const RAPID_FIRE_GUESS_CAP = 0.50;

// EMA
export const EMA_ALPHA = 0.3;
export const EMA_COLD_START = 0.5;
export const EMA_STAGNATION_MIN_ATTEMPTS = 10;
export const EMA_STAGNATION_LOWER = 0.45;
export const EMA_STAGNATION_UPPER = 0.55;
export const EMA_RAPID_IMPROVEMENT_DELTA = 0.25;
export const EMA_RAPID_IMPROVEMENT_WINDOW = 5;

// Mastery levels
export const MASTERY_NOVICE_MAX = 0.40;
export const MASTERY_DEVELOPING_MAX = 0.70;
export const MASTERY_PROFICIENT_MAX = 0.95;

// Mastery achieved
export const MASTERY_ACHIEVED_THRESHOLD = 0.95;
export const MASTERY_ACHIEVED_MIN_ATTEMPTS = 5;

// Intervention
export const STAGNATION_ESCALATION_ATTEMPTS = 15;

// Validation
export const TIMESTAMP_SKEW_TOLERANCE_MS = 60_000;

// Analytics history + windows
export const ANALYTICS_HISTORY_MAX_EVENTS = 500;
export const VELOCITY_WINDOW_HOURS = 24;
export const FORGETTING_PROJECTION_DAYS = [1, 3, 7, 14, 30] as const;
export const SPACED_REPETITION_MASTERY_THRESHOLD = 0.7;
export const SESSION_GAP_MINUTES = 45;

// Engagement normalization targets
export const ENGAGEMENT_TARGET_DAILY_FREQUENCY = 3;
export const ENGAGEMENT_TARGET_SESSION_MINUTES = 20;
export const ENGAGEMENT_TARGET_STREAK_DAYS = 7;
export const ENGAGEMENT_TARGET_ACTIVE_DAYS = 7;

// Engagement weights
export const ENGAGEMENT_WEIGHTS = {
  frequency: 0.3,
  duration: 0.2,
  streak: 0.2,
  consistency: 0.3,
} as const;
