import { describe, it, expect } from 'vitest';
import { computeEngagementScore } from '../../src/services/engagement.js';
import type { StudentConceptState } from '../../src/types.js';

function makeState(history: StudentConceptState['interaction_history']): StudentConceptState {
  return {
    student_id: 'student-1',
    concept_tag: 'math',
    p_mastery: 0.5,
    stability: 1,
    last_interaction_at: history.at(-1)?.timestamp ?? null,
    first_interaction_at: history[0]?.timestamp ?? null,
    ema: 0.5,
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

describe('computeEngagementScore', () => {
  it('returns zeros for empty state', () => {
    const result = computeEngagementScore('student-1', []);
    expect(result.score).toBe(0);
    expect(result.components.frequency).toBe(0);
  });

  it('computes weighted engagement score', () => {
    const state = makeState([
      { timestamp: '2026-03-01T08:00:00Z', concept_tag: 'math', is_correct: true, p_mastery: 0.3, ema: 0.45, error_classification: 'none' },
      { timestamp: '2026-03-01T08:10:00Z', concept_tag: 'math', is_correct: true, p_mastery: 0.35, ema: 0.5, error_classification: 'none' },
      { timestamp: '2026-03-02T09:00:00Z', concept_tag: 'math', is_correct: false, p_mastery: 0.33, ema: 0.48, error_classification: 'careless_mistake' },
      { timestamp: '2026-03-03T09:15:00Z', concept_tag: 'math', is_correct: true, p_mastery: 0.4, ema: 0.55, error_classification: 'none' },
    ]);

    const result = computeEngagementScore('student-1', [state]);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.components.streak).toBeGreaterThan(0);
  });
});
