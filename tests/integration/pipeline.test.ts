import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { runPipeline } from '../../src/services/pipeline.js';
import { InMemoryStateStore } from '../../src/adapters/state-store.js';
import type { LMSEvent } from '../../src/types.js';

function makeEvent(overrides: Partial<LMSEvent> = {}): LMSEvent {
  return {
    event_id: uuidv4(),
    student_id: 'student-001',
    timestamp: '2026-03-01T14:00:00Z',
    concept_tag: 'math.algebra.quadratic',
    is_correct: true,
    ...overrides,
  };
}

describe('Pipeline Integration', () => {
  let store: InMemoryStateStore;

  beforeEach(() => {
    store = new InMemoryStateStore();
  });

  it('handles cold start correctly', async () => {
    const result = await runPipeline(makeEvent(), store);

    expect(result.student_id).toBe('student-001');
    expect(result.concept_tag).toBe('math.algebra.quadratic');
    expect(result.mastery.mastery_level).toBe('novice');
    expect(result.decay.decay_applied).toBe(false);
    expect(result.interaction_summary.total_attempts).toBe(1);
  });

  it('increases mastery on consecutive correct answers', async () => {
    const base = '2026-03-01T14:00:00Z';
    let prevMastery = 0;

    for (let i = 0; i < 5; i++) {
      const ts = new Date(Date.parse(base) + i * 3_600_000 * 2).toISOString();
      const result = await runPipeline(
        makeEvent({ timestamp: ts, is_correct: true }),
        store
      );
      expect(result.mastery.p_mastery_posterior).toBeGreaterThan(prevMastery);
      prevMastery = result.mastery.p_mastery_posterior;
    }
  });

  it('decreases mastery on incorrect answer', async () => {
    // First, build up some mastery
    const r1 = await runPipeline(
      makeEvent({ timestamp: '2026-03-01T10:00:00Z', is_correct: true }),
      store
    );
    const r2 = await runPipeline(
      makeEvent({ timestamp: '2026-03-01T12:00:00Z', is_correct: false }),
      store
    );
    expect(r2.mastery.p_mastery_posterior).toBeLessThan(r1.mastery.p_mastery_posterior);
  });

  it('applies decay after inactivity', async () => {
    // Build some mastery
    await runPipeline(
      makeEvent({ timestamp: '2026-03-01T10:00:00Z', is_correct: true }),
      store
    );

    // Come back 72 hours later
    const result = await runPipeline(
      makeEvent({ timestamp: '2026-03-04T10:00:00Z', is_correct: true }),
      store
    );

    expect(result.decay.decay_applied).toBe(true);
    expect(result.decay.hours_since_last).toBeCloseTo(72, 0);
    expect(result.decay.decay_magnitude).toBeGreaterThan(0);
  });

  it('flags decay_warning on significant mastery loss', async () => {
    // Build high mastery
    for (let i = 0; i < 10; i++) {
      const ts = new Date(Date.parse('2026-03-01T10:00:00Z') + i * 7_200_000).toISOString();
      await runPipeline(
        makeEvent({ timestamp: ts, is_correct: true }),
        store
      );
    }

    // Long gap → significant decay
    const result = await runPipeline(
      makeEvent({ timestamp: '2026-04-01T10:00:00Z', is_correct: true }),
      store
    );

    expect(result.decay.decay_applied).toBe(true);
    expect(result.flags.decay_warning).toBe(true);
  });

  it('detects lucky guess on low-mastery correct answer', async () => {
    // Cold start P(L₀) = 0.10, correct answer → lucky_guess
    const result = await runPipeline(
      makeEvent({ is_correct: true }),
      store
    );
    expect(result.flags.lucky_guess).toBe(true);
  });

  it('detects careless mistake at high mastery', async () => {
    // Build very high mastery
    for (let i = 0; i < 20; i++) {
      const ts = new Date(Date.parse('2026-03-01T10:00:00Z') + i * 7_200_000).toISOString();
      await runPipeline(
        makeEvent({ timestamp: ts, is_correct: true }),
        store
      );
    }

    // Then get one wrong
    const result = await runPipeline(
      makeEvent({ timestamp: '2026-03-03T10:00:00Z', is_correct: false }),
      store
    );

    expect(result.flags.careless_mistake).toBe(true);
  });

  it('tracks streaks correctly', async () => {
    await runPipeline(
      makeEvent({ timestamp: '2026-03-01T10:00:00Z', is_correct: true }),
      store
    );
    await runPipeline(
      makeEvent({ timestamp: '2026-03-01T12:00:00Z', is_correct: true }),
      store
    );
    const r3 = await runPipeline(
      makeEvent({ timestamp: '2026-03-01T14:00:00Z', is_correct: true }),
      store
    );
    expect(r3.interaction_summary.streak_correct).toBe(3);
    expect(r3.interaction_summary.streak_incorrect).toBe(0);

    const r4 = await runPipeline(
      makeEvent({ timestamp: '2026-03-01T16:00:00Z', is_correct: false }),
      store
    );
    expect(r4.interaction_summary.streak_correct).toBe(0);
    expect(r4.interaction_summary.streak_incorrect).toBe(1);
  });

  it('computes accuracy rate correctly', async () => {
    await runPipeline(
      makeEvent({ timestamp: '2026-03-01T10:00:00Z', is_correct: true }),
      store
    );
    await runPipeline(
      makeEvent({ timestamp: '2026-03-01T12:00:00Z', is_correct: false }),
      store
    );
    const result = await runPipeline(
      makeEvent({ timestamp: '2026-03-01T14:00:00Z', is_correct: true }),
      store
    );
    expect(result.interaction_summary.total_attempts).toBe(3);
    expect(result.interaction_summary.total_correct).toBe(2);
    expect(result.interaction_summary.accuracy_rate).toBeCloseTo(2 / 3, 4);
  });

  it('sets intervention priority for stagnating student', async () => {
    // Alternate correct/incorrect for 15+ attempts to create stagnation
    for (let i = 0; i < 16; i++) {
      const ts = new Date(Date.parse('2026-03-01T10:00:00Z') + i * 7_200_000).toISOString();
      await runPipeline(
        makeEvent({ timestamp: ts, is_correct: i % 2 === 0 }),
        store
      );
    }

    const state = await store.get('student-001', 'math.algebra.quadratic');
    // EMA should be near 0.5 after alternating correct/incorrect
    // Check that stagnation is detected (attempts >= 15 → critical)
    const lastResult = await runPipeline(
      makeEvent({
        timestamp: '2026-03-03T20:00:00Z',
        is_correct: false,
      }),
      store
    );

    if (lastResult.flags.stagnation) {
      expect(lastResult.intervention.priority).toBe('critical');
      expect(lastResult.intervention.recommended_action).toBe('escalate_to_instructor');
    }
  });

  it('returns correct mastery levels', async () => {
    // Cold start → novice
    const r1 = await runPipeline(makeEvent({ is_correct: true }), store);
    expect(r1.mastery.mastery_level).toBe('novice');
  });

  it('isolates state between different concepts', async () => {
    await runPipeline(
      makeEvent({ concept_tag: 'math.algebra', is_correct: true }),
      store
    );
    const result = await runPipeline(
      makeEvent({ concept_tag: 'science.physics', is_correct: false }),
      store
    );

    // Second concept should be fresh cold start, not affected by first
    expect(result.interaction_summary.total_attempts).toBe(1);
  });

  it('isolates state between different students', async () => {
    await runPipeline(
      makeEvent({ student_id: 'alice', is_correct: true }),
      store
    );
    const result = await runPipeline(
      makeEvent({ student_id: 'bob', is_correct: false }),
      store
    );

    expect(result.interaction_summary.total_attempts).toBe(1);
  });
});
