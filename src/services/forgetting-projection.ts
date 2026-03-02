import type {
  ForgettingProjectionPoint,
  ForgettingProjectionResult,
  StudentConceptState,
} from '../types.js';
import { FORGETTING_PROJECTION_DAYS, LAMBDA } from '../utils/constants.js';

function projectMastery(current: number, stability: number, days: number): number {
  const safeStability = Math.max(stability, 0.1);
  return current * Math.exp((-LAMBDA * days) / safeStability);
}

export function computeForgettingProjection(
  studentId: string,
  states: StudentConceptState[],
  projectionDays: readonly number[] = FORGETTING_PROJECTION_DAYS
): ForgettingProjectionResult {
  const projections = states.map((state) => {
    const points: ForgettingProjectionPoint[] = projectionDays.map((days) => ({
      days,
      projected_mastery: projectMastery(state.p_mastery, state.stability, days),
    }));

    return {
      concept_tag: state.concept_tag,
      current_mastery: state.p_mastery,
      points,
    };
  });

  return {
    student_id: studentId,
    days: [...projectionDays],
    projections,
  };
}
