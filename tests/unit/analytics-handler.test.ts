import { describe, it, expect } from 'vitest';
import { createAnalyticsHandlers } from '../../src/handlers/analytics.js';
import type { IStateStore } from '../../src/adapters/state-store.js';
import type { StudentConceptState } from '../../src/types.js';

function makeState(concept: string, history: StudentConceptState['interaction_history']): StudentConceptState {
  return {
    student_id: 'student-1',
    concept_tag: concept,
    p_mastery: history.at(-1)?.p_mastery ?? 0.4,
    stability: 1,
    last_interaction_at: history.at(-1)?.timestamp ?? null,
    first_interaction_at: history[0]?.timestamp ?? null,
    ema: history.at(-1)?.ema ?? 0.5,
    attempt_count: history.length,
    correct_count: history.filter((h) => h.is_correct).length,
    streak_correct: 0,
    streak_incorrect: 0,
    recent_results: history.map((h) => h.is_correct),
    interaction_history: history,
    rapid_fire_counter: 0,
    last_event_id: null,
    updated_at: history.at(-1)?.timestamp ?? '2026-03-01T00:00:00Z',
  };
}

function mockResponse() {
  let statusCode = 200;
  let payload: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: unknown) {
      payload = data;
      return this;
    },
  };

  return {
    res,
    get statusCode() {
      return statusCode;
    },
    get payload() {
      return payload;
    },
  };
}

describe('analytics handlers', () => {
  it('returns dashboard payload', async () => {
    const store: IStateStore = {
      async get() { return null; },
      async upsert() {},
      async getAllForStudent() {
        return [
          makeState('math', [
            { timestamp: '2026-03-01T00:00:00Z', concept_tag: 'math', is_correct: true, p_mastery: 0.2, ema: 0.4, error_classification: 'none' },
            { timestamp: '2026-03-01T01:00:00Z', concept_tag: 'math', is_correct: false, p_mastery: 0.18, ema: 0.35, error_classification: 'careless_mistake' },
          ]),
        ];
      },
    };

    const handlers = createAnalyticsHandlers(store);
    const response = mockResponse();
    await handlers.getDashboard({ params: { studentId: 'student-1' } } as never, response.res as never);

    expect(response.statusCode).toBe(200);
    expect((response.payload as Record<string, unknown>).student_id).toBe('student-1');
    expect((response.payload as Record<string, unknown>).learning_velocity).toBeDefined();
    expect((response.payload as Record<string, unknown>).error_heatmap).toBeDefined();
  });

  it('returns empty structures for student with no state', async () => {
    const store: IStateStore = {
      async get() { return null; },
      async upsert() {},
      async getAllForStudent() { return []; },
    };

    const handlers = createAnalyticsHandlers(store);
    const response = mockResponse();
    await handlers.getDashboard({ params: { studentId: 'missing' } } as never, response.res as never);

    expect(response.statusCode).toBe(200);
    const payload = response.payload as Record<string, unknown>;
    expect(payload.student_id).toBe('missing');
    expect((payload.mastery_timeline as unknown[]).length).toBe(0);
  });

  it('returns correct summary_kpis for known fixture', async () => {
    const store: IStateStore = {
      async get() { return null; },
      async upsert() {},
      async getAllForStudent() {
        return [
          makeState('math', [
            { timestamp: '2026-03-01T00:00:00Z', concept_tag: 'math', is_correct: true, p_mastery: 0.2, ema: 0.4, error_classification: 'none' },
            { timestamp: '2026-03-01T01:00:00Z', concept_tag: 'math', is_correct: true, p_mastery: 0.3, ema: 0.45, error_classification: 'none' },
            { timestamp: '2026-03-01T02:00:00Z', concept_tag: 'math', is_correct: false, p_mastery: 0.28, ema: 0.4, error_classification: 'careless_mistake' },
          ]),
          {
            ...makeState('science', [
              { timestamp: '2026-03-01T03:00:00Z', concept_tag: 'science', is_correct: true, p_mastery: 0.85, ema: 0.8, error_classification: 'none' },
            ]),
            p_mastery: 0.85,
          },
        ];
      },
    };

    const handlers = createAnalyticsHandlers(store);
    const response = mockResponse();
    await handlers.getDashboard({ params: { studentId: 'student-1' } } as never, response.res as never);

    expect(response.statusCode).toBe(200);
    const kpis = (response.payload as Record<string, unknown>).summary_kpis as Record<string, unknown>;
    expect(kpis).toBeDefined();
    expect(kpis.total_attempts).toBe(4);
    expect(kpis.overall_accuracy).toBeCloseTo(3 / 4);
    expect(kpis.concepts_attempted).toBe(2);
    expect(kpis.concepts_mastered).toBe(1);
    expect(kpis.best_streak).toBe(2);
    expect(typeof kpis.current_streak).toBe('number');
  });

  it('returns zero-filled summary_kpis for student with no state', async () => {
    const store: IStateStore = {
      async get() { return null; },
      async upsert() {},
      async getAllForStudent() { return []; },
    };

    const handlers = createAnalyticsHandlers(store);
    const response = mockResponse();
    await handlers.getDashboard({ params: { studentId: 'empty' } } as never, response.res as never);

    expect(response.statusCode).toBe(200);
    const kpis = (response.payload as Record<string, unknown>).summary_kpis as Record<string, unknown>;
    expect(kpis.total_attempts).toBe(0);
    expect(kpis.overall_accuracy).toBe(0);
    expect(kpis.current_streak).toBe(0);
    expect(kpis.best_streak).toBe(0);
    expect(kpis.concepts_attempted).toBe(0);
    expect(kpis.concepts_mastered).toBe(0);
  });
});
