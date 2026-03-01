import { describe, it, expect } from 'vitest';
import { AgentValidationError, runCrashCourseAgent } from '../../src/services/crash-course-agent.js';
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
    sora_video_prompt: {
      engine: 'sora.ai',
      tone: 'playful brainrot',
      audience: 'student',
      output_format: 'vertical_short',
      video_objective: 'Teach the exact misconception clearly.',
      safety_constraints: ['No discouraging language.', 'No stereotypes or bias.'],
      scenes: [
        {
          stage: 'specific_mistake',
          scene_goal: 'State the exact mistake.',
          on_screen_visual: 'Equation with highlighted incorrect sign move.',
          narration_prompt: 'You hit a procedural error. Fix this specific step.',
          misconception_target: 'moving terms across equals without flipping sign',
        },
        {
          stage: 'intuition_analogy',
          scene_goal: 'Build intuition via analogy.',
          on_screen_visual: 'Balance scale animation.',
          narration_prompt: 'Treat both sides like a seesaw; both must stay balanced.',
          misconception_target: 'equality preservation',
        },
        {
          stage: 'actual_concept',
          scene_goal: 'Explain concept rule.',
          on_screen_visual: 'Step-by-step equation transform.',
          narration_prompt: 'Balance both sides at every step.',
          misconception_target: 'procedural consistency',
        },
        {
          stage: 'worked_example',
          scene_goal: 'Show worked example.',
          on_screen_visual: '2x + 3 = 11 to x = 4 walkthrough.',
          narration_prompt: 'Apply the rule line by line to avoid sign mistakes.',
          misconception_target: 'line-by-line equation solving',
        },
        {
          stage: 'practice_question',
          scene_goal: 'Prompt targeted practice.',
          on_screen_visual: 'New equation appears with pause for student attempt.',
          narration_prompt: 'Solve 3x - 4 = 17 and call out the sign flip step.',
          misconception_target: 'sign handling when moving terms',
        },
      ],
      final_call_to_action: 'Try one more equation and explain your anti-error step out loud.',
    },
  };
}

describe('runCrashCourseAgent', () => {
  it('passes checker on first attempt with default deps', async () => {
    const result = await runCrashCourseAgent(makeInput(), {
      maker: async () => makeValidDraft(),
      checker: async () => ({ passed: true, issues: [] }),
    });
    expect(result.attempts).toBe(1);
    expect(result.cards.length).toBe(5);
    expect(result.sora_video_prompt.engine).toBe('sora.ai');
    expect(result.sora_video_prompt.scenes).toHaveLength(5);
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
    await expect(runCrashCourseAgent(makeInput(), {
      maker: async () => ({ cards: [] }),
      checker: async () => ({
        passed: false,
        issues: [{ message: 'still wrong', fix_instruction: 'fix again' }],
      }),
    })).rejects.toBeInstanceOf(AgentValidationError);
  });

  it('returns a maker-provided sora prompt aligned to card structure', async () => {
    const result = await runCrashCourseAgent(makeInput(), {
      maker: async () => makeValidDraft(),
      checker: async () => ({ passed: true, issues: [] }),
    });
    expect(result.cards.map((card) => card.stage)).toEqual([
      'specific_mistake',
      'intuition_analogy',
      'actual_concept',
      'worked_example',
      'practice_question',
    ]);
    expect(result.sora_video_prompt.scenes.map((scene) => scene.stage)).toEqual(
      result.cards.map((card) => card.stage)
    );
  });
});
