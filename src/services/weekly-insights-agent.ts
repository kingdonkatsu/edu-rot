import type {
  WeeklyLearningState,
  WeeklyInsightsAgentOutput,
  WeeklyInsightsRecap,
  MainCharacterSection,
  FlopEraSection,
  GhostTopicSection,
  PlotTwistSection,
  WeeklyQuestItem,
  AgentCheckerResult,
  AgentCheckerIssue,
} from '../types.js';

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

// --- Quest calibration ---

function calibrateQuestCount(state: WeeklyLearningState): number {
  // Short session override: always inject habit sprint
  if (state.avg_session_minutes < 15) return -1; // sentinel for short-session override
  if (state.previous_week_quest_completion_rate < 0.4) return 1;
  if (state.previous_week_quest_completion_rate < 0.75) return 2;
  return 3;
}

function buildQuestItems(state: WeeklyLearningState, flopTopic: string): WeeklyQuestItem[] {
  const count = calibrateQuestCount(state);
  const isShortSession = count === -1;

  const targetTopic = flopTopic;
  const ghostTopic = state.untouched_topics[0]?.topic ?? targetTopic;

  const habitItem: WeeklyQuestItem = {
    action: 'Complete a 15-min daily review sprint every day this week',
    rationale: 'Your average session is under 15 minutes — building the habit first unlocks everything else, no cap.',
  };

  const flopItem: WeeklyQuestItem = {
    action: `Attempt 3 ${targetTopic} problems within the next 7 days`,
    rationale: `Targeting your flop era on ${targetTopic} directly — speedrun past that pattern this week.`,
  };

  const ghostItem: WeeklyQuestItem = {
    action: `Review ${ghostTopic} for 10 minutes at least 2 times this week`,
    rationale: `${ghostTopic} is ghosted and decaying — even 2 quick reviews will vibe-check the decay curve.`,
  };

  if (isShortSession) {
    return [habitItem, flopItem];
  }

  if (count === 1) return [flopItem];
  if (count === 2) return [flopItem, ghostItem];
  return [flopItem, ghostItem, habitItem];
}

// --- Maker ---

export type WeeklyInsightsMaker = (
  input: WeeklyLearningState,
  priorIssues: AgentCheckerIssue[]
) => WeeklyInsightsAgentOutput;

export function defaultWeeklyInsightsMaker(
  input: WeeklyLearningState,
  _priorIssues: AgentCheckerIssue[]
): WeeklyInsightsAgentOutput {
  const topImproved = input.improved_topics[0];
  const worstDeclined = input.declined_topics[input.declined_topics.length - 1] ?? input.declined_topics[0];
  const topErrorPattern = input.recurring_error_patterns[0]?.pattern ?? 'recurring errors';
  const bestBehaviorWindow = input.behavior_windows.reduce(
    (best, w) => (w.accuracy_rate > (best?.accuracy_rate ?? 0) ? w : best),
    input.behavior_windows[0]
  );

  const main_character: MainCharacterSection = {
    topic: topImproved?.topic ?? 'Unknown',
    mastery_delta: topImproved?.mastery_delta ?? 0,
    attempts: topImproved?.attempts ?? 0,
    narrative: `No cap — you went full main character arc on ${topImproved?.topic ?? 'that topic'} this week. Lowkey a speedrun of ${((topImproved?.mastery_delta ?? 0) * 100).toFixed(0)}% mastery gain. Vibe check: passed.`,
  };

  const flop_era: FlopEraSection = {
    topic: worstDeclined?.topic ?? 'Unknown',
    error_pattern: topErrorPattern,
    accuracy_rate: worstDeclined?.accuracy_rate ?? 0,
    narrative: `Lowkey your ${worstDeclined?.topic ?? 'that topic'} era is giving NPC energy — ${((worstDeclined?.accuracy_rate ?? 0) * 100).toFixed(0)}% accuracy is a glitch we can fix. No shame, just a plot twist incoming.`,
  };

  const ghost_topics: GhostTopicSection[] = input.untouched_topics.map(t => ({
    topic: t.topic,
    estimated_decay: t.estimated_decay,
  }));

  const plot_twist: PlotTwistSection = bestBehaviorWindow
    ? {
        insight: `No cap — you are ${((bestBehaviorWindow.accuracy_rate - 0.5) * 100).toFixed(0)}% more accurate ${bestBehaviorWindow.label}. That is your main character window.`,
        metric_label: bestBehaviorWindow.label,
        metric_value: bestBehaviorWindow.accuracy_rate,
      }
    : {
        insight: `You completed ${input.sessions_count} sessions across ${input.days_active} days — that consistency is lowkey the real speedrun.`,
        metric_label: 'sessions_count',
        metric_value: input.sessions_count,
      };

  const weekly_quest: WeeklyQuestItem[] = buildQuestItems(input, worstDeclined?.topic ?? 'your weak topic');

  const recap: WeeklyInsightsRecap = {
    main_character,
    flop_era,
    ghost_topics,
    plot_twist,
    weekly_quest,
  };

  return { recap, attempts: 1, checker_history: [] };
}

// --- Checker ---

export type WeeklyInsightsChecker = (
  output: WeeklyInsightsAgentOutput,
  input: WeeklyLearningState,
  attempt: number
) => AgentCheckerResult;

export function defaultWeeklyInsightsChecker(
  output: WeeklyInsightsAgentOutput,
  input: WeeklyLearningState,
  attempt: number
): AgentCheckerResult {
  const issues: AgentCheckerIssue[] = [];
  const { recap } = output;

  // Gate: all 5 sections present
  if (!recap.main_character) issues.push({ gate: 'five-sections-present', message: 'Missing main_character section' });
  if (!recap.flop_era) issues.push({ gate: 'five-sections-present', message: 'Missing flop_era section' });
  if (!recap.ghost_topics) issues.push({ gate: 'five-sections-present', message: 'Missing ghost_topics section' });
  if (!recap.plot_twist) issues.push({ gate: 'five-sections-present', message: 'Missing plot_twist section' });
  if (!recap.weekly_quest) issues.push({ gate: 'five-sections-present', message: 'Missing weekly_quest section' });

  const topImproved = input.improved_topics[0];
  const worstDeclined = input.declined_topics[input.declined_topics.length - 1] ?? input.declined_topics[0];

  // Gate: main_character stat fidelity
  if (recap.main_character && topImproved) {
    if (recap.main_character.topic !== topImproved.topic) {
      issues.push({
        gate: 'main-character-stat-fidelity',
        message: `main_character.topic must be '${topImproved.topic}', got '${recap.main_character.topic}'`,
      });
    }
    if (Math.abs(recap.main_character.mastery_delta - topImproved.mastery_delta) > 0.0001) {
      issues.push({
        gate: 'main-character-stat-fidelity',
        message: `main_character.mastery_delta must be ${topImproved.mastery_delta}`,
      });
    }
    if (recap.main_character.attempts !== topImproved.attempts) {
      issues.push({
        gate: 'main-character-stat-fidelity',
        message: `main_character.attempts must be ${topImproved.attempts}`,
      });
    }
  }

  // Gate: flop_era stat fidelity
  if (recap.flop_era && worstDeclined) {
    if (recap.flop_era.topic !== worstDeclined.topic) {
      issues.push({
        gate: 'flop-era-stat-fidelity',
        message: `flop_era.topic must be '${worstDeclined.topic}', got '${recap.flop_era.topic}'`,
      });
    }
    if (Math.abs(recap.flop_era.accuracy_rate - worstDeclined.accuracy_rate) > 0.0001) {
      issues.push({
        gate: 'flop-era-stat-fidelity',
        message: `flop_era.accuracy_rate must be ${worstDeclined.accuracy_rate}`,
      });
    }
  }

  // Gate: flop_era error_pattern must exist in recurring_error_patterns
  if (recap.flop_era) {
    const validPatterns = input.recurring_error_patterns.map(p => p.pattern);
    if (!validPatterns.includes(recap.flop_era.error_pattern)) {
      issues.push({
        gate: 'flop-era-stat-fidelity',
        message: `flop_era.error_pattern '${recap.flop_era.error_pattern}' not found in recurring_error_patterns`,
      });
    }
  }

  // Gate: ghost_topics fidelity
  if (recap.ghost_topics) {
    for (const gt of recap.ghost_topics) {
      const match = input.untouched_topics.find(t => t.topic === gt.topic);
      if (!match) {
        issues.push({
          gate: 'ghost-topics-fidelity',
          message: `ghost_topics topic '${gt.topic}' not found in input.untouched_topics`,
        });
      } else if (Math.abs(gt.estimated_decay - match.estimated_decay) > 0.0001) {
        issues.push({
          gate: 'ghost-topics-fidelity',
          message: `ghost_topics '${gt.topic}' estimated_decay must be ${match.estimated_decay}`,
        });
      }
    }
  }

  // Gate: quest count matches calibration table
  if (recap.weekly_quest) {
    const isShortSession = input.avg_session_minutes < 15;
    let expectedCount: number;
    if (isShortSession) {
      expectedCount = 2; // override: habit sprint + flop item
    } else if (input.previous_week_quest_completion_rate < 0.4) {
      expectedCount = 1;
    } else if (input.previous_week_quest_completion_rate < 0.75) {
      expectedCount = 2;
    } else {
      expectedCount = 3;
    }
    if (recap.weekly_quest.length !== expectedCount) {
      issues.push({
        gate: 'quest-count-and-calibration',
        message: `Expected ${expectedCount} quest items (completion_rate=${input.previous_week_quest_completion_rate}, avg_session_min=${input.avg_session_minutes}), got ${recap.weekly_quest.length}`,
      });
    }
  }

  // Gate: quest actionability — each item must contain a number and time-bound language
  const timeBoundPattern = /\b(week|day|days|daily|weekly|minutes?|hours?|this week|per day)\b/i;
  const numberPattern = /\d+/;
  if (recap.weekly_quest) {
    for (let i = 0; i < recap.weekly_quest.length; i++) {
      const action = recap.weekly_quest[i].action;
      if (!numberPattern.test(action) || !timeBoundPattern.test(action)) {
        issues.push({
          gate: 'quest-actionability',
          message: `Quest item ${i + 1} must contain a number and time-bound language`,
        });
      }
    }
  }

  // Gate: no section contradiction (main_character.topic ≠ flop_era.topic)
  if (recap.main_character && recap.flop_era && recap.main_character.topic === recap.flop_era.topic) {
    issues.push({
      gate: 'no-section-contradiction',
      message: 'main_character.topic must not equal flop_era.topic',
    });
  }

  // Gate: plot_twist grounded — metric_label maps to a real behavior window or session metric
  if (recap.plot_twist) {
    const validLabels = new Set([
      ...input.behavior_windows.map(w => w.label),
      'sessions_count',
      'days_active',
      'avg_session_minutes',
    ]);
    if (!validLabels.has(recap.plot_twist.metric_label)) {
      issues.push({
        gate: 'no-section-contradiction',
        message: `plot_twist.metric_label '${recap.plot_twist.metric_label}' is not a real behavior window or session metric`,
      });
    }
  }

  // Gate: no discouraging tone
  const allNarrativeText = [
    recap.main_character?.narrative ?? '',
    recap.flop_era?.narrative ?? '',
    recap.plot_twist?.insight ?? '',
    ...(recap.weekly_quest?.map(q => q.action + ' ' + q.rationale) ?? []),
  ].join(' ');
  if (DISCOURAGING_WORDS.test(allNarrativeText)) {
    issues.push({ gate: 'no-discouraging-tone', message: 'Content contains discouraging language' });
  }

  // Gate: no bias
  for (const pattern of BIAS_PATTERNS) {
    if (pattern.test(allNarrativeText)) {
      issues.push({ gate: 'no-bias-risk', message: 'Content contains demographic bias pattern' });
      break;
    }
  }

  return { passed: issues.length === 0, issues, attempt };
}

// --- Control Loop ---

export interface WeeklyInsightsAgentDeps {
  maker?: WeeklyInsightsMaker;
  checker?: WeeklyInsightsChecker;
}

const MAX_ATTEMPTS = 3;

export async function runWeeklyInsightsAgent(
  input: WeeklyLearningState,
  deps?: WeeklyInsightsAgentDeps
): Promise<WeeklyInsightsAgentOutput> {
  const maker = deps?.maker ?? defaultWeeklyInsightsMaker;
  const checker = deps?.checker ?? defaultWeeklyInsightsChecker;

  const accumulatedIssues: AgentCheckerIssue[] = [];
  const checkerHistory: AgentCheckerResult[] = [];
  let lastOutput: WeeklyInsightsAgentOutput | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const draft = maker(input, accumulatedIssues);
    const checkerResult = checker(draft, input, attempt);

    checkerHistory.push(checkerResult);

    // Accumulate issues across retries
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

  // Fail-open
  return lastOutput!;
}
