import { validate as isUUID } from 'uuid';
import type { LMSEvent } from '../types.js';
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
