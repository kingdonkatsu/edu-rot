import { describe, it, expect } from 'vitest';
import { computeForgettingProjection } from '../../src/services/forgetting-projection.js';
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

describe('computeForgettingProjection', () => {
  it('generates projections across default day buckets', () => {
    const result = computeForgettingProjection('student-1', [makeState('math', 0.8, 1)]);
    expect(result.days).toEqual([1, 3, 7, 14, 30]);
    expect(result.projections).toHaveLength(1);
    expect(result.projections[0].points).toHaveLength(5);
  });

  it('decays mastery over time', () => {
    const result = computeForgettingProjection('student-1', [makeState('math', 0.9, 1)]);
    const [d1, d3] = result.projections[0].points;
    expect(d3.projected_mastery).toBeLessThan(d1.projected_mastery);
  });
});
