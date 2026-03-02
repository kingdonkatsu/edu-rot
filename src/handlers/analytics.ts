import type { Request, Response } from 'express';
import type {
  AccuracyTimelinePoint,
  ActivityHeatmapCell,
  DashboardAnalyticsResponse,
  EMATimelinePoint,
  InteractionRecord,
  MasteryTimelinePoint,
  StudentConceptState,
  SummaryKPIs,
} from '../types.js';
import type { IStateStore } from '../adapters/state-store.js';
import { computeLearningVelocity } from '../services/learning-velocity.js';
import { computeEngagementScore } from '../services/engagement.js';
import { computeForgettingProjection } from '../services/forgetting-projection.js';
import { computeSpacedRepetitionSchedule } from '../services/spaced-repetition.js';
import { computeErrorHeatmap } from '../services/error-heatmap.js';

function sortByTimestamp<T extends { timestamp: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

function buildMasteryTimeline(records: Array<{ timestamp: string; concept_tag: string; p_mastery: number }>): MasteryTimelinePoint[] {
  return sortByTimestamp(records).map((record) => ({
    timestamp: record.timestamp,
    concept_tag: record.concept_tag,
    p_mastery: record.p_mastery,
  }));
}

function buildEMATimeline(records: Array<{ timestamp: string; concept_tag: string; ema: number }>): EMATimelinePoint[] {
  return sortByTimestamp(records).map((record) => ({
    timestamp: record.timestamp,
    concept_tag: record.concept_tag,
    ema: record.ema,
  }));
}

function buildCumulativeAccuracy(records: Array<{ timestamp: string; is_correct: boolean }>): AccuracyTimelinePoint[] {
  const sorted = sortByTimestamp(records);
  let total = 0;
  let correct = 0;

  return sorted.map((record) => {
    total += 1;
    if (record.is_correct) correct += 1;
    return {
      timestamp: record.timestamp,
      cumulative_accuracy: total > 0 ? correct / total : 0,
    };
  });
}

function buildWeeklyActivityHeatmap(records: Array<{ timestamp: string }>): ActivityHeatmapCell[] {
  const counts = new Map<string, number>();

  for (const record of records) {
    const date = new Date(record.timestamp);
    const key = `${date.getUTCDay()}::${date.getUTCHours()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const cells: ActivityHeatmapCell[] = [];
  for (const [key, count] of counts.entries()) {
    const [day_of_week, hour_of_day] = key.split('::').map(Number);
    cells.push({ day_of_week, hour_of_day, count });
  }

  return cells.sort((a, b) => (a.day_of_week - b.day_of_week) || (a.hour_of_day - b.hour_of_day));
}

function computeBestStreak(history: InteractionRecord[]): number {
  const sorted = [...history].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  let best = 0;
  let current = 0;
  for (const record of sorted) {
    current = record.is_correct ? current + 1 : 0;
    if (current > best) best = current;
  }
  return best;
}

function computeSummaryKPIs(states: StudentConceptState[]): SummaryKPIs {
  let total_attempts = 0;
  let total_correct = 0;
  let current_streak = 0;
  let best_streak = 0;
  let concepts_attempted = 0;
  let concepts_mastered = 0;

  for (const s of states) {
    total_attempts += s.attempt_count;
    total_correct += s.correct_count;
    if (s.attempt_count > 0) concepts_attempted++;
    if (s.p_mastery >= 0.8) concepts_mastered++;
    if (s.streak_correct > current_streak) current_streak = s.streak_correct;
    const conceptBest = computeBestStreak(s.interaction_history);
    if (conceptBest > best_streak) best_streak = conceptBest;
  }

  return {
    total_attempts,
    overall_accuracy: total_attempts > 0 ? total_correct / total_attempts : 0,
    current_streak,
    best_streak,
    concepts_attempted,
    concepts_mastered,
  };
}

export function createAnalyticsHandlers(store: IStateStore) {
  function paramToString(value: unknown): string {
    return Array.isArray(value) ? value[0] ?? '' : String(value ?? '');
  }

  async function loadStudentState(studentId: string) {
    return store.getAllForStudent(studentId);
  }

  async function getDashboard(req: Request, res: Response): Promise<void> {
    const studentId = paramToString(req.params.studentId);

    try {
      const states = await loadStudentState(studentId);
      const records = states.flatMap((state) => state.interaction_history);

      const payload: DashboardAnalyticsResponse = {
        student_id: studentId,
        learning_velocity: computeLearningVelocity(studentId, states),
        engagement: computeEngagementScore(studentId, states),
        forgetting_curves: computeForgettingProjection(studentId, states),
        review_schedule: computeSpacedRepetitionSchedule(studentId, states),
        error_heatmap: computeErrorHeatmap(studentId, states),
        mastery_timeline: buildMasteryTimeline(records),
        ema_timeline: buildEMATimeline(records),
        topic_mastery: states.map((state) => ({ concept_tag: state.concept_tag, p_mastery: state.p_mastery })),
        cumulative_accuracy: buildCumulativeAccuracy(records),
        weekly_activity_heatmap: buildWeeklyActivityHeatmap(records),
        summary_kpis: computeSummaryKPIs(states),
      };

      res.status(200).json(payload);
    } catch (error) {
      console.error('[analytics.dashboard] error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async function getForgettingCurves(req: Request, res: Response): Promise<void> {
    const studentId = paramToString(req.params.studentId);

    try {
      const states = await loadStudentState(studentId);
      res.status(200).json(computeForgettingProjection(studentId, states));
    } catch (error) {
      console.error('[analytics.forgetting-curves] error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async function getReviewSchedule(req: Request, res: Response): Promise<void> {
    const studentId = paramToString(req.params.studentId);

    try {
      const states = await loadStudentState(studentId);
      res.status(200).json(computeSpacedRepetitionSchedule(studentId, states));
    } catch (error) {
      console.error('[analytics.review-schedule] error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async function getErrorHeatmap(req: Request, res: Response): Promise<void> {
    const studentId = paramToString(req.params.studentId);

    try {
      const states = await loadStudentState(studentId);
      res.status(200).json(computeErrorHeatmap(studentId, states));
    } catch (error) {
      console.error('[analytics.error-heatmap] error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  return {
    getDashboard,
    getForgettingCurves,
    getReviewSchedule,
    getErrorHeatmap,
  };
}
