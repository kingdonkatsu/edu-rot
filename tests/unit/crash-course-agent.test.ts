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
    concept_explanations: [
      'A quadratic equation has the form ax squared plus bx plus c equals zero and can be solved using factoring or the quadratic formula.',
    ],
    misconception_data: [
      'Students often keep the lucky_guess pattern and skip verification of both roots.',
    ],
    analogies: [
      'Think of the quadratic formula like a GPS giving two exits from one highway.',
    ],
    worked_examples: [
      'Solve x squared minus five x plus six equals zero by factoring into x minus two and x minus three.',
    ],
  },
};

describe('defaultCrashCourseMaker', () => {
  it('produces exactly 6 sections', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    expect(output.script.sections).toHaveLength(6);
  });

  it('uses required section order', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    expect(output.script.sections.map((section) => section.label)).toEqual([
      'hook',
      'misconception_callout',
      'intuition_bridge',
      'concept_explanation',
      'worked_example',
      'practice_cta',
    ]);
  });

  it('builds coherent full_script and word_count', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const expected = output.script.sections.map((section) => section.text.trim()).join(' ').trim();
    expect(output.script.full_script).toBe(expected);
    expect(output.script.word_count).toBeGreaterThanOrEqual(120);
    expect(output.script.word_count).toBeLessThanOrEqual(180);
  });

  it('misconception_callout mentions error classification', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const section = output.script.sections.find((item) => item.label === 'misconception_callout');
    expect(section?.text.toLowerCase()).toContain('lucky_guess');
  });
});

describe('defaultCrashCourseChecker', () => {
  it('passes a well-formed output', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const result = defaultCrashCourseChecker(output, baseInput, 1);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('fails section-count', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const badOutput: CrashCourseAgentOutput = {
      ...output,
      script: {
        ...output.script,
        sections: output.script.sections.slice(0, 5),
      },
    };
    const result = defaultCrashCourseChecker(badOutput, baseInput, 1);
    expect(result.passed).toBe(false);
    expect(result.issues.some((issue) => issue.gate === 'section-count')).toBe(true);
  });

  it('fails section-order', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const swapped = [...output.script.sections];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    const badOutput: CrashCourseAgentOutput = {
      ...output,
      script: { ...output.script, sections: swapped },
    };
    const result = defaultCrashCourseChecker(badOutput, baseInput, 1);
    expect(result.issues.some((issue) => issue.gate === 'section-order')).toBe(true);
  });

  it('fails word-count-range', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const badOutput: CrashCourseAgentOutput = {
      ...output,
      script: { ...output.script, full_script: 'too short', word_count: 2 },
    };
    const result = defaultCrashCourseChecker(badOutput, baseInput, 1);
    expect(result.issues.some((issue) => issue.gate === 'word-count-range')).toBe(true);
  });

  it('fails section-non-empty', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const sections = output.script.sections.map((section, index) =>
      index === 2 ? { ...section, text: 'too short' } : section
    );
    const badOutput: CrashCourseAgentOutput = {
      ...output,
      script: { ...output.script, sections },
    };
    const result = defaultCrashCourseChecker(badOutput, baseInput, 1);
    expect(result.issues.some((issue) => issue.gate === 'section-non-empty')).toBe(true);
  });

  it('fails supportive-tone', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const sections = output.script.sections.map((section, index) =>
      index === 0 ? { ...section, text: 'you are stupid and this is hopeless' } : section
    );
    const fullScript = sections.map((section) => section.text).join(' ');
    const badOutput: CrashCourseAgentOutput = {
      ...output,
      script: { ...output.script, sections, full_script: fullScript, word_count: fullScript.split(/\s+/).length },
    };
    const result = defaultCrashCourseChecker(badOutput, baseInput, 1);
    expect(result.issues.some((issue) => issue.gate === 'supportive-tone')).toBe(true);
  });

  it('fails no-bias-risk', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const sections = output.script.sections.map((section, index) =>
      index === 0 ? { ...section, text: 'boys are naturally better here' } : section
    );
    const fullScript = sections.map((section) => section.text).join(' ');
    const badOutput: CrashCourseAgentOutput = {
      ...output,
      script: { ...output.script, sections, full_script: fullScript, word_count: fullScript.split(/\s+/).length },
    };
    const result = defaultCrashCourseChecker(badOutput, baseInput, 1);
    expect(result.issues.some((issue) => issue.gate === 'no-bias-risk')).toBe(true);
  });

  it('fails brainrot-tone', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const plainSections = output.script.sections.map((section) => ({
      ...section,
      text: 'This section explains the lesson in plain neutral language for classroom delivery.',
    }));
    const fullScript = plainSections.map((section) => section.text).join(' ');
    const badOutput: CrashCourseAgentOutput = {
      ...output,
      script: { ...output.script, sections: plainSections, full_script: fullScript, word_count: fullScript.split(/\s+/).length },
    };
    const result = defaultCrashCourseChecker(badOutput, baseInput, 1);
    expect(result.issues.some((issue) => issue.gate === 'brainrot-tone')).toBe(true);
  });

  it('fails error-targeting', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const sections = output.script.sections.map((section) =>
      section.label === 'misconception_callout'
        ? { ...section, text: 'This section avoids naming the specific issue by design.' }
        : section
    );
    const fullScript = sections.map((section) => section.text).join(' ');
    const badOutput: CrashCourseAgentOutput = {
      ...output,
      script: { ...output.script, sections, full_script: fullScript, word_count: fullScript.split(/\s+/).length },
    };
    const result = defaultCrashCourseChecker(badOutput, baseInput, 1);
    expect(result.issues.some((issue) => issue.gate === 'error-targeting')).toBe(true);
  });

  it('fails concept-grounding', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const sections = output.script.sections.map((section) =>
      section.label === 'concept_explanation'
        ? { ...section, text: 'Completely unrelated astronomy content with no overlap.' }
        : section
    );
    const fullScript = sections.map((section) => section.text).join(' ');
    const badOutput: CrashCourseAgentOutput = {
      ...output,
      script: { ...output.script, sections, full_script: fullScript, word_count: fullScript.split(/\s+/).length },
    };
    const result = defaultCrashCourseChecker(badOutput, baseInput, 1);
    expect(result.issues.some((issue) => issue.gate === 'concept-grounding')).toBe(true);
  });

  it('fails example-grounding', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const sections = output.script.sections.map((section) =>
      section.label === 'worked_example'
        ? { ...section, text: 'No relation to the provided problem solving steps at all.' }
        : section
    );
    const fullScript = sections.map((section) => section.text).join(' ');
    const badOutput: CrashCourseAgentOutput = {
      ...output,
      script: { ...output.script, sections, full_script: fullScript, word_count: fullScript.split(/\s+/).length },
    };
    const result = defaultCrashCourseChecker(badOutput, baseInput, 1);
    expect(result.issues.some((issue) => issue.gate === 'example-grounding')).toBe(true);
  });

  it('fails practice-targeting', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const sections = output.script.sections.map((section) =>
      section.label === 'practice_cta'
        ? { ...section, text: 'Practice later with no mention of specific misconceptions.' }
        : section
    );
    const fullScript = sections.map((section) => section.text).join(' ');
    const badOutput: CrashCourseAgentOutput = {
      ...output,
      script: { ...output.script, sections, full_script: fullScript, word_count: fullScript.split(/\s+/).length },
    };
    const result = defaultCrashCourseChecker(badOutput, baseInput, 1);
    expect(result.issues.some((issue) => issue.gate === 'practice-targeting')).toBe(true);
  });

  it('fails full-script-coherence', () => {
    const output = defaultCrashCourseMaker(baseInput, []);
    const badOutput: CrashCourseAgentOutput = {
      ...output,
      script: { ...output.script, full_script: 'This does not match sections at all.', word_count: 9 },
    };
    const result = defaultCrashCourseChecker(badOutput, baseInput, 1);
    expect(result.issues.some((issue) => issue.gate === 'full-script-coherence')).toBe(true);
  });
});

describe('runCrashCourseAgent control loop', () => {
  it('returns output when checker passes', async () => {
    const output = await runCrashCourseAgent(baseInput);
    expect(output.script.sections).toHaveLength(6);
    expect(output.attempts).toBeGreaterThanOrEqual(1);
    expect(output.attempts).toBeLessThanOrEqual(3);
    expect(output.checker_history).toHaveLength(output.attempts);
  });

  it('retries up to 3 times and fails open if checker always fails', async () => {
    const alwaysFail = (_out: CrashCourseAgentOutput, _in: CrashCourseAgentInput, attempt: number) => ({
      passed: false,
      issues: [{ gate: 'forced', message: 'forced failure' }],
      attempt,
    });

    const output = await runCrashCourseAgent(baseInput, { checker: alwaysFail });
    expect(output.attempts).toBe(3);
    expect(output.checker_history).toHaveLength(3);
    expect(output.checker_history.every((item) => !item.passed)).toBe(true);
  });

  it('stops early when checker passes on second attempt', async () => {
    let calls = 0;
    const passSecond = (_out: CrashCourseAgentOutput, _in: CrashCourseAgentInput, attempt: number) => {
      calls += 1;
      return {
        passed: calls >= 2,
        issues: calls < 2 ? [{ gate: 'retry', message: 'retry once' }] : [],
        attempt,
      };
    };

    const output = await runCrashCourseAgent(baseInput, { checker: passSecond });
    expect(output.attempts).toBe(2);
  });

  it('passes prior issues back into maker across retries', async () => {
    const captured: string[] = [];
    let calls = 0;

    const checker = (_out: CrashCourseAgentOutput, _in: CrashCourseAgentInput, attempt: number) => {
      calls += 1;
      return {
        passed: false,
        issues: [{ gate: `gate-${calls}`, message: `issue-${calls}` }],
        attempt,
      };
    };

    const maker = (input: CrashCourseAgentInput, priorIssues: { gate: string; message: string }[]) => {
      captured.push(...priorIssues.map((issue) => issue.gate));
      return defaultCrashCourseMaker(input, priorIssues);
    };

    await runCrashCourseAgent(baseInput, { maker, checker });

    expect(captured).toContain('gate-1');
    expect(captured).toContain('gate-2');
  });
});
