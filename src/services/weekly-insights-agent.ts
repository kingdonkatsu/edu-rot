import type {
  AgentCheckerIssue,
  AgentCheckerResult,
  WeeklyInsightsAgentOutput,
  WeeklyProblemStatementAnswers,
  WeeklyInsightsRecap,
  WeeklyLearningState,
  WeeklyQuestItem,
  WeeklyTopicTrend,
} from '../types.js';
import {
  AgentConfigError,
  callOpenAIJson,
  isOpenAIConfigured,
  loadLocalEnv,
} from './openai-agent-client.js';

const MAX_RETRIES = 2;
const MAX_ATTEMPTS = MAX_RETRIES + 1;
const DISCOURAGING_TERMS = ['stupid', 'idiot', 'lazy', 'hopeless', 'dumb'];
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

export interface WeeklyInsightsAgentDeps {
  maker?: (
    input: WeeklyLearningState,
    fixInstructions: string[]
  ) => Promise<WeeklyInsightsRecap>;
  checker?: (
    input: WeeklyLearningState,
    recap: WeeklyInsightsRecap
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

interface WeeklyInsightsMakerRaw {
  main_character?: WeeklyInsightsRecap['main_character'];
  flop_era?: WeeklyInsightsRecap['flop_era'];
  ghost_topics?: WeeklyInsightsRecap['ghost_topics'];
  plot_twist?: WeeklyInsightsRecap['plot_twist'];
  weekly_quest?: WeeklyInsightsRecap['weekly_quest'];
  problem_statement_answers?: WeeklyInsightsRecap['problem_statement_answers'];
}

interface WeeklyInsightsCheckerRaw {
  passed?: boolean;
  issues?: Array<{
    message?: string;
    fix_instruction?: string;
    card_index?: number;
  }>;
}

export function createOpenAIWeeklyInsightsDeps(): WeeklyInsightsAgentDeps {
  loadLocalEnv();
  if (!isOpenAIConfigured()) {
    throw new AgentConfigError('OPENAI_API_KEY is missing for Weekly Insights OpenAI runtime.');
  }

  return {
    maker: async (input, fixInstructions) => {
      const topImproved = pickTopImprovedTopic(input.improved_topics);
      const topDeclined = pickTopDeclinedTopic(input.declined_topics);
      const topPattern = pickTopErrorPattern(input.recurring_error_patterns);
      const questCount = expectedQuestCount(input.previous_week_quest_completion_rate);
      const plotTwistTarget = buildGuaranteedPlotTwist(input);
      const raw = await callOpenAIJson<WeeklyInsightsMakerRaw>({
        system: [
          'You are Weekly Insights Maker for an EdTech app.',
          'Return strict JSON only.',
          'Produce recap with exactly these sections: main_character, flop_era, ghost_topics, plot_twist, weekly_quest.',
          'Keep playful tone but respectful and non-biased.',
          'Do not invent metrics or unsupported claims.',
          'Use exact source numbers for mastery_delta, attempts, accuracy_rate, and metric_value.',
          'Main Character must map to top improved topic.',
          'Flop Era must map to most declined topic and top recurring error pattern when provided.',
          'Weekly Quest must contain exactly the calibrated count for this week and each action must be concrete/time-bound.',
          'Use engaging but respectful language that motivates continued study next week.',
          'Include problem_statement_answers with all five fields to explicitly answer weak-vs-careless, trend, time-priority, repeated struggle, and adaptation.',
        ].join(' '),
        user: JSON.stringify({
          task: 'Generate weekly insights recap',
          constraints: {
            no_hallucinated_numbers: true,
            weekly_quest_count_range: [1, 3],
            actionable_recommendations_only: true,
            no_bias_or_stereotypes: true,
            no_internal_contradictions: true,
            retention_focused: true,
            must_answer_problem_statement_questions: true,
          },
          required_targets: {
            main_character_topic: topImproved?.topic ?? 'No clear winner this week',
            main_character_mastery_delta: topImproved?.mastery_delta ?? 0,
            main_character_attempts: topImproved?.attempts ?? 0,
            flop_era_topic: topDeclined?.topic ?? 'No major decline tracked',
            flop_era_accuracy_rate: topDeclined?.accuracy_rate ?? 0,
            flop_era_error_pattern: topPattern ?? 'none-detected',
            ghost_topics: input.untouched_topics,
            plot_twist_metric_label: plotTwistTarget.metric_label,
            plot_twist_metric_value: plotTwistTarget.metric_value,
            weekly_quest_required_count: questCount,
          },
          fix_instructions: fixInstructions,
          input,
          output_schema: {
            main_character: {
              topic: 'string',
              mastery_delta: 0.0,
              attempts: 0,
              narrative: 'string',
            },
            flop_era: {
              topic: 'string',
              error_pattern: 'string',
              accuracy_rate: 0.0,
              narrative: 'string',
            },
            ghost_topics: [
              { topic: 'string', estimated_decay: 0.0 },
            ],
            plot_twist: {
              insight: 'string',
              metric_label: 'string',
              metric_value: 0.0,
            },
            weekly_quest: [
              { action: 'string', rationale: 'string' },
            ],
            problem_statement_answers: {
              weak_vs_careless: 'string',
              trend_over_time: 'string',
              limited_time_focus: 'string',
              repeated_struggle_reason: 'string',
              adaptation_note: 'string',
            },
          },
        }),
        temperature: 0.25,
      });

      return sanitizeWeeklyInsightsMakerRaw(raw);
    },
    checker: async (input, recap) => {
      const llmRaw = await callOpenAIJson<WeeklyInsightsCheckerRaw>({
        system: [
          'You are Weekly Insights Checker for an EdTech app.',
          'Return strict JSON only.',
          'Reject hallucinated metrics, contradictions, non-actionable quests, bias, or discouraging tone.',
          'Allow playful style, but keep recommendations concrete and data-faithful.',
        ].join(' '),
        user: JSON.stringify({
          task: 'Validate weekly insights recap',
          input,
          recap,
          output_schema: {
            passed: true,
            issues: [
              {
                message: 'string',
                fix_instruction: 'string',
              },
            ],
          },
        }),
        temperature: 0.1,
      });

      const llmCheck = sanitizeWeeklyInsightsCheckerRaw(llmRaw);
      const deterministicCheck = await defaultWeeklyInsightsChecker(input, recap);
      return mergeCheckerResults(llmCheck, deterministicCheck);
    },
  };
}

export async function runWeeklyInsightsAgent(
  input: WeeklyLearningState,
  deps: WeeklyInsightsAgentDeps = {}
): Promise<WeeklyInsightsAgentOutput> {
  const openAIDeps = (!deps.maker || !deps.checker) ? createOpenAIWeeklyInsightsDeps() : null;
  const maker = deps.maker ?? openAIDeps!.maker!;
  const checker = deps.checker ?? openAIDeps!.checker!;

  let fixInstructions: string[] = [];
  const checkerHistory: AgentCheckerResult[] = [];
  let latestRecap: WeeklyInsightsRecap = emptyRecap();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const isFinalOpenAIAttempt = Boolean(openAIDeps) && attempt === MAX_ATTEMPTS;
    const modelRecap = isFinalOpenAIAttempt
      ? buildGuaranteedWeeklyRecap(input)
      : await maker(input, fixInstructions);
    latestRecap = openAIDeps
      ? hardenWeeklyRecap(input, modelRecap)
      : modelRecap;
    const check = await checker(input, latestRecap);
    checkerHistory.push(check);

    if (check.passed) {
      return {
        recap: latestRecap,
        attempts: attempt,
        checker_history: checkerHistory,
      };
    }

    fixInstructions = check.issues.map((issue) => issue.fix_instruction);
  }

  throw new AgentValidationError(
    `Weekly Insights validation failed after ${MAX_ATTEMPTS} attempts`,
    checkerHistory
  );
}

async function defaultWeeklyInsightsChecker(
  input: WeeklyLearningState,
  recap: WeeklyInsightsRecap
): Promise<AgentCheckerResult> {
  const issues: AgentCheckerIssue[] = [];

  const expectedMain = pickTopImprovedTopic(input.improved_topics);
  if (expectedMain) {
    if (recap.main_character.topic !== expectedMain.topic) {
      issues.push({
        message: 'Main Character topic does not match strongest improved topic.',
        fix_instruction: 'Set Main Character to the top improved topic by mastery_delta.',
      });
    }
    if (roundMetric(recap.main_character.mastery_delta) !== roundMetric(expectedMain.mastery_delta)) {
      issues.push({
        message: 'Main Character mastery delta does not match data.',
        fix_instruction: 'Use exact mastery_delta from weekly input for Main Character.',
      });
    }
    if (recap.main_character.attempts !== expectedMain.attempts) {
      issues.push({
        message: 'Main Character attempts value does not match data.',
        fix_instruction: 'Use exact attempts count for Main Character topic.',
      });
    }
  }

  const expectedFlop = pickTopDeclinedTopic(input.declined_topics);
  if (expectedFlop) {
    if (recap.flop_era.topic !== expectedFlop.topic) {
      issues.push({
        message: 'Flop Era topic does not match strongest declined topic.',
        fix_instruction: 'Set Flop Era topic to the most declined topic by mastery_delta.',
      });
    }
    if (roundMetric(recap.flop_era.accuracy_rate) !== roundMetric(expectedFlop.accuracy_rate)) {
      issues.push({
        message: 'Flop Era accuracy does not match source data.',
        fix_instruction: 'Use exact accuracy_rate from weekly input for Flop Era.',
      });
    }
  }

  if (!isNarrativeMetricsConsistent(recap, input, expectedMain, expectedFlop)) {
    issues.push({
      message: 'Narrative contains inconsistent percentage/metric references.',
      fix_instruction: 'Align all narrative percentages to exact source metrics (main, flop, and plot twist).',
    });
  }

  const validPatterns = new Set(input.recurring_error_patterns.map((pattern) => String(pattern.pattern)));
  if (recap.flop_era.error_pattern !== 'none-detected' && !validPatterns.has(recap.flop_era.error_pattern)) {
    issues.push({
      message: 'Flop Era error pattern not found in recurring error data.',
      fix_instruction: 'Use an error pattern from recurring_error_patterns for Flop Era.',
    });
  }
  const topPattern = pickTopErrorPattern(input.recurring_error_patterns);
  if (topPattern && recap.flop_era.error_pattern !== topPattern) {
    issues.push({
      message: 'Flop Era error pattern does not match the most frequent recurring pattern.',
      fix_instruction: `Use ${topPattern} as Flop Era error_pattern when recurring_error_patterns are provided.`,
    });
  }

  recap.ghost_topics.forEach((ghost, index) => {
    const source = input.untouched_topics.find((topic) => topic.topic === ghost.topic);
    if (!source) {
      issues.push({
        message: `Ghost topic ${ghost.topic} is not in untouched topics.`,
        fix_instruction: `Replace ghost topic ${index + 1} with an untouched topic from source data.`,
      });
      return;
    }
    if (roundMetric(ghost.estimated_decay) !== roundMetric(source.estimated_decay)) {
      issues.push({
        message: `Ghost topic ${ghost.topic} decay estimate mismatch.`,
        fix_instruction: `Use exact estimated_decay for ${ghost.topic}.`,
      });
    }
  });

  if (recap.weekly_quest.length < 1 || recap.weekly_quest.length > 3) {
    issues.push({
      message: 'Weekly Quest must include 1-3 action items.',
      fix_instruction: 'Regenerate Weekly Quest with 1-3 actions.',
    });
  }

  const expectedQuestItems = expectedQuestCount(input.previous_week_quest_completion_rate);
  if (recap.weekly_quest.length !== expectedQuestItems) {
    issues.push({
      message: 'Weekly Quest difficulty is not calibrated to completion rate.',
      fix_instruction: `Set Weekly Quest to ${expectedQuestItems} action items based on prior completion.`,
    });
  }

  recap.weekly_quest.forEach((item, index) => {
    if (!isActionable(item)) {
      issues.push({
        message: `Weekly Quest item ${index + 1} is not actionable.`,
        fix_instruction: `Rewrite Weekly Quest item ${index + 1} as a concrete weekly action.`,
      });
    }
  });

  if (!questsTargetRelevantTopics(recap.weekly_quest, recap.flop_era.topic, recap.ghost_topics.map((topic) => topic.topic))) {
    issues.push({
      message: 'Weekly Quest actions are not aligned with struggling/untouched topics.',
      fix_instruction: 'Keep quest actions tied to Flop Era or Ghost Topics, unless using generic daily review sprint.',
    });
  }

  if (recap.main_character.topic === recap.flop_era.topic && recap.main_character.topic !== 'No clear winner this week') {
    issues.push({
      message: 'Main Character and Flop Era topics should not contradict each other.',
      fix_instruction: 'Use different topics for Main Character and Flop Era sections.',
    });
  }

  if (!containsBehaviorMetric(recap.plot_twist, input)) {
    issues.push({
      message: 'Plot Twist does not align to behavior data.',
      fix_instruction: 'Ground Plot Twist in behavior_windows or session metrics from the weekly input.',
    });
  }

  const toneBlocks = [
    recap.main_character.narrative,
    recap.flop_era.narrative,
    recap.plot_twist.insight,
    recap.problem_statement_answers?.weak_vs_careless ?? '',
    recap.problem_statement_answers?.trend_over_time ?? '',
    recap.problem_statement_answers?.limited_time_focus ?? '',
    recap.problem_statement_answers?.repeated_struggle_reason ?? '',
    recap.problem_statement_answers?.adaptation_note ?? '',
    ...recap.weekly_quest.map((item) => `${item.action} ${item.rationale}`),
  ];
  const discouraging = toneBlocks.some((block) => containsDiscouragingTone(block));
  if (discouraging) {
    issues.push({
      message: 'Tone crossed into discouraging language.',
      fix_instruction: 'Use playful, supportive language and remove discouraging words.',
    });
  }

  const biasRisk = toneBlocks.some((block) => containsBiasRisk(block));
  if (biasRisk) {
    issues.push({
      message: 'Tone may contain biased or demographic-targeting language.',
      fix_instruction: 'Remove demographic stereotypes and keep language identity-neutral.',
    });
  }

  if (!hasProblemStatementAnswers(recap)) {
    issues.push({
      message: 'Missing problem_statement_answers block.',
      fix_instruction: 'Add all five problem_statement_answers fields with clear, grounded explanations.',
    });
  } else {
    if (!isWeakVsCarelessGrounded(recap.problem_statement_answers!, input)) {
      issues.push({
        message: 'weak_vs_careless answer is not grounded in recurring error patterns.',
        fix_instruction: 'Ground weak_vs_careless in recurring_error_patterns and current weak topics.',
      });
    }
    if (!isTrendGrounded(recap.problem_statement_answers!, input)) {
      issues.push({
        message: 'trend_over_time answer is not grounded in improved/declined trajectories.',
        fix_instruction: 'Reference improved/declined topics and mastery deltas in trend_over_time.',
      });
    }
    if (!isLimitedTimeFocusGrounded(recap.problem_statement_answers!, recap)) {
      issues.push({
        message: 'limited_time_focus answer is not aligned to recommended quest focus.',
        fix_instruction: 'Make limited_time_focus explicitly match quest topics and weekly scope.',
      });
    }
    if (!isRepeatedStruggleGrounded(recap.problem_statement_answers!, input)) {
      issues.push({
        message: 'repeated_struggle_reason answer is not grounded in recurring patterns.',
        fix_instruction: 'Reference top recurring error pattern and where it appears.',
      });
    }
    if (!isAdaptationGrounded(recap.problem_statement_answers!, input)) {
      issues.push({
        message: 'adaptation_note answer is not grounded in inactivity/intensity signals.',
        fix_instruction: 'Reference days_active, sessions_count, behavior windows, or decay to explain adaptation.',
      });
    }
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

function sanitizeWeeklyInsightsMakerRaw(raw: WeeklyInsightsMakerRaw): WeeklyInsightsRecap {
  return {
    main_character: {
      topic: normalizeNonEmptyText(raw.main_character?.topic, ''),
      mastery_delta: normalizeNumber(raw.main_character?.mastery_delta, 0),
      attempts: normalizeNumber(raw.main_character?.attempts, 0),
      narrative: normalizeNonEmptyText(raw.main_character?.narrative, ''),
    },
    flop_era: {
      topic: normalizeNonEmptyText(raw.flop_era?.topic, ''),
      error_pattern: normalizeNonEmptyText(raw.flop_era?.error_pattern, ''),
      accuracy_rate: normalizeNumber(raw.flop_era?.accuracy_rate, 0),
      narrative: normalizeNonEmptyText(raw.flop_era?.narrative, ''),
    },
    ghost_topics: Array.isArray(raw.ghost_topics)
      ? raw.ghost_topics.map((item) => ({
        topic: normalizeNonEmptyText(item.topic, ''),
        estimated_decay: normalizeNumber(item.estimated_decay, 0),
      }))
      : [],
    plot_twist: {
      insight: normalizeNonEmptyText(raw.plot_twist?.insight, ''),
      metric_label: normalizeNonEmptyText(raw.plot_twist?.metric_label, ''),
      metric_value: normalizeNumber(raw.plot_twist?.metric_value, 0),
    },
    weekly_quest: Array.isArray(raw.weekly_quest)
      ? raw.weekly_quest.map((item) => ({
        action: normalizeNonEmptyText(item.action, ''),
        rationale: normalizeNonEmptyText(item.rationale, ''),
      }))
      : [],
    problem_statement_answers: sanitizeProblemStatementAnswers(raw.problem_statement_answers),
  };
}

function sanitizeWeeklyInsightsCheckerRaw(raw: WeeklyInsightsCheckerRaw): AgentCheckerResult {
  const issues = Array.isArray(raw.issues)
    ? raw.issues.map((issue) => ({
      message: normalizeNonEmptyText(issue.message, 'Validation issue'),
      fix_instruction: normalizeNonEmptyText(issue.fix_instruction, 'Regenerate with corrections.'),
      card_index: typeof issue.card_index === 'number' ? issue.card_index : undefined,
    }))
    : [];

  const passed = Boolean(raw.passed) && issues.length === 0;
  return { passed, issues };
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

function pickTopImprovedTopic(topics: WeeklyTopicTrend[]): WeeklyTopicTrend | null {
  if (topics.length === 0) {
    return null;
  }
  return [...topics].sort((a, b) => b.mastery_delta - a.mastery_delta)[0];
}

function pickTopDeclinedTopic(topics: WeeklyTopicTrend[]): WeeklyTopicTrend | null {
  if (topics.length === 0) {
    return null;
  }
  return [...topics].sort((a, b) => a.mastery_delta - b.mastery_delta)[0];
}

function expectedQuestCount(previousCompletionRate: number): number {
  if (previousCompletionRate < 0.4) return 1;
  if (previousCompletionRate < 0.75) return 2;
  return 3;
}

function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function roundMetric(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function isActionable(item: WeeklyQuestItem): boolean {
  const action = item.action.trim();
  const rationale = item.rationale.trim();
  if (!action || !rationale) {
    return false;
  }
  const hasNumber = /\d/.test(action);
  const hasTimeBound = /\b(day|days|week|weeks|daily|session|sessions|minute|minutes)\b/i.test(action);
  return hasNumber || hasTimeBound;
}

function containsBehaviorMetric(
  plotTwist: WeeklyInsightsRecap['plot_twist'],
  input: WeeklyLearningState
): boolean {
  if (plotTwist.metric_label === 'sessions_count') {
    return roundMetric(plotTwist.metric_value) === roundMetric(input.sessions_count);
  }

  if (plotTwist.metric_label === 'accuracy_diff_best_vs_worst_window' && input.behavior_windows.length >= 2) {
    const sorted = [...input.behavior_windows].sort((a, b) => b.accuracy_rate - a.accuracy_rate);
    const expected = Math.max(0, sorted[0].accuracy_rate - sorted[sorted.length - 1].accuracy_rate);
    return roundMetric(plotTwist.metric_value) === roundMetric(expected);
  }

  return false;
}

function containsDiscouragingTone(text: string): boolean {
  const lowered = text.toLowerCase();
  return DISCOURAGING_TERMS.some((term) => lowered.includes(term));
}

function containsBiasRisk(text: string): boolean {
  return BIAS_PATTERNS.some((pattern) => pattern.test(text));
}

function isNarrativeMetricsConsistent(
  recap: WeeklyInsightsRecap,
  input: WeeklyLearningState,
  expectedMain: WeeklyTopicTrend | null,
  expectedFlop: WeeklyTopicTrend | null
): boolean {
  if (expectedMain) {
    const expectedMainPercent = toPercent(expectedMain.mastery_delta);
    if (!recap.main_character.narrative.includes(expectedMainPercent)) {
      return false;
    }
  }

  if (expectedFlop) {
    const expectedFlopAccuracy = toPercent(expectedFlop.accuracy_rate);
    if (!recap.flop_era.narrative.includes(expectedFlopAccuracy)) {
      return false;
    }
  }

  if (input.behavior_windows.length >= 2) {
    const sorted = [...input.behavior_windows].sort((a, b) => b.accuracy_rate - a.accuracy_rate);
    const expectedDiff = toPercent(Math.max(0, sorted[0].accuracy_rate - sorted[sorted.length - 1].accuracy_rate));
    if (!recap.plot_twist.insight.includes(expectedDiff)) {
      return false;
    }
  } else {
    const expectedSessions = String(input.sessions_count);
    if (!recap.plot_twist.insight.includes(expectedSessions)) {
      return false;
    }
  }

  return true;
}

function questsTargetRelevantTopics(
  questItems: WeeklyQuestItem[],
  flopTopic: string,
  ghostTopics: string[]
): boolean {
  const allowedTopics = new Set([flopTopic, ...ghostTopics].filter((topic) => Boolean(topic)));
  return questItems.every((item) => {
    const action = item.action.toLowerCase();
    const hasAllowedTopic = Array.from(allowedTopics).some((topic) => action.includes(topic.toLowerCase()));
    const genericSprint =
      action.includes('review sprint') ||
      action.includes('daily') ||
      action.includes('weak concept');
    return hasAllowedTopic || genericSprint;
  });
}

function emptyRecap(): WeeklyInsightsRecap {
  return {
    main_character: {
      topic: '',
      mastery_delta: 0,
      attempts: 0,
      narrative: '',
    },
    flop_era: {
      topic: '',
      error_pattern: '',
      accuracy_rate: 0,
      narrative: '',
    },
    ghost_topics: [],
    plot_twist: {
      insight: '',
      metric_label: '',
      metric_value: 0,
    },
    weekly_quest: [],
  };
}

function hardenWeeklyRecap(
  input: WeeklyLearningState,
  recap: WeeklyInsightsRecap
): WeeklyInsightsRecap {
  const fallback = buildGuaranteedWeeklyRecap(input);
  const expectedQuestItems = expectedQuestCount(input.previous_week_quest_completion_rate);
  const sourceQuest = Array.isArray(recap.weekly_quest) ? recap.weekly_quest : [];
  const sourceGhost = Array.isArray(recap.ghost_topics) ? recap.ghost_topics : [];

  const ghostTopics = input.untouched_topics.map((topic) => ({
    topic: topic.topic,
    estimated_decay: topic.estimated_decay,
  }));

  const weeklyQuest = Array.from({ length: expectedQuestItems }).map((_, index) => {
    const fallbackQuest = fallback.weekly_quest[index];
    const source = sourceQuest[index];
    return {
      action: normalizeNonEmptyText(source?.action, fallbackQuest.action),
      rationale: normalizeNonEmptyText(source?.rationale, fallbackQuest.rationale),
    };
  });

  const hardened: WeeklyInsightsRecap = {
    main_character: {
      topic: fallback.main_character.topic,
      mastery_delta: fallback.main_character.mastery_delta,
      attempts: fallback.main_character.attempts,
      narrative: normalizeNonEmptyText(recap.main_character?.narrative, fallback.main_character.narrative),
    },
    flop_era: {
      topic: fallback.flop_era.topic,
      error_pattern: fallback.flop_era.error_pattern,
      accuracy_rate: fallback.flop_era.accuracy_rate,
      narrative: normalizeNonEmptyText(recap.flop_era?.narrative, fallback.flop_era.narrative),
    },
    ghost_topics: ghostTopics.length > 0
      ? ghostTopics
      : sourceGhost.map((item) => ({
        topic: normalizeNonEmptyText(item.topic, ''),
        estimated_decay: normalizeNumber(item.estimated_decay, 0),
      })),
    plot_twist: {
      metric_label: fallback.plot_twist.metric_label,
      metric_value: fallback.plot_twist.metric_value,
      insight: normalizeNonEmptyText(recap.plot_twist?.insight, fallback.plot_twist.insight),
    },
    weekly_quest: weeklyQuest,
    problem_statement_answers: {
      ...fallback.problem_statement_answers!,
      weak_vs_careless: normalizeNonEmptyText(
        recap.problem_statement_answers?.weak_vs_careless,
        fallback.problem_statement_answers!.weak_vs_careless
      ),
      trend_over_time: normalizeNonEmptyText(
        recap.problem_statement_answers?.trend_over_time,
        fallback.problem_statement_answers!.trend_over_time
      ),
      limited_time_focus: normalizeNonEmptyText(
        recap.problem_statement_answers?.limited_time_focus,
        fallback.problem_statement_answers!.limited_time_focus
      ),
      repeated_struggle_reason: normalizeNonEmptyText(
        recap.problem_statement_answers?.repeated_struggle_reason,
        fallback.problem_statement_answers!.repeated_struggle_reason
      ),
      adaptation_note: normalizeNonEmptyText(
        recap.problem_statement_answers?.adaptation_note,
        fallback.problem_statement_answers!.adaptation_note
      ),
    },
  };

  const deterministicCheck = buildDeterministicValidationReport(input, hardened);
  if (!deterministicCheck.passed) {
    return fallback;
  }
  return hardened;
}

function buildGuaranteedWeeklyRecap(input: WeeklyLearningState): WeeklyInsightsRecap {
  const topImproved = pickTopImprovedTopic(input.improved_topics);
  const topDeclined = pickTopDeclinedTopic(input.declined_topics);
  const topPattern = pickTopErrorPattern(input.recurring_error_patterns);
  const questCount = expectedQuestCount(input.previous_week_quest_completion_rate);
  const ghostTopics = input.untouched_topics.map((topic) => ({
    topic: topic.topic,
    estimated_decay: topic.estimated_decay,
  }));

  const mainCharacter = topImproved
    ? {
      topic: topImproved.topic,
      mastery_delta: topImproved.mastery_delta,
      attempts: topImproved.attempts,
      narrative: `Main Character arc: ${topImproved.topic} gained ${toPercent(topImproved.mastery_delta)} mastery across ${topImproved.attempts} attempts, no cap. Keep this momentum for next week.`,
    }
    : {
      topic: 'No clear winner this week',
      mastery_delta: 0,
      attempts: 0,
      narrative: 'Main Character arc: No clear winner this week, so we keep momentum with steady reps and build a comeback streak.',
    };

  const flopEra = topDeclined
    ? {
      topic: topDeclined.topic,
      error_pattern: topPattern ?? 'none-detected',
      accuracy_rate: topDeclined.accuracy_rate,
      narrative: `Flop Era alert: ${topDeclined.topic} sat at ${toPercent(topDeclined.accuracy_rate)} accuracy, mostly from ${topPattern ?? 'none-detected'} glitches. This is your next level-up target.`,
    }
    : {
      topic: 'No major decline tracked',
      error_pattern: 'none-detected',
      accuracy_rate: 0,
      narrative: 'Flop Era alert: No major decline tracked, so we focus on prevention and consistency to protect your streak.',
    };

  const plotTwist = buildGuaranteedPlotTwist(input);
  const weeklyQuest = buildGuaranteedWeeklyQuest(
    flopEra.topic,
    ghostTopics.map((topic) => topic.topic),
    questCount
  );
  const problemAnswers = buildProblemStatementAnswers(input, flopEra.topic, ghostTopics.map((topic) => topic.topic));

  return {
    main_character: mainCharacter,
    flop_era: flopEra,
    ghost_topics: ghostTopics,
    plot_twist: plotTwist,
    weekly_quest: weeklyQuest,
    problem_statement_answers: problemAnswers,
  };
}

function buildGuaranteedPlotTwist(input: WeeklyLearningState): WeeklyInsightsRecap['plot_twist'] {
  if (input.behavior_windows.length >= 2) {
    const sorted = [...input.behavior_windows].sort((a, b) => b.accuracy_rate - a.accuracy_rate);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const diff = Math.max(0, best.accuracy_rate - worst.accuracy_rate);
    return {
      metric_label: 'accuracy_diff_best_vs_worst_window',
      metric_value: diff,
      insight: `Plot Twist: you are ${toPercent(diff)} more accurate during ${best.label} than ${worst.label}, lowkey huge.`,
    };
  }

  return {
    metric_label: 'sessions_count',
    metric_value: input.sessions_count,
    insight: `Plot Twist: ${input.sessions_count} total sessions this week sets your baseline for next-week speedrun.`,
  };
}

function buildGuaranteedWeeklyQuest(
  flopTopic: string,
  ghostTopics: string[],
  count: number
): WeeklyQuestItem[] {
  const candidateTopics = [flopTopic, ...ghostTopics].filter(
    (topic) => Boolean(topic) && topic !== 'No major decline tracked'
  );
  const uniqueTopics = Array.from(new Set(candidateTopics));
  const selectedTopics = uniqueTopics.length > 0
    ? uniqueTopics
    : ['weak concept review sprint'];

  return Array.from({ length: count }).map((_, index) => {
    const sessions = count === 1 ? 2 : index === 0 ? 2 : 1;
    if (index >= selectedTopics.length || selectedTopics[index] === 'weak concept review sprint') {
      return {
        action: `Mission ${index + 1}: Run a daily weak concept review sprint for ${sessions} weeks with 20-minute sessions.`,
        rationale: 'Keeps scope realistic this week while rebuilding consistency and retention.',
      };
    }

    const topic = selectedTopics[index];
    return {
      action: `Mission ${index + 1}: Run ${sessions} focused sessions on ${topic} this week (20 minutes each).`,
      rationale: `Targets ${topic} directly, keeps this week's load realistic, and supports consistent study habits.`,
    };
  });
}

function pickTopErrorPattern(patterns: WeeklyLearningState['recurring_error_patterns']): string | null {
  if (patterns.length === 0) {
    return null;
  }
  return [...patterns].sort((a, b) => b.count - a.count)[0].pattern;
}

function buildDeterministicValidationReport(
  input: WeeklyLearningState,
  recap: WeeklyInsightsRecap
): AgentCheckerResult {
  const expectedMain = pickTopImprovedTopic(input.improved_topics);
  const expectedFlop = pickTopDeclinedTopic(input.declined_topics);
  const issues: AgentCheckerIssue[] = [];

  if (expectedMain) {
    if (recap.main_character.topic !== expectedMain.topic) {
      issues.push({
        message: 'Main Character topic does not match strongest improved topic.',
        fix_instruction: 'Set Main Character to the top improved topic by mastery_delta.',
      });
    }
    if (roundMetric(recap.main_character.mastery_delta) !== roundMetric(expectedMain.mastery_delta)) {
      issues.push({
        message: 'Main Character mastery delta does not match data.',
        fix_instruction: 'Use exact mastery_delta from weekly input for Main Character.',
      });
    }
    if (recap.main_character.attempts !== expectedMain.attempts) {
      issues.push({
        message: 'Main Character attempts value does not match data.',
        fix_instruction: 'Use exact attempts count for Main Character topic.',
      });
    }
  }

  if (expectedFlop) {
    if (recap.flop_era.topic !== expectedFlop.topic) {
      issues.push({
        message: 'Flop Era topic does not match strongest declined topic.',
        fix_instruction: 'Set Flop Era topic to the most declined topic by mastery_delta.',
      });
    }
    if (roundMetric(recap.flop_era.accuracy_rate) !== roundMetric(expectedFlop.accuracy_rate)) {
      issues.push({
        message: 'Flop Era accuracy does not match source data.',
        fix_instruction: 'Use exact accuracy_rate from weekly input for Flop Era.',
      });
    }
  }

  if (!isNarrativeMetricsConsistent(recap, input, expectedMain, expectedFlop)) {
    issues.push({
      message: 'Narrative contains inconsistent percentage/metric references.',
      fix_instruction: 'Align all narrative percentages to exact source metrics (main, flop, and plot twist).',
    });
  }

  if (!containsBehaviorMetric(recap.plot_twist, input)) {
    issues.push({
      message: 'Plot Twist does not align to behavior data.',
      fix_instruction: 'Ground Plot Twist in behavior_windows or session metrics from the weekly input.',
    });
  }

  if (recap.weekly_quest.length !== expectedQuestCount(input.previous_week_quest_completion_rate)) {
    issues.push({
      message: 'Weekly Quest difficulty is not calibrated to completion rate.',
      fix_instruction: 'Adjust quest item count to match completion-rate calibration.',
    });
  }

  recap.weekly_quest.forEach((item, index) => {
    if (!isActionable(item)) {
      issues.push({
        message: `Weekly Quest item ${index + 1} is not actionable.`,
        fix_instruction: `Rewrite Weekly Quest item ${index + 1} as a concrete weekly action.`,
      });
    }
  });

  if (!questsTargetRelevantTopics(recap.weekly_quest, recap.flop_era.topic, recap.ghost_topics.map((topic) => topic.topic))) {
    issues.push({
      message: 'Weekly Quest actions are not aligned with struggling/untouched topics.',
      fix_instruction: 'Keep quest actions tied to Flop Era or Ghost Topics, unless using generic daily review sprint.',
    });
  }

  if (!hasProblemStatementAnswers(recap)) {
    issues.push({
      message: 'Missing problem_statement_answers block.',
      fix_instruction: 'Add all five problem_statement_answers fields.',
    });
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

function sanitizeProblemStatementAnswers(
  raw: WeeklyInsightsMakerRaw['problem_statement_answers']
): WeeklyProblemStatementAnswers {
  return {
    weak_vs_careless: normalizeNonEmptyText(raw?.weak_vs_careless, ''),
    trend_over_time: normalizeNonEmptyText(raw?.trend_over_time, ''),
    limited_time_focus: normalizeNonEmptyText(raw?.limited_time_focus, ''),
    repeated_struggle_reason: normalizeNonEmptyText(raw?.repeated_struggle_reason, ''),
    adaptation_note: normalizeNonEmptyText(raw?.adaptation_note, ''),
  };
}

function hasProblemStatementAnswers(recap: WeeklyInsightsRecap): boolean {
  const answers = recap.problem_statement_answers;
  if (!answers) {
    return false;
  }
  return Boolean(
    answers.weak_vs_careless.trim() &&
    answers.trend_over_time.trim() &&
    answers.limited_time_focus.trim() &&
    answers.repeated_struggle_reason.trim() &&
    answers.adaptation_note.trim()
  );
}

function buildProblemStatementAnswers(
  input: WeeklyLearningState,
  flopTopic: string,
  ghostTopics: string[]
): WeeklyProblemStatementAnswers {
  const topPattern = pickTopErrorPattern(input.recurring_error_patterns) ?? 'none-detected';
  const carelessPatterns = new Set(['careless_mistake', 'lucky_guess', 'misread_question']);
  const carelessCount = input.recurring_error_patterns
    .filter((item) => carelessPatterns.has(String(item.pattern)))
    .reduce((sum, item) => sum + item.count, 0);
  const conceptualCount = input.recurring_error_patterns
    .filter((item) => !carelessPatterns.has(String(item.pattern)))
    .reduce((sum, item) => sum + item.count, 0);
  const weakVsCareless =
    conceptualCount >= carelessCount
      ? `Your bigger issue this week is concept/procedure weakness (top pattern: ${topPattern}), not just careless slips.`
      : `Careless-style errors are dominant this week (top pattern: ${topPattern}), so accuracy habits matter most.`;

  const bestImproved = pickTopImprovedTopic(input.improved_topics);
  const worstDeclined = pickTopDeclinedTopic(input.declined_topics);
  const trend = `Trend check: improving in ${bestImproved?.topic ?? 'no clear topic'} while regressing in ${worstDeclined?.topic ?? 'no major decline tracked'}.`;

  const priorityTopics = [flopTopic, ...ghostTopics].filter((topic) => Boolean(topic) && topic !== 'No major decline tracked');
  const limitedTime = `If you only have limited time, prioritize ${priorityTopics.slice(0, 2).join(' then ')} with short focused sessions.`;

  const repeatedStruggle = `Repeated struggle is linked to ${topPattern} appearing ${input.recurring_error_patterns.find((x) => x.pattern === topPattern)?.count ?? 0} times across attempts.`;

  const adaptation =
    input.days_active <= 3
      ? `Adaptation note: activity is sparse (${input.days_active} active days), so keep goals smaller and consistency-first.`
      : `Adaptation note: high engagement (${input.sessions_count} sessions over ${input.days_active} days) supports progressive challenge.`;

  return {
    weak_vs_careless: weakVsCareless,
    trend_over_time: trend,
    limited_time_focus: limitedTime,
    repeated_struggle_reason: repeatedStruggle,
    adaptation_note: adaptation,
  };
}

function isWeakVsCarelessGrounded(
  answers: WeeklyProblemStatementAnswers,
  input: WeeklyLearningState
): boolean {
  const text = answers.weak_vs_careless.toLowerCase();
  const topPattern = pickTopErrorPattern(input.recurring_error_patterns);
  if (!topPattern) {
    return true;
  }
  return text.includes(String(topPattern).toLowerCase());
}

function isTrendGrounded(
  answers: WeeklyProblemStatementAnswers,
  input: WeeklyLearningState
): boolean {
  const text = answers.trend_over_time.toLowerCase();
  const improvedTopic = pickTopImprovedTopic(input.improved_topics)?.topic;
  const declinedTopic = pickTopDeclinedTopic(input.declined_topics)?.topic;
  const improvedOk = improvedTopic ? text.includes(improvedTopic.toLowerCase()) : true;
  const declinedOk = declinedTopic ? text.includes(declinedTopic.toLowerCase()) : true;
  return improvedOk && declinedOk;
}

function isLimitedTimeFocusGrounded(
  answers: WeeklyProblemStatementAnswers,
  recap: WeeklyInsightsRecap
): boolean {
  const text = answers.limited_time_focus.toLowerCase();
  const questTopics = recap.weekly_quest.map((item) => item.action.toLowerCase());
  return questTopics.some((topicLine) => {
    const words = topicLine.split(/\W+/).filter((w) => w.length > 3);
    return words.some((w) => text.includes(w));
  });
}

function isRepeatedStruggleGrounded(
  answers: WeeklyProblemStatementAnswers,
  input: WeeklyLearningState
): boolean {
  const text = answers.repeated_struggle_reason.toLowerCase();
  const topPattern = pickTopErrorPattern(input.recurring_error_patterns);
  return topPattern ? text.includes(String(topPattern).toLowerCase()) : true;
}

function isAdaptationGrounded(
  answers: WeeklyProblemStatementAnswers,
  input: WeeklyLearningState
): boolean {
  const text = answers.adaptation_note.toLowerCase();
  return (
    text.includes(String(input.days_active)) ||
    text.includes(String(input.sessions_count)) ||
    input.behavior_windows.some((window) => text.includes(window.label.toLowerCase()))
  );
}

function normalizeNonEmptyText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  return value;
}
