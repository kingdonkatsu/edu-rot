import { describe, it, expect } from 'vitest';
import {
  runCrashCourseAgent,
  defaultCrashCourseMaker,
  defaultCrashCourseChecker,
} from '../../src/services/crash-course-agent.js';
import type { CrashCourseAgentInput, CrashCourseAgentOutput } from '../../src/types.js';

const baseInput: CrashCourseAgentInput = {
  student_id: 'test-student',
  topic: 'Algebra',
  subtopic: 'Quadratic equations',
  error_classification: 'lucky_guess',
  mastery_level: 'novice',
  known_strengths: ['arithmetic'],
  rag: {
    concept_explanations: ['A quadratic equation has the form ax² + bx + c = 0 and is solved with the quadratic formula.'],
    misconception_data: ['Students often apply lucky_guess logic and treat a guessed answer as real mastery.'],
    analogies: ['Think of the quadratic formula like a GPS giving two possible exits.'],
    worked_examples: ['Solve x²-5x+6=0 by factoring: (x-2)(x-3)=0 so x=2 or x=3. Apply quadratic rule.'],
  },
};

describe('defaultCrashCourseMaker', () => {
  it('produces exactly 5 cards', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    expect(output.cards).toHaveLength(5);
  });

  it('cards follow fixed stage order', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const expectedStages = ['specific_mistake', 'intuition_analogy', 'actual_concept', 'worked_example', 'practice_question'];
    output.cards.forEach((card, i) => {
      expect(card.stage).toBe(expectedStages[i]);
    });
  });

  it('each card body is ≤ 280 characters', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    output.cards.forEach(card => {
      expect(card.body.length).toBeLessThanOrEqual(280);
    });
  });

  it('card 1 body contains the error_classification', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    expect(output.cards[0].body.toLowerCase()).toContain('lucky_guess');
  });
});

describe('defaultCrashCourseChecker', () => {
  it('passes a well-formed output', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const result = defaultCrashCourseChecker(output, baseInput, 1);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('fails if card count is wrong', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const badOutput = { ...output, cards: output.cards.slice(0, 3) };
    const result = defaultCrashCourseChecker(badOutput, baseInput, 1);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.gate === 'card-count-exact-5')).toBe(true);
  });

  it('fails if stage order is wrong', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const swapped = [...output.cards];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    const badOutput = { ...output, cards: swapped };
    const result = defaultCrashCourseChecker(badOutput, baseInput, 1);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.gate === 'required-stage-order')).toBe(true);
  });

  it('fails if card body exceeds 280 characters', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const longCards = output.cards.map((c, i) =>
      i === 0 ? { ...c, body: 'x'.repeat(300) } : c
    );
    const badOutput = { ...output, cards: longCards };
    const result = defaultCrashCourseChecker(badOutput, baseInput, 1);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.gate === 'one-screen-card-size')).toBe(true);
  });

  it('fails if discouraging language is present', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const badCards = output.cards.map((c, i) =>
      i === 0 ? { ...c, body: 'You are so stupid for getting this wrong.' } : c
    );
    const badOutput = { ...output, cards: badCards };
    const result = defaultCrashCourseChecker(badOutput, baseInput, 1);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.gate === 'supportive-tone')).toBe(true);
  });

  it('fails if brainrot markers are missing', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const flatCards = output.cards.map(c => ({
      ...c,
      title: 'Plain title',
      body: 'This is a plain educational card without any internet slang.',
    }));
    const badOutput = { ...output, cards: flatCards };
    const result = defaultCrashCourseChecker(badOutput, baseInput, 1);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.gate === 'brainrot-tone')).toBe(true);
  });

  it('fails if card 1 body does not contain error_classification', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const badCards = [...output.cards];
    badCards[0] = { ...badCards[0], body: 'No cap, you did great overall. Vibe check passed.' };
    const badOutput = { ...output, cards: badCards };
    const result = defaultCrashCourseChecker(badOutput, baseInput, 1);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.gate === 'diagnosed-error-targeting')).toBe(true);
  });
});

describe('runCrashCourseAgent control loop', () => {
  it('returns output on first pass when checker passes', async () => {
    const output = await runCrashCourseAgent(baseInput);
    expect(output.cards).toHaveLength(5);
    expect(output.attempts).toBeGreaterThanOrEqual(1);
    expect(output.attempts).toBeLessThanOrEqual(3);
    expect(output.checker_history).toHaveLength(output.attempts);
  });

  it('retries up to 3 times and fails-open when checker always fails', async () => {
    const alwaysFailChecker = (out: CrashCourseAgentOutput, _in: CrashCourseAgentInput, attempt: number) => ({
      passed: false,
      issues: [{ gate: 'test-gate', message: 'forced failure' }],
      attempt,
    });

    const output = await runCrashCourseAgent(baseInput, { checker: alwaysFailChecker });
    // Fail-open: returns last draft
    expect(output).toBeDefined();
    expect(output.attempts).toBe(3);
    expect(output.checker_history).toHaveLength(3);
    expect(output.checker_history.every(r => !r.passed)).toBe(true);
  });

  it('accumulates issues across retries (no whack-a-mole)', async () => {
    let callCount = 0;
    const trackingChecker = (out: CrashCourseAgentOutput, _in: CrashCourseAgentInput, attempt: number) => {
      callCount++;
      return {
        passed: false,
        issues: [{ gate: `gate-${callCount}`, message: `issue ${callCount}` }],
        attempt,
      };
    };

    const capturedIssues: string[] = [];
    const trackingMaker = (input: CrashCourseAgentInput, priorIssues: { gate: string; message: string }[]) => {
      capturedIssues.push(...priorIssues.map(i => i.gate));
      return defaultCrashCourseMaker(input, priorIssues);
    };

    await runCrashCourseAgent(baseInput, { maker: trackingMaker, checker: trackingChecker });

    // By attempt 3, priorIssues should have gates from earlier attempts
    expect(capturedIssues.includes('gate-1')).toBe(true);
    expect(capturedIssues.includes('gate-2')).toBe(true);
  });

  it('stops early when checker passes on retry', async () => {
    let callCount = 0;
    const passOnSecondChecker = (out: CrashCourseAgentOutput, _in: CrashCourseAgentInput, attempt: number) => {
      callCount++;
      return {
        passed: callCount >= 2,
        issues: callCount < 2 ? [{ gate: 'test', message: 'not yet' }] : [],
        attempt,
      };
    };

    const output = await runCrashCourseAgent(baseInput, { checker: passOnSecondChecker });
    expect(output.attempts).toBe(2);
  });

  it('accepts dependency-injected maker', async () => {
    const fixedOutput: CrashCourseAgentOutput = {
      cards: [
        { stage: 'specific_mistake', title: 'T1', body: 'No cap this is the lucky_guess glitch.' },
        { stage: 'intuition_analogy', title: 'T2', body: 'Lowkey think of it like a GPS. Speedrun.' },
        { stage: 'actual_concept', title: 'T3', body: 'The quadratic rule: ax²+bx+c=0. Main character arc.' },
        { stage: 'worked_example', title: 'T4', body: 'Solve x²-5x+6=0 by factoring quadratic. NPC defeated.' },
        { stage: 'practice_question', title: 'T5', body: 'Now try: solve quadratic using lucky_guess pattern fix.' },
      ],
      attempts: 1,
      checker_history: [],
    };

    const mockMaker = () => fixedOutput;
    const output = await runCrashCourseAgent(baseInput, { maker: mockMaker });
    expect(output.checker_history.length).toBeGreaterThan(0);
    expect(output.checker_history[0].passed).toBe(true);
  });
});
