import type { LearningVelocityResult, StudentConceptState } from '../types.js';
import { VELOCITY_WINDOW_HOURS } from '../utils/constants.js';

function safeHours(from: string, to: string): number {
  const diff = (Date.parse(to) - Date.parse(from)) / 3_600_000;
  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}

export function computeLearningVelocity(
  studentId: string,
  states: StudentConceptState[],
  windowHours = VELOCITY_WINDOW_HOURS
): LearningVelocityResult {
  const histories = states.flatMap((state) => state.interaction_history);
  if (histories.length === 0) {
    return {
      student_id: studentId,
      window_hours: windowHours,
      mastery_delta: 0,
      elapsed_hours: 0,
      velocity_per_hour: 0,
      by_concept: [],
    };
  }

  const sorted = [...histories].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const latestTs = Date.parse(sorted[sorted.length - 1].timestamp);
  const cutoffTs = latestTs - windowHours * 3_600_000;
  const inWindow = sorted.filter((record) => Date.parse(record.timestamp) >= cutoffTs);

  const byConcept = states.map((state) => {
    const conceptHistory = inWindow
      .filter((record) => record.concept_tag === state.concept_tag)
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

    if (conceptHistory.length < 2) {
      return {
        concept_tag: state.concept_tag,
        mastery_delta: 0,
        elapsed_hours: 0,
        velocity_per_hour: 0,
      };
    }

    const first = conceptHistory[0];
    const last = conceptHistory[conceptHistory.length - 1];
    const elapsedHours = safeHours(first.timestamp, last.timestamp);
    const masteryDelta = last.p_mastery - first.p_mastery;

    return {
      concept_tag: state.concept_tag,
      mastery_delta: masteryDelta,
      elapsed_hours: elapsedHours,
      velocity_per_hour: elapsedHours > 0 ? masteryDelta / elapsedHours : 0,
    };
  });

  const conceptWithSignal = byConcept.filter((item) => item.elapsed_hours > 0);
  const masteryDelta = conceptWithSignal.reduce((sum, item) => sum + item.mastery_delta, 0);
  const elapsedHours = conceptWithSignal.reduce((sum, item) => sum + item.elapsed_hours, 0);

  return {
    student_id: studentId,
    window_hours: windowHours,
    mastery_delta: masteryDelta,
    elapsed_hours: elapsedHours,
    velocity_per_hour: elapsedHours > 0 ? masteryDelta / elapsedHours : 0,
    by_concept: byConcept.sort((a, b) => b.velocity_per_hour - a.velocity_per_hour),
  };
}
