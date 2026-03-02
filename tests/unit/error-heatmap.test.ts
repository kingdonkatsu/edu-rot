import { describe, it, expect } from 'vitest';
import { computeErrorHeatmap } from '../../src/services/error-heatmap.js';
import type { StudentConceptState } from '../../src/types.js';

function makeState(concept: string, history: StudentConceptState['interaction_history']): StudentConceptState {
  return {
    student_id: 'student-1',
    concept_tag: concept,
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

describe('computeErrorHeatmap', () => {
  it('counts errors by concept and classification', () => {
    const states = [
      makeState('math', [
        { timestamp: '2026-03-01T00:00:00Z', concept_tag: 'math', is_correct: false, p_mastery: 0.2, ema: 0.4, error_classification: 'careless_mistake' },
        { timestamp: '2026-03-01T01:00:00Z', concept_tag: 'math', is_correct: true, p_mastery: 0.3, ema: 0.5, error_classification: 'none' },
      ]),
      makeState('science', [
        { timestamp: '2026-03-01T02:00:00Z', concept_tag: 'science', is_correct: false, p_mastery: 0.25, ema: 0.45, error_classification: 'lucky_guess' },
        { timestamp: '2026-03-01T03:00:00Z', concept_tag: 'science', is_correct: false, p_mastery: 0.2, ema: 0.4, error_classification: 'lucky_guess' },
      ]),
    ];

    const result = computeErrorHeatmap('student-1', states);
    expect(result.cells.find((cell) => cell.concept_tag === 'science' && cell.error_classification === 'lucky_guess')?.count).toBe(2);
    expect(result.cells.find((cell) => cell.concept_tag === 'math' && cell.error_classification === 'careless_mistake')?.count).toBe(1);
  });

  it('ignores records marked as none', () => {
    const states = [
      makeState('math', [
        { timestamp: '2026-03-01T00:00:00Z', concept_tag: 'math', is_correct: true, p_mastery: 0.3, ema: 0.5, error_classification: 'none' },
      ]),
    ];

    const result = computeErrorHeatmap('student-1', states);
    expect(result.cells).toHaveLength(0);
  });
});
