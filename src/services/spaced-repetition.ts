import type {
  ReviewScheduleItem,
  SpacedRepetitionScheduleResult,
  StudentConceptState,
} from '../types.js';
import { LAMBDA, SPACED_REPETITION_MASTERY_THRESHOLD } from '../utils/constants.js';

function hoursToThreshold(mastery: number, stability: number, threshold: number): number {
  if (mastery <= threshold) return 0;
  const safeStability = Math.max(stability, 0.1);
  const intervalDays = (safeStability / LAMBDA) * Math.log(mastery / threshold);
  return Math.max(0, intervalDays * 24);
}

export function computeSpacedRepetitionSchedule(
  studentId: string,
  states: StudentConceptState[],
  threshold = SPACED_REPETITION_MASTERY_THRESHOLD
): SpacedRepetitionScheduleResult {
  const recommendations: ReviewScheduleItem[] = states.map((state) => {
    const hours = hoursToThreshold(state.p_mastery, state.stability, threshold);
    const baseTs = Date.parse(state.updated_at);
    const reviewTs = Number.isFinite(baseTs) ? baseTs + hours * 3_600_000 : Date.now() + hours * 3_600_000;

    return {
      concept_tag: state.concept_tag,
      current_mastery: state.p_mastery,
      threshold,
      recommended_review_at: new Date(reviewTs).toISOString(),
      hours_until_review: hours,
    };
  });

  recommendations.sort((a, b) => a.hours_until_review - b.hours_until_review);

  return {
    student_id: studentId,
    threshold,
    recommendations,
  };
}
