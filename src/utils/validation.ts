import { validate as isUUID } from 'uuid';
import type { LMSEvent, CrashCourseAgentInput, WeeklyLearningState, ErrorClassification, MasteryLevel } from '../types.js';
import { TIMESTAMP_SKEW_TOLERANCE_MS } from './constants.js';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  data?: LMSEvent;
}

export function validateLMSEvent(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: [{ field: 'body', message: 'Request body must be a JSON object' }] };
  }

  const obj = body as Record<string, unknown>;
  const errors: ValidationError[] = [];

  const eventIdErr = validateEventId(obj.event_id);
  if (eventIdErr) errors.push(eventIdErr);

  const studentIdErr = validateStudentId(obj.student_id);
  if (studentIdErr) errors.push(studentIdErr);

  const timestampErr = validateTimestamp(obj.timestamp);
  if (timestampErr) errors.push(timestampErr);

  const conceptTagErr = validateConceptTag(obj.concept_tag);
  if (conceptTagErr) errors.push(conceptTagErr);

  const isCorrectErr = validateIsCorrect(obj.is_correct);
  if (isCorrectErr) errors.push(isCorrectErr);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      event_id: obj.event_id as string,
      student_id: obj.student_id as string,
      timestamp: obj.timestamp as string,
      concept_tag: obj.concept_tag as string,
      is_correct: obj.is_correct as boolean,
    },
  };
}

function validateEventId(value: unknown): ValidationError | null {
  if (typeof value !== 'string' || !value) {
    return { field: 'event_id', message: 'event_id is required and must be a string' };
  }
  if (!isUUID(value)) {
    return { field: 'event_id', message: 'event_id must be a valid UUID' };
  }
  return null;
}

function validateStudentId(value: unknown): ValidationError | null {
  if (typeof value !== 'string' || !value.trim()) {
    return { field: 'student_id', message: 'student_id is required and must be a non-empty string' };
  }
  return null;
}

function validateTimestamp(value: unknown): ValidationError | null {
  if (typeof value !== 'string' || !value) {
    return { field: 'timestamp', message: 'timestamp is required and must be an ISO 8601 string' };
  }
  const parsed = Date.parse(value);
  if (isNaN(parsed)) {
    return { field: 'timestamp', message: 'timestamp must be a valid ISO 8601 date' };
  }
  if (parsed > Date.now() + TIMESTAMP_SKEW_TOLERANCE_MS) {
    return { field: 'timestamp', message: 'timestamp must not be in the future' };
  }
  return null;
}

function validateConceptTag(value: unknown): ValidationError | null {
  if (typeof value !== 'string' || !value.trim()) {
    return { field: 'concept_tag', message: 'concept_tag is required and must be a non-empty string' };
  }
  return null;
}

function validateIsCorrect(value: unknown): ValidationError | null {
  if (typeof value !== 'boolean') {
    return { field: 'is_correct', message: 'is_correct is required and must be a boolean' };
  }
  return null;
}

// --- Crash Course Agent Validation ---

const VALID_ERROR_CLASSIFICATIONS: ErrorClassification[] = [
  'careless_mistake', 'lucky_guess', 'conceptual_gap', 'procedural_error',
  'misread_question', 'stagnation', 'decay', 'none',
];

const VALID_MASTERY_LEVELS: MasteryLevel[] = ['novice', 'developing', 'proficient', 'mastered'];

export interface CrashCourseValidationResult {
  valid: boolean;
  errors: ValidationError[];
  data?: CrashCourseAgentInput;
}

export function validateCrashCourseInput(body: unknown): CrashCourseValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: [{ field: 'body', message: 'Request body must be a JSON object' }] };
  }

  const obj = body as Record<string, unknown>;
  const errors: ValidationError[] = [];

  if (typeof obj.student_id !== 'string' || !obj.student_id.trim()) {
    errors.push({ field: 'student_id', message: 'student_id is required and must be a non-empty string' });
  }
  if (typeof obj.topic !== 'string' || !obj.topic.trim()) {
    errors.push({ field: 'topic', message: 'topic is required and must be a non-empty string' });
  }
  if (typeof obj.subtopic !== 'string' || !obj.subtopic.trim()) {
    errors.push({ field: 'subtopic', message: 'subtopic is required and must be a non-empty string' });
  }
  if (!VALID_ERROR_CLASSIFICATIONS.includes(obj.error_classification as ErrorClassification)) {
    errors.push({ field: 'error_classification', message: `error_classification must be one of: ${VALID_ERROR_CLASSIFICATIONS.join(', ')}` });
  }
  if (!VALID_MASTERY_LEVELS.includes(obj.mastery_level as MasteryLevel)) {
    errors.push({ field: 'mastery_level', message: `mastery_level must be one of: ${VALID_MASTERY_LEVELS.join(', ')}` });
  }
  if (!Array.isArray(obj.known_strengths)) {
    errors.push({ field: 'known_strengths', message: 'known_strengths must be an array' });
  }

  const rag = obj.rag as Record<string, unknown> | undefined;
  if (!rag || typeof rag !== 'object') {
    errors.push({ field: 'rag', message: 'rag must be an object with concept_explanations, misconception_data, analogies, worked_examples arrays' });
  } else {
    for (const key of ['concept_explanations', 'misconception_data', 'analogies', 'worked_examples']) {
      if (!Array.isArray(rag[key])) {
        errors.push({ field: `rag.${key}`, message: `rag.${key} must be an array` });
      }
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    data: {
      student_id: obj.student_id as string,
      topic: obj.topic as string,
      subtopic: obj.subtopic as string,
      error_classification: obj.error_classification as ErrorClassification,
      mastery_level: obj.mastery_level as MasteryLevel,
      known_strengths: obj.known_strengths as string[],
      rag: {
        concept_explanations: (rag as Record<string, unknown>).concept_explanations as string[],
        misconception_data: (rag as Record<string, unknown>).misconception_data as string[],
        analogies: (rag as Record<string, unknown>).analogies as string[],
        worked_examples: (rag as Record<string, unknown>).worked_examples as string[],
      },
    },
  };
}

// --- Weekly Insights Agent Validation ---

export interface WeeklyInsightsValidationResult {
  valid: boolean;
  errors: ValidationError[];
  data?: WeeklyLearningState;
}

export function validateWeeklyInsightsInput(body: unknown): WeeklyInsightsValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: [{ field: 'body', message: 'Request body must be a JSON object' }] };
  }

  const obj = body as Record<string, unknown>;
  const errors: ValidationError[] = [];

  if (typeof obj.student_id !== 'string' || !obj.student_id.trim()) {
    errors.push({ field: 'student_id', message: 'student_id is required and must be a non-empty string' });
  }

  for (const field of ['week_start', 'week_end']) {
    if (typeof obj[field] !== 'string' || isNaN(Date.parse(obj[field] as string))) {
      errors.push({ field, message: `${field} must be a valid ISO 8601 date string` });
    }
  }

  for (const field of ['improved_topics', 'declined_topics', 'untouched_topics', 'recurring_error_patterns', 'behavior_windows']) {
    if (!Array.isArray(obj[field])) {
      errors.push({ field, message: `${field} must be an array` });
    }
  }

  for (const field of ['avg_session_minutes', 'sessions_count', 'days_active', 'previous_week_quest_completion_rate']) {
    if (typeof obj[field] !== 'number') {
      errors.push({ field, message: `${field} must be a number` });
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    data: obj as unknown as WeeklyLearningState,
  };
}

