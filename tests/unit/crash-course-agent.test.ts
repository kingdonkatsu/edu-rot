import { describe, it, expect } from 'vitest';
import { runCrashCourseAgent } from '../../src/services/crash-course-agent.js';
import type { CrashCourseAgentInput, CrashCourseMakerOutput } from '../../src/types.js';

function makeInput(overrides: Partial<CrashCourseAgentInput> = {}): CrashCourseAgentInput {
  return {
    student_id: 'student-001',
    topic: 'Algebra',
    subtopic: 'Solving linear equations',
    error_classification: 'procedural_error',
    mastery_level: 'developing',
    known_strengths: ['isolation of variables'],
    rag: {
      concept_explanations: ['Balance both sides of the equation and preserve equality at every step.'],
      misconception_data: ['moving terms across equals without flipping sign'],
      analogies: ['Treat each side like a seesaw: whatever you do on one side must happen on the other.'],
      worked_examples: ['2x + 3 = 11 -> 2x = 8 -> x = 4'],
    },
    ...overrides,
  };
}

function makeValidDraft(): CrashCourseMakerOutput {
  return {
    cards: [
      { stage: 'specific_mistake', title: 'Mistake', body: 'You hit procedural error while solving linear equations.' },
      { stage: 'intuition_analogy', title: 'Analogy', body: 'Think seesaw: both sides move together.' },
      { stage: 'actual_concept', title: 'Concept', body: 'Balance both sides of the equation and preserve equality.' },
      { stage: 'worked_example', title: 'Example', body: '2x + 3 = 11 -> 2x = 8 -> x = 4' },
      { stage: 'practice_question', title: 'Practice', body: 'Solve 3x - 4 = 17 and avoid procedural error.' },
    ],
  };
}

describe('runCrashCourseAgent', () => {
  it('passes checker on first attempt with default deps', async () => {
    const result = await runCrashCourseAgent(makeInput());
    expect(result.attempts).toBe(1);
    expect(result.cards.length).toBeGreaterThanOrEqual(4);
    expect(result.checker_history).toHaveLength(1);
    expect(result.checker_history[0].passed).toBe(true);
  });

  it('retries with checker feedback when first draft fails', async () => {
    let makerCalls = 0;
    const seenFixInstructions: string[][] = [];

    const result = await runCrashCourseAgent(makeInput(), {
      maker: async (_input, fixInstructions) => {
        makerCalls += 1;
        seenFixInstructions.push(fixInstructions);
        if (makerCalls === 1) {
          return { cards: [] };
        }
        return makeValidDraft();
      },
      checker: async (_input, draft) => {
        if (draft.cards.length === 0) {
          return {
            passed: false,
            issues: [
              {
                message: 'missing cards',
                fix_instruction: 'add required cards',
              },
            ],
          };
        }
        return { passed: true, issues: [] };
      },
    });

    expect(result.attempts).toBe(2);
    expect(result.checker_history).toHaveLength(2);
    expect(seenFixInstructions[0]).toEqual([]);
    expect(seenFixInstructions[1]).toEqual(['add required cards']);
  });

  it('stops after max retries when checker keeps failing', async () => {
    const result = await runCrashCourseAgent(makeInput(), {
      maker: async () => ({ cards: [] }),
      checker: async () => ({
        passed: false,
        issues: [{ message: 'still wrong', fix_instruction: 'fix again' }],
      }),
    });

    expect(result.attempts).toBe(3);
    expect(result.checker_history).toHaveLength(3);
    expect(result.checker_history.every((entry) => !entry.passed)).toBe(true);
  });

  it('normalizes punctuation so cards do not contain double periods', async () => {
    const result = await runCrashCourseAgent(makeInput({
      rag: {
        concept_explanations: ['Balance both sides.'],
        misconception_data: ['sign error.'],
        analogies: ['See-saw model.'],
        worked_examples: ['2x + 3 = 11 -> 2x = 8 -> x = 4'],
      },
    }));

    expect(result.cards.every((card) => !card.body.includes('..'))).toBe(true);
  });
});
