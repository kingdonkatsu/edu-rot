import { describe, it, expect } from 'vitest';
import { computeLearningVelocity } from '../../src/services/learning-velocity.js';
import type { StudentConceptState } from '../../src/types.js';

function makeState(concept: string, history: StudentConceptState['interaction_history']): StudentConceptState {
  return {
    student_id: 'student-1',
    concept_tag: concept,
    p_mastery: history.at(-1)?.p_mastery ?? 0,
    stability: 1,
    last_interaction_at: history.at(-1)?.timestamp ?? null,
    first_interaction_at: history[0]?.timestamp ?? null,
    ema: history.at(-1)?.ema ?? 0,
    attempt_count: history.length,
    correct_count: history.filter((item) => item.is_correct).length,
    streak_correct: 0,
    streak_incorrect: 0,
    recent_results: history.map((item) => item.is_correct),
    interaction_history: history,
    rapid_fire_counter: 0,
    last_event_id: null,
    updated_at: history.at(-1)?.timestamp ?? '2026-03-01T00:00:00Z',
  };
}

describe('computeLearningVelocity', () => {
  it('returns zero metrics for empty history', () => {
    const result = computeLearningVelocity('student-1', []);
    expect(result.velocity_per_hour).toBe(0);
    expect(result.by_concept).toHaveLength(0);
  });

  it('computes per-concept and aggregate velocity', () => {
    const states = [
      makeState('math', [
        { timestamp: '2026-03-01T00:00:00Z', concept_tag: 'math', is_correct: true, p_mastery: 0.2, ema: 0.5, error_classification: 'none' },
        { timestamp: '2026-03-01T02:00:00Z', concept_tag: 'math', is_correct: true, p_mastery: 0.4, ema: 0.6, error_classification: 'none' },
      ]),
      makeState('science', [
        { timestamp: '2026-03-01T00:30:00Z', concept_tag: 'science', is_correct: false, p_mastery: 0.3, ema: 0.4, error_classification: 'careless_mistake' },
        { timestamp: '2026-03-01T03:30:00Z', concept_tag: 'science', is_correct: true, p_mastery: 0.45, ema: 0.55, error_classification: 'none' },
      ]),
    ];

    const result = computeLearningVelocity('student-1', states, 24);
    expect(result.by_concept).toHaveLength(2);
    expect(result.mastery_delta).toBeCloseTo(0.35, 5);
    expect(result.elapsed_hours).toBeCloseTo(5, 5);
    expect(result.velocity_per_hour).toBeCloseTo(0.07, 5);
  });
});
