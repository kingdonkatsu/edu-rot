import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { validateLMSEvent } from '../../src/utils/validation.js';

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    event_id: uuidv4(),
    student_id: 'student-001',
    timestamp: '2026-02-01T14:30:00Z',
    concept_tag: 'math.algebra.quadratic',
    is_correct: true,
    ...overrides,
  };
}

describe('validateLMSEvent', () => {
  it('accepts a valid payload', () => {
    const result = validateLMSEvent(validPayload());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toBeDefined();
  });

  it('rejects non-object body', () => {
    const result = validateLMSEvent(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('body');
  });

  it('rejects missing event_id', () => {
    const { event_id, ...rest } = validPayload();
    const result = validateLMSEvent(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'event_id')).toBe(true);
  });

  it('rejects invalid UUID for event_id', () => {
    const result = validateLMSEvent(validPayload({ event_id: 'not-a-uuid' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'event_id')).toBe(true);
  });

  it('rejects empty student_id', () => {
    const result = validateLMSEvent(validPayload({ student_id: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'student_id')).toBe(true);
  });

  it('rejects missing timestamp', () => {
    const { timestamp, ...rest } = validPayload();
    const result = validateLMSEvent(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'timestamp')).toBe(true);
  });

  it('rejects invalid timestamp format', () => {
    const result = validateLMSEvent(validPayload({ timestamp: 'not-a-date' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'timestamp')).toBe(true);
  });

  it('rejects future timestamp beyond tolerance', () => {
    const futureDate = new Date(Date.now() + 120_000).toISOString();
    const result = validateLMSEvent(validPayload({ timestamp: futureDate }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'timestamp')).toBe(true);
  });

  it('accepts timestamp within clock-skew tolerance', () => {
    const nearFuture = new Date(Date.now() + 30_000).toISOString();
    const result = validateLMSEvent(validPayload({ timestamp: nearFuture }));
    expect(result.valid).toBe(true);
  });

  it('rejects empty concept_tag', () => {
    const result = validateLMSEvent(validPayload({ concept_tag: '   ' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'concept_tag')).toBe(true);
  });

  it('rejects non-boolean is_correct', () => {
    const result = validateLMSEvent(validPayload({ is_correct: 'true' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'is_correct')).toBe(true);
  });

  it('collects multiple errors at once', () => {
    const result = validateLMSEvent({ event_id: 'bad', student_id: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
