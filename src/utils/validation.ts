import { validate as isUUID } from 'uuid';
import type {
  CrashCourseAgentInput,
  CrashCourseVideoRenderRequest,
  ErrorClassification,
  LMSEvent,
  WeeklyLearningState,
} from '../types.js';
import { TIMESTAMP_SKEW_TOLERANCE_MS } from './constants.js';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult<T = LMSEvent> {
  valid: boolean;
  errors: ValidationError[];
  data?: T;
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

export function validateCrashCourseAgentInput(body: unknown): ValidationResult<CrashCourseAgentInput> {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: [{ field: 'body', message: 'Request body must be a JSON object' }] };
  }

  const obj = body as Record<string, unknown>;
  const errors: ValidationError[] = [];

  const studentIdErr = validateStudentId(obj.student_id);
  if (studentIdErr) errors.push(studentIdErr);

  const topicErr = validateRequiredString('topic', obj.topic);
  if (topicErr) errors.push(topicErr);

  const subtopicErr = validateRequiredString('subtopic', obj.subtopic);
  if (subtopicErr) errors.push(subtopicErr);

  const masteryErr = validateMasteryLevel(obj.mastery_level);
  if (masteryErr) errors.push(masteryErr);

  const errorClassErr = validateErrorClassification(obj.error_classification);
  if (errorClassErr) errors.push(errorClassErr);

  const strengthsErr = validateStringArray('known_strengths', obj.known_strengths);
  if (strengthsErr) errors.push(strengthsErr);

  const ragErr = validateCrashCourseRAG(obj.rag);
  if (ragErr) errors.push(...ragErr);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const rag = obj.rag as Record<string, unknown>;
  return {
    valid: true,
    errors: [],
    data: {
      student_id: obj.student_id as string,
      topic: obj.topic as string,
      subtopic: obj.subtopic as string,
      error_classification: obj.error_classification as ErrorClassification,
      mastery_level: obj.mastery_level as CrashCourseAgentInput['mastery_level'],
      known_strengths: obj.known_strengths as string[],
      rag: {
        concept_explanations: rag.concept_explanations as string[],
        misconception_data: rag.misconception_data as string[],
        analogies: rag.analogies as string[],
        worked_examples: rag.worked_examples as string[],
      },
    },
  };
}

export function validateWeeklyLearningState(body: unknown): ValidationResult<WeeklyLearningState> {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: [{ field: 'body', message: 'Request body must be a JSON object' }] };
  }

  const obj = body as Record<string, unknown>;
  const errors: ValidationError[] = [];

  const studentIdErr = validateStudentId(obj.student_id);
  if (studentIdErr) errors.push(studentIdErr);

  const weekStartErr = validateTimestampRequired('week_start', obj.week_start);
  if (weekStartErr) errors.push(weekStartErr);
  const weekEndErr = validateTimestampRequired('week_end', obj.week_end);
  if (weekEndErr) errors.push(weekEndErr);

  const improvedErr = validateTopicTrendArray('improved_topics', obj.improved_topics);
  if (improvedErr) errors.push(...improvedErr);
  const declinedErr = validateTopicTrendArray('declined_topics', obj.declined_topics);
  if (declinedErr) errors.push(...declinedErr);

  const untouchedErr = validateUntouchedTopics(obj.untouched_topics);
  if (untouchedErr) errors.push(...untouchedErr);

  const recurringErr = validateRecurringErrors(obj.recurring_error_patterns);
  if (recurringErr) errors.push(...recurringErr);

  const behaviorErr = validateBehaviorWindows(obj.behavior_windows);
  if (behaviorErr) errors.push(...behaviorErr);

  const avgSessionErr = validateNonNegativeNumber('avg_session_minutes', obj.avg_session_minutes);
  if (avgSessionErr) errors.push(avgSessionErr);
  const sessionsCountErr = validateNonNegativeNumber('sessions_count', obj.sessions_count);
  if (sessionsCountErr) errors.push(sessionsCountErr);
  const daysActiveErr = validateNonNegativeNumber('days_active', obj.days_active);
  if (daysActiveErr) errors.push(daysActiveErr);
  const completionRateErr = validateRate(
    'previous_week_quest_completion_rate',
    obj.previous_week_quest_completion_rate
  );
  if (completionRateErr) errors.push(completionRateErr);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      student_id: obj.student_id as string,
      week_start: obj.week_start as string,
      week_end: obj.week_end as string,
      improved_topics: obj.improved_topics as WeeklyLearningState['improved_topics'],
      declined_topics: obj.declined_topics as WeeklyLearningState['declined_topics'],
      untouched_topics: obj.untouched_topics as WeeklyLearningState['untouched_topics'],
      recurring_error_patterns: obj.recurring_error_patterns as WeeklyLearningState['recurring_error_patterns'],
      behavior_windows: obj.behavior_windows as WeeklyLearningState['behavior_windows'],
      avg_session_minutes: obj.avg_session_minutes as number,
      sessions_count: obj.sessions_count as number,
      days_active: obj.days_active as number,
      previous_week_quest_completion_rate: obj.previous_week_quest_completion_rate as number,
    },
  };
}

export function validateCrashCourseVideoRenderRequest(
  body: unknown
): ValidationResult<CrashCourseVideoRenderRequest> {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: [{ field: 'body', message: 'Request body must be a JSON object' }] };
  }

  const obj = body as Record<string, unknown>;
  const errors: ValidationError[] = [];

  const crashValidation = validateCrashCourseAgentInput(obj.crash_course_input);
  if (!crashValidation.valid) {
    crashValidation.errors.forEach((error) => {
      errors.push({
        field: `crash_course_input.${error.field}`,
        message: error.message,
      });
    });
  }

  let stylePreset:
    | 'brainrot_classic'
    | 'cartoon_ocean_mentor'
    | 'anime_sensei'
    | 'retro_arcade_coach'
    | 'chalkboard_speedrun'
    | undefined;
  let creatorPrompt: string | undefined;
  let voiceoverStyle: string | undefined;
  let seconds: '4' | '8' | '12' | undefined;
  let size: '720x1280' | '1280x720' | '1024x1792' | '1792x1024' | undefined;

  if (obj.video_preference !== undefined) {
    if (!obj.video_preference || typeof obj.video_preference !== 'object') {
      errors.push({ field: 'video_preference', message: 'video_preference must be an object' });
    } else {
      const pref = obj.video_preference as Record<string, unknown>;
      if (pref.style_preset !== undefined) {
        const allowed = new Set([
          'brainrot_classic',
          'cartoon_ocean_mentor',
          'anime_sensei',
          'retro_arcade_coach',
          'chalkboard_speedrun',
        ]);
        if (typeof pref.style_preset !== 'string' || !allowed.has(pref.style_preset)) {
          errors.push({
            field: 'video_preference.style_preset',
            message: 'video_preference.style_preset is invalid',
          });
        } else {
          stylePreset = pref.style_preset as
            | 'brainrot_classic'
            | 'cartoon_ocean_mentor'
            | 'anime_sensei'
            | 'retro_arcade_coach'
            | 'chalkboard_speedrun';
        }
      }

      if (pref.creator_prompt !== undefined) {
        if (typeof pref.creator_prompt !== 'string') {
          errors.push({
            field: 'video_preference.creator_prompt',
            message: 'video_preference.creator_prompt must be a string',
          });
        } else {
          creatorPrompt = pref.creator_prompt;
        }
      }

      if (pref.voiceover_style !== undefined) {
        if (typeof pref.voiceover_style !== 'string') {
          errors.push({
            field: 'video_preference.voiceover_style',
            message: 'video_preference.voiceover_style must be a string',
          });
        } else {
          voiceoverStyle = pref.voiceover_style;
        }
      }

      if (pref.seconds !== undefined) {
        if (pref.seconds !== '4' && pref.seconds !== '8' && pref.seconds !== '12') {
          errors.push({
            field: 'video_preference.seconds',
            message: 'video_preference.seconds must be one of 4, 8, or 12',
          });
        } else {
          seconds = pref.seconds;
        }
      }

      if (pref.size !== undefined) {
        const allowedSizes = new Set(['720x1280', '1280x720', '1024x1792', '1792x1024']);
        if (typeof pref.size !== 'string' || !allowedSizes.has(pref.size)) {
          errors.push({
            field: 'video_preference.size',
            message: 'video_preference.size is invalid',
          });
        } else {
          size = pref.size as typeof size;
        }
      }
    }
  }

  if (obj.auto_poll !== undefined && typeof obj.auto_poll !== 'boolean') {
    errors.push({ field: 'auto_poll', message: 'auto_poll must be a boolean' });
  }
  if (obj.poll_interval_ms !== undefined) {
    const err = validateNonNegativeNumber('poll_interval_ms', obj.poll_interval_ms);
    if (err) errors.push(err);
  }
  if (obj.max_wait_ms !== undefined) {
    const err = validateNonNegativeNumber('max_wait_ms', obj.max_wait_ms);
    if (err) errors.push(err);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      crash_course_input: crashValidation.data!,
      video_preference: obj.video_preference === undefined
        ? undefined
        : {
          style_preset: stylePreset,
          creator_prompt: creatorPrompt,
          voiceover_style: voiceoverStyle,
          seconds,
          size,
        },
      auto_poll: typeof obj.auto_poll === 'boolean' ? obj.auto_poll : undefined,
      poll_interval_ms: typeof obj.poll_interval_ms === 'number' ? obj.poll_interval_ms : undefined,
      max_wait_ms: typeof obj.max_wait_ms === 'number' ? obj.max_wait_ms : undefined,
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

function validateRequiredString(field: string, value: unknown): ValidationError | null {
  if (typeof value !== 'string' || !value.trim()) {
    return { field, message: `${field} is required and must be a non-empty string` };
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

function validateMasteryLevel(value: unknown): ValidationError | null {
  if (value !== 'novice' && value !== 'developing' && value !== 'proficient' && value !== 'mastered') {
    return { field: 'mastery_level', message: 'mastery_level must be one of novice, developing, proficient, mastered' };
  }
  return null;
}

function validateErrorClassification(value: unknown): ValidationError | null {
  const allowed = new Set([
    'careless_mistake',
    'lucky_guess',
    'conceptual_gap',
    'procedural_error',
    'misread_question',
    'stagnation',
    'decay',
    'none',
  ]);
  if (typeof value !== 'string' || !allowed.has(value)) {
    return { field: 'error_classification', message: 'error_classification is invalid' };
  }
  return null;
}

function validateStringArray(field: string, value: unknown): ValidationError | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return { field, message: `${field} must be an array of strings` };
  }
  return null;
}

function validateCrashCourseRAG(value: unknown): ValidationError[] | null {
  if (!value || typeof value !== 'object') {
    return [{ field: 'rag', message: 'rag is required and must be an object' }];
  }

  const rag = value as Record<string, unknown>;
  const errors: ValidationError[] = [];
  const conceptErr = validateStringArray('rag.concept_explanations', rag.concept_explanations);
  if (conceptErr) errors.push(conceptErr);
  const misconceptionErr = validateStringArray('rag.misconception_data', rag.misconception_data);
  if (misconceptionErr) errors.push(misconceptionErr);
  const analogiesErr = validateStringArray('rag.analogies', rag.analogies);
  if (analogiesErr) errors.push(analogiesErr);
  const workedExamplesErr = validateStringArray('rag.worked_examples', rag.worked_examples);
  if (workedExamplesErr) errors.push(workedExamplesErr);

  return errors.length > 0 ? errors : null;
}

function validateTimestampRequired(field: string, value: unknown): ValidationError | null {
  if (typeof value !== 'string' || !value) {
    return { field, message: `${field} is required and must be an ISO 8601 string` };
  }
  const parsed = Date.parse(value);
  if (isNaN(parsed)) {
    return { field, message: `${field} must be a valid ISO 8601 date` };
  }
  return null;
}

function validateTopicTrendArray(field: string, value: unknown): ValidationError[] | null {
  if (!Array.isArray(value)) {
    return [{ field, message: `${field} must be an array` }];
  }

  const errors: ValidationError[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      errors.push({ field: `${field}[${index}]`, message: 'item must be an object' });
      return;
    }
    const obj = item as Record<string, unknown>;
    const topicErr = validateRequiredString(`${field}[${index}].topic`, obj.topic);
    if (topicErr) errors.push(topicErr);
    const attemptsErr = validateNonNegativeNumber(`${field}[${index}].attempts`, obj.attempts);
    if (attemptsErr) errors.push(attemptsErr);
    const accuracyErr = validateRate(`${field}[${index}].accuracy_rate`, obj.accuracy_rate);
    if (accuracyErr) errors.push(accuracyErr);
    const masteryDeltaErr = validateNumber(`${field}[${index}].mastery_delta`, obj.mastery_delta);
    if (masteryDeltaErr) errors.push(masteryDeltaErr);
  });

  return errors.length > 0 ? errors : null;
}

function validateUntouchedTopics(value: unknown): ValidationError[] | null {
  if (!Array.isArray(value)) {
    return [{ field: 'untouched_topics', message: 'untouched_topics must be an array' }];
  }

  const errors: ValidationError[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      errors.push({ field: `untouched_topics[${index}]`, message: 'item must be an object' });
      return;
    }
    const obj = item as Record<string, unknown>;
    const topicErr = validateRequiredString(`untouched_topics[${index}].topic`, obj.topic);
    if (topicErr) errors.push(topicErr);
    const decayErr = validateRate(`untouched_topics[${index}].estimated_decay`, obj.estimated_decay);
    if (decayErr) errors.push(decayErr);
  });

  return errors.length > 0 ? errors : null;
}

function validateRecurringErrors(value: unknown): ValidationError[] | null {
  if (!Array.isArray(value)) {
    return [{ field: 'recurring_error_patterns', message: 'recurring_error_patterns must be an array' }];
  }

  const errors: ValidationError[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      errors.push({ field: `recurring_error_patterns[${index}]`, message: 'item must be an object' });
      return;
    }
    const obj = item as Record<string, unknown>;
    const patternErr = validateRequiredString(`recurring_error_patterns[${index}].pattern`, obj.pattern);
    if (patternErr) errors.push(patternErr);
    const countErr = validateNonNegativeNumber(`recurring_error_patterns[${index}].count`, obj.count);
    if (countErr) errors.push(countErr);
  });

  return errors.length > 0 ? errors : null;
}

function validateBehaviorWindows(value: unknown): ValidationError[] | null {
  if (!Array.isArray(value)) {
    return [{ field: 'behavior_windows', message: 'behavior_windows must be an array' }];
  }

  const errors: ValidationError[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      errors.push({ field: `behavior_windows[${index}]`, message: 'item must be an object' });
      return;
    }
    const obj = item as Record<string, unknown>;
    const labelErr = validateRequiredString(`behavior_windows[${index}].label`, obj.label);
    if (labelErr) errors.push(labelErr);
    const accuracyErr = validateRate(`behavior_windows[${index}].accuracy_rate`, obj.accuracy_rate);
    if (accuracyErr) errors.push(accuracyErr);
    const sessionsErr = validateNonNegativeNumber(`behavior_windows[${index}].sessions`, obj.sessions);
    if (sessionsErr) errors.push(sessionsErr);
  });

  return errors.length > 0 ? errors : null;
}

function validateRate(field: string, value: unknown): ValidationError | null {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
    return { field, message: `${field} must be a number between 0 and 1` };
  }
  return null;
}

function validateNumber(field: string, value: unknown): ValidationError | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return { field, message: `${field} must be a number` };
  }
  return null;
}

function validateNonNegativeNumber(field: string, value: unknown): ValidationError | null {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    return { field, message: `${field} must be a non-negative number` };
  }
  return null;
}
