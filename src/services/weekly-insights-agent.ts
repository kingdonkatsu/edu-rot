import type {
  AgentCheckerIssue,
  AgentCheckerResult,
  WeeklyInsightsAgentOutput,
  WeeklyInsightsRecap,
  WeeklyLearningState,
  WeeklyQuestItem,
  WeeklyTopicTrend,
} from '../types.js';

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

export async function runWeeklyInsightsAgent(
  input: WeeklyLearningState,
  deps: WeeklyInsightsAgentDeps = {}
): Promise<WeeklyInsightsAgentOutput> {
  const maker = deps.maker ?? defaultWeeklyInsightsMaker;
  const checker = deps.checker ?? defaultWeeklyInsightsChecker;

  let fixInstructions: string[] = [];
  const checkerHistory: AgentCheckerResult[] = [];
  let latestRecap: WeeklyInsightsRecap = emptyRecap();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    latestRecap = await maker(input, fixInstructions);
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

  return {
    recap: latestRecap,
    attempts: MAX_ATTEMPTS,
    checker_history: checkerHistory,
  };
}

async function defaultWeeklyInsightsMaker(
  input: WeeklyLearningState,
  _fixInstructions: string[]
): Promise<WeeklyInsightsRecap> {
  const mainTopic = pickTopImprovedTopic(input.improved_topics);
  const flopTopic = pickTopDeclinedTopic(input.declined_topics);
  const topPattern = input.recurring_error_patterns[0]?.pattern ?? 'none-detected';
  const ghostTopics = input.untouched_topics.slice(0, 3);
  const plotTwist = buildPlotTwist(input);
  const questCount = expectedQuestCount(input.previous_week_quest_completion_rate);
  const quest = buildQuestItems(input, questCount, flopTopic?.topic, ghostTopics.map((g) => g.topic));

  return {
    main_character: {
      topic: mainTopic?.topic ?? 'No clear winner this week',
      mastery_delta: mainTopic?.mastery_delta ?? 0,
      attempts: mainTopic?.attempts ?? 0,
      narrative: mainTopic
        ? `Main Character arc: ${mainTopic.topic} popped off with +${toPercent(mainTopic.mastery_delta)} mastery over ${mainTopic.attempts} attempts.`
        : 'Main Character arc: no improved topic detected this week.',
    },
    flop_era: {
      topic: flopTopic?.topic ?? 'No major decline tracked',
      error_pattern: String(topPattern),
      accuracy_rate: flopTopic?.accuracy_rate ?? 0,
      narrative: flopTopic
        ? `Flop Era alert: ${flopTopic.topic} got stuck on ${String(topPattern)} with ${toPercent(flopTopic.accuracy_rate)} accuracy.`
        : 'Flop Era alert: no declined topic this week, keep momentum.',
    },
    ghost_topics: ghostTopics.map((topic) => ({
      topic: topic.topic,
      estimated_decay: topic.estimated_decay,
    })),
    plot_twist: plotTwist,
    weekly_quest: quest,
  };
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

  return {
    passed: issues.length === 0,
    issues,
  };
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

function buildPlotTwist(input: WeeklyLearningState): WeeklyInsightsRecap['plot_twist'] {
  if (input.behavior_windows.length >= 2) {
    const sorted = [...input.behavior_windows].sort((a, b) => b.accuracy_rate - a.accuracy_rate);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const diff = Math.max(0, best.accuracy_rate - worst.accuracy_rate);
    return {
      insight: `Plot Twist: you are ${toPercent(diff)} more accurate during ${best.label} than ${worst.label}.`,
      metric_label: 'accuracy_diff_best_vs_worst_window',
      metric_value: roundMetric(diff),
    };
  }

  return {
    insight: `Plot Twist: you logged ${input.sessions_count} sessions across ${input.days_active} active days.`,
    metric_label: 'sessions_count',
    metric_value: input.sessions_count,
  };
}

function buildQuestItems(
  input: WeeklyLearningState,
  count: number,
  flopTopic: string | undefined,
  ghostTopics: string[]
): WeeklyQuestItem[] {
  const topicsForQuest = [flopTopic, ...ghostTopics].filter((topic): topic is string => Boolean(topic));
  const actions: WeeklyQuestItem[] = [];

  for (let index = 0; index < count; index++) {
    const targetTopic = topicsForQuest[index] ?? 'your next weak concept';
    actions.push({
      action: `Run 2 focused practice blocks on ${targetTopic} this week.`,
      rationale: `Keeps weekly scope realistic and targets current error patterns for ${targetTopic}.`,
    });
  }

  if (actions.length > 0 && input.avg_session_minutes < 15) {
    actions[0] = {
      action: `Add one 15-minute review sprint before your first session each day.`,
      rationale: 'Short daily reps reduce decay without overloading your schedule.',
    };
  }

  return actions;
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
