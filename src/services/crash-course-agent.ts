import type {
  AgentCheckerIssue,
  AgentCheckerResult,
  CrashCourseAgentInput,
  CrashCourseAgentOutput,
  CrashCourseCard,
  CrashCourseMakerOutput,
  CrashCourseSoraPrompt,
} from '../types.js';
import {
  AgentConfigError,
  callOpenAIJson,
  isOpenAIConfigured,
  loadLocalEnv,
} from './openai-agent-client.js';

const MAX_RETRIES = 2;
const MAX_ATTEMPTS = MAX_RETRIES + 1;
const MAX_CARD_BODY_CHARS = 280;
const MAX_CARD_SENTENCES = 3;
const DISCOURAGING_TERMS = ['stupid', 'idiot', 'lazy', 'hopeless', 'dumb'];
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
const ENGAGEMENT_HOOK_MARKERS = [
  'quick win',
  'level up',
  'streak',
  'checkpoint',
  'boss fight',
  'combo',
];
const BIAS_PATTERNS = [
  /\bboys?\s+are\b/i,
  /\bgirls?\s+are\b/i,
  /\bmen\s+are\b/i,
  /\bwomen\s+are\b/i,
  /\byour\s+race\b/i,
  /\byour\s+religion\b/i,
  /\byour\s+gender\b/i,
  /\byour\s+kind\b/i,
];
const REQUIRED_STAGES: CrashCourseCard['stage'][] = [
  'specific_mistake',
  'intuition_analogy',
  'actual_concept',
  'worked_example',
  'practice_question',
];
const TARGET_CARD_COUNT = REQUIRED_STAGES.length;
const CONFLICTING_LLM_TONE_PATTERNS = [
  /informal/i,
  /unprofessional/i,
  /\bslang\b/i,
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

export class AgentValidationError extends Error {
  readonly checkerHistory: AgentCheckerResult[];

  constructor(message: string, checkerHistory: AgentCheckerResult[]) {
    super(message);
    this.name = 'AgentValidationError';
    this.checkerHistory = checkerHistory;
  }
}

interface CrashCourseMakerRaw {
  cards?: Array<{
    stage?: string;
    title?: string;
    body?: string;
  }>;
  sora_video_prompt?: Partial<CrashCourseSoraPrompt> & {
    scenes?: Array<Partial<CrashCourseSoraPrompt['scenes'][number]>>;
  };
}

interface CrashCourseCheckerRaw {
  passed?: boolean;
  issues?: Array<{
    message?: string;
    fix_instruction?: string;
    card_index?: number;
  }>;
}

export function createOpenAICrashCourseDeps(): CrashCourseAgentDeps {
  loadLocalEnv();
  if (!isOpenAIConfigured()) {
    throw new AgentConfigError('OPENAI_API_KEY is missing for Crash Course OpenAI runtime.');
  }

  return {
    maker: async (input, fixInstructions) => {
      const errorLabel = normalizeLabel(input.error_classification);
      const primaryMisconception = normalizeNonEmptyText(input.rag.misconception_data[0], errorLabel);
      const primaryConcept = normalizeNonEmptyText(input.rag.concept_explanations[0], input.subtopic);
      const primaryAnalogy = normalizeNonEmptyText(input.rag.analogies[0], input.topic);
      const primaryWorked = normalizeNonEmptyText(input.rag.worked_examples[0], input.subtopic);
      const raw = await callOpenAIJson<CrashCourseMakerRaw>({
        system: [
          'You are Crash Course Maker for an EdTech app.',
          'Return strict JSON only.',
          'Output exactly 5 cards in this order:',
          'specific_mistake, intuition_analogy, actual_concept, worked_example, practice_question.',
          'Use playful brainrot tone but stay respectful and non-toxic.',
          'Each card must contain one idea only and remain concise.',
          'Card 1 must name the diagnosed error and misconception explicitly.',
          'Card 2 must anchor to retrieved analogy.',
          'Card 3 must anchor to retrieved concept explanation.',
          'Card 4 must reuse retrieved worked example structure and stay mathematically consistent.',
          'Card 5 must target the exact misconception explicitly.',
          'Card 5 should feel like a quick-win mission that invites immediate action.',
          'sora_video_prompt.scenes must contain exactly 5 scenes, one per card, in identical stage order.',
          'Ground all content in provided input/RAG context only.',
        ].join(' '),
        user: JSON.stringify({
          task: 'Generate crash course cards',
          style: {
            tone: 'brainrot playful and supportive',
            allowed_markers: ['vibe check', 'no cap', 'main character arc', 'glitch'],
            forbidden: ['insults', 'demeaning language', 'demographic stereotypes'],
            retention_goal: 'make the student want to do the next practice step immediately',
          },
          constraints: {
            max_card_body_chars: MAX_CARD_BODY_CHARS,
            one_idea_per_card: true,
            no_hallucinated_facts: true,
            no_bias_or_stereotypes: true,
          },
          must_include: {
            error_label: errorLabel,
            misconception_phrase: primaryMisconception,
            analogy_anchor: primaryAnalogy,
            concept_anchor: primaryConcept,
            worked_example_anchor: primaryWorked,
          },
          fix_instructions: fixInstructions,
          input,
          output_schema: {
            cards: [
              {
                stage: 'specific_mistake',
                title: 'string',
                body: 'string',
              },
            ],
            sora_video_prompt: {
              engine: 'sora.ai',
              tone: 'string',
              audience: 'string',
              output_format: 'vertical_short',
              video_objective: 'string',
              safety_constraints: ['string'],
              scenes: [
                {
                  stage: 'specific_mistake',
                  scene_goal: 'string',
                  on_screen_visual: 'string',
                  narration_prompt: 'string',
                  misconception_target: 'string',
                },
              ],
              final_call_to_action: 'string',
            },
          },
        }),
        temperature: 0.35,
      });
      return sanitizeCrashCourseMakerRaw(raw);
    },
    checker: async (input, draft) => {
      const llmRaw = await callOpenAIJson<CrashCourseCheckerRaw>({
        system: [
          'You are Crash Course Checker for an EdTech app.',
          'Return strict JSON only.',
          'Reject outputs with mistakes, hallucinations, bias, stereotypes, or discouraging tone.',
          'Ensure exact 5-card stage order and misconception targeting.',
          'Respectful playful brainrot phrasing is allowed; do not fail solely for slang if non-toxic.',
          'Do not invent policy constraints not requested by the app.',
        ].join(' '),
        user: JSON.stringify({
          task: 'Validate crash course draft',
          input,
          draft,
          output_schema: {
            passed: true,
            issues: [
              {
                message: 'string',
                fix_instruction: 'string',
                card_index: 0,
              },
            ],
          },
        }),
        temperature: 0.1,
      });

      const llmCheck = sanitizeCrashCourseCheckerRaw(llmRaw);
      const deterministicCheck = await defaultCrashCourseChecker(input, draft);
      return mergeCheckerResults(llmCheck, deterministicCheck);
    },
  };
}

export async function runCrashCourseAgent(
  input: CrashCourseAgentInput,
  deps: CrashCourseAgentDeps = {}
): Promise<CrashCourseAgentOutput> {
  const openAIDeps = (!deps.maker || !deps.checker) ? createOpenAICrashCourseDeps() : null;
  const maker = deps.maker ?? openAIDeps!.maker!;
  const checker = deps.checker ?? openAIDeps!.checker!;

  let fixInstructions: string[] = [];
  const checkerHistory: AgentCheckerResult[] = [];
  let latestDraft: CrashCourseMakerOutput = { cards: [] };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const isFinalOpenAIAttempt = Boolean(openAIDeps) && attempt === MAX_ATTEMPTS;
    const modelDraft = isFinalOpenAIAttempt
      ? buildGuaranteedCrashCourseDraft(input)
      : await maker(input, fixInstructions);
    latestDraft = openAIDeps
      ? hardenCrashCourseDraft(input, modelDraft)
      : modelDraft;
    const check = await checker(input, latestDraft);
    checkerHistory.push(check);

    if (check.passed) {
      return {
        cards: latestDraft.cards,
        sora_video_prompt: latestDraft.sora_video_prompt!,
        attempts: attempt,
        checker_history: checkerHistory,
      };
    }

    fixInstructions = check.issues.map((issue) => issue.fix_instruction);
  }

  throw new AgentValidationError(
    `Crash Course validation failed after ${MAX_ATTEMPTS} attempts`,
    checkerHistory
  );
}

async function defaultCrashCourseChecker(
  input: CrashCourseAgentInput,
  draft: CrashCourseMakerOutput
): Promise<AgentCheckerResult> {
  const issues: AgentCheckerIssue[] = [];
  const cards = draft.cards;

  if (cards.length !== TARGET_CARD_COUNT) {
    issues.push({
      message: `Card count must be exactly ${TARGET_CARD_COUNT}.`,
      fix_instruction: `Regenerate with exactly ${TARGET_CARD_COUNT} cards in required order.`,
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

    if (containsBiasRisk(lowered)) {
      issues.push({
        message: `Card ${index + 1} may contain biased language.`,
        fix_instruction: `Rewrite card ${index + 1} to remove demographic stereotypes or targeting.`,
        card_index: index,
      });
    }

    if (countSentences(card.body) > MAX_CARD_SENTENCES) {
      issues.push({
        message: `Card ${index + 1} includes too many ideas.`,
        fix_instruction: `Keep card ${index + 1} to one idea (${MAX_CARD_SENTENCES} sentences max).`,
        card_index: index,
      });
    }
  });

  if (!hasBrainrotTone(cards)) {
    issues.push({
      message: 'Deck tone is not brainrot enough for target style.',
      fix_instruction: 'Use playful brainrot phrasing (e.g., vibe check, no cap, main character arc) while staying respectful.',
    });
  }
  if (!hasEngagementHooks(cards)) {
    issues.push({
      message: 'Deck lacks motivational hooks for user retention.',
      fix_instruction: 'Add at least one quick-win or level-up style hook, especially in practice card.',
    });
  }

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
    if (!mentionsMisconceptionData(mistakeCard.body, input.rag.misconception_data)) {
      issues.push({
        message: 'Specific mistake card does not mention the diagnosed misconception.',
        fix_instruction: 'Reference the exact misconception in card 1 using retrieved misconception data.',
        card_index: 0,
      });
    }
  }

  const analogyCard = cards.find((card) => card.stage === 'intuition_analogy');
  if (analogyCard && !hasRAGGrounding(analogyCard.body, input.rag.analogies)) {
    issues.push({
      message: 'Intuition card is not grounded in retrieved analogy data.',
      fix_instruction: 'Ground card 2 in retrieved analogy keywords.',
    });
  }

  const conceptCard = cards.find((card) => card.stage === 'actual_concept');
  if (conceptCard && !hasRAGGrounding(conceptCard.body, input.rag.concept_explanations)) {
    issues.push({
      message: 'Concept card is not grounded in retrieved concept explanation.',
      fix_instruction: 'Ground card 3 in retrieved concept explanation keywords.',
    });
  }

  const workedExampleCard = cards.find((card) => card.stage === 'worked_example');
  if (workedExampleCard && !hasRAGGrounding(workedExampleCard.body, input.rag.worked_examples)) {
    issues.push({
      message: 'Worked example is not grounded in retrieved worked examples.',
      fix_instruction: 'Ground card 4 in retrieved worked example keywords; avoid invented examples.',
    });
  }
  if (workedExampleCard && !hasMathematicallyConsistentWorkedExample(workedExampleCard.body)) {
    issues.push({
      message: 'Worked example appears mathematically inconsistent.',
      fix_instruction: 'Ensure the final variable value satisfies the displayed equation in card 4.',
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

  const soraPrompt = draft.sora_video_prompt;
  if (!soraPrompt) {
    issues.push({
      message: 'Missing sora_video_prompt bundle.',
      fix_instruction: 'Provide sora_video_prompt with scenes aligned to all cards.',
    });
  } else {
    if (soraPrompt.engine !== 'sora.ai') {
      issues.push({
        message: 'sora_video_prompt.engine must be sora.ai.',
        fix_instruction: 'Set sora_video_prompt.engine to sora.ai.',
      });
    }
    if (soraPrompt.output_format !== 'vertical_short') {
      issues.push({
        message: 'sora_video_prompt.output_format must be vertical_short.',
        fix_instruction: 'Set sora_video_prompt.output_format to vertical_short.',
      });
    }
    if (!Array.isArray(soraPrompt.scenes) || soraPrompt.scenes.length !== cards.length) {
      issues.push({
        message: 'sora_video_prompt.scenes must match card count.',
        fix_instruction: 'Generate one sora scene per crash course card in the same order.',
      });
    } else {
      soraPrompt.scenes.forEach((scene, index) => {
        const expectedStage = cards[index]?.stage;
        if (scene.stage !== expectedStage) {
          issues.push({
            message: `Sora scene ${index + 1} stage mismatch.`,
            fix_instruction: `Align sora scene ${index + 1} stage to ${expectedStage}.`,
            card_index: index,
          });
        }
        if (!scene.narration_prompt?.trim()) {
          issues.push({
            message: `Sora scene ${index + 1} missing narration prompt.`,
            fix_instruction: `Provide narration_prompt for sora scene ${index + 1}.`,
            card_index: index,
          });
        }
      });
    }
    if (!soraPrompt.final_call_to_action?.trim()) {
      issues.push({
        message: 'sora_video_prompt is missing final_call_to_action.',
        fix_instruction: 'Add a clear final call to action in sora_video_prompt.',
      });
    }
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

function sanitizeCrashCourseMakerRaw(raw: CrashCourseMakerRaw): CrashCourseMakerOutput {
  const cards = sanitizeCards(raw.cards);
  const soraVideoPrompt = sanitizeSoraVideoPrompt(raw.sora_video_prompt);
  return {
    cards,
    sora_video_prompt: soraVideoPrompt,
  };
}

function hardenCrashCourseDraft(
  input: CrashCourseAgentInput,
  draft: CrashCourseMakerOutput
): CrashCourseMakerOutput {
  const fallback = buildGuaranteedCrashCourseDraft(input);
  const sourceCards = Array.isArray(draft.cards) ? draft.cards : [];

  const cards = REQUIRED_STAGES.map((stage, index) => {
    const source = sourceCards.find((card) => card.stage === stage) ?? sourceCards[index];
    const fallbackCard = fallback.cards[index];
    const title = normalizeNonEmptyText(source?.title, fallbackCard.title);
    const bodyCandidate = normalizeNonEmptyText(source?.body, fallbackCard.body);
    const body = clampToScreen(bodyCandidate.length > 0 ? bodyCandidate : fallbackCard.body);
    return { stage, title, body };
  });

  if (!cards[0].body.toLowerCase().includes(normalizeLabel(input.error_classification).toLowerCase())) {
    cards[0].body = fallback.cards[0].body;
  }
  if (!mentionsMisconceptionData(cards[0].body, input.rag.misconception_data)) {
    cards[0].body = fallback.cards[0].body;
  }
  if (!hasRAGGrounding(cards[1].body, input.rag.analogies)) {
    cards[1].body = fallback.cards[1].body;
  }
  if (!hasRAGGrounding(cards[2].body, input.rag.concept_explanations)) {
    cards[2].body = fallback.cards[2].body;
  }
  if (!hasRAGGrounding(cards[3].body, input.rag.worked_examples)) {
    cards[3].body = fallback.cards[3].body;
  }
  if (!hasMathematicallyConsistentWorkedExample(cards[3].body)) {
    cards[3].body = fallback.cards[3].body;
  }
  if (!targetsMisconception(cards[4].body, input)) {
    cards[4].body = fallback.cards[4].body;
  }
  if (!hasEngagementHooks(cards)) {
    cards[4].body = fallback.cards[4].body;
  }
  if (!hasBrainrotTone(cards)) {
    cards[1].body = fallback.cards[1].body;
  }

  const sourcePrompt = draft.sora_video_prompt;
  const soraPrompt: CrashCourseSoraPrompt = {
    ...fallback.sora_video_prompt!,
    tone: normalizeNonEmptyText(sourcePrompt?.tone, fallback.sora_video_prompt!.tone),
    audience: normalizeNonEmptyText(sourcePrompt?.audience, fallback.sora_video_prompt!.audience),
    video_objective: normalizeNonEmptyText(sourcePrompt?.video_objective, fallback.sora_video_prompt!.video_objective),
    safety_constraints: Array.isArray(sourcePrompt?.safety_constraints) && sourcePrompt.safety_constraints.length >= 2
      ? sourcePrompt.safety_constraints.map((item) => normalizeNonEmptyText(item, '')).filter(Boolean)
      : fallback.sora_video_prompt!.safety_constraints,
    final_call_to_action: normalizeNonEmptyText(
      sourcePrompt?.final_call_to_action,
      fallback.sora_video_prompt!.final_call_to_action
    ),
    scenes: REQUIRED_STAGES.map((stage, index) => {
      const fallbackScene = fallback.sora_video_prompt!.scenes[index];
      const sourceScene = sourcePrompt?.scenes?.find((scene) => scene.stage === stage) ?? sourcePrompt?.scenes?.[index];
      return {
        stage,
        scene_goal: normalizeNonEmptyText(sourceScene?.scene_goal, fallbackScene.scene_goal),
        on_screen_visual: normalizeNonEmptyText(sourceScene?.on_screen_visual, fallbackScene.on_screen_visual),
        narration_prompt: clampToScreen(
          normalizeNonEmptyText(sourceScene?.narration_prompt, fallbackScene.narration_prompt)
        ),
        misconception_target: normalizeNonEmptyText(
          sourceScene?.misconception_target,
          fallbackScene.misconception_target
        ),
      };
    }),
  };

  return {
    cards,
    sora_video_prompt: soraPrompt,
  };
}

function buildGuaranteedCrashCourseDraft(input: CrashCourseAgentInput): CrashCourseMakerOutput {
  const errorLabel = normalizeLabel(input.error_classification);
  const conceptLine = normalizeNonEmptyText(
    input.rag.concept_explanations[0],
    `Use the correct ${input.subtopic} rule step by step.`
  );
  const misconceptionLine = normalizeNonEmptyText(
    input.rag.misconception_data[0],
    `the ${errorLabel} pattern`
  );
  const analogyLine = normalizeNonEmptyText(
    input.rag.analogies[0],
    'Treat both sides like a balanced system.'
  );
  const workedExampleLine = normalizeNonEmptyText(
    input.rag.worked_examples[0],
    `Apply the ${input.subtopic} rule in one clean sequence.`
  );
  const strengths = input.known_strengths.length > 0
    ? input.known_strengths.join(', ')
    : 'consistent effort';

  const cards: CrashCourseCard[] = [
    {
      stage: 'specific_mistake',
      title: 'Glitch Detected',
      body: clampToScreen(
        `Vibe check: your exact error is ${errorLabel}. The misconception is ${misconceptionLine}, no cap, and your strength in ${strengths} means this is fixable fast.`
      ),
    },
    {
      stage: 'intuition_analogy',
      title: 'Mental Model Checkpoint',
      body: clampToScreen(
        `Main character arc for intuition: ${analogyLine}. Keep both moves synced each step so the logic does not glitch, and you level up faster.`
      ),
    },
    {
      stage: 'actual_concept',
      title: 'Core Rule Locked',
      body: clampToScreen(
        `Actual rule: ${conceptLine} Keep this one rule locked before you compute.`
      ),
    },
    {
      stage: 'worked_example',
      title: 'Boss Fight Walkthrough',
      body: clampToScreen(
        `Worked example speedrun: ${workedExampleLine} Call out the exact anti-${errorLabel} step before final answer to keep your combo alive.`
      ),
    },
    {
      stage: 'practice_question',
      title: 'Quick Win Mission',
      body: clampToScreen(
        `Quick win mission: solve one new ${input.subtopic} question and avoid ${misconceptionLine}. Then explain your anti-${errorLabel} move and start a 2-question streak.`
      ),
    },
  ];

  const prompt: CrashCourseSoraPrompt = {
    engine: 'sora.ai',
    tone: 'playful brainrot, supportive, clarity-first',
    audience: `student mastering ${input.topic} ${input.subtopic}`,
    output_format: 'vertical_short',
    video_objective: `Fix ${errorLabel} in ${input.subtopic} with one misconception-targeted micro-lesson.`,
    safety_constraints: [
      'No discouraging or insulting language.',
      'No demographic stereotypes or biased framing.',
    ],
    scenes: cards.map((card) => ({
      stage: card.stage,
      scene_goal: `Deliver ${card.stage.replaceAll('_', ' ')} for ${input.subtopic}.`,
      on_screen_visual: `Full-screen card with ${input.topic} cues and highlighted key phrase: ${card.title}.`,
      narration_prompt: card.body,
      misconception_target: misconceptionLine,
    })),
    final_call_to_action: `Now speedrun one fresh ${input.subtopic} question, narrate your anti-${errorLabel} step, and keep the streak going.`,
  };

  return {
    cards,
    sora_video_prompt: prompt,
  };
}

function sanitizeCards(
  cards: CrashCourseMakerRaw['cards']
): CrashCourseCard[] {
  if (!Array.isArray(cards)) {
    return [];
  }

  return cards.slice(0, TARGET_CARD_COUNT).map((card, index) => ({
    stage: normalizeStage(card.stage, REQUIRED_STAGES[index] ?? 'practice_question'),
    title: normalizeNonEmptyText(card.title, ''),
    body: clampToScreen(normalizeNonEmptyText(card.body, '')),
  }));
}

function sanitizeSoraVideoPrompt(
  raw: CrashCourseMakerRaw['sora_video_prompt']
): CrashCourseSoraPrompt {
  const scenesRaw = Array.isArray(raw?.scenes) ? raw.scenes : [];

  return {
    engine: 'sora.ai',
    tone: normalizeNonEmptyText(raw?.tone, ''),
    audience: normalizeNonEmptyText(raw?.audience, ''),
    output_format: 'vertical_short',
    video_objective: normalizeNonEmptyText(raw?.video_objective, ''),
    safety_constraints: Array.isArray(raw?.safety_constraints)
      ? raw.safety_constraints.map((item) => normalizeNonEmptyText(item, '')).filter(Boolean)
      : [],
    scenes: scenesRaw.map((scene, index) => ({
      stage: normalizeStage(
        typeof scene.stage === 'string' ? scene.stage : undefined,
        REQUIRED_STAGES[index] ?? 'practice_question'
      ),
      scene_goal: normalizeNonEmptyText(scene.scene_goal, ''),
      on_screen_visual: normalizeNonEmptyText(scene.on_screen_visual, ''),
      narration_prompt: clampToScreen(normalizeNonEmptyText(scene.narration_prompt, '')),
      misconception_target: normalizeNonEmptyText(scene.misconception_target, ''),
    })),
    final_call_to_action: normalizeNonEmptyText(raw?.final_call_to_action, ''),
  };
}

function sanitizeCrashCourseCheckerRaw(raw: CrashCourseCheckerRaw): AgentCheckerResult {
  const issues = Array.isArray(raw.issues)
    ? raw.issues.map((issue) => ({
      message: normalizeNonEmptyText(issue.message, 'Validation issue'),
      fix_instruction: normalizeNonEmptyText(issue.fix_instruction, 'Regenerate with corrections.'),
      card_index: typeof issue.card_index === 'number' ? issue.card_index : undefined,
    })).filter((issue) => !isConflictingToneIssue(issue))
    : [];

  const passed = Boolean(raw.passed) && issues.length === 0;
  return { passed, issues };
}

function isConflictingToneIssue(issue: AgentCheckerIssue): boolean {
  const text = `${issue.message} ${issue.fix_instruction}`.toLowerCase();
  const isSafetyCritical =
    text.includes('discourag') ||
    text.includes('toxic') ||
    text.includes('bias') ||
    text.includes('stereotype') ||
    text.includes('insult');
  if (isSafetyCritical) {
    return false;
  }
  return CONFLICTING_LLM_TONE_PATTERNS.some((pattern) => pattern.test(text));
}

function mergeCheckerResults(
  first: AgentCheckerResult,
  second: AgentCheckerResult
): AgentCheckerResult {
  const mergedIssues = dedupeIssues([...first.issues, ...second.issues]);
  return {
    passed: first.passed && second.passed && mergedIssues.length === 0,
    issues: mergedIssues,
  };
}

function dedupeIssues(issues: AgentCheckerIssue[]): AgentCheckerIssue[] {
  const seen = new Set<string>();
  const deduped: AgentCheckerIssue[] = [];
  issues.forEach((issue) => {
    const key = `${issue.card_index ?? 'n'}|${issue.message}|${issue.fix_instruction}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    deduped.push(issue);
  });
  return deduped;
}

function normalizeStage(value: string | undefined, fallback: CrashCourseCard['stage']): CrashCourseCard['stage'] {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase() as CrashCourseCard['stage'];
  if (REQUIRED_STAGES.includes(normalized)) {
    return normalized;
  }
  return fallback;
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

function hasRAGGrounding(cardText: string, candidates: string[]): boolean {
  if (candidates.length === 0) {
    return true;
  }
  const text = cardText.toLowerCase();
  const normalizedCard = normalizeForMatch(cardText);
  return candidates.some((candidate) => {
    const keywords = extractKeywords(candidate);
    if (keywords.length === 0) {
      return normalizedCard.includes(normalizeForMatch(candidate));
    }
    return keywords.some((keyword) => text.includes(keyword));
  });
}

function hasBrainrotTone(cards: CrashCourseCard[]): boolean {
  const text = cards.map((card) => `${card.title} ${card.body}`.toLowerCase()).join(' ');
  const markerHits = BRAINROT_MARKERS.filter((marker) => text.includes(marker));
  return markerHits.length >= 2;
}

function hasEngagementHooks(cards: CrashCourseCard[]): boolean {
  const text = cards.map((card) => `${card.title} ${card.body}`.toLowerCase()).join(' ');
  return ENGAGEMENT_HOOK_MARKERS.some((marker) => text.includes(marker));
}

function countSentences(text: string): number {
  const matches = text.match(/[.!?](\s|$)/g);
  return matches ? matches.length : 1;
}

function containsBiasRisk(text: string): boolean {
  return BIAS_PATTERNS.some((pattern) => pattern.test(text));
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

function mentionsMisconceptionData(cardText: string, misconceptionData: string[]): boolean {
  if (misconceptionData.length === 0) {
    return true;
  }
  const text = cardText.toLowerCase();
  const normalized = normalizeForMatch(cardText);
  return misconceptionData.some((misconception) => {
    const keywords = extractKeywords(misconception);
    if (keywords.length === 0) {
      return normalized.includes(normalizeForMatch(misconception));
    }
    return keywords.some((keyword) => text.includes(keyword));
  });
}

function hasMathematicallyConsistentWorkedExample(cardText: string): boolean {
  const equation = parseLinearEquation(cardText);
  if (!equation) {
    return true;
  }

  const solved = extractAssignedValue(cardText, equation.variable);
  if (solved === null) {
    // Only enforce equation check when the card explicitly provides a solved value.
    return true;
  }

  const lhs = equation.coefficient * solved + equation.constant;
  return Math.abs(lhs - equation.rhs) < 1e-6;
}

interface ParsedLinearEquation {
  variable: string;
  coefficient: number;
  constant: number;
  rhs: number;
}

function parseLinearEquation(text: string): ParsedLinearEquation | null {
  const normalized = text
    .replaceAll('−', '-')
    .replaceAll('–', '-')
    .replace(/\s+/g, '');

  const match = normalized.match(/([+-]?\d*\.?\d*)([a-zA-Z])([+-]\d*\.?\d+)?=([+-]?\d*\.?\d+)/);
  if (!match) {
    return null;
  }

  const coefficient = parseCoefficient(match[1]);
  const variable = match[2];
  const constant = match[3] ? Number(match[3]) : 0;
  const rhs = Number(match[4]);

  if (
    coefficient === null ||
    Number.isNaN(constant) ||
    Number.isNaN(rhs)
  ) {
    return null;
  }

  return { variable, coefficient, constant, rhs };
}

function parseCoefficient(raw: string): number | null {
  if (raw === '' || raw === '+') {
    return 1;
  }
  if (raw === '-') {
    return -1;
  }
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function extractAssignedValue(text: string, variable: string): number | null {
  const matcher = new RegExp(`${variable}\\s*=\\s*([+-]?\\d*\\.?\\d+)`, 'gi');
  let matched: RegExpExecArray | null = null;
  let current = matcher.exec(text);
  while (current) {
    matched = current;
    current = matcher.exec(text);
  }
  if (!matched) {
    return null;
  }
  const value = Number(matched[1]);
  return Number.isNaN(value) ? null : value;
}

function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4);
  return Array.from(new Set(words)).slice(0, 8);
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeNonEmptyText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}
