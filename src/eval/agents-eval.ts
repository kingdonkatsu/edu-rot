/**
 * Rubric-based evaluation harness for both agents.
 * Run via: npm run eval:agents
 */
import { runCrashCourseAgent } from '../services/crash-course-agent.js';
import { runWeeklyInsightsAgent } from '../services/weekly-insights-agent.js';
import { crashCourseFixtures, weeklyInsightsFixtures } from './fixtures.js';
import type {
  CrashCourseAgentOutput,
  CrashCourseAgentInput,
  WeeklyInsightsAgentOutput,
  WeeklyLearningState,
} from '../types.js';

interface RubricCheck {
  id: string;
  pass: boolean;
  message?: string;
}

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

const SECTION_ORDER = [
  'hook',
  'misconception_callout',
  'intuition_bridge',
  'concept_explanation',
  'worked_example',
  'practice_cta',
];

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function keywordSet(texts: string[]): Set<string> {
  return new Set(texts.join(' ').toLowerCase().split(/\W+/).filter((w) => w.length > 4));
}

function hasKeywordOverlap(text: string, set: Set<string>): boolean {
  return text.toLowerCase().split(/\W+/).some((w) => w.length > 4 && set.has(w));
}

function checkCrashCourse(output: CrashCourseAgentOutput, input: CrashCourseAgentInput): RubricCheck[] {
  const checks: RubricCheck[] = [];
  const { script, attempts, checker_history } = output;
  const sections = script.sections;

  checks.push({
    id: 'attempt-limit',
    pass: attempts <= 3,
    message: attempts > 3 ? `${attempts} attempts exceeds max of 3` : undefined,
  });

  checks.push({
    id: 'checker-pass',
    pass: checker_history.length > 0,
    message: checker_history.length === 0 ? 'No checker runs recorded' : undefined,
  });

  checks.push({
    id: 'section-count',
    pass: sections.length === 6,
    message: sections.length !== 6 ? `Got ${sections.length} sections, expected 6` : undefined,
  });

  const orderOk = sections.every((section, index) => section.label === SECTION_ORDER[index]);
  checks.push({
    id: 'section-order',
    pass: orderOk,
    message: !orderOk ? `Labels: ${sections.map((section) => section.label).join(', ')}` : undefined,
  });

  const computedWordCount = words(script.full_script).length;
  const wordCountOk = computedWordCount >= 120 && computedWordCount <= 180 && computedWordCount === script.word_count;
  checks.push({
    id: 'word-count-range',
    pass: wordCountOk,
    message: !wordCountOk ? `Declared ${script.word_count}, computed ${computedWordCount}, expected 120-180` : undefined,
  });

  const sectionNonEmpty = sections.every((section) => words(section.text).length >= 5);
  checks.push({
    id: 'section-non-empty',
    pass: sectionNonEmpty,
    message: !sectionNonEmpty ? 'One or more sections have <5 words' : undefined,
  });

  const allText = sections.map((section) => section.text).join(' ');
  const discouragingPattern = /\b(stupid|idiot|lazy|hopeless|dumb)\b/i;
  checks.push({
    id: 'supportive-tone',
    pass: !discouragingPattern.test(allText),
    message: discouragingPattern.test(allText) ? 'Discouraging language detected' : undefined,
  });

  const biasPatterns = [
    /\b(boys?|girls?)\s+(are|were|can't|cannot|shouldn't)\b/i,
    /\b(men|women)\s+(are|were|can't|cannot|shouldn't)\b/i,
    /\basians?\s+(are|were)\b/i,
    /\b(white|black|hispanic|latino|latina)\s+(students?|kids?|people)\b/i,
  ];
  const hasBias = biasPatterns.some((pattern) => pattern.test(allText));
  checks.push({
    id: 'no-bias-risk',
    pass: !hasBias,
    message: hasBias ? 'Demographic bias pattern detected' : undefined,
  });

  const foundMarkers = BRAINROT_MARKERS.filter((marker) => allText.toLowerCase().includes(marker));
  checks.push({
    id: 'brainrot-tone',
    pass: foundMarkers.length >= 3,
    message: foundMarkers.length < 3 ? `Only ${foundMarkers.length} brainrot markers found` : undefined,
  });

  const misconception = sections.find((section) => section.label === 'misconception_callout');
  const errorTargeting = !!misconception?.text.toLowerCase().includes(input.error_classification.toLowerCase());
  checks.push({
    id: 'error-targeting',
    pass: errorTargeting,
    message: !errorTargeting ? `misconception_callout missing '${input.error_classification}'` : undefined,
  });

  const concept = sections.find((section) => section.label === 'concept_explanation');
  const conceptWords = keywordSet(input.rag.concept_explanations);
  const conceptGrounding = input.rag.concept_explanations.length === 0 || (concept ? hasKeywordOverlap(concept.text, conceptWords) : false);
  checks.push({
    id: 'concept-grounding',
    pass: conceptGrounding,
    message: !conceptGrounding ? 'concept_explanation shares no keywords with concept_explanations' : undefined,
  });

  const example = sections.find((section) => section.label === 'worked_example');
  const exampleWords = keywordSet(input.rag.worked_examples);
  const exampleGrounding = input.rag.worked_examples.length === 0 || (example ? hasKeywordOverlap(example.text, exampleWords) : false);
  checks.push({
    id: 'example-grounding',
    pass: exampleGrounding,
    message: !exampleGrounding ? 'worked_example shares no keywords with worked_examples' : undefined,
  });

  const practice = sections.find((section) => section.label === 'practice_cta');
  const misconceptionWords = keywordSet(input.rag.misconception_data);
  const practiceTargeting = !!practice && (
    practice.text.toLowerCase().includes(input.error_classification.toLowerCase()) ||
    hasKeywordOverlap(practice.text, misconceptionWords)
  );
  checks.push({
    id: 'practice-targeting',
    pass: practiceTargeting,
    message: !practiceTargeting ? 'practice_cta missing error/misconception references' : undefined,
  });

  const expectedFullScript = sections.map((section) => section.text.trim()).join(' ').trim();
  checks.push({
    id: 'full-script-coherence',
    pass: script.full_script.trim() === expectedFullScript,
    message: script.full_script.trim() !== expectedFullScript ? 'full_script does not match concatenated sections' : undefined,
  });

  return checks;
}

function checkWeeklyInsights(output: WeeklyInsightsAgentOutput, input: WeeklyLearningState): RubricCheck[] {
  const checks: RubricCheck[] = [];
  const { recap, attempts, checker_history } = output;

  checks.push({
    id: 'attempt-limit',
    pass: attempts <= 3,
    message: attempts > 3 ? `${attempts} attempts exceeds max` : undefined,
  });

  checks.push({
    id: 'checker-pass',
    pass: checker_history.length > 0,
    message: checker_history.length === 0 ? 'No checker history' : undefined,
  });

  const allSections = !!(recap.main_character && recap.flop_era && recap.ghost_topics && recap.plot_twist && recap.weekly_quest);
  checks.push({
    id: 'five-sections-present',
    pass: allSections,
    message: !allSections ? 'One or more sections missing' : undefined,
  });

  const topImproved = input.improved_topics[0];
  const worstDeclined = input.declined_topics[input.declined_topics.length - 1] ?? input.declined_topics[0];

  const mcOk = recap.main_character?.topic === topImproved?.topic &&
    Math.abs(recap.main_character?.mastery_delta - (topImproved?.mastery_delta ?? 0)) < 0.0001 &&
    recap.main_character?.attempts === topImproved?.attempts;
  checks.push({
    id: 'main-character-stat-fidelity',
    pass: mcOk,
    message: !mcOk ? `Expected topic=${topImproved?.topic}, delta=${topImproved?.mastery_delta}, attempts=${topImproved?.attempts}` : undefined,
  });

  const flopOk = recap.flop_era?.topic === worstDeclined?.topic &&
    Math.abs(recap.flop_era?.accuracy_rate - (worstDeclined?.accuracy_rate ?? 0)) < 0.0001;
  checks.push({
    id: 'flop-era-stat-fidelity',
    pass: flopOk,
    message: !flopOk ? `Expected topic=${worstDeclined?.topic}, accuracy=${worstDeclined?.accuracy_rate}` : undefined,
  });

  const ghostOk = recap.ghost_topics?.every((gt) => {
    const match = input.untouched_topics.find((topic) => topic.topic === gt.topic);
    return !!match && Math.abs(gt.estimated_decay - match.estimated_decay) < 0.0001;
  }) ?? true;
  checks.push({
    id: 'ghost-topics-fidelity',
    pass: ghostOk,
    message: !ghostOk ? 'One or more ghost_topics have incorrect topic or estimated_decay' : undefined,
  });

  const isShortSession = input.avg_session_minutes < 15;
  let expectedCount: number;
  if (isShortSession) expectedCount = 2;
  else if (input.previous_week_quest_completion_rate < 0.4) expectedCount = 1;
  else if (input.previous_week_quest_completion_rate < 0.75) expectedCount = 2;
  else expectedCount = 3;

  checks.push({
    id: 'quest-count-and-calibration',
    pass: recap.weekly_quest?.length === expectedCount,
    message: recap.weekly_quest?.length !== expectedCount ? `Expected ${expectedCount} quest items, got ${recap.weekly_quest?.length}` : undefined,
  });

  const timeBound = /\b(week|day|days|daily|weekly|minutes?|hours?|this week|per day)\b/i;
  const hasNumber = /\d+/;
  const questActionable = recap.weekly_quest?.every((item) => timeBound.test(item.action) && hasNumber.test(item.action)) ?? false;
  checks.push({
    id: 'quest-actionability',
    pass: questActionable,
    message: !questActionable ? 'One or more quest items lack a number or time-bound language' : undefined,
  });

  const noContra = recap.main_character?.topic !== recap.flop_era?.topic;
  checks.push({
    id: 'no-section-contradiction',
    pass: noContra,
    message: !noContra ? 'main_character.topic equals flop_era.topic' : undefined,
  });

  const discouragingPattern = /\b(stupid|idiot|lazy|hopeless|dumb)\b/i;
  const allText = [
    recap.main_character?.narrative ?? '',
    recap.flop_era?.narrative ?? '',
    recap.plot_twist?.insight ?? '',
    ...(recap.weekly_quest?.map((q) => `${q.action} ${q.rationale}`) ?? []),
  ].join(' ');
  checks.push({
    id: 'no-discouraging-tone',
    pass: !discouragingPattern.test(allText),
    message: discouragingPattern.test(allText) ? 'Discouraging language detected' : undefined,
  });

  const biasPatterns = [
    /\b(boys?|girls?)\s+(are|were|can't|cannot|shouldn't)\b/i,
    /\b(men|women)\s+(are|were|can't|cannot|shouldn't)\b/i,
  ];
  const hasBias = biasPatterns.some((pattern) => pattern.test(allText));
  checks.push({
    id: 'no-bias-risk',
    pass: !hasBias,
    message: hasBias ? 'Demographic bias detected' : undefined,
  });

  return checks;
}

async function runEval(): Promise<void> {
  let totalChecks = 0;
  let passedChecks = 0;
  const failures: string[] = [];

  console.log('\n=== Crash Course Agent Eval (14 checks × 5 fixtures) ===\n');

  for (let i = 0; i < crashCourseFixtures.length; i++) {
    const input = crashCourseFixtures[i];
    const output = await runCrashCourseAgent(input);
    const checks = checkCrashCourse(output, input);

    console.log(`Fixture CC-${i + 1} (${input.student_id}, ${input.error_classification}):`);
    for (const check of checks) {
      totalChecks++;
      if (check.pass) {
        passedChecks++;
        console.log(`  ✓ ${check.id}`);
      } else {
        console.log(`  ✗ ${check.id}: ${check.message}`);
        failures.push(`CC-${i + 1} / ${check.id}: ${check.message}`);
      }
    }
    console.log();
  }

  console.log('\n=== Weekly Insights Agent Eval (11 checks × 5 fixtures) ===\n');

  for (let i = 0; i < weeklyInsightsFixtures.length; i++) {
    const input = weeklyInsightsFixtures[i];
    const output = await runWeeklyInsightsAgent(input);
    const checks = checkWeeklyInsights(output, input);

    console.log(`Fixture WI-${i + 1} (${input.student_id}):`);
    for (const check of checks) {
      totalChecks++;
      if (check.pass) {
        passedChecks++;
        console.log(`  ✓ ${check.id}`);
      } else {
        console.log(`  ✗ ${check.id}: ${check.message}`);
        failures.push(`WI-${i + 1} / ${check.id}: ${check.message}`);
      }
    }
    console.log();
  }

  console.log(`\n=== Results: ${passedChecks}/${totalChecks} checks passed ===\n`);

  if (failures.length > 0) {
    console.log('FAILURES:');
    for (const failure of failures) {
      console.log(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log('All rubric checks passed.');
}

runEval().catch((error) => {
  console.error('Eval harness error:', error);
  process.exit(1);
});
