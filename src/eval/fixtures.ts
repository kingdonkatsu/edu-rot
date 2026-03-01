import type { CrashCourseAgentInput, WeeklyLearningState } from '../types.js';

// --- 5 Crash Course Fixtures ---

export const crashCourseFixtures: CrashCourseAgentInput[] = [
  {
    student_id: 'student-001',
    topic: 'Algebra',
    subtopic: 'Quadratic equations',
    error_classification: 'lucky_guess',
    mastery_level: 'novice',
    known_strengths: ['basic arithmetic', 'equation balancing'],
    rag: {
      concept_explanations: [
        'A quadratic equation has the form ax² + bx + c = 0 and can be solved using the quadratic formula or factoring.',
      ],
      misconception_data: [
        'Students often forget to apply lucky_guess correction and treat a guess as real knowledge.',
        'Common error: not checking both roots of the quadratic.',
      ],
      analogies: [
        'Think of the quadratic formula like a GPS — plug in the coordinates and it finds both exits.',
      ],
      worked_examples: [
        'Solve x² - 5x + 6 = 0 by factoring: (x-2)(x-3) = 0, so x = 2 or x = 3.',
      ],
    },
  },
  {
    student_id: 'student-002',
    topic: 'Java',
    subtopic: 'Polymorphism',
    error_classification: 'conceptual_gap',
    mastery_level: 'developing',
    known_strengths: ['inheritance basics', 'class structure'],
    rag: {
      concept_explanations: [
        'Polymorphism allows objects of different classes to be treated as the same type via a common interface or superclass.',
      ],
      misconception_data: [
        'conceptual_gap: students confuse polymorphism with overloading rather than overriding.',
      ],
      analogies: [
        'Polymorphism is like a universal remote — one button, but different devices respond differently.',
      ],
      worked_examples: [
        'Animal a = new Dog(); a.speak(); // calls Dog.speak() not Animal.speak() — runtime dispatch.',
      ],
    },
  },
  {
    student_id: 'student-003',
    topic: 'Statistics',
    subtopic: 'Standard deviation',
    error_classification: 'procedural_error',
    mastery_level: 'developing',
    known_strengths: ['mean calculation', 'data reading'],
    rag: {
      concept_explanations: [
        'Standard deviation measures how spread out numbers are from the mean. Formula: sqrt(Σ(x-μ)²/N).',
      ],
      misconception_data: [
        'procedural_error: students forget to square the differences before summing, causing sign errors.',
      ],
      analogies: [
        'Think of standard deviation as measuring how far your average pizza delivery time strays from the promised 30 minutes.',
      ],
      worked_examples: [
        'Data [2,4,4,4,5,5,7,9]: mean=5, deviations squared=[9,1,1,1,0,0,4,16], variance=4, std=2.',
      ],
    },
  },
  {
    student_id: 'student-004',
    topic: 'Chemistry',
    subtopic: 'Balancing equations',
    error_classification: 'careless_mistake',
    mastery_level: 'proficient',
    known_strengths: ['stoichiometry', 'mole concept', 'reaction types'],
    rag: {
      concept_explanations: [
        'Balancing chemical equations requires equal numbers of each atom on both sides, conserving mass.',
      ],
      misconception_data: [
        'careless_mistake: students add subscripts instead of coefficients when balancing, changing the compound.',
      ],
      analogies: [
        'Balancing is like splitting a restaurant bill — you cannot change what you ordered, only how many servings.',
      ],
      worked_examples: [
        'H2 + O2 → H2O: unbalanced. Fix: 2H2 + O2 → 2H2O. Coefficients only, no subscript changes.',
      ],
    },
  },
  {
    student_id: 'student-005',
    topic: 'History',
    subtopic: 'French Revolution causes',
    error_classification: 'stagnation',
    mastery_level: 'developing',
    known_strengths: ['timeline recall', 'key figures'],
    rag: {
      concept_explanations: [
        'The French Revolution was caused by financial crisis, social inequality, Enlightenment ideas, and food scarcity.',
      ],
      misconception_data: [
        'stagnation: students list causes but cannot explain the causal chain or prioritize them.',
        'Common stagnation pattern: memorizing facts without understanding the interconnections.',
      ],
      analogies: [
        'The Revolution is like a dam bursting — pressure built from inequality, debt, and hunger until it gave way.',
      ],
      worked_examples: [
        'Cause chain: debt → tax burden on peasants → food prices rise → bread riots → Estates General → revolution.',
      ],
    },
  },
];

// --- 5 Weekly Insights Fixtures ---

export const weeklyInsightsFixtures: WeeklyLearningState[] = [
  {
    student_id: 'student-001',
    week_start: '2026-02-23T00:00:00Z',
    week_end: '2026-03-01T00:00:00Z',
    improved_topics: [
      { topic: 'Algebra', attempts: 12, accuracy_rate: 0.83, mastery_delta: 0.15 },
      { topic: 'Geometry', attempts: 6, accuracy_rate: 0.67, mastery_delta: 0.08 },
    ],
    declined_topics: [
      { topic: 'Statistics', attempts: 4, accuracy_rate: 0.25, mastery_delta: -0.12 },
    ],
    untouched_topics: [
      { topic: 'Trigonometry', estimated_decay: 0.07 },
      { topic: 'Calculus', estimated_decay: 0.04 },
    ],
    recurring_error_patterns: [
      { pattern: 'formula_recall_failure', count: 5 },
      { pattern: 'sign_error', count: 3 },
    ],
    behavior_windows: [
      { label: 'after 9pm', accuracy_rate: 0.71, sessions: 4 },
      { label: 'before 9am', accuracy_rate: 0.42, sessions: 2 },
    ],
    avg_session_minutes: 22,
    sessions_count: 8,
    days_active: 5,
    previous_week_quest_completion_rate: 0.8,
  },
  {
    student_id: 'student-002',
    week_start: '2026-02-23T00:00:00Z',
    week_end: '2026-03-01T00:00:00Z',
    improved_topics: [
      { topic: 'Java OOP', attempts: 20, accuracy_rate: 0.9, mastery_delta: 0.22 },
    ],
    declined_topics: [
      { topic: 'Data Structures', attempts: 8, accuracy_rate: 0.38, mastery_delta: -0.18 },
    ],
    untouched_topics: [
      { topic: 'Algorithms', estimated_decay: 0.11 },
    ],
    recurring_error_patterns: [
      { pattern: 'off_by_one_error', count: 7 },
    ],
    behavior_windows: [
      { label: 'afternoon', accuracy_rate: 0.88, sessions: 6 },
      { label: 'evening', accuracy_rate: 0.55, sessions: 3 },
    ],
    avg_session_minutes: 35,
    sessions_count: 9,
    days_active: 6,
    previous_week_quest_completion_rate: 0.6,
  },
  {
    student_id: 'student-003',
    week_start: '2026-02-23T00:00:00Z',
    week_end: '2026-03-01T00:00:00Z',
    improved_topics: [
      { topic: 'Reading Comprehension', attempts: 5, accuracy_rate: 0.6, mastery_delta: 0.06 },
    ],
    declined_topics: [
      { topic: 'Grammar', attempts: 3, accuracy_rate: 0.33, mastery_delta: -0.05 },
      { topic: 'Vocabulary', attempts: 2, accuracy_rate: 0.5, mastery_delta: -0.02 },
    ],
    untouched_topics: [
      { topic: 'Writing', estimated_decay: 0.09 },
    ],
    recurring_error_patterns: [
      { pattern: 'comma_splice', count: 4 },
      { pattern: 'subject_verb_disagreement', count: 2 },
    ],
    behavior_windows: [
      { label: 'weekend morning', accuracy_rate: 0.72, sessions: 2 },
    ],
    avg_session_minutes: 10,
    sessions_count: 4,
    days_active: 3,
    previous_week_quest_completion_rate: 0.3,
  },
  {
    student_id: 'student-004',
    week_start: '2026-02-23T00:00:00Z',
    week_end: '2026-03-01T00:00:00Z',
    improved_topics: [
      { topic: 'Organic Chemistry', attempts: 15, accuracy_rate: 0.87, mastery_delta: 0.19 },
    ],
    declined_topics: [
      { topic: 'Physical Chemistry', attempts: 6, accuracy_rate: 0.33, mastery_delta: -0.14 },
    ],
    untouched_topics: [
      { topic: 'Inorganic Chemistry', estimated_decay: 0.06 },
      { topic: 'Biochemistry', estimated_decay: 0.13 },
    ],
    recurring_error_patterns: [
      { pattern: 'electron_configuration_error', count: 6 },
    ],
    behavior_windows: [
      { label: 'after lunch', accuracy_rate: 0.82, sessions: 5 },
      { label: 'late night', accuracy_rate: 0.41, sessions: 2 },
    ],
    avg_session_minutes: 28,
    sessions_count: 7,
    days_active: 5,
    previous_week_quest_completion_rate: 0.5,
  },
  {
    student_id: 'student-005',
    week_start: '2026-02-23T00:00:00Z',
    week_end: '2026-03-01T00:00:00Z',
    improved_topics: [
      { topic: 'World History', attempts: 10, accuracy_rate: 0.8, mastery_delta: 0.12 },
    ],
    declined_topics: [
      { topic: 'Geography', attempts: 5, accuracy_rate: 0.4, mastery_delta: -0.09 },
    ],
    untouched_topics: [
      { topic: 'Civics', estimated_decay: 0.08 },
    ],
    recurring_error_patterns: [
      { pattern: 'date_confusion', count: 8 },
      { pattern: 'region_misidentification', count: 3 },
    ],
    behavior_windows: [
      { label: 'after school', accuracy_rate: 0.78, sessions: 5 },
      { label: 'morning', accuracy_rate: 0.52, sessions: 2 },
    ],
    avg_session_minutes: 18,
    sessions_count: 7,
    days_active: 5,
    previous_week_quest_completion_rate: 0.75,
  },
];
