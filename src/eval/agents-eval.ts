/**
 * Rubric-based evaluation harness for both agents.
 * Run via: npm run eval:agents
 *
 * Crash Course rubric: 12 checks × 5 fixtures
 * Weekly Insights rubric: 11 checks × 5 fixtures
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

// --- Rubric check types ---

interface RubricCheck {
  id: string;
  pass: boolean;
  message?: string;
}

// --- Crash Course Rubric (12 checks) ---

const BRAINROT_MARKERS = [
  'no cap', 'lowkey', 'speedrun', 'npc', 'main character arc', 'brain lag', 'vibe check', 'glitch',
];

const STAGE_ORDER = ['specific_mistake', 'intuition_analogy', 'actual_concept', 'worked_example', 'practice_question'];

function checkCrashCourse(output: CrashCourseAgentOutput, input: CrashCourseAgentInput): RubricCheck[] {
  const checks: RubricCheck[] = [];
  const { cards, attempts, checker_history } = output;

  // 1. attempt-limit: ≤ 3 attempts
  checks.push({
    id: 'attempt-limit',
    pass: attempts <= 3,
    message: attempts > 3 ? `${attempts} attempts exceeds max of 3` : undefined,
  });

  // 2. checker-pass: at least one checker run
  checks.push({
    id: 'checker-pass',
    pass: checker_history.length > 0,
    message: checker_history.length === 0 ? 'No checker runs recorded' : undefined,
  });

  // 3. card-count-exact-5
  checks.push({
    id: 'card-count-exact-5',
    pass: cards.length === 5,
    message: cards.length !== 5 ? `Got ${cards.length} cards, expected 5` : undefined,
  });

  // 4. required-stage-order
  const stageOrderCorrect = cards.every((c, i) => c.stage === STAGE_ORDER[i]);
  checks.push({
    id: 'required-stage-order',
    pass: stageOrderCorrect,
    message: !stageOrderCorrect ? `Stages: ${cards.map(c => c.stage).join(', ')}` : undefined,
  });

  // 5. one-screen-card-size: body ≤ 280 chars and ≤ 3 sentences each
  // Sentence splitter: only split on terminal punctuation followed by whitespace or end,
  // so embedded dots (method calls, decimals) are not counted as sentence breaks.
  const sizeOk = cards.every(c => {
    if (c.body.length > 280) return false;
    const sentences = c.body.split(/[.!?]+(?=\s|$)/).filter(s => s.trim().length > 0);
    return sentences.length <= 3;
  });
  checks.push({
    id: 'one-screen-card-size',
    pass: sizeOk,
    message: !sizeOk ? 'One or more cards exceed 280 chars or 3 sentences' : undefined,
  });

  // 6. supportive-tone: no discouraging words
  const discouragingPattern = /\b(stupid|idiot|lazy|hopeless|dumb)\b/i;
  const allCardText = cards.map(c => c.title + ' ' + c.body).join(' ');
  checks.push({
    id: 'supportive-tone',
    pass: !discouragingPattern.test(allCardText),
    message: discouragingPattern.test(allCardText) ? 'Discouraging language detected' : undefined,
  });

  // 7. no-bias-risk
  const BIAS_PATTERNS = [
    /\b(boys?|girls?)\s+(are|were|can't|cannot|shouldn't)\b/i,
    /\b(men|women)\s+(are|were|can't|cannot|shouldn't)\b/i,
    /\basians?\s+(are|were)\b/i,
    /\b(white|black|hispanic|latino|latina)\s+(students?|kids?|people)\b/i,
  ];
  const hasBias = BIAS_PATTERNS.some(p => p.test(allCardText));
  checks.push({
    id: 'no-bias-risk',
    pass: !hasBias,
    message: hasBias ? 'Demographic bias pattern detected' : undefined,
  });

  // 8. brainrot-tone: ≥ 2 markers
  const deckTextLower = allCardText.toLowerCase();
  const foundMarkers = BRAINROT_MARKERS.filter(m => deckTextLower.includes(m));
  checks.push({
    id: 'brainrot-tone',
    pass: foundMarkers.length >= 2,
    message: foundMarkers.length < 2 ? `Only ${foundMarkers.length} brainrot markers found` : undefined,
  });

  // 9. diagnosed-error-targeting: card 1 must contain error_classification
  const card1HasError = cards.length >= 1 &&
    cards[0].body.toLowerCase().includes(input.error_classification.toLowerCase());
  checks.push({
    id: 'diagnosed-error-targeting',
    pass: card1HasError,
    message: !card1HasError ? `Card 1 missing '${input.error_classification}'` : undefined,
  });

  // 10. concept-grounding: card 3 shares ≥ 1 keyword with concept_explanations
  const conceptWords = new Set(
    input.rag.concept_explanations.join(' ').toLowerCase().split(/\W+/).filter(w => w.length > 4)
  );
  const card3Words = cards.length >= 3 ? cards[2].body.toLowerCase().split(/\W+/) : [];
  const hasConceptOverlap = card3Words.some(w => w.length > 4 && conceptWords.has(w));
  checks.push({
    id: 'concept-grounding',
    pass: hasConceptOverlap || input.rag.concept_explanations.length === 0,
    message: (!hasConceptOverlap && input.rag.concept_explanations.length > 0)
      ? 'Card 3 shares no keywords with concept_explanations'
      : undefined,
  });

  // 11. worked-example-grounding: card 4 shares ≥ 1 keyword with worked_examples
  const exampleWords = new Set(
    input.rag.worked_examples.join(' ').toLowerCase().split(/\W+/).filter(w => w.length > 4)
  );
  const card4Words = cards.length >= 4 ? cards[3].body.toLowerCase().split(/\W+/) : [];
  const hasExampleOverlap = card4Words.some(w => w.length > 4 && exampleWords.has(w));
  checks.push({
    id: 'worked-example-grounding',
    pass: hasExampleOverlap || input.rag.worked_examples.length === 0,
    message: (!hasExampleOverlap && input.rag.worked_examples.length > 0)
      ? 'Card 4 shares no keywords with worked_examples'
      : undefined,
  });

  // 12. practice-targeting: card 5 references error label or misconception_data keywords
  const card5Text = cards.length >= 5 ? cards[4].body.toLowerCase() : '';
  const hasErrorLabel = card5Text.includes(input.error_classification.toLowerCase());
  const misconceptionWords = new Set(
    input.rag.misconception_data.join(' ').toLowerCase().split(/\W+/).filter(w => w.length > 4)
  );
  const hasMisconceptionKw = card5Text.split(/\W+/).some(w => w.length > 4 && misconceptionWords.has(w));
  checks.push({
    id: 'practice-targeting',
    pass: hasErrorLabel || hasMisconceptionKw,
    message: !(hasErrorLabel || hasMisconceptionKw)
      ? 'Card 5 does not reference error label or misconception keywords'
      : undefined,
  });

  return checks;
}

// --- Weekly Insights Rubric (11 checks) ---

function checkWeeklyInsights(output: WeeklyInsightsAgentOutput, input: WeeklyLearningState): RubricCheck[] {
  const checks: RubricCheck[] = [];
  const { recap, attempts, checker_history } = output;

  // 1. attempt-limit
  checks.push({
    id: 'attempt-limit',
    pass: attempts <= 3,
    message: attempts > 3 ? `${attempts} attempts exceeds max` : undefined,
  });

  // 2. checker-pass
  checks.push({
    id: 'checker-pass',
    pass: checker_history.length > 0,
    message: checker_history.length === 0 ? 'No checker history' : undefined,
  });

  // 3. five-sections-present
  const allSections = !!(recap.main_character && recap.flop_era && recap.ghost_topics && recap.plot_twist && recap.weekly_quest);
  checks.push({
    id: 'five-sections-present',
    pass: allSections,
    message: !allSections ? 'One or more sections missing' : undefined,
  });

  const topImproved = input.improved_topics[0];
  const worstDeclined = input.declined_topics[input.declined_topics.length - 1] ?? input.declined_topics[0];

  // 4. main-character-stat-fidelity
  const mcOk = recap.main_character?.topic === topImproved?.topic &&
    Math.abs(recap.main_character?.mastery_delta - (topImproved?.mastery_delta ?? 0)) < 0.0001 &&
    recap.main_character?.attempts === topImproved?.attempts;
  checks.push({
    id: 'main-character-stat-fidelity',
    pass: mcOk,
    message: !mcOk ? `Expected topic=${topImproved?.topic}, delta=${topImproved?.mastery_delta}, attempts=${topImproved?.attempts}` : undefined,
  });

  // 5. flop-era-stat-fidelity
  const flopOk = recap.flop_era?.topic === worstDeclined?.topic &&
    Math.abs(recap.flop_era?.accuracy_rate - (worstDeclined?.accuracy_rate ?? 0)) < 0.0001;
  checks.push({
    id: 'flop-era-stat-fidelity',
    pass: flopOk,
    message: !flopOk ? `Expected topic=${worstDeclined?.topic}, accuracy=${worstDeclined?.accuracy_rate}` : undefined,
  });

  // 6. ghost-topics-fidelity
  const ghostOk = recap.ghost_topics?.every(gt => {
    const match = input.untouched_topics.find(t => t.topic === gt.topic);
    return match && Math.abs(gt.estimated_decay - match.estimated_decay) < 0.0001;
  }) ?? true;
  checks.push({
    id: 'ghost-topics-fidelity',
    pass: ghostOk,
    message: !ghostOk ? 'One or more ghost_topics have incorrect topic or estimated_decay' : undefined,
  });

  // 7. quest-count-and-calibration
  const isShortSession = input.avg_session_minutes < 15;
  let expectedCount: number;
  if (isShortSession) expectedCount = 2;
  else if (input.previous_week_quest_completion_rate < 0.4) expectedCount = 1;
  else if (input.previous_week_quest_completion_rate < 0.75) expectedCount = 2;
  else expectedCount = 3;

  checks.push({
    id: 'quest-count-and-calibration',
    pass: recap.weekly_quest?.length === expectedCount,
    message: recap.weekly_quest?.length !== expectedCount
      ? `Expected ${expectedCount} quest items, got ${recap.weekly_quest?.length}`
      : undefined,
  });

  // 8. quest-actionability
  const timeBound = /\b(week|day|days|daily|weekly|minutes?|hours?|this week|per day)\b/i;
  const hasNumber = /\d+/;
  const questActionable = recap.weekly_quest?.every(q => timeBound.test(q.action) && hasNumber.test(q.action)) ?? false;
  checks.push({
    id: 'quest-actionability',
    pass: questActionable,
    message: !questActionable ? 'One or more quest items lack a number or time-bound language' : undefined,
  });

  // 9. no-section-contradiction
  const noContra = recap.main_character?.topic !== recap.flop_era?.topic;
  checks.push({
    id: 'no-section-contradiction',
    pass: noContra,
    message: !noContra ? 'main_character.topic equals flop_era.topic' : undefined,
  });

  // 10. no-discouraging-tone
  const discouragingPattern = /\b(stupid|idiot|lazy|hopeless|dumb)\b/i;
  const allText = [
    recap.main_character?.narrative ?? '',
    recap.flop_era?.narrative ?? '',
    recap.plot_twist?.insight ?? '',
    ...(recap.weekly_quest?.map(q => q.action + ' ' + q.rationale) ?? []),
  ].join(' ');
  checks.push({
    id: 'no-discouraging-tone',
    pass: !discouragingPattern.test(allText),
    message: discouragingPattern.test(allText) ? 'Discouraging language detected' : undefined,
  });

  // 11. no-bias-risk
  const BIAS_PATTERNS = [
    /\b(boys?|girls?)\s+(are|were|can't|cannot|shouldn't)\b/i,
    /\b(men|women)\s+(are|were|can't|cannot|shouldn't)\b/i,
  ];
  const hasBias = BIAS_PATTERNS.some(p => p.test(allText));
  checks.push({
    id: 'no-bias-risk',
    pass: !hasBias,
    message: hasBias ? 'Demographic bias detected' : undefined,
  });

  return checks;
}

// --- Runner ---

async function runEval(): Promise<void> {
  let totalChecks = 0;
  let passedChecks = 0;
  const failures: string[] = [];

  console.log('\n=== Crash Course Agent Eval (12 checks × 5 fixtures) ===\n');

  for (let i = 0; i < crashCourseFixtures.length; i++) {
    const input = crashCourseFixtures[i];
    const output = await runCrashCourseAgent(input);
    const checks = checkCrashCourse(output, input);

    console.log(`Fixture CC-${i + 1} (${input.student_id}, ${input.error_classification}):`);
    for (const c of checks) {
      totalChecks++;
      if (c.pass) {
        passedChecks++;
        console.log(`  ✓ ${c.id}`);
      } else {
        console.log(`  ✗ ${c.id}: ${c.message}`);
        failures.push(`CC-${i + 1} / ${c.id}: ${c.message}`);
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
    for (const c of checks) {
      totalChecks++;
      if (c.pass) {
        passedChecks++;
        console.log(`  ✓ ${c.id}`);
      } else {
        console.log(`  ✗ ${c.id}: ${c.message}`);
        failures.push(`WI-${i + 1} / ${c.id}: ${c.message}`);
      }
    }
    console.log();
  }

  console.log(`\n=== Results: ${passedChecks}/${totalChecks} checks passed ===\n`);

  if (failures.length > 0) {
    console.log('FAILURES:');
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  } else {
    console.log('All rubric checks passed.');
  }
}

runEval().catch(err => {
  console.error('Eval harness error:', err);
  process.exit(1);
});
