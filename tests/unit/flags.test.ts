import { describe, it, expect } from 'vitest';
import { evaluateFlags } from '../../src/services/flags.js';
import type { BKTResult, DecayResult, StudentConceptState } from '../../src/types.js';

function makeState(overrides: Partial<StudentConceptState> = {}): StudentConceptState {
  return {
    student_id: 'student-001',
    concept_tag: 'math.algebra',
    p_mastery: 0.50,
    stability: 1.0,
    last_interaction_at: '2026-03-01T12:00:00Z',
    ema: 0.50,
    attempt_count: 3,
    correct_count: 2,
    streak_correct: 1,
    streak_incorrect: 0,
    recent_results: [true, false, true],
    rapid_fire_counter: 0,
    last_event_id: null,
    updated_at: '2026-03-01T12:00:00Z',
    ...overrides,
  };
}

function makeBKT(overrides: Partial<BKTResult> = {}): BKTResult {
  return {
    prior: 0.50,
    posterior: 0.60,
    updated_mastery: 0.60,
    careless_mistake: false,
    lucky_guess: false,
    ...overrides,
  };
}

function makeDecay(overrides: Partial<DecayResult> = {}): DecayResult {
  return {
    pre_decay_mastery: 0.50,
    post_decay_mastery: 0.50,
    delta_t_hours: 0,
    decay_applied: false,
    decay_drop: 0,
    ...overrides,
  };
}

describe('evaluateFlags', () => {
  it('returns all false for average student with steady progress', () => {
    const flags = evaluateFlags(makeBKT(), makeDecay(), 0.55, makeState());
    expect(flags.careless_mistake).toBe(false);
    expect(flags.lucky_guess).toBe(false);
    expect(flags.decay_warning).toBe(false);
    expect(flags.stagnation).toBe(false);
    expect(flags.rapid_improvement).toBe(false);
    expect(flags.mastery_achieved).toBe(false);
  });

  it('sets careless_mistake from BKT result', () => {
    const flags = evaluateFlags(
      makeBKT({ careless_mistake: true }),
      makeDecay(),
      0.55,
      makeState()
    );
    expect(flags.careless_mistake).toBe(true);
  });

  it('sets lucky_guess from BKT result', () => {
    const flags = evaluateFlags(
      makeBKT({ lucky_guess: true }),
      makeDecay(),
      0.55,
      makeState()
    );
    expect(flags.lucky_guess).toBe(true);
  });

  it('sets decay_warning when decay drop > 0.15', () => {
    const flags = evaluateFlags(
      makeBKT(),
      makeDecay({ decay_drop: 0.20 }),
      0.55,
      makeState()
    );
    expect(flags.decay_warning).toBe(true);
  });

  it('sets mastery_achieved when mastery >= 0.95 and attempts >= 5', () => {
    const flags = evaluateFlags(
      makeBKT({ updated_mastery: 0.96 }),
      makeDecay(),
      0.90,
      makeState({ attempt_count: 5 })
    );
    expect(flags.mastery_achieved).toBe(true);
  });

  it('does not set mastery_achieved with too few attempts', () => {
    const flags = evaluateFlags(
      makeBKT({ updated_mastery: 0.96 }),
      makeDecay(),
      0.90,
      makeState({ attempt_count: 3 })
    );
    expect(flags.mastery_achieved).toBe(false);
  });
});
