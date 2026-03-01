import { describe, it, expect, vi } from 'vitest';
import { createFrontendAgentFlows } from '../../src/client/frontend-flows.js';
import type { CrashCourseAgentInput, WeeklyLearningState } from '../../src/types.js';

function makeStudentContext(): Omit<CrashCourseAgentInput, 'topic' | 'subtopic'> {
  return {
    student_id: 'student-001',
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

describe('frontend agent flows', () => {
  it('uses postCrashCourseAgent on topic card tap', async () => {
    const postCrashCourse = vi.fn(async () => ({
      cards: [],
      sora_video_prompt: {
        engine: 'sora.ai' as const,
        tone: '',
        audience: '',
        output_format: 'vertical_short' as const,
        video_objective: '',
        safety_constraints: [],
        scenes: [],
        final_call_to_action: '',
      },
      attempts: 1,
      checker_history: [],
    }));
    const flows = createFrontendAgentFlows({ postCrashCourse });

    await flows.onTopicCardTap(
      { topic: 'Algebra', subtopic: 'Linear equations' },
      makeStudentContext(),
      { baseUrl: 'http://localhost:3000' }
    );

    expect(postCrashCourse).toHaveBeenCalledTimes(1);
    expect(postCrashCourse).toHaveBeenCalledWith(
      {
        ...makeStudentContext(),
        topic: 'Algebra',
        subtopic: 'Linear equations',
      },
      { baseUrl: 'http://localhost:3000' }
    );
  });

  it('uses postWeeklyInsightsAgent for weekly recap fetch', async () => {
    const postWeeklyInsights = vi.fn(async () => ({
      recap: {
        main_character: { topic: 'Fractions', mastery_delta: 0.24, attempts: 12, narrative: '' },
        flop_era: { topic: 'Geometry', error_pattern: 'procedural_error', accuracy_rate: 0.42, narrative: '' },
        ghost_topics: [],
        plot_twist: { insight: '', metric_label: 'sessions_count', metric_value: 10 },
        weekly_quest: [],
      },
      attempts: 1,
      checker_history: [],
    }));
    const flows = createFrontendAgentFlows({ postWeeklyInsights });

    const weeklyInput = makeWeeklyInput();
    await flows.fetchWeeklyRecap(weeklyInput, { baseUrl: 'http://localhost:3000' });

    expect(postWeeklyInsights).toHaveBeenCalledTimes(1);
    expect(postWeeklyInsights).toHaveBeenCalledWith(weeklyInput, {
      baseUrl: 'http://localhost:3000',
    });
  });
});
