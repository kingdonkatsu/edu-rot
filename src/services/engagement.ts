import type { EngagementScoreResult, StudentConceptState } from '../types.js';
import {
  ENGAGEMENT_TARGET_ACTIVE_DAYS,
  ENGAGEMENT_TARGET_DAILY_FREQUENCY,
  ENGAGEMENT_TARGET_SESSION_MINUTES,
  ENGAGEMENT_TARGET_STREAK_DAYS,
  ENGAGEMENT_WEIGHTS,
  SESSION_GAP_MINUTES,
} from '../utils/constants.js';

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function toDateKey(timestamp: string): string {
  return timestamp.slice(0, 10);
}

function dayDiff(a: string, b: string): number {
  const aa = Date.parse(`${a}T00:00:00Z`);
  const bb = Date.parse(`${b}T00:00:00Z`);
  return Math.round((bb - aa) / 86_400_000);
}

function estimateSessionStats(timestamps: string[]): { sessions: number; avgMinutes: number } {
  if (timestamps.length === 0) return { sessions: 0, avgMinutes: 0 };

  const sorted = [...timestamps].sort((a, b) => Date.parse(a) - Date.parse(b));
  const sessions: Array<{ start: number; end: number }> = [];
  let start = Date.parse(sorted[0]);
  let end = start;

  for (let i = 1; i < sorted.length; i++) {
    const ts = Date.parse(sorted[i]);
    const gapMinutes = (ts - end) / 60_000;
    if (gapMinutes > SESSION_GAP_MINUTES) {
      sessions.push({ start, end });
      start = ts;
      end = ts;
    } else {
      end = ts;
    }
  }
  sessions.push({ start, end });

  const totalMinutes = sessions.reduce((sum, session) => {
    const span = (session.end - session.start) / 60_000;
    return sum + Math.max(5, span + 5);
  }, 0);

  return {
    sessions: sessions.length,
    avgMinutes: sessions.length > 0 ? totalMinutes / sessions.length : 0,
  };
}

function longestStreak(dayKeys: string[]): number {
  if (dayKeys.length === 0) return 0;
  const sortedUnique = [...new Set(dayKeys)].sort();
  let best = 1;
  let current = 1;

  for (let i = 1; i < sortedUnique.length; i++) {
    if (dayDiff(sortedUnique[i - 1], sortedUnique[i]) === 1) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }

  return best;
}

export function computeEngagementScore(studentId: string, states: StudentConceptState[]): EngagementScoreResult {
  const history = states.flatMap((state) => state.interaction_history);
  if (history.length === 0) {
    return {
      student_id: studentId,
      score: 0,
      components: { frequency: 0, duration: 0, streak: 0, consistency: 0 },
      weighted: { frequency: 0, duration: 0, streak: 0, consistency: 0 },
    };
  }

  const timestamps = history.map((event) => event.timestamp);
  const dayKeys = timestamps.map(toDateKey);
  const uniqueDays = new Set(dayKeys);
  const activeDays = uniqueDays.size;

  const frequencyRaw = history.length / Math.max(activeDays, 1);
  const frequency = clamp01(frequencyRaw / ENGAGEMENT_TARGET_DAILY_FREQUENCY);

  const sessionStats = estimateSessionStats(timestamps);
  const duration = clamp01(sessionStats.avgMinutes / ENGAGEMENT_TARGET_SESSION_MINUTES);

  const streakDays = longestStreak(dayKeys);
  const streak = clamp01(streakDays / ENGAGEMENT_TARGET_STREAK_DAYS);

  const consistency = clamp01(activeDays / ENGAGEMENT_TARGET_ACTIVE_DAYS);

  const weighted = {
    frequency: frequency * ENGAGEMENT_WEIGHTS.frequency,
    duration: duration * ENGAGEMENT_WEIGHTS.duration,
    streak: streak * ENGAGEMENT_WEIGHTS.streak,
    consistency: consistency * ENGAGEMENT_WEIGHTS.consistency,
  };

  return {
    student_id: studentId,
    score: weighted.frequency + weighted.duration + weighted.streak + weighted.consistency,
    components: { frequency, duration, streak, consistency },
    weighted,
  };
}
