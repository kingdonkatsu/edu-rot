import { runCrashCourseAgent } from '../services/crash-course-agent.js';
import { runWeeklyInsightsAgent } from '../services/weekly-insights-agent.js';
import { crashCourseEvalCases, weeklyInsightsEvalCases } from './fixtures.js';
import type {
  CrashCourseAgentInput,
  CrashCourseAgentOutput,
  WeeklyInsightsAgentOutput,
  WeeklyLearningState,
} from '../types.js';

interface RubricCheck {
  name: string;
  passed: boolean;
  details?: string;
}

interface CaseEvalResult {
  caseId: string;
  description: string;
  checks: RubricCheck[];
}

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
const REQUIRED_CRASH_STAGES = [
  'specific_mistake',
  'intuition_analogy',
  'actual_concept',
  'worked_example',
  'practice_question',
] as const;

async function main(): Promise<void> {
  const crashResults = await Promise.all(
    crashCourseEvalCases.map(async (evalCase) => evalCrashCourseCase(evalCase.id, evalCase.description, evalCase.input))
  );
  const weeklyResults = await Promise.all(
    weeklyInsightsEvalCases.map(async (evalCase) => evalWeeklyInsightsCase(evalCase.id, evalCase.description, evalCase.input))
  );

  const crashSummary = summarizeSuite('Crash Course Agent', crashResults);
  const weeklySummary = summarizeSuite('Weekly Insights Agent', weeklyResults);

  printSuiteSummary(crashSummary);
  printSuiteSummary(weeklySummary);
  printFinalSummary([crashSummary, weeklySummary]);

  if (!crashSummary.passed || !weeklySummary.passed) {
    process.exitCode = 1;
  }
}

async function evalCrashCourseCase(
  caseId: string,
  description: string,
  input: CrashCourseAgentInput
): Promise<CaseEvalResult> {
  const output = await runCrashCourseAgent(input);
  const checks: RubricCheck[] = [];

  checks.push(checkAttempts(output.attempts));
  checks.push(checkFinalCheckerPass(output.checker_history.at(-1)?.passed ?? false));
  checks.push(checkCardCount(output.cards.length));
  checks.push(checkCrashStageOrder(output));
  checks.push(checkCardBodyLength(output));
  checks.push(checkNoDiscouragingToneCrash(output));
  checks.push(checkNoBiasRiskCrash(output));
  checks.push(checkBrainrotToneCrash(output));
  checks.push(checkSpecificMistakeTargetsError(output, input));
  checks.push(checkConceptGrounding(output, input));
  checks.push(checkWorkedExampleGrounding(output, input));
  checks.push(checkPracticeTargetsMisconception(output, input));
  checks.push(checkSoraPromptBundle(output));

  return { caseId, description, checks };
}

async function evalWeeklyInsightsCase(
  caseId: string,
  description: string,
  input: WeeklyLearningState
): Promise<CaseEvalResult> {
  const output = await runWeeklyInsightsAgent(input);
  const checks: RubricCheck[] = [];

  checks.push(checkAttempts(output.attempts));
  checks.push(checkFinalCheckerPass(output.checker_history.at(-1)?.passed ?? false));
  checks.push(checkWeeklySectionsPresent(output));
  checks.push(checkMainCharacterData(output, input));
  checks.push(checkFlopEraData(output, input));
  checks.push(checkGhostTopicsData(output, input));
  checks.push(checkPlotTwistMetric(output, input));
  checks.push(checkQuestCountAndCalibration(output, input));
  checks.push(checkQuestActionability(output));
  checks.push(checkNoSectionContradiction(output));
  checks.push(checkNoDiscouragingToneWeekly(output));
  checks.push(checkNoBiasRiskWeekly(output));

  return { caseId, description, checks };
}

function checkAttempts(attempts: number): RubricCheck {
  const passed = attempts >= 1 && attempts <= 3;
  return {
    name: 'attempt-limit',
    passed,
    details: passed ? undefined : `Expected attempts in [1,3], got ${attempts}`,
  };
}

function checkFinalCheckerPass(finalPass: boolean): RubricCheck {
  return {
    name: 'checker-pass',
    passed: finalPass,
    details: finalPass ? undefined : 'Final checker verdict was not passed',
  };
}

function checkCardCount(cardCount: number): RubricCheck {
  const passed = cardCount === REQUIRED_CRASH_STAGES.length;
  return {
    name: 'card-count-exact-5',
    passed,
    details: passed ? undefined : `Expected ${REQUIRED_CRASH_STAGES.length} cards, got ${cardCount}`,
  };
}

function checkCrashStageOrder(output: CrashCourseAgentOutput): RubricCheck {
  const mismatches = REQUIRED_CRASH_STAGES
    .map((stage, index) => ({ index, stage }))
    .filter(({ index, stage }) => output.cards[index]?.stage !== stage);
  const passed = mismatches.length === 0;
  return {
    name: 'required-stage-order',
    passed,
    details: passed
      ? undefined
      : `Stage mismatches at indexes: ${mismatches.map((m) => `${m.index}:${m.stage}`).join(', ')}`,
  };
}

function checkCardBodyLength(output: CrashCourseAgentOutput): RubricCheck {
  const violations = output.cards
    .map((card, index) => ({ index, length: card.body.length }))
    .filter((entry) => entry.length > 280);
  const passed = violations.length === 0;
  return {
    name: 'one-screen-card-size',
    passed,
    details: passed
      ? undefined
      : `Cards over 280 chars: ${violations.map((v) => `${v.index}:${v.length}`).join(', ')}`,
  };
}

function checkNoDiscouragingToneCrash(output: CrashCourseAgentOutput): RubricCheck {
  const badCard = output.cards.find((card) =>
    DISCOURAGING_TERMS.some((term) => `${card.title} ${card.body}`.toLowerCase().includes(term))
  );
  const passed = !badCard;
  return {
    name: 'supportive-tone',
    passed,
    details: passed ? undefined : `Discouraging tone detected in card "${badCard?.title}"`,
  };
}

function checkNoBiasRiskCrash(output: CrashCourseAgentOutput): RubricCheck {
  const badCard = output.cards.find((card) =>
    BIAS_PATTERNS.some((pattern) => pattern.test(`${card.title} ${card.body}`))
  );
  const passed = !badCard;
  return {
    name: 'no-bias-risk',
    passed,
    details: passed ? undefined : `Bias-risk phrase detected in card "${badCard?.title}"`,
  };
}

function checkBrainrotToneCrash(output: CrashCourseAgentOutput): RubricCheck {
  const text = output.cards.map((card) => `${card.title} ${card.body}`.toLowerCase()).join(' ');
  const markers = BRAINROT_MARKERS.filter((marker) => text.includes(marker));
  const passed = markers.length >= 2;
  return {
    name: 'brainrot-tone',
    passed,
    details: passed ? undefined : 'Brainrot markers were too sparse for the target tone',
  };
}

function checkSpecificMistakeTargetsError(
  output: CrashCourseAgentOutput,
  input: CrashCourseAgentInput
): RubricCheck {
  const firstCard = output.cards[0];
  const target = input.error_classification.replaceAll('_', ' ').toLowerCase();
  const passed = Boolean(firstCard?.body.toLowerCase().includes(target));
  return {
    name: 'diagnosed-error-targeting',
    passed,
    details: passed ? undefined : `Card 1 does not mention diagnosed error "${target}"`,
  };
}

function checkConceptGrounding(
  output: CrashCourseAgentOutput,
  input: CrashCourseAgentInput
): RubricCheck {
  const conceptCard = output.cards.find((card) => card.stage === 'actual_concept');
  if (!conceptCard) {
    return { name: 'concept-grounding', passed: false, details: 'Missing actual concept card' };
  }
  if (input.rag.concept_explanations.length === 0) {
    return { name: 'concept-grounding', passed: true };
  }

  const text = conceptCard.body.toLowerCase();
  const grounded = input.rag.concept_explanations.some((explanation) =>
    extractKeywords(explanation).some((keyword) => text.includes(keyword))
  );
  return {
    name: 'concept-grounding',
    passed: grounded,
    details: grounded ? undefined : 'Concept card does not reflect concept explanation keywords',
  };
}

function checkWorkedExampleGrounding(
  output: CrashCourseAgentOutput,
  input: CrashCourseAgentInput
): RubricCheck {
  const exampleCard = output.cards.find((card) => card.stage === 'worked_example');
  if (!exampleCard) {
    return { name: 'worked-example-grounding', passed: false, details: 'Missing worked example card' };
  }
  if (input.rag.worked_examples.length === 0) {
    return { name: 'worked-example-grounding', passed: true };
  }

  const text = exampleCard.body.toLowerCase();
  const normalizedText = normalizeForMatch(exampleCard.body);
  const grounded = input.rag.worked_examples.some((example) =>
    (() => {
      const keywords = extractKeywords(example);
      if (keywords.length === 0) {
        return normalizedText.includes(normalizeForMatch(example));
      }
      return keywords.some((keyword) => text.includes(keyword));
    })()
  );
  return {
    name: 'worked-example-grounding',
    passed: grounded,
    details: grounded ? undefined : 'Worked example card does not reflect retrieved example keywords',
  };
}

function checkPracticeTargetsMisconception(
  output: CrashCourseAgentOutput,
  input: CrashCourseAgentInput
): RubricCheck {
  const practiceCard = output.cards.find((card) => card.stage === 'practice_question');
  if (!practiceCard) {
    return { name: 'practice-targeting', passed: false, details: 'Missing practice question card' };
  }
  const text = practiceCard.body.toLowerCase();
  const errorLabel = input.error_classification.replaceAll('_', ' ').toLowerCase();
  const directMatch = text.includes(errorLabel);
  const misconceptionMatch = input.rag.misconception_data.some((item) =>
    extractKeywords(item).some((keyword) => text.includes(keyword))
  );
  const passed = directMatch || misconceptionMatch;
  return {
    name: 'practice-targeting',
    passed,
    details: passed ? undefined : 'Practice card does not target diagnosed misconception',
  };
}

function checkSoraPromptBundle(output: CrashCourseAgentOutput): RubricCheck {
  const prompt = output.sora_video_prompt;
  const sceneCountMatches = prompt.scenes.length === output.cards.length;
  const stageOrderMatches = output.cards.every(
    (card, index) => prompt.scenes[index]?.stage === card.stage
  );
  const ctaPresent = Boolean(prompt.final_call_to_action?.trim());
  const safeGuardrails = prompt.safety_constraints.length >= 2;
  const passed = sceneCountMatches && stageOrderMatches && ctaPresent && safeGuardrails;
  return {
    name: 'sora-prompt-bundle',
    passed,
    details: passed ? undefined : 'Sora video prompt bundle is incomplete or inconsistent with cards',
  };
}

function checkWeeklySectionsPresent(output: WeeklyInsightsAgentOutput): RubricCheck {
  const recap = output.recap;
  const passed = Boolean(
    recap.main_character &&
    recap.flop_era &&
    recap.plot_twist &&
    Array.isArray(recap.ghost_topics) &&
    Array.isArray(recap.weekly_quest)
  );
  return {
    name: 'five-sections-present',
    passed,
    details: passed ? undefined : 'One or more required recap sections are missing',
  };
}

function checkMainCharacterData(
  output: WeeklyInsightsAgentOutput,
  input: WeeklyLearningState
): RubricCheck {
  const topImproved = input.improved_topics
    .slice()
    .sort((a, b) => b.mastery_delta - a.mastery_delta)[0];
  if (!topImproved) {
    return {
      name: 'main-character-stat-fidelity',
      passed: output.recap.main_character.topic === 'No clear winner this week',
      details: output.recap.main_character.topic === 'No clear winner this week'
        ? undefined
        : 'Expected fallback main character topic for empty improved topics',
    };
  }

  const sameTopic = output.recap.main_character.topic === topImproved.topic;
  const sameDelta = roundMetric(output.recap.main_character.mastery_delta) === roundMetric(topImproved.mastery_delta);
  const sameAttempts = output.recap.main_character.attempts === topImproved.attempts;
  const passed = sameTopic && sameDelta && sameAttempts;
  return {
    name: 'main-character-stat-fidelity',
    passed,
    details: passed ? undefined : `Expected ${topImproved.topic} (+${topImproved.mastery_delta}, ${topImproved.attempts} attempts)`,
  };
}

function checkFlopEraData(
  output: WeeklyInsightsAgentOutput,
  input: WeeklyLearningState
): RubricCheck {
  const worstDeclined = input.declined_topics
    .slice()
    .sort((a, b) => a.mastery_delta - b.mastery_delta)[0];
  if (!worstDeclined) {
    return {
      name: 'flop-era-stat-fidelity',
      passed: output.recap.flop_era.topic === 'No major decline tracked',
      details: output.recap.flop_era.topic === 'No major decline tracked'
        ? undefined
        : 'Expected fallback flop era topic for empty declined topics',
    };
  }

  const validPatterns = new Set(input.recurring_error_patterns.map((item) => String(item.pattern)));
  const sameTopic = output.recap.flop_era.topic === worstDeclined.topic;
  const sameAccuracy = roundMetric(output.recap.flop_era.accuracy_rate) === roundMetric(worstDeclined.accuracy_rate);
  const validPattern = validPatterns.has(output.recap.flop_era.error_pattern);
  const passed = sameTopic && sameAccuracy && validPattern;
  return {
    name: 'flop-era-stat-fidelity',
    passed,
    details: passed ? undefined : 'Flop era topic, accuracy, or error pattern mismatches source data',
  };
}

function checkGhostTopicsData(
  output: WeeklyInsightsAgentOutput,
  input: WeeklyLearningState
): RubricCheck {
  const invalid = output.recap.ghost_topics.find((ghost) => {
    const source = input.untouched_topics.find((item) => item.topic === ghost.topic);
    if (!source) return true;
    return roundMetric(source.estimated_decay) !== roundMetric(ghost.estimated_decay);
  });
  const passed = !invalid;
  return {
    name: 'ghost-topics-fidelity',
    passed,
    details: passed ? undefined : `Invalid ghost topic entry: ${invalid?.topic}`,
  };
}

function checkPlotTwistMetric(
  output: WeeklyInsightsAgentOutput,
  input: WeeklyLearningState
): RubricCheck {
  const plotTwist = output.recap.plot_twist;

  if (plotTwist.metric_label === 'sessions_count') {
    const passed = roundMetric(plotTwist.metric_value) === roundMetric(input.sessions_count);
    return {
      name: 'plot-twist-metric-fidelity',
      passed,
      details: passed ? undefined : `Expected sessions_count ${input.sessions_count}, got ${plotTwist.metric_value}`,
    };
  }

  if (plotTwist.metric_label === 'accuracy_diff_best_vs_worst_window' && input.behavior_windows.length >= 2) {
    const sorted = input.behavior_windows.slice().sort((a, b) => b.accuracy_rate - a.accuracy_rate);
    const expectedDiff = roundMetric(Math.max(0, sorted[0].accuracy_rate - sorted[sorted.length - 1].accuracy_rate));
    const passed = roundMetric(plotTwist.metric_value) === expectedDiff;
    return {
      name: 'plot-twist-metric-fidelity',
      passed,
      details: passed ? undefined : `Expected accuracy diff ${expectedDiff}, got ${plotTwist.metric_value}`,
    };
  }

  return {
    name: 'plot-twist-metric-fidelity',
    passed: false,
    details: `Unexpected metric label "${plotTwist.metric_label}"`,
  };
}

function checkQuestCountAndCalibration(
  output: WeeklyInsightsAgentOutput,
  input: WeeklyLearningState
): RubricCheck {
  const questCount = output.recap.weekly_quest.length;
  const inRange = questCount >= 1 && questCount <= 3;
  const expectedCount = expectedQuestCount(input.previous_week_quest_completion_rate);
  const calibrated = questCount === expectedCount;
  const passed = inRange && calibrated;
  return {
    name: 'quest-count-calibration',
    passed,
    details: passed ? undefined : `Expected ${expectedCount} quests in range 1-3, got ${questCount}`,
  };
}

function checkQuestActionability(output: WeeklyInsightsAgentOutput): RubricCheck {
  const invalid = output.recap.weekly_quest.find((item) => !isActionable(item.action, item.rationale));
  const passed = !invalid;
  return {
    name: 'quest-actionability',
    passed,
    details: passed ? undefined : `Non-actionable quest item: ${invalid?.action}`,
  };
}

function checkNoSectionContradiction(output: WeeklyInsightsAgentOutput): RubricCheck {
  const mainTopic = output.recap.main_character.topic;
  const flopTopic = output.recap.flop_era.topic;
  const passed = mainTopic !== flopTopic || mainTopic === 'No clear winner this week';
  return {
    name: 'no-section-contradictions',
    passed,
    details: passed ? undefined : `Main Character and Flop Era both reference "${mainTopic}"`,
  };
}

function checkNoDiscouragingToneWeekly(output: WeeklyInsightsAgentOutput): RubricCheck {
  const textBlocks = [
    output.recap.main_character.narrative,
    output.recap.flop_era.narrative,
    output.recap.plot_twist.insight,
    ...output.recap.weekly_quest.map((item) => `${item.action} ${item.rationale}`),
  ];
  const badText = textBlocks.find((block) =>
    DISCOURAGING_TERMS.some((term) => block.toLowerCase().includes(term))
  );
  const passed = !badText;
  return {
    name: 'supportive-tone',
    passed,
    details: passed ? undefined : `Discouraging language detected: "${badText}"`,
  };
}

function checkNoBiasRiskWeekly(output: WeeklyInsightsAgentOutput): RubricCheck {
  const textBlocks = [
    output.recap.main_character.narrative,
    output.recap.flop_era.narrative,
    output.recap.plot_twist.insight,
    ...output.recap.weekly_quest.map((item) => `${item.action} ${item.rationale}`),
  ];
  const badText = textBlocks.find((block) =>
    BIAS_PATTERNS.some((pattern) => pattern.test(block))
  );
  const passed = !badText;
  return {
    name: 'no-bias-risk',
    passed,
    details: passed ? undefined : `Bias-risk phrase detected: "${badText}"`,
  };
}

function summarizeSuite(suiteName: string, results: CaseEvalResult[]) {
  const totalChecks = results.reduce((sum, result) => sum + result.checks.length, 0);
  const failedChecks = results.flatMap((result) =>
    result.checks
      .filter((check) => !check.passed)
      .map((check) => ({
        caseId: result.caseId,
        description: result.description,
        check,
      }))
  );
  const passedChecks = totalChecks - failedChecks.length;
  return {
    suiteName,
    totalCases: results.length,
    totalChecks,
    passedChecks,
    failedChecks,
    passed: failedChecks.length === 0,
  };
}

function printSuiteSummary(summary: ReturnType<typeof summarizeSuite>): void {
  console.log(`\n=== ${summary.suiteName} ===`);
  console.log(`Cases: ${summary.totalCases}`);
  console.log(`Checks: ${summary.passedChecks}/${summary.totalChecks} passed`);
  console.log(`Status: ${summary.passed ? 'PASS' : 'FAIL'}`);

  if (!summary.passed) {
    console.log('\nFailed checks:');
    summary.failedChecks.forEach((failed) => {
      console.log(
        `- [${failed.caseId}] ${failed.check.name}: ${failed.check.details ?? 'No details'} (${failed.description})`
      );
    });
  }
}

function printFinalSummary(summaries: Array<ReturnType<typeof summarizeSuite>>): void {
  const totalChecks = summaries.reduce((sum, item) => sum + item.totalChecks, 0);
  const passedChecks = summaries.reduce((sum, item) => sum + item.passedChecks, 0);
  const failedChecks = totalChecks - passedChecks;
  console.log('\n=== Overall Agent Eval ===');
  console.log(`Checks: ${passedChecks}/${totalChecks} passed`);
  console.log(`Failed checks: ${failedChecks}`);
  console.log(`Overall status: ${failedChecks === 0 ? 'PASS' : 'FAIL'}`);
}

function expectedQuestCount(completionRate: number): number {
  if (completionRate < 0.4) return 1;
  if (completionRate < 0.75) return 2;
  return 3;
}

function isActionable(action: string, rationale: string): boolean {
  if (!action.trim() || !rationale.trim()) return false;
  const hasNumber = /\d/.test(action);
  const hasTimeboundLanguage = /\b(day|days|week|weeks|daily|session|sessions|minute|minutes)\b/i.test(action);
  return hasNumber || hasTimeboundLanguage;
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

function roundMetric(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

void main();
