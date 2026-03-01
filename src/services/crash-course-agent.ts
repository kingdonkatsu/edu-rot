import type {
  CrashCourseAgentInput,
  CrashCourseAgentOutput,
  CrashCourseCard,
  CrashCourseCardStage,
  AgentCheckerResult,
  AgentCheckerIssue,
} from '../types.js';

// --- Brainrot markers required by the PRD ---
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

const CARD_STAGE_ORDER: CrashCourseCardStage[] = [
  'specific_mistake',
  'intuition_analogy',
  'actual_concept',
  'worked_example',
  'practice_question',
];

// --- Maker ---

export type CrashCourseMaker = (
  input: CrashCourseAgentInput,
  priorIssues: AgentCheckerIssue[]
) => CrashCourseAgentOutput;

export function defaultCrashCourseMaker(
  input: CrashCourseAgentInput,
  priorIssues: AgentCheckerIssue[]
): CrashCourseAgentOutput {
  const { subtopic, error_classification, known_strengths, rag } = input;

  const issueHints = priorIssues.length > 0
    ? ` [Fixing: ${priorIssues.map(i => i.gate).join(', ')}]`
    : '';

  // Extract first terminal sentence only, so multi-sentence RAG strings don't blow card limits.
  // Splits on terminal punctuation followed by whitespace or end of string (same rule as the checker).
  function firstSentence(text: string): string {
    const match = text.match(/^.+?[.!?]+(?=\s|$)/);
    return match ? match[0] : text;
  }

  const conceptText = firstSentence(rag.concept_explanations[0] ?? `${subtopic} works by applying the core rule step by step.`);
  const exampleText = firstSentence(rag.worked_examples[0] ?? `Apply the rule to ${subtopic} step by step and check each line.`);
  const conceptKeyword = conceptText.split(' ').find(w => w.length > 4) ?? subtopic;
  const exampleKeyword = exampleText.split(' ').find(w => w.length > 4) ?? subtopic;
  const misconceptionKeyword = rag.misconception_data[0]?.split(' ').find(w => w.length > 4) ?? error_classification;
  const strengthNote = known_strengths.length > 0
    ? `You already get ${known_strengths[0]}, so`
    : 'You are lowkey closer than you think —';
  const analogy = firstSentence(rag.analogies[0] ?? `think of ${subtopic} like leveling up in a game.`);

  const cards: CrashCourseCard[] = [
    {
      stage: 'specific_mistake',
      title: `No cap — the ${error_classification} glitch`,
      body: `${strengthNote} this is one fix: your ${error_classification} on ${subtopic}. We speedrun past it now.${issueHints}`.slice(0, 280),
    },
    {
      stage: 'intuition_analogy',
      title: 'Intuition unlocked — vibe check',
      body: `Lowkey, ${analogy} Your brain lag on ${subtopic} is just a wrong mental map. No cap.`.slice(0, 280),
    },
    {
      stage: 'actual_concept',
      title: `The actual rule — ${conceptKeyword} edition`,
      body: `Here is the legit concept: ${conceptText} Main character arc unlocked.`.slice(0, 280),
    },
    {
      stage: 'worked_example',
      title: 'Speedrun the example',
      body: `${exampleKeyword} example: ${exampleText} NPC moves avoided.`.slice(0, 280),
    },
    {
      stage: 'practice_question',
      title: 'Vibe check — your turn',
      body: `Your turn: solve ${subtopic} and dodge the ${error_classification} trap (watch for ${misconceptionKeyword}). No cap, main character mode activated.`.slice(0, 280),
    },
  ];

  return { cards, attempts: 1, checker_history: [] };
}

// --- Checker ---

export type CrashCourseChecker = (
  output: CrashCourseAgentOutput,
  input: CrashCourseAgentInput
) => AgentCheckerResult;

export function defaultCrashCourseChecker(
  output: CrashCourseAgentOutput,
  input: CrashCourseAgentInput,
  attempt: number
): AgentCheckerResult {
  const issues: AgentCheckerIssue[] = [];
  const { cards } = output;

  // Gate: card count
  if (cards.length !== 5) {
    issues.push({ gate: 'card-count-exact-5', message: `Expected 5 cards, got ${cards.length}` });
  }

  // Gate: stage order
  for (let i = 0; i < Math.min(cards.length, CARD_STAGE_ORDER.length); i++) {
    if (cards[i].stage !== CARD_STAGE_ORDER[i]) {
      issues.push({
        gate: 'required-stage-order',
        message: `Card ${i + 1} must be stage '${CARD_STAGE_ORDER[i]}', got '${cards[i].stage}'`,
      });
    }
  }

  // Gate: body length and sentence count
  // Sentence splitter: only split on terminal punctuation followed by whitespace or end of string,
  // so embedded dots (method calls, decimals) are not counted as sentence breaks.
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].body.length > 280) {
      issues.push({
        gate: 'one-screen-card-size',
        message: `Card ${i + 1} body exceeds 280 characters (${cards[i].body.length})`,
      });
    }
    const sentences = cards[i].body.split(/[.!?]+(?=\s|$)/).filter(s => s.trim().length > 0);
    if (sentences.length > 3) {
      issues.push({
        gate: 'one-screen-card-size',
        message: `Card ${i + 1} body has ${sentences.length} sentences (max 3)`,
      });
    }
  }

  // Gate: no discouraging language
  for (let i = 0; i < cards.length; i++) {
    if (DISCOURAGING_WORDS.test(cards[i].body) || DISCOURAGING_WORDS.test(cards[i].title)) {
      issues.push({
        gate: 'supportive-tone',
        message: `Card ${i + 1} contains discouraging language`,
      });
    }
  }

  // Gate: no bias
  const allText = cards.map(c => c.title + ' ' + c.body).join(' ');
  for (const pattern of BIAS_PATTERNS) {
    if (pattern.test(allText)) {
      issues.push({ gate: 'no-bias-risk', message: 'Content contains demographic bias pattern' });
      break;
    }
  }

  // Gate: brainrot tone (≥ 2 markers across the deck)
  const deckText = allText.toLowerCase();
  const foundMarkers = BRAINROT_MARKERS.filter(m => deckText.includes(m));
  if (foundMarkers.length < 2) {
    issues.push({
      gate: 'brainrot-tone',
      message: `Only ${foundMarkers.length} brainrot markers found (need ≥ 2): ${BRAINROT_MARKERS.join(', ')}`,
    });
  }

  // Gate: error targeting — card 1 body must contain error_classification
  if (cards.length >= 1 && !cards[0].body.toLowerCase().includes(input.error_classification.toLowerCase())) {
    issues.push({
      gate: 'diagnosed-error-targeting',
      message: `Card 1 body must mention the error classification '${input.error_classification}'`,
    });
  }

  // Gate: RAG grounding — card 3 must share ≥ 1 keyword with concept_explanations
  if (cards.length >= 3 && input.rag.concept_explanations.length > 0) {
    const conceptWords = new Set(
      input.rag.concept_explanations.join(' ').toLowerCase().split(/\W+/).filter(w => w.length > 4)
    );
    const card3Words = cards[2].body.toLowerCase().split(/\W+/);
    const hasOverlap = card3Words.some(w => w.length > 4 && conceptWords.has(w));
    if (!hasOverlap) {
      issues.push({
        gate: 'concept-grounding',
        message: 'Card 3 must share ≥ 1 keyword with rag.concept_explanations',
      });
    }
  }

  // Gate: RAG grounding — card 4 must share ≥ 1 keyword with worked_examples
  if (cards.length >= 4 && input.rag.worked_examples.length > 0) {
    const exampleWords = new Set(
      input.rag.worked_examples.join(' ').toLowerCase().split(/\W+/).filter(w => w.length > 4)
    );
    const card4Words = cards[3].body.toLowerCase().split(/\W+/);
    const hasOverlap = card4Words.some(w => w.length > 4 && exampleWords.has(w));
    if (!hasOverlap) {
      issues.push({
        gate: 'worked-example-grounding',
        message: 'Card 4 must share ≥ 1 keyword with rag.worked_examples',
      });
    }
  }

  // Gate: misconception targeting — card 5 must reference error label or misconception_data keywords
  if (cards.length >= 5) {
    const card5Text = cards[4].body.toLowerCase();
    const hasErrorLabel = card5Text.includes(input.error_classification.toLowerCase());
    const misconceptionWords = new Set(
      input.rag.misconception_data.join(' ').toLowerCase().split(/\W+/).filter(w => w.length > 4)
    );
    const hasMisconceptionKeyword = card5Text.split(/\W+/).some(w => w.length > 4 && misconceptionWords.has(w));
    if (!hasErrorLabel && !hasMisconceptionKeyword) {
      issues.push({
        gate: 'practice-targeting',
        message: 'Card 5 must reference the error label or rag.misconception_data keywords',
      });
    }
  }


  return { passed: issues.length === 0, issues, attempt };
}

// --- Control Loop ---

export interface CrashCourseAgentDeps {
  maker?: CrashCourseMaker;
  checker?: (output: CrashCourseAgentOutput, input: CrashCourseAgentInput, attempt: number) => AgentCheckerResult;
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

    // Accumulate issues (never replace — prevent whack-a-mole regressions)
    for (const issue of checkerResult.issues) {
      const alreadyTracked = accumulatedIssues.some(
        i => i.gate === issue.gate && i.message === issue.message
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

  // Fail-open: return last draft (student sees it; no crash)
  return lastOutput!;
}
