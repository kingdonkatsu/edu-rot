import { describe, it, expect } from 'vitest';
import {
  runWeeklyInsightsAgent,
  defaultWeeklyInsightsMaker,
  defaultWeeklyInsightsChecker,
} from '../../src/services/weekly-insights-agent.js';
import type { WeeklyLearningState, WeeklyInsightsAgentOutput } from '../../src/types.js';

const baseInput: WeeklyLearningState = {
  student_id: 'test-student',
  week_start: '2026-02-23T00:00:00Z',
  week_end: '2026-03-01T00:00:00Z',
  improved_topics: [
    { topic: 'Algebra', attempts: 12, accuracy_rate: 0.83, mastery_delta: 0.15 },
  ],
  declined_topics: [
    { topic: 'Statistics', attempts: 4, accuracy_rate: 0.25, mastery_delta: -0.12 },
  ],
  untouched_topics: [
    { topic: 'Trigonometry', estimated_decay: 0.07 },
  ],
  recurring_error_patterns: [
    { pattern: 'formula_recall_failure', count: 5 },
  ],
  behavior_windows: [
    { label: 'after 9pm', accuracy_rate: 0.71, sessions: 4 },
  ],
  avg_session_minutes: 22,
  sessions_count: 8,
  days_active: 5,
  previous_week_quest_completion_rate: 0.8,
};

describe('defaultWeeklyInsightsMaker', () => {
  it('produces all 5 sections', () => {
    const output = defaultWeeklyInsightsMaker(baseInput, []);
    expect(output.recap.main_character).toBeDefined();
    expect(output.recap.flop_era).toBeDefined();
    expect(output.recap.ghost_topics).toBeDefined();
    expect(output.recap.plot_twist).toBeDefined();
    expect(output.recap.weekly_quest).toBeDefined();
  });

  it('produces summary_kpis with correct shape and values', () => {
    const output = defaultWeeklyInsightsMaker(baseInput, []);
    expect(output.summary_kpis).toBeDefined();
    expect(output.summary_kpis.top_topic).toBe('Algebra');
    expect(output.summary_kpis.top_gain).toBe(0.15);
    expect(output.summary_kpis.days_active).toBe(5);
    expect(output.summary_kpis.sessions_count).toBe(8);
    expect(output.summary_kpis.quest_count).toBeGreaterThanOrEqual(1);
    expect(typeof output.summary_kpis.accuracy_this_week).toBe('number');
  });

  it('main_character matches top improved topic', () => {
    const output = defaultWeeklyInsightsMaker(baseInput, []);
    expect(output.recap.main_character.topic).toBe('Algebra');
    expect(output.recap.main_character.mastery_delta).toBe(0.15);
    expect(output.recap.main_character.attempts).toBe(12);
  });

  it('flop_era matches worst declined topic', () => {
    const output = defaultWeeklyInsightsMaker(baseInput, []);
    expect(output.recap.flop_era.topic).toBe('Statistics');
    expect(output.recap.flop_era.accuracy_rate).toBe(0.25);
  });

  it('flop_era error_pattern comes from recurring_error_patterns', () => {
    const output = defaultWeeklyInsightsMaker(baseInput, []);
    const validPatterns = baseInput.recurring_error_patterns.map(p => p.pattern);
    expect(validPatterns).toContain(output.recap.flop_era.error_pattern);
  });

  it('ghost_topics match input untouched_topics', () => {
    const output = defaultWeeklyInsightsMaker(baseInput, []);
    for (const gt of output.recap.ghost_topics) {
      const match = baseInput.untouched_topics.find(t => t.topic === gt.topic);
      expect(match).toBeDefined();
      expect(gt.estimated_decay).toBe(match!.estimated_decay);
    }
  });

  it('quest count is 3 when completion_rate ≥ 0.75', () => {
    const output = defaultWeeklyInsightsMaker(baseInput, []);
    expect(output.recap.weekly_quest).toHaveLength(3);
  });

  it('quest count is 1 when completion_rate < 0.4', () => {
    const lowInput = { ...baseInput, previous_week_quest_completion_rate: 0.2 };
    const output = defaultWeeklyInsightsMaker(lowInput, []);
    expect(output.recap.weekly_quest).toHaveLength(1);
  });

  it('quest count is 2 when completion_rate is between 0.4 and 0.75', () => {
    const midInput = { ...baseInput, previous_week_quest_completion_rate: 0.6 };
    const output = defaultWeeklyInsightsMaker(midInput, []);
    expect(output.recap.weekly_quest).toHaveLength(2);
  });

  it('injects 15-min sprint as first item when avg_session < 15', () => {
    const shortInput = { ...baseInput, avg_session_minutes: 10 };
    const output = defaultWeeklyInsightsMaker(shortInput, []);
    expect(output.recap.weekly_quest).toHaveLength(2);
    expect(output.recap.weekly_quest[0].action).toMatch(/15.?min/i);
  });

  it('quest actions contain a number and time-bound language', () => {
    const output = defaultWeeklyInsightsMaker(baseInput, []);
    const timeBound = /\b(week|day|days|daily|weekly|minutes?|hours?|this week|per day)\b/i;
    for (const q of output.recap.weekly_quest) {
      expect(/\d+/.test(q.action)).toBe(true);
      expect(timeBound.test(q.action)).toBe(true);
    }
  });
});

describe('defaultWeeklyInsightsChecker', () => {
  it('passes a well-formed output', () => {
    const output = defaultWeeklyInsightsMaker(baseInput, []);
    const result = defaultWeeklyInsightsChecker(output, baseInput, 1);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('fails if main_character topic is wrong', () => {
    const output = defaultWeeklyInsightsMaker(baseInput, []);
    const badOutput = {
      ...output,
      recap: {
        ...output.recap,
        main_character: { ...output.recap.main_character, topic: 'Wrong Topic' },
      },
    };
    const result = defaultWeeklyInsightsChecker(badOutput, baseInput, 1);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.gate === 'main-character-stat-fidelity')).toBe(true);
  });

  it('fails if flop_era topic is wrong', () => {
    const output = defaultWeeklyInsightsMaker(baseInput, []);
    const badOutput = {
      ...output,
      recap: {
        ...output.recap,
        flop_era: { ...output.recap.flop_era, topic: 'Algebra' },
      },
    };
    const result = defaultWeeklyInsightsChecker(badOutput, baseInput, 1);
    expect(result.passed).toBe(false);
  });

  it('fails if main_character.topic equals flop_era.topic (section contradiction)', () => {
    const output = defaultWeeklyInsightsMaker(baseInput, []);
    const badOutput = {
      ...output,
      recap: {
        ...output.recap,
        flop_era: { ...output.recap.flop_era, topic: output.recap.main_character.topic },
      },
    };
    const result = defaultWeeklyInsightsChecker(badOutput, baseInput, 1);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.gate === 'no-section-contradiction')).toBe(true);
  });

  it('fails if quest count is wrong', () => {
    const output = defaultWeeklyInsightsMaker(baseInput, []);
    const badOutput = {
      ...output,
      recap: { ...output.recap, weekly_quest: [output.recap.weekly_quest[0]] }, // 1 instead of 3
    };
    const result = defaultWeeklyInsightsChecker(badOutput, baseInput, 1);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.gate === 'quest-count-and-calibration')).toBe(true);
  });

  it('fails if quest action lacks a number', () => {
    const output = defaultWeeklyInsightsMaker(baseInput, []);
    const badQuests = output.recap.weekly_quest.map(q => ({ ...q, action: 'Practice this week no cap' }));
    const badOutput = { ...output, recap: { ...output.recap, weekly_quest: badQuests } };
    const result = defaultWeeklyInsightsChecker(badOutput, baseInput, 1);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.gate === 'quest-actionability')).toBe(true);
  });

  it('fails if flop_era.error_pattern is not in recurring_error_patterns', () => {
    const output = defaultWeeklyInsightsMaker(baseInput, []);
    const badOutput = {
      ...output,
      recap: {
        ...output.recap,
        flop_era: { ...output.recap.flop_era, error_pattern: 'invented_pattern' },
      },
    };
    const result = defaultWeeklyInsightsChecker(badOutput, baseInput, 1);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.gate === 'flop-era-stat-fidelity')).toBe(true);
  });

  it('fails if discouraging language is present', () => {
    const output = defaultWeeklyInsightsMaker(baseInput, []);
    const badOutput = {
      ...output,
      recap: {
        ...output.recap,
        main_character: { ...output.recap.main_character, narrative: 'You are so lazy for skipping practice.' },
      },
    };
    const result = defaultWeeklyInsightsChecker(badOutput, baseInput, 1);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.gate === 'no-discouraging-tone')).toBe(true);
  });
});

describe('runWeeklyInsightsAgent control loop', () => {
  it('completes and returns all 5 sections', async () => {
    const output = await runWeeklyInsightsAgent(baseInput);
    expect(output.recap.main_character).toBeDefined();
    expect(output.recap.flop_era).toBeDefined();
    expect(output.recap.ghost_topics).toBeDefined();
    expect(output.recap.plot_twist).toBeDefined();
    expect(output.recap.weekly_quest).toBeDefined();
    expect(output.attempts).toBeGreaterThanOrEqual(1);
    expect(output.attempts).toBeLessThanOrEqual(3);
  });

  it('fails-open after 3 failed attempts', async () => {
    const alwaysFailChecker = (out: WeeklyInsightsAgentOutput, _in: WeeklyLearningState, attempt: number) => ({
      passed: false,
      issues: [{ gate: 'forced', message: 'fail' }],
      attempt,
    });

    const output = await runWeeklyInsightsAgent(baseInput, { checker: alwaysFailChecker });
    expect(output).toBeDefined();
    expect(output.attempts).toBe(3);
    expect(output.checker_history).toHaveLength(3);
  });

  it('accumulates issues across retries', async () => {
    let callCount = 0;
    const capturedPriorIssues: string[] = [];

    const trackingMaker = (input: WeeklyLearningState, priorIssues: { gate: string }[]) => {
      capturedPriorIssues.push(...priorIssues.map(i => i.gate));
      return defaultWeeklyInsightsMaker(input, priorIssues);
    };

    const trackingChecker = (out: WeeklyInsightsAgentOutput, input: WeeklyLearningState, attempt: number) => {
      callCount++;
      if (callCount === 1) {
        return { passed: false, issues: [{ gate: 'gate-1', message: 'first issue' }], attempt };
      }
      return defaultWeeklyInsightsChecker(out, input, attempt);
    };

    await runWeeklyInsightsAgent(baseInput, { maker: trackingMaker, checker: trackingChecker });
    expect(capturedPriorIssues).toContain('gate-1');
  });

  it('stops at attempt 2 when checker passes on retry', async () => {
    let callCount = 0;
    const passOnSecond = (out: WeeklyInsightsAgentOutput, _in: WeeklyLearningState, attempt: number) => {
      callCount++;
      return { passed: callCount >= 2, issues: [], attempt };
    };

    const output = await runWeeklyInsightsAgent(baseInput, { checker: passOnSecond });
    expect(output.attempts).toBe(2);
  });
});
