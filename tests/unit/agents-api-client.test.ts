import { describe, it, expect, vi } from 'vitest';
import {
  AgentApiHttpError,
  postCrashCourseAgent,
  postWeeklyInsightsAgent,
} from '../../src/client/agents-api.js';
import type { CrashCourseAgentInput, WeeklyLearningState } from '../../src/types.js';

function makeCrashCourseInput(): CrashCourseAgentInput {
  return {
    student_id: 'student-001',
    topic: 'Algebra',
    subtopic: 'Linear equations',
    error_classification: 'procedural_error',
    mastery_level: 'developing',
    known_strengths: ['isolating variables'],
    rag: {
      concept_explanations: ['Balance both sides of an equation.'],
      misconception_data: ['sign change missed'],
      analogies: ['A balance scale'],
      worked_examples: ['2x + 3 = 11 -> x = 4'],
    },
  };
}

function makeWeeklyInput(): WeeklyLearningState {
  return {
    student_id: 'student-001',
    week_start: '2026-02-23T00:00:00Z',
    week_end: '2026-03-01T23:59:59Z',
    improved_topics: [
      { topic: 'Fractions', attempts: 12, accuracy_rate: 0.82, mastery_delta: 0.24 },
    ],
    declined_topics: [
      { topic: 'Geometry', attempts: 9, accuracy_rate: 0.42, mastery_delta: -0.18 },
    ],
    untouched_topics: [
      { topic: 'Probability', estimated_decay: 0.21 },
    ],
    recurring_error_patterns: [
      { pattern: 'procedural_error', count: 6 },
    ],
    behavior_windows: [
      { label: 'after 9pm', accuracy_rate: 0.79, sessions: 4 },
      { label: 'before 9am', accuracy_rate: 0.56, sessions: 3 },
    ],
    avg_session_minutes: 18,
    sessions_count: 10,
    days_active: 5,
    previous_week_quest_completion_rate: 0.6,
  };
}

describe('agent API client', () => {
  it('posts crash course payload and returns parsed response', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toBe('http://localhost:3000/api/v1/agents/crash-course');
      return new Response(JSON.stringify({ attempts: 1, cards: [], checker_history: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await postCrashCourseAgent(makeCrashCourseInput(), {
      baseUrl: 'http://localhost:3000',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.attempts).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws AgentApiHttpError on non-2xx responses', async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ error: 'Validation failed' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    ));

    await expect(postWeeklyInsightsAgent(makeWeeklyInput(), {
      baseUrl: 'http://localhost:3000',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).rejects.toBeInstanceOf(AgentApiHttpError);
  });
});
