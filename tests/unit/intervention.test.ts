import { describe, it, expect } from 'vitest';
import { computeIntervention } from '../../src/services/intervention.js';
import type { AnalyticsFlags, StudentConceptState } from '../../src/types.js';

function makeFlags(overrides: Partial<AnalyticsFlags> = {}): AnalyticsFlags {
  return {
    careless_mistake: false,
    lucky_guess: false,
    decay_warning: false,
    stagnation: false,
    rapid_improvement: false,
    mastery_achieved: false,
    ...overrides,
  };
}

function makeState(overrides: Partial<StudentConceptState> = {}): StudentConceptState {
  return {
    student_id: 'student-001',
    concept_tag: 'math.algebra',
    p_mastery: 0.50,
    stability: 1.0,
    last_interaction_at: '2026-03-01T12:00:00Z',
    first_interaction_at: '2026-03-01T10:00:00Z',
    ema: 0.50,
    attempt_count: 10,
    correct_count: 5,
    streak_correct: 0,
    streak_incorrect: 0,
    recent_results: [],
    interaction_history: [],
    rapid_fire_counter: 0,
    last_event_id: null,
    updated_at: '2026-03-01T12:00:00Z',
    ...overrides,
  };
}

describe('computeIntervention', () => {
  it('returns none priority when no flags active', () => {
    const result = computeIntervention(makeFlags(), makeState(), 'developing', 0.55);
    expect(result.priority).toBe('none');
    expect(result.recommended_action).toBe('continue_learning_path');
  });

  it('returns none priority with advance action for mastery', () => {
    const result = computeIntervention(
      makeFlags({ mastery_achieved: true }),
      makeState(),
      'mastered',
      0.95
    );
    expect(result.priority).toBe('none');
    expect(result.recommended_action).toBe('advance_to_next_concept');
  });

  it('returns critical for stagnation with >= 15 attempts', () => {
    const result = computeIntervention(
      makeFlags({ stagnation: true }),
      makeState({ attempt_count: 15 }),
      'developing',
      0.50
    );
    expect(result.priority).toBe('critical');
    expect(result.recommended_action).toBe('escalate_to_instructor');
  });

  it('returns high for decay_warning with low mastery', () => {
    const result = computeIntervention(
      makeFlags({ decay_warning: true }),
      makeState({ p_mastery: 0.30 }),
      'novice',
      0.40
    );
    expect(result.priority).toBe('high');
    expect(result.recommended_action).toBe('trigger_spaced_review');
  });

  it('returns medium for lucky_guess', () => {
    const result = computeIntervention(
      makeFlags({ lucky_guess: true }),
      makeState(),
      'novice',
      0.40
    );
    expect(result.priority).toBe('medium');
    expect(result.recommended_action).toBe('assign_reinforcement');
  });

  it('returns medium for stagnation (< 15 attempts)', () => {
    const result = computeIntervention(
      makeFlags({ stagnation: true }),
      makeState({ attempt_count: 12 }),
      'developing',
      0.50
    );
    expect(result.priority).toBe('medium');
  });

  it('returns low for careless_mistake', () => {
    const result = computeIntervention(
      makeFlags({ careless_mistake: true }),
      makeState(),
      'proficient',
      0.80
    );
    expect(result.priority).toBe('low');
    expect(result.recommended_action).toBe('prompt_attention_check');
  });

  it('includes context with concept info', () => {
    const result = computeIntervention(
      makeFlags({ lucky_guess: true }),
      makeState({ concept_tag: 'science.physics.gravity' }),
      'novice',
      0.35
    );
    expect(result.context.concept_tag).toBe('science.physics.gravity');
    expect(result.context.mastery_level).toBe('novice');
  });
});
