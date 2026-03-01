import { describe, it, expect } from 'vitest';
import {
  validateCrashCourseAgentInput,
  validateWeeklyLearningState,
} from '../../src/utils/validation.js';

function validCrashCoursePayload(overrides: Record<string, unknown> = {}) {
  return {
    student_id: 'student-001',
    topic: 'Algebra',
    subtopic: 'Linear equations',
    error_classification: 'procedural_error',
    mastery_level: 'developing',
    known_strengths: ['isolating variables'],
    rag: {
      concept_explanations: ['Balance both sides.'],
      misconception_data: ['sign flip missed'],
      analogies: ['see-saw balance'],
      worked_examples: ['2x + 3 = 11 -> x = 4'],
    },
    ...overrides,
  };
}

function validWeeklyPayload(overrides: Record<string, unknown> = {}) {
  return {
    student_id: 'student-001',
    week_start: '2026-02-23T00:00:00Z',
    week_end: '2026-03-01T23:59:59Z',
    improved_topics: [
      { topic: 'Fractions', attempts: 10, accuracy_rate: 0.8, mastery_delta: 0.2 },
    ],
    declined_topics: [
      { topic: 'Geometry', attempts: 8, accuracy_rate: 0.45, mastery_delta: -0.15 },
    ],
    untouched_topics: [
      { topic: 'Probability', estimated_decay: 0.25 },
    ],
    recurring_error_patterns: [
      { pattern: 'procedural_error', count: 5 },
    ],
    behavior_windows: [
      { label: 'after 9pm', accuracy_rate: 0.78, sessions: 4 },
    ],
    avg_session_minutes: 20,
    sessions_count: 9,
    days_active: 4,
    previous_week_quest_completion_rate: 0.7,
    ...overrides,
  };
}

describe('agent payload validation', () => {
  it('accepts valid crash course input', () => {
    const result = validateCrashCourseAgentInput(validCrashCoursePayload());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects crash course input with invalid error classification', () => {
    const result = validateCrashCourseAgentInput(
      validCrashCoursePayload({ error_classification: 'wrong_type' })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.field === 'error_classification')).toBe(true);
  });

  it('accepts valid weekly insights input', () => {
    const result = validateWeeklyLearningState(validWeeklyPayload());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects weekly insights input with out-of-range rate', () => {
    const result = validateWeeklyLearningState(
      validWeeklyPayload({ previous_week_quest_completion_rate: 1.2 })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.field === 'previous_week_quest_completion_rate')).toBe(true);
  });
});
