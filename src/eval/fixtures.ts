import type { CrashCourseAgentInput, WeeklyLearningState } from '../types.js';

export interface CrashCourseEvalCase {
  id: string;
  description: string;
  input: CrashCourseAgentInput;
}

export interface WeeklyInsightsEvalCase {
  id: string;
  description: string;
  input: WeeklyLearningState;
}

export const crashCourseEvalCases: CrashCourseEvalCase[] = [
  {
    id: 'cc-01',
    description: 'Procedural algebra error with clear misconception data',
    input: {
      student_id: 'student-001',
      topic: 'Algebra',
      subtopic: 'Linear equations',
      error_classification: 'procedural_error',
      mastery_level: 'developing',
      known_strengths: ['isolating variables', 'integer arithmetic'],
      rag: {
        concept_explanations: ['Maintain equality by applying the same operation to both sides.'],
        misconception_data: ['moving terms across equals without changing sign'],
        analogies: ['A two-sided balance scale'],
        worked_examples: ['2x + 3 = 11 -> 2x = 8 -> x = 4'],
      },
    },
  },
  {
    id: 'cc-02',
    description: 'Geometry conceptual gap with low mastery',
    input: {
      student_id: 'student-002',
      topic: 'Geometry',
      subtopic: 'Area of triangles',
      error_classification: 'conceptual_gap',
      mastery_level: 'novice',
      known_strengths: ['rectangle area'],
      rag: {
        concept_explanations: ['Triangle area is half of base times height.'],
        misconception_data: ['using side length instead of perpendicular height'],
        analogies: ['A rectangle cut diagonally into two equal triangles'],
        worked_examples: ['base 10, height 6 -> area = 1/2 * 10 * 6 = 30'],
      },
    },
  },
  {
    id: 'cc-03',
    description: 'Careless mistake in fractions for proficient learner',
    input: {
      student_id: 'student-003',
      topic: 'Fractions',
      subtopic: 'Common denominator addition',
      error_classification: 'careless_mistake',
      mastery_level: 'proficient',
      known_strengths: ['simplifying fractions'],
      rag: {
        concept_explanations: ['Add numerators only after converting to a shared denominator.'],
        misconception_data: ['adding denominators directly'],
        analogies: ['Adding apples in the same basket size'],
        worked_examples: ['1/4 + 1/2 -> 1/4 + 2/4 = 3/4'],
      },
    },
  },
  {
    id: 'cc-04',
    description: 'Misread question in physics word problems',
    input: {
      student_id: 'student-004',
      topic: 'Physics',
      subtopic: 'Speed distance time',
      error_classification: 'misread_question',
      mastery_level: 'developing',
      known_strengths: ['unit conversion basics'],
      rag: {
        concept_explanations: ['Use speed = distance / time and track units.'],
        misconception_data: ['solving for speed when prompt asks for time'],
        analogies: ['A GPS route where distance and speed determine arrival time'],
        worked_examples: ['distance 120 km, speed 60 km/h -> time 2 hours'],
      },
    },
  },
  {
    id: 'cc-05',
    description: 'Stagnation in ratio problems with sparse RAG',
    input: {
      student_id: 'student-005',
      topic: 'Ratios',
      subtopic: 'Part-to-part ratio simplification',
      error_classification: 'stagnation',
      mastery_level: 'developing',
      known_strengths: [],
      rag: {
        concept_explanations: ['Reduce all terms by the same common factor.'],
        misconception_data: ['reducing only one side of the ratio'],
        analogies: ['Compressing an image while keeping proportions'],
        worked_examples: ['12:18 -> divide by 6 -> 2:3'],
      },
    },
  },
];

export const weeklyInsightsEvalCases: WeeklyInsightsEvalCase[] = [
  {
    id: 'wi-01',
    description: 'Balanced week with improvement, decline, and untouched topics',
    input: {
      student_id: 'student-101',
      week_start: '2026-02-23T00:00:00Z',
      week_end: '2026-03-01T23:59:59Z',
      improved_topics: [
        { topic: 'Fractions', attempts: 15, accuracy_rate: 0.84, mastery_delta: 0.26 },
        { topic: 'Algebra', attempts: 10, accuracy_rate: 0.78, mastery_delta: 0.14 },
      ],
      declined_topics: [
        { topic: 'Geometry', attempts: 8, accuracy_rate: 0.44, mastery_delta: -0.19 },
      ],
      untouched_topics: [
        { topic: 'Probability', estimated_decay: 0.23 },
        { topic: 'Ratios', estimated_decay: 0.17 },
      ],
      recurring_error_patterns: [
        { pattern: 'procedural_error', count: 7 },
        { pattern: 'misread_question', count: 3 },
      ],
      behavior_windows: [
        { label: 'after 9pm', accuracy_rate: 0.81, sessions: 4 },
        { label: 'before 9am', accuracy_rate: 0.57, sessions: 3 },
      ],
      avg_session_minutes: 19,
      sessions_count: 11,
      days_active: 6,
      previous_week_quest_completion_rate: 0.6,
    },
  },
  {
    id: 'wi-02',
    description: 'Low completion week should generate easier quest',
    input: {
      student_id: 'student-102',
      week_start: '2026-02-23T00:00:00Z',
      week_end: '2026-03-01T23:59:59Z',
      improved_topics: [
        { topic: 'Decimals', attempts: 9, accuracy_rate: 0.74, mastery_delta: 0.12 },
      ],
      declined_topics: [
        { topic: 'Word Problems', attempts: 7, accuracy_rate: 0.38, mastery_delta: -0.22 },
      ],
      untouched_topics: [
        { topic: 'Percents', estimated_decay: 0.2 },
      ],
      recurring_error_patterns: [
        { pattern: 'misread_question', count: 8 },
      ],
      behavior_windows: [
        { label: 'afternoon', accuracy_rate: 0.63, sessions: 4 },
        { label: 'late night', accuracy_rate: 0.49, sessions: 2 },
      ],
      avg_session_minutes: 12,
      sessions_count: 7,
      days_active: 4,
      previous_week_quest_completion_rate: 0.3,
    },
  },
  {
    id: 'wi-03',
    description: 'High completion week should generate stretch quest',
    input: {
      student_id: 'student-103',
      week_start: '2026-02-23T00:00:00Z',
      week_end: '2026-03-01T23:59:59Z',
      improved_topics: [
        { topic: 'Equations', attempts: 18, accuracy_rate: 0.9, mastery_delta: 0.31 },
        { topic: 'Functions', attempts: 12, accuracy_rate: 0.82, mastery_delta: 0.17 },
      ],
      declined_topics: [
        { topic: 'Graph interpretation', attempts: 6, accuracy_rate: 0.46, mastery_delta: -0.12 },
      ],
      untouched_topics: [
        { topic: 'Statistics', estimated_decay: 0.14 },
      ],
      recurring_error_patterns: [
        { pattern: 'careless_mistake', count: 5 },
      ],
      behavior_windows: [
        { label: 'after school', accuracy_rate: 0.77, sessions: 5 },
        { label: 'early morning', accuracy_rate: 0.61, sessions: 2 },
      ],
      avg_session_minutes: 25,
      sessions_count: 13,
      days_active: 6,
      previous_week_quest_completion_rate: 0.85,
    },
  },
  {
    id: 'wi-04',
    description: 'No improved topics edge case',
    input: {
      student_id: 'student-104',
      week_start: '2026-02-23T00:00:00Z',
      week_end: '2026-03-01T23:59:59Z',
      improved_topics: [],
      declined_topics: [
        { topic: 'Geometry proofs', attempts: 5, accuracy_rate: 0.32, mastery_delta: -0.25 },
      ],
      untouched_topics: [
        { topic: 'Trigonometry', estimated_decay: 0.19 },
        { topic: 'Probability', estimated_decay: 0.22 },
      ],
      recurring_error_patterns: [
        { pattern: 'conceptual_gap', count: 6 },
      ],
      behavior_windows: [
        { label: 'weekend mornings', accuracy_rate: 0.51, sessions: 2 },
      ],
      avg_session_minutes: 16,
      sessions_count: 6,
      days_active: 3,
      previous_week_quest_completion_rate: 0.55,
    },
  },
  {
    id: 'wi-05',
    description: 'Multiple untouched topics and varied behavior windows',
    input: {
      student_id: 'student-105',
      week_start: '2026-02-23T00:00:00Z',
      week_end: '2026-03-01T23:59:59Z',
      improved_topics: [
        { topic: 'Ratios', attempts: 11, accuracy_rate: 0.8, mastery_delta: 0.2 },
      ],
      declined_topics: [
        { topic: 'Probability', attempts: 10, accuracy_rate: 0.41, mastery_delta: -0.2 },
      ],
      untouched_topics: [
        { topic: 'Geometry', estimated_decay: 0.16 },
        { topic: 'Fractions', estimated_decay: 0.12 },
        { topic: 'Algebra', estimated_decay: 0.15 },
      ],
      recurring_error_patterns: [
        { pattern: 'lucky_guess', count: 4 },
        { pattern: 'procedural_error', count: 4 },
      ],
      behavior_windows: [
        { label: 'after 9pm', accuracy_rate: 0.73, sessions: 3 },
        { label: 'lunch break', accuracy_rate: 0.68, sessions: 3 },
        { label: 'before school', accuracy_rate: 0.58, sessions: 2 },
      ],
      avg_session_minutes: 21,
      sessions_count: 9,
      days_active: 5,
      previous_week_quest_completion_rate: 0.72,
    },
  },
];
