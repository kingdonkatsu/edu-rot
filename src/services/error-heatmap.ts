import type {
  ErrorClassification,
  ErrorHeatmapCell,
  ErrorHeatmapResult,
  StudentConceptState,
} from '../types.js';

const ERROR_LABELS: ErrorClassification[] = [
  'careless_mistake',
  'lucky_guess',
  'conceptual_gap',
  'procedural_error',
  'misread_question',
  'stagnation',
  'decay',
];

export function computeErrorHeatmap(studentId: string, states: StudentConceptState[]): ErrorHeatmapResult {
  const counter = new Map<string, number>();

  for (const state of states) {
    for (const record of state.interaction_history) {
      if (record.error_classification === 'none') continue;
      const key = `${record.concept_tag}::${record.error_classification}`;
      counter.set(key, (counter.get(key) ?? 0) + 1);
    }
  }

  const cells: ErrorHeatmapCell[] = [];
  for (const [key, count] of counter.entries()) {
    const [concept_tag, error_classification] = key.split('::');
    cells.push({
      concept_tag,
      error_classification: error_classification as ErrorClassification,
      count,
    });
  }

  cells.sort((a, b) => b.count - a.count);

  return {
    student_id: studentId,
    concepts: [...new Set(states.map((state) => state.concept_tag))],
    error_labels: ERROR_LABELS,
    cells,
  };
}
