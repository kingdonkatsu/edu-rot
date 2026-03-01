import type { StudentConceptState } from '../types.js';
import {
  BKT_P_L0,
  EMA_COLD_START,
  STABILITY_INITIAL,
} from '../utils/constants.js';

export interface IStateStore {
  get(studentId: string, conceptTag: string): Promise<StudentConceptState | null>;
  upsert(state: StudentConceptState): Promise<void>;
}

export function createInitialState(
  studentId: string,
  conceptTag: string,
  timestamp: string
): StudentConceptState {
  return {
    student_id: studentId,
    concept_tag: conceptTag,
    p_mastery: BKT_P_L0,
    stability: STABILITY_INITIAL,
    last_interaction_at: null,
    ema: EMA_COLD_START,
    attempt_count: 0,
    correct_count: 0,
    streak_correct: 0,
    streak_incorrect: 0,
    recent_results: [],
    rapid_fire_counter: 0,
    last_event_id: null,
    updated_at: timestamp,
  };
}

export class InMemoryStateStore implements IStateStore {
  private readonly store = new Map<string, StudentConceptState>();

  private key(studentId: string, conceptTag: string): string {
    return `${studentId}::${conceptTag}`;
  }

  async get(studentId: string, conceptTag: string): Promise<StudentConceptState | null> {
    return this.store.get(this.key(studentId, conceptTag)) ?? null;
  }

  async upsert(state: StudentConceptState): Promise<void> {
    this.store.set(
      this.key(state.student_id, state.concept_tag),
      { ...state }
    );
  }
}

export const stateStore: IStateStore = new InMemoryStateStore();
