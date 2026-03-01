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

export const crashCourseEvalCasesLarge: CrashCourseEvalCase[] = [
  {
    id: 'cc-large-01',
    description: 'Quadratic factorization with multi-source RAG and procedural confusion',
    input: {
      student_id: 'student-201',
      topic: 'Algebra',
      subtopic: 'Factoring quadratics',
      error_classification: 'procedural_error',
      mastery_level: 'developing',
      known_strengths: ['integer multiplication', 'pattern spotting', 'sign handling in simple equations'],
      rag: {
        concept_explanations: [
          'To factor ax^2 + bx + c, find factors of ac that sum to b, then group terms.',
          'Keep equivalent transformations at each rewrite step.',
          'Always verify factors by expansion.',
        ],
        misconception_data: [
          'choosing factor pairs for c instead of ac when a is not 1',
          'dropping the middle term sign during grouping',
        ],
        analogies: [
          'A lock with two keys: both factors must fit the same equation.',
          'Splitting a bill into two parts that still total the same amount.',
        ],
        worked_examples: [
          '2x^2 + 7x + 3 = 0 -> 2x^2 + 6x + x + 3 = 0 -> 2x(x + 3) + 1(x + 3) = 0 -> (2x + 1)(x + 3) = 0',
          'x^2 + 5x + 6 = 0 -> (x + 2)(x + 3) = 0',
        ],
      },
    },
  },
  {
    id: 'cc-large-02',
    description: 'Trigonometry identity errors with dense misconception metadata',
    input: {
      student_id: 'student-202',
      topic: 'Trigonometry',
      subtopic: 'Pythagorean identities',
      error_classification: 'conceptual_gap',
      mastery_level: 'novice',
      known_strengths: ['basic sine and cosine values'],
      rag: {
        concept_explanations: [
          'sin^2(theta) + cos^2(theta) = 1 is the base identity.',
          'Rearrange identities by isolating the required term without changing equivalence.',
          'Reciprocal identities connect tan, sec, and cot through sin/cos.',
        ],
        misconception_data: [
          'treating sin^2(theta) as sin(theta^2)',
          'subtracting terms from only one side when rearranging identities',
          'mixing reciprocal and Pythagorean identities in one step incorrectly',
        ],
        analogies: [
          'A triangle budget: every side contribution must still sum to the same total.',
          'Recipe substitutions where proportions must remain consistent.',
        ],
        worked_examples: [
          'sin^2(theta) + cos^2(theta) = 1 -> sin^2(theta) = 1 - cos^2(theta)',
          '1 + tan^2(theta) = sec^2(theta)',
        ],
      },
    },
  },
  {
    id: 'cc-large-03',
    description: 'Chemistry stoichiometry misread and unit mismatch',
    input: {
      student_id: 'student-203',
      topic: 'Chemistry',
      subtopic: 'Mole ratio stoichiometry',
      error_classification: 'misread_question',
      mastery_level: 'developing',
      known_strengths: ['balancing simple equations', 'molar mass lookup'],
      rag: {
        concept_explanations: [
          'Use balanced equation coefficients as mole conversion ratios.',
          'Track units through each conversion step to avoid target mismatch.',
          'Convert grams to moles before applying stoichiometric ratios.',
        ],
        misconception_data: [
          'using mass ratios directly from coefficients',
          'solving for product when prompt asks for reactant consumed',
        ],
        analogies: [
          'Recipe scaling: ingredient ratios come from the recipe, not package weight.',
          'Currency conversion chain where each step changes units.',
        ],
        worked_examples: [
          '2H2 + O2 -> 2H2O: 4 mol H2 gives 4 mol H2O',
          '10 g H2 -> moles H2 -> moles H2O -> grams H2O',
        ],
      },
    },
  },
  {
    id: 'cc-large-04',
    description: 'Statistics probability tree with careless mistakes under time pressure',
    input: {
      student_id: 'student-204',
      topic: 'Statistics',
      subtopic: 'Conditional probability trees',
      error_classification: 'careless_mistake',
      mastery_level: 'proficient',
      known_strengths: ['basic probability rules', 'fraction simplification'],
      rag: {
        concept_explanations: [
          'For sequential events, multiply along branches and add across mutually exclusive paths.',
          'Conditioning changes the sample space denominator.',
        ],
        misconception_data: [
          'adding branch probabilities before conditioning',
          'forgetting to renormalize after a condition is applied',
        ],
        analogies: [
          'GPS routing where each turn narrows available roads.',
          'Tournament brackets where only surviving paths remain.',
        ],
        worked_examples: [
          'P(A and B) = P(A) * P(B|A)',
          'P(A|B) = P(A and B) / P(B)',
        ],
      },
    },
  },
  {
    id: 'cc-large-05',
    description: 'Economics elasticity stagnation with sparse strengths',
    input: {
      student_id: 'student-205',
      topic: 'Economics',
      subtopic: 'Price elasticity of demand',
      error_classification: 'stagnation',
      mastery_level: 'developing',
      known_strengths: ['interpreting percentage change'],
      rag: {
        concept_explanations: [
          'Elasticity is percentage change in quantity demanded over percentage change in price.',
          'Use midpoint method to avoid base-value bias.',
        ],
        misconception_data: [
          'dividing by raw change instead of percentage change',
          'ignoring absolute value when interpreting elasticity magnitude',
        ],
        analogies: [
          'Stretch test on a rubber band: responsiveness matters more than raw distance.',
          'Volume knob sensitivity: tiny knob turns can make large output changes.',
        ],
        worked_examples: [
          'Price 10->12, quantity 100->90 -> midpoint elasticity = ((-10/95)/(2/11))',
        ],
      },
    },
  },
];

export const weeklyInsightsEvalCasesLarge: WeeklyInsightsEvalCase[] = [
  {
    id: 'wi-large-01',
    description: 'High-activity mixed trajectory week with many tracked topics',
    input: {
      student_id: 'student-301',
      week_start: '2026-02-23T00:00:00Z',
      week_end: '2026-03-01T23:59:59Z',
      improved_topics: [
        { topic: 'Linear Algebra', attempts: 24, accuracy_rate: 0.86, mastery_delta: 0.29 },
        { topic: 'Calculus', attempts: 20, accuracy_rate: 0.81, mastery_delta: 0.22 },
        { topic: 'Statistics', attempts: 15, accuracy_rate: 0.79, mastery_delta: 0.16 },
      ],
      declined_topics: [
        { topic: 'Physics Mechanics', attempts: 17, accuracy_rate: 0.48, mastery_delta: -0.21 },
        { topic: 'Thermodynamics', attempts: 11, accuracy_rate: 0.52, mastery_delta: -0.09 },
      ],
      untouched_topics: [
        { topic: 'Organic Chemistry', estimated_decay: 0.25 },
        { topic: 'Discrete Math', estimated_decay: 0.19 },
        { topic: 'Economics', estimated_decay: 0.17 },
      ],
      recurring_error_patterns: [
        { pattern: 'procedural_error', count: 11 },
        { pattern: 'misread_question', count: 7 },
        { pattern: 'careless_mistake', count: 5 },
      ],
      behavior_windows: [
        { label: 'after 10pm', accuracy_rate: 0.84, sessions: 8 },
        { label: 'afternoon', accuracy_rate: 0.74, sessions: 10 },
        { label: 'before 8am', accuracy_rate: 0.58, sessions: 6 },
      ],
      avg_session_minutes: 31,
      sessions_count: 24,
      days_active: 7,
      previous_week_quest_completion_rate: 0.78,
    },
  },
  {
    id: 'wi-large-02',
    description: 'Low-consistency week with severe decline and low completion carryover',
    input: {
      student_id: 'student-302',
      week_start: '2026-02-23T00:00:00Z',
      week_end: '2026-03-01T23:59:59Z',
      improved_topics: [
        { topic: 'Basic Algebra', attempts: 6, accuracy_rate: 0.69, mastery_delta: 0.07 },
      ],
      declined_topics: [
        { topic: 'Probability', attempts: 14, accuracy_rate: 0.34, mastery_delta: -0.27 },
        { topic: 'Geometry Proofs', attempts: 9, accuracy_rate: 0.39, mastery_delta: -0.18 },
      ],
      untouched_topics: [
        { topic: 'Functions', estimated_decay: 0.24 },
        { topic: 'Trigonometry', estimated_decay: 0.22 },
        { topic: 'Statistics', estimated_decay: 0.2 },
        { topic: 'Chemistry', estimated_decay: 0.18 },
      ],
      recurring_error_patterns: [
        { pattern: 'conceptual_gap', count: 12 },
        { pattern: 'misread_question', count: 6 },
      ],
      behavior_windows: [
        { label: 'late night', accuracy_rate: 0.41, sessions: 5 },
        { label: 'lunch break', accuracy_rate: 0.49, sessions: 3 },
        { label: 'morning commute', accuracy_rate: 0.36, sessions: 2 },
      ],
      avg_session_minutes: 14,
      sessions_count: 10,
      days_active: 4,
      previous_week_quest_completion_rate: 0.22,
    },
  },
  {
    id: 'wi-large-03',
    description: 'Strong-comeback week with high quest completion and concentrated study windows',
    input: {
      student_id: 'student-303',
      week_start: '2026-02-23T00:00:00Z',
      week_end: '2026-03-01T23:59:59Z',
      improved_topics: [
        { topic: 'Data Structures', attempts: 27, accuracy_rate: 0.91, mastery_delta: 0.34 },
        { topic: 'Algorithms', attempts: 23, accuracy_rate: 0.88, mastery_delta: 0.28 },
      ],
      declined_topics: [
        { topic: 'Dynamic Programming', attempts: 12, accuracy_rate: 0.51, mastery_delta: -0.11 },
      ],
      untouched_topics: [
        { topic: 'Graph Theory', estimated_decay: 0.13 },
      ],
      recurring_error_patterns: [
        { pattern: 'careless_mistake', count: 9 },
        { pattern: 'procedural_error', count: 4 },
      ],
      behavior_windows: [
        { label: 'evening deep-work', accuracy_rate: 0.9, sessions: 9 },
        { label: 'midday', accuracy_rate: 0.77, sessions: 7 },
      ],
      avg_session_minutes: 37,
      sessions_count: 19,
      days_active: 6,
      previous_week_quest_completion_rate: 0.93,
    },
  },
  {
    id: 'wi-large-04',
    description: 'No improvement with broad inactivity and many untouched domains',
    input: {
      student_id: 'student-304',
      week_start: '2026-02-23T00:00:00Z',
      week_end: '2026-03-01T23:59:59Z',
      improved_topics: [],
      declined_topics: [
        { topic: 'Organic Chemistry', attempts: 8, accuracy_rate: 0.31, mastery_delta: -0.24 },
        { topic: 'Inorganic Chemistry', attempts: 7, accuracy_rate: 0.37, mastery_delta: -0.16 },
      ],
      untouched_topics: [
        { topic: 'Calculus', estimated_decay: 0.26 },
        { topic: 'Linear Algebra', estimated_decay: 0.23 },
        { topic: 'Statistics', estimated_decay: 0.21 },
        { topic: 'Physics', estimated_decay: 0.24 },
        { topic: 'Economics', estimated_decay: 0.2 },
      ],
      recurring_error_patterns: [
        { pattern: 'conceptual_gap', count: 10 },
        { pattern: 'stagnation', count: 8 },
      ],
      behavior_windows: [
        { label: 'weekend only', accuracy_rate: 0.43, sessions: 3 },
      ],
      avg_session_minutes: 17,
      sessions_count: 6,
      days_active: 2,
      previous_week_quest_completion_rate: 0.5,
    },
  },
  {
    id: 'wi-large-05',
    description: 'Dense mixed-performance week with wide behavior variability',
    input: {
      student_id: 'student-305',
      week_start: '2026-02-23T00:00:00Z',
      week_end: '2026-03-01T23:59:59Z',
      improved_topics: [
        { topic: 'Ratios', attempts: 18, accuracy_rate: 0.83, mastery_delta: 0.25 },
        { topic: 'Fractions', attempts: 16, accuracy_rate: 0.8, mastery_delta: 0.19 },
      ],
      declined_topics: [
        { topic: 'Word Problems', attempts: 15, accuracy_rate: 0.45, mastery_delta: -0.2 },
        { topic: 'Probability', attempts: 13, accuracy_rate: 0.49, mastery_delta: -0.14 },
      ],
      untouched_topics: [
        { topic: 'Geometry', estimated_decay: 0.18 },
        { topic: 'Algebra', estimated_decay: 0.16 },
        { topic: 'Trigonometry', estimated_decay: 0.19 },
      ],
      recurring_error_patterns: [
        { pattern: 'misread_question', count: 9 },
        { pattern: 'procedural_error', count: 8 },
        { pattern: 'lucky_guess', count: 5 },
      ],
      behavior_windows: [
        { label: 'after 11pm', accuracy_rate: 0.76, sessions: 5 },
        { label: 'after school', accuracy_rate: 0.71, sessions: 6 },
        { label: 'early morning', accuracy_rate: 0.54, sessions: 4 },
        { label: 'lunch break', accuracy_rate: 0.63, sessions: 3 },
      ],
      avg_session_minutes: 26,
      sessions_count: 18,
      days_active: 6,
      previous_week_quest_completion_rate: 0.67,
    },
  },
];
