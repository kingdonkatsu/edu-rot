import type {
  CrashCourseAgentInput,
  CrashCourseAgentOutput,
  VoiceoverScript,
  VoiceoverSectionLabel,
  AgentCheckerResult,
  AgentCheckerIssue,
} from '../types.js';

const BRAINROT_MARKERS = [
  'no cap',
  'lowkey',
  'speedrun',
  'npc',
  'main character arc',
  'brain lag',
  'vibe check',
  'glitch',
];

const DISCOURAGING_WORDS = /\b(stupid|idiot|lazy|hopeless|dumb)\b/i;

const BIAS_PATTERNS = [
  /\b(boys?|girls?)\s+(are|were|can't|cannot|shouldn't)\b/i,
  /\b(men|women)\s+(are|were|can't|cannot|shouldn't)\b/i,
  /\basians?\s+(are|were)\b/i,
  /\b(white|black|hispanic|latino|latina)\s+(students?|kids?|people)\b/i,
  /\b(poor|rich)\s+(kids?|students?|people)\s+(are|can't)\b/i,
  /\b(girls?|women)\s+(can't|cannot)\s+(do|understand)\s+(math|science|coding)\b/i,
  /\b(christians?|muslims?|jews?|hindus?)\s+(are|were|can't)\b/i,
  /\b(immigrants?|foreigners?)\s+(are|were|can't)\b/i,
];

const SECTION_ORDER: VoiceoverSectionLabel[] = [
  'hook',
  'misconception_callout',
  'intuition_bridge',
  'concept_explanation',
  'worked_example',
  'practice_cta',
];

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter(Boolean);
}

function firstSentence(text: string): string {
  const match = text.match(/^.+?[.!?]+(?=\s|$)/);
  return (match ? match[0] : text).trim();
}

function keywordSet(values: string[]): Set<string> {
  return new Set(values.join(' ').toLowerCase().split(/\W+/).filter((w) => w.length > 4));
}

function hasKeywordOverlap(text: string, keywords: Set<string>): boolean {
  return tokenize(text).some((w) => w.length > 4 && keywords.has(w));
}

export type CrashCourseMaker = (
  input: CrashCourseAgentInput,
  priorIssues: AgentCheckerIssue[]
) => CrashCourseAgentOutput;

export function defaultCrashCourseMaker(
  input: CrashCourseAgentInput,
  priorIssues: AgentCheckerIssue[]
): CrashCourseAgentOutput {
  const { topic, subtopic, error_classification, known_strengths, rag } = input;

  const strength = known_strengths[0] ?? 'pattern recognition';
  const conceptText = firstSentence(
    rag.concept_explanations[0] ?? `${subtopic} follows one clear rule you can apply in order.`
  );
  const exampleText = firstSentence(
    rag.worked_examples[0] ?? `Walk through ${subtopic} step by step and check each operation.`
  );
  const analogyText = firstSentence(
    rag.analogies[0] ?? `${subtopic} is like following a game map from spawn to objective.`
  );
  const misconceptionWord =
    rag.misconception_data[0]?.split(/\W+/).find((w) => w.length > 4)?.toLowerCase() ??
    error_classification;

  const issueHint =
    priorIssues.length > 0
      ? ` Fixing: ${priorIssues.map((i) => i.gate).join(', ')}.`
      : '';

  const sections = [
    {
      label: 'hook' as const,
      text: `No cap, ${subtopic} can feel messy, so here is a 60-second speedrun to clear the glitch.`,
    },
    {
      label: 'misconception_callout' as const,
      text: `The main issue is ${error_classification}: a brain lag moment where a quick guess feels done. You are strong at ${strength}, so this pattern is fixable.${issueHint}`,
    },
    {
      label: 'intuition_bridge' as const,
      text: `Lowkey use this analogy: ${analogyText} It gives each step a reason instead of random NPC moves.`,
    },
    {
      label: 'concept_explanation' as const,
      text: `Actual concept, grounded and clean: ${conceptText} Main character arc begins when you follow the same rule order every time.`,
    },
    {
      label: 'worked_example' as const,
      text: `Worked example speedrun: ${exampleText} Each line follows the previous line, so your final answer stays traceable.`,
    },
    {
      label: 'practice_cta' as const,
      text: `Your turn: solve one new ${subtopic} problem now, explain each step aloud, dodge ${error_classification}, and catch ${misconceptionWord} early. No cap, repeat twice this week.`,
    },
  ];

  const fullScript = sections.map((s) => s.text.trim()).join(' ').trim();
  const script: VoiceoverScript = {
    title: `${topic}: ${subtopic} in 60 seconds`,
    target_duration_seconds: 60,
    sections,
    full_script: fullScript,
    word_count: wordCount(fullScript),
  };

  return { script, attempts: 1, checker_history: [] };
}

export type CrashCourseChecker = (
  output: CrashCourseAgentOutput,
  input: CrashCourseAgentInput,
  attempt: number
) => AgentCheckerResult;

export function defaultCrashCourseChecker(
  output: CrashCourseAgentOutput,
  input: CrashCourseAgentInput,
  attempt: number
): AgentCheckerResult {
  const issues: AgentCheckerIssue[] = [];
  const { script } = output;
  const sections = script.sections;

  if (sections.length !== 6) {
    issues.push({ gate: 'section-count', message: `Expected 6 sections, got ${sections.length}` });
  }

  for (let i = 0; i < Math.min(sections.length, SECTION_ORDER.length); i++) {
    if (sections[i].label !== SECTION_ORDER[i]) {
      issues.push({
        gate: 'section-order',
        message: `Section ${i + 1} must be '${SECTION_ORDER[i]}', got '${sections[i].label}'`,
      });
    }
  }

  const computedWordCount = wordCount(script.full_script);
  if (computedWordCount < 120 || computedWordCount > 180 || script.word_count !== computedWordCount) {
    issues.push({
      gate: 'word-count-range',
      message: `Word count must be 120-180 and match full_script count (declared=${script.word_count}, computed=${computedWordCount})`,
    });
  }

  const shortSection = sections.find((section) => wordCount(section.text) < 5);
  if (shortSection) {
    issues.push({
      gate: 'section-non-empty',
      message: `Section '${shortSection.label}' must have at least 5 words`,
    });
  }

  const allText = sections.map((s) => s.text).join(' ');
  if (DISCOURAGING_WORDS.test(allText) || DISCOURAGING_WORDS.test(script.title)) {
    issues.push({ gate: 'supportive-tone', message: 'Script contains discouraging language' });
  }

  if (BIAS_PATTERNS.some((pattern) => pattern.test(allText))) {
    issues.push({ gate: 'no-bias-risk', message: 'Script contains demographic bias pattern' });
  }

  const foundMarkers = BRAINROT_MARKERS.filter((marker) => allText.toLowerCase().includes(marker));
  if (foundMarkers.length < 3) {
    issues.push({
      gate: 'brainrot-tone',
      message: `Only ${foundMarkers.length} brainrot markers found; need at least 3`,
    });
  }

  const misconceptionSection = sections.find((section) => section.label === 'misconception_callout');
  if (!misconceptionSection || !misconceptionSection.text.toLowerCase().includes(input.error_classification.toLowerCase())) {
    issues.push({
      gate: 'error-targeting',
      message: `misconception_callout must mention '${input.error_classification}'`,
    });
  }

  const conceptSection = sections.find((section) => section.label === 'concept_explanation');
  if (conceptSection && input.rag.concept_explanations.length > 0) {
    const conceptKeywords = keywordSet(input.rag.concept_explanations);
    if (!hasKeywordOverlap(conceptSection.text, conceptKeywords)) {
      issues.push({
        gate: 'concept-grounding',
        message: 'concept_explanation must share keyword with rag.concept_explanations',
      });
    }
  }

  const exampleSection = sections.find((section) => section.label === 'worked_example');
  if (exampleSection && input.rag.worked_examples.length > 0) {
    const exampleKeywords = keywordSet(input.rag.worked_examples);
    if (!hasKeywordOverlap(exampleSection.text, exampleKeywords)) {
      issues.push({
        gate: 'example-grounding',
        message: 'worked_example must share keyword with rag.worked_examples',
      });
    }
  }

  const practiceSection = sections.find((section) => section.label === 'practice_cta');
  if (practiceSection) {
    const practiceText = practiceSection.text.toLowerCase();
    const misconceptionKeywords = keywordSet(input.rag.misconception_data);
    const hasErrorLabel = practiceText.includes(input.error_classification.toLowerCase());
    const hasMisconceptionKeyword = hasKeywordOverlap(practiceText, misconceptionKeywords);
    if (!hasErrorLabel && !hasMisconceptionKeyword) {
      issues.push({
        gate: 'practice-targeting',
        message: 'practice_cta must reference error label or misconception keywords',
      });
    }
  }

  const joinedSections = sections.map((s) => s.text.trim()).join(' ').trim();
  if (script.full_script.trim() !== joinedSections) {
    issues.push({
      gate: 'full-script-coherence',
      message: 'full_script must equal concatenated section texts',
    });
  }

  return { passed: issues.length === 0, issues, attempt };
}

export interface CrashCourseAgentDeps {
  maker?: CrashCourseMaker;
  checker?: CrashCourseChecker;
}

const MAX_ATTEMPTS = 3;

export async function runCrashCourseAgent(
  input: CrashCourseAgentInput,
  deps?: CrashCourseAgentDeps
): Promise<CrashCourseAgentOutput> {
  const maker = deps?.maker ?? defaultCrashCourseMaker;
  const checker = deps?.checker ?? defaultCrashCourseChecker;

  const accumulatedIssues: AgentCheckerIssue[] = [];
  const checkerHistory: AgentCheckerResult[] = [];
  let lastOutput: CrashCourseAgentOutput | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const draft = maker(input, accumulatedIssues);
    const checkerResult = checker(draft, input, attempt);

    checkerHistory.push(checkerResult);

    for (const issue of checkerResult.issues) {
      const alreadyTracked = accumulatedIssues.some(
        (tracked) => tracked.gate === issue.gate && tracked.message === issue.message
      );
      if (!alreadyTracked) {
        accumulatedIssues.push(issue);
      }
    }

    lastOutput = { ...draft, attempts: attempt, checker_history: checkerHistory };

    if (checkerResult.passed) {
      return lastOutput;
    }
  }

  return lastOutput!;
}
