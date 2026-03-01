import type {
  AgentCheckerIssue,
  AgentCheckerResult,
  CrashCourseAgentInput,
  CrashCourseAgentOutput,
  CrashCourseCard,
  CrashCourseMakerOutput,
} from '../types.js';

const MAX_RETRIES = 2;
const MAX_ATTEMPTS = MAX_RETRIES + 1;
const MAX_CARD_BODY_CHARS = 280;
const DISCOURAGING_TERMS = ['stupid', 'idiot', 'lazy', 'hopeless', 'dumb'];
const REQUIRED_STAGES: CrashCourseCard['stage'][] = [
  'specific_mistake',
  'intuition_analogy',
  'actual_concept',
  'worked_example',
  'practice_question',
];

export interface CrashCourseAgentDeps {
  maker?: (
    input: CrashCourseAgentInput,
    fixInstructions: string[]
  ) => Promise<CrashCourseMakerOutput>;
  checker?: (
    input: CrashCourseAgentInput,
    draft: CrashCourseMakerOutput
  ) => Promise<AgentCheckerResult>;
}

export async function runCrashCourseAgent(
  input: CrashCourseAgentInput,
  deps: CrashCourseAgentDeps = {}
): Promise<CrashCourseAgentOutput> {
  const maker = deps.maker ?? defaultCrashCourseMaker;
  const checker = deps.checker ?? defaultCrashCourseChecker;

  let fixInstructions: string[] = [];
  const checkerHistory: AgentCheckerResult[] = [];
  let latestDraft: CrashCourseMakerOutput = { cards: [] };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    latestDraft = await maker(input, fixInstructions);
    const check = await checker(input, latestDraft);
    checkerHistory.push(check);

    if (check.passed) {
      return {
        cards: latestDraft.cards,
        attempts: attempt,
        checker_history: checkerHistory,
      };
    }

    fixInstructions = check.issues.map((issue) => issue.fix_instruction);
  }

  return {
    cards: latestDraft.cards,
    attempts: MAX_ATTEMPTS,
    checker_history: checkerHistory,
  };
}

async function defaultCrashCourseMaker(
  input: CrashCourseAgentInput,
  _fixInstructions: string[]
): Promise<CrashCourseMakerOutput> {
  const errorLabel = normalizeLabel(input.error_classification);
  const strengths = input.known_strengths.length > 0
    ? input.known_strengths.join(', ')
    : 'you already remember the basics';
  const analogy = normalizeSentence(
    input.rag.analogies[0] ?? `think of ${input.subtopic} like building with Lego blocks`
  );
  const concept = normalizeSentence(
    input.rag.concept_explanations[0]
    ?? `${input.subtopic} works by following a repeatable rule step by step`
  );
  const workedExample = input.rag.worked_examples[0]
    ?? `Example: apply the rule in order, check units, then confirm the final answer matches the question.`;
  const misconception = normalizeSentence(
    input.rag.misconception_data[0]
    ?? `${errorLabel} on ${input.subtopic}`
  );

  const cards: CrashCourseCard[] = [
    {
      stage: 'specific_mistake',
      title: 'Where It Went Sideways',
      body: clampToScreen(
        `You got hit by ${errorLabel} on ${input.topic} -> ${input.subtopic}. ` +
        `You still have strengths in ${strengths}, so this is a fixable gap.`
      ),
    },
    {
      stage: 'intuition_analogy',
      title: 'Brainrot Analogy',
      body: clampToScreen(
        `Imagine this: ${analogy}. Same logic, different skin. Keep the same order every time and it clicks.`
      ),
    },
    {
      stage: 'actual_concept',
      title: 'What Is Actually True',
      body: clampToScreen(
        `Core concept: ${concept}. Do not skip the middle step; that is where ${errorLabel} usually appears.`
      ),
    },
    {
      stage: 'worked_example',
      title: 'Worked Example',
      body: clampToScreen(
        `${workedExample} Focus check: name the step that prevents ${errorLabel} before finalizing.`
      ),
    },
    {
      stage: 'practice_question',
      title: 'Your Targeted Practice',
      body: clampToScreen(
        `Practice prompt: Solve one new ${input.subtopic} problem and explicitly avoid ${misconception}. ` +
        `After solving, explain which step blocked the ${errorLabel} mistake.`
      ),
    },
  ];

  return { cards };
}

async function defaultCrashCourseChecker(
  input: CrashCourseAgentInput,
  draft: CrashCourseMakerOutput
): Promise<AgentCheckerResult> {
  const issues: AgentCheckerIssue[] = [];
  const cards = draft.cards;

  if (cards.length < 4 || cards.length > 6) {
    issues.push({
      message: 'Card count must be between 4 and 6.',
      fix_instruction: 'Regenerate with 4-6 cards only.',
    });
  }

  REQUIRED_STAGES.forEach((stage, index) => {
    if (!cards[index] || cards[index].stage !== stage) {
      issues.push({
        message: `Card ${index + 1} must be ${stage}.`,
        fix_instruction: `Set card ${index + 1} stage to ${stage}.`,
        card_index: index,
      });
    }
  });

  cards.forEach((card, index) => {
    if (card.body.length > MAX_CARD_BODY_CHARS) {
      issues.push({
        message: `Card ${index + 1} exceeds one-screen limit.`,
        fix_instruction: `Shorten card ${index + 1} to <= ${MAX_CARD_BODY_CHARS} chars.`,
        card_index: index,
      });
    }

    const lowered = `${card.title} ${card.body}`.toLowerCase();
    const hit = DISCOURAGING_TERMS.find((term) => lowered.includes(term));
    if (hit) {
      issues.push({
        message: `Card ${index + 1} has discouraging tone (${hit}).`,
        fix_instruction: `Rewrite card ${index + 1} with playful but respectful tone.`,
        card_index: index,
      });
    }
  });

  const mistakeCard = cards[0];
  if (mistakeCard) {
    const target = normalizeLabel(input.error_classification);
    if (!mistakeCard.body.toLowerCase().includes(target.toLowerCase())) {
      issues.push({
        message: 'Specific mistake card is not tied to diagnosed error.',
        fix_instruction: 'Name the exact diagnosed error in card 1.',
        card_index: 0,
      });
    }
  }

  const conceptCard = cards.find((card) => card.stage === 'actual_concept');
  if (conceptCard && !hasRAGGrounding(conceptCard.body, input.rag.concept_explanations)) {
    issues.push({
      message: 'Concept card is not grounded in retrieved concept explanation.',
      fix_instruction: 'Ground card 3 in retrieved concept explanation keywords.',
    });
  }

  const practiceCard = cards.find((card) => card.stage === 'practice_question');
  if (!practiceCard) {
    issues.push({
      message: 'Missing practice question card.',
      fix_instruction: 'Add a practice question card targeting the misconception.',
    });
  } else if (!targetsMisconception(practiceCard.body, input)) {
    issues.push({
      message: 'Practice card does not target diagnosed misconception.',
      fix_instruction: 'Make practice prompt explicitly target the diagnosed error pattern.',
    });
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

function clampToScreen(text: string): string {
  if (text.length <= MAX_CARD_BODY_CHARS) {
    return text;
  }
  return `${text.slice(0, MAX_CARD_BODY_CHARS - 3)}...`;
}

function normalizeLabel(value: string): string {
  return value.replaceAll('_', ' ');
}

function normalizeSentence(value: string): string {
  return value.trim().replace(/[.!?]+$/g, '');
}

function hasRAGGrounding(cardText: string, candidates: string[]): boolean {
  if (candidates.length === 0) {
    return true;
  }
  const text = cardText.toLowerCase();
  return candidates.some((candidate) => {
    const keywords = extractKeywords(candidate);
    if (keywords.length === 0) {
      return false;
    }
    return keywords.some((keyword) => text.includes(keyword));
  });
}

function targetsMisconception(cardText: string, input: CrashCourseAgentInput): boolean {
  const text = cardText.toLowerCase();
  const errorLabel = normalizeLabel(input.error_classification).toLowerCase();
  if (text.includes(errorLabel)) {
    return true;
  }

  return input.rag.misconception_data.some((misconception) => {
    const keywords = extractKeywords(misconception);
    return keywords.some((keyword) => text.includes(keyword));
  });
}

function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4);
  return Array.from(new Set(words)).slice(0, 8);
}
