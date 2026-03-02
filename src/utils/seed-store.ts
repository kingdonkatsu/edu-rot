/**
 * Seed the in-memory state store with synthetic data derived from the weekly
 * insights fixtures so that the analytics dashboard has something to display
 * on first load without requiring real LMS events to be posted.
 */
import type { IStateStore } from '../adapters/state-store.js';
import type {
  InteractionRecord,
  StudentConceptState,
  ErrorClassification,
} from '../types.js';
import { weeklyInsightsFixtures } from '../eval/fixtures.js';
import { EMA_COLD_START, STABILITY_INITIAL } from './constants.js';

const ERROR_CLASSIFICATIONS: ErrorClassification[] = [
  'careless_mistake',
  'conceptual_gap',
  'procedural_error',
  'none',
  'none',
  'none',
];

function pickError(isCorrect: boolean, index: number): ErrorClassification {
  if (isCorrect) return 'none';
  return ERROR_CLASSIFICATIONS[index % (ERROR_CLASSIFICATIONS.length - 3)] as ErrorClassification;
}

/**
 * Build a deterministic interaction history for one concept.
 * Spreads `attempts` events across the week, with `correctCount` correct answers.
 */
function buildHistory(
  _studentId: string,
  conceptTag: string,
  attempts: number,
  accuracyRate: number,
  finalMastery: number,
  weekStart: string,
  weekEnd: string
): InteractionRecord[] {
  const start = Date.parse(weekStart);
  const end = Date.parse(weekEnd);
  const span = end - start;
  const correctCount = Math.round(attempts * accuracyRate);

  // Spread correct/incorrect deterministically (corrects first, then wrongs)
  const results: boolean[] = [
    ...Array(correctCount).fill(true),
    ...Array(attempts - correctCount).fill(false),
  ];
  // Interleave: sort so they're mixed rather than all corrects up front
  results.sort((_, __, i = 0) => (i++ % 2 === 0 ? -1 : 1));

  const records: InteractionRecord[] = [];
  let p = Math.max(0.1, finalMastery - 0.3);
  let ema = EMA_COLD_START;
  const alpha = 0.3;
  const masteryStep = attempts > 1 ? (finalMastery - p) / (attempts - 1) : 0;

  for (let i = 0; i < attempts; i++) {
    const t = new Date(start + Math.round((span * i) / Math.max(1, attempts - 1))).toISOString();
    const isCorrect = results[i] ?? false;
    ema = alpha * (isCorrect ? 1 : 0) + (1 - alpha) * ema;
    p = Math.min(1, Math.max(0, p + masteryStep + (isCorrect ? 0.01 : -0.005)));

    records.push({
      timestamp: t,
      concept_tag: conceptTag,
      is_correct: isCorrect,
      p_mastery: parseFloat(p.toFixed(3)),
      ema: parseFloat(ema.toFixed(3)),
      error_classification: pickError(isCorrect, i),
    });
  }

  return records;
}

function buildState(
  studentId: string,
  conceptTag: string,
  history: InteractionRecord[]
): StudentConceptState {
  const correctCount = history.filter((r) => r.is_correct).length;
  const lastRecord = history.at(-1);
  const firstRecord = history[0];

  let streakCorrect = 0;
  let streakIncorrect = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].is_correct) {
      if (streakIncorrect > 0) break;
      streakCorrect++;
    } else {
      if (streakCorrect > 0) break;
      streakIncorrect++;
    }
  }

  return {
    student_id: studentId,
    concept_tag: conceptTag,
    p_mastery: lastRecord?.p_mastery ?? 0.2,
    stability: STABILITY_INITIAL,
    last_interaction_at: lastRecord?.timestamp ?? null,
    first_interaction_at: firstRecord?.timestamp ?? null,
    ema: lastRecord?.ema ?? EMA_COLD_START,
    attempt_count: history.length,
    correct_count: correctCount,
    streak_correct: streakCorrect,
    streak_incorrect: streakIncorrect,
    recent_results: history.slice(-10).map((r) => r.is_correct),
    interaction_history: history,
    rapid_fire_counter: 0,
    last_event_id: null,
    updated_at: lastRecord?.timestamp ?? new Date().toISOString(),
  };
}

export async function seedStoreFromFixtures(store: IStateStore): Promise<void> {
  for (const fixture of weeklyInsightsFixtures) {
    const allTopics = [
      ...fixture.improved_topics.map((t) => ({ ...t, mastery_delta: t.mastery_delta })),
      ...fixture.declined_topics.map((t) => ({ ...t, mastery_delta: t.mastery_delta })),
    ];

    for (const topic of allTopics) {
      const finalMastery = Math.min(1, Math.max(0.05, 0.5 + topic.mastery_delta));
      const history = buildHistory(
        fixture.student_id,
        topic.topic,
        topic.attempts,
        topic.accuracy_rate,
        finalMastery,
        fixture.week_start,
        fixture.week_end
      );
      const state = buildState(fixture.student_id, topic.topic, history);
      await store.upsert(state);
    }
  }
}
