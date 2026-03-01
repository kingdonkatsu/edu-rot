import { describe, it, expect } from 'vitest';
import { runWeeklyInsightsAgent } from '../../src/services/weekly-insights-agent.js';
import type { WeeklyInsightsRecap, WeeklyLearningState } from '../../src/types.js';

function makeInput(overrides: Partial<WeeklyLearningState> = {}): WeeklyLearningState {
  return {
    student_id: 'student-001',
    week_start: '2026-02-23T00:00:00Z',
    week_end: '2026-03-01T23:59:59Z',
    improved_topics: [
      { topic: 'Fractions', attempts: 12, accuracy_rate: 0.82, mastery_delta: 0.24 },
      { topic: 'Integers', attempts: 8, accuracy_rate: 0.75, mastery_delta: 0.14 },
    ],
    declined_topics: [
      { topic: 'Geometry', attempts: 9, accuracy_rate: 0.42, mastery_delta: -0.18 },
    ],
    untouched_topics: [
      { topic: 'Probability', estimated_decay: 0.21 },
      { topic: 'Ratios', estimated_decay: 0.17 },
    ],
    recurring_error_patterns: [
      { pattern: 'procedural_error', count: 6 },
      { pattern: 'misread_question', count: 4 },
    ],
    behavior_windows: [
      { label: 'after 9pm', accuracy_rate: 0.79, sessions: 4 },
      { label: 'before 9am', accuracy_rate: 0.56, sessions: 3 },
    ],
    avg_session_minutes: 18,
    sessions_count: 10,
    days_active: 5,
    previous_week_quest_completion_rate: 0.6,
    ...overrides,
  };
}

function makeRecap(): WeeklyInsightsRecap {
  return {
    main_character: {
      topic: 'Fractions',
      mastery_delta: 0.24,
      attempts: 12,
      narrative: 'Main Character arc: Fractions popped off.',
    },
    flop_era: {
      topic: 'Geometry',
      error_pattern: 'procedural_error',
      accuracy_rate: 0.42,
      narrative: 'Flop Era alert: Geometry struggled.',
    },
    ghost_topics: [
      { topic: 'Probability', estimated_decay: 0.21 },
    ],
    plot_twist: {
      insight: 'Plot Twist: night sessions are stronger.',
      metric_label: 'accuracy_diff_best_vs_worst_window',
      metric_value: 0.23,
    },
    weekly_quest: [
      { action: 'Run 2 focused practice blocks on Geometry this week.', rationale: 'Targets this week weakness.' },
      { action: 'Run 2 focused practice blocks on Probability this week.', rationale: 'Prevents decay this week.' },
    ],
  };
}

describe('runWeeklyInsightsAgent', () => {
  it('passes checker on first attempt with default deps', async () => {
    const result = await runWeeklyInsightsAgent(makeInput());
    expect(result.attempts).toBe(1);
    expect(result.checker_history).toHaveLength(1);
    expect(result.checker_history[0].passed).toBe(true);
    expect(result.recap.weekly_quest).toHaveLength(2);
  });

  it('retries with checker feedback when first recap fails', async () => {
    let makerCalls = 0;
    const seenFixInstructions: string[][] = [];

    const result = await runWeeklyInsightsAgent(makeInput(), {
      maker: async (_input, fixInstructions) => {
        makerCalls += 1;
        seenFixInstructions.push(fixInstructions);
        if (makerCalls === 1) {
          return makeRecap();
        }
        return {
          ...makeRecap(),
          weekly_quest: [{ action: 'Run 2 focused practice blocks on Geometry this week.', rationale: 'Targets weak topic this week.' }],
        };
      },
      checker: async (_input, recap) => {
        if (recap.weekly_quest.length !== 1) {
          return {
            passed: false,
            issues: [{ message: 'wrong quest count', fix_instruction: 'reduce to 1 item' }],
          };
        }
        return { passed: true, issues: [] };
      },
    });

    expect(result.attempts).toBe(2);
    expect(result.checker_history).toHaveLength(2);
    expect(seenFixInstructions[0]).toEqual([]);
    expect(seenFixInstructions[1]).toEqual(['reduce to 1 item']);
  });

  it('stops after max retries when checker keeps failing', async () => {
    const result = await runWeeklyInsightsAgent(makeInput(), {
      maker: async () => makeRecap(),
      checker: async () => ({
        passed: false,
        issues: [{ message: 'still wrong', fix_instruction: 'fix again' }],
      }),
    });

    expect(result.attempts).toBe(3);
    expect(result.checker_history).toHaveLength(3);
    expect(result.checker_history.every((entry) => !entry.passed)).toBe(true);
  });

  it('rounds plot twist metric to avoid floating precision noise', async () => {
    const result = await runWeeklyInsightsAgent(makeInput());
    expect(result.recap.plot_twist.metric_value).toBe(0.23);
  });
});
