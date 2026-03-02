import { describe, it, expect } from 'vitest';
import { computeSpacedRepetitionSchedule } from '../../src/services/spaced-repetition.js';
import type { StudentConceptState } from '../../src/types.js';

function makeState(concept: string, mastery: number, stability: number): StudentConceptState {
  return {
    student_id: 'student-1',
    concept_tag: concept,
    p_mastery: mastery,
    stability,
    last_interaction_at: '2026-03-01T00:00:00Z',
    first_interaction_at: '2026-03-01T00:00:00Z',
    ema: 0.5,
    attempt_count: 1,
    correct_count: 1,
    streak_correct: 1,
    streak_incorrect: 0,
    recent_results: [true],
    interaction_history: [],
    rapid_fire_counter: 0,
    last_event_id: null,
    updated_at: '2026-03-01T00:00:00Z',
  };
}

describe('computeSpacedRepetitionSchedule', () => {
  it('recommends immediate review when mastery is below threshold', () => {
    const result = computeSpacedRepetitionSchedule('student-1', [makeState('math', 0.5, 1)], 0.7);
    expect(result.recommendations[0].hours_until_review).toBe(0);
  });

  it('returns sorted recommendations by urgency', () => {
    const result = computeSpacedRepetitionSchedule(
      'student-1',
      [makeState('a', 0.71, 1), makeState('b', 0.95, 1)],
      0.7
    );
    expect(result.recommendations[0].hours_until_review).toBeLessThanOrEqual(result.recommendations[1].hours_until_review);
  });
});
