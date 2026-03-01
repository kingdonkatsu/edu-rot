# edu-rot

> Scaffolded with [Claude Code Mastery Starter Kit](https://github.com/TheDecipherist/claude-code-mastery-project-starter-kit) (clean mode)

## Getting Started

This project was created with **clean mode** — all Claude Code infrastructure is in place with zero coding opinions. You decide your own language, framework, and structure.

## What's Included

- `.claude/` — 16 slash commands, 2 skills, 2 agents, 3 hooks
- `project-docs/` — Architecture, Infrastructure, and Decisions templates
- `tests/` — Test checklist and issue tracking templates
- `CLAUDE.md` — Security rules only (no coding opinions)
- `.env` / `.env.example` — Environment variable pattern

## Available Commands

Run `/help` in Claude Code to see all 16 available commands.

Agent eval command:

```bash
npm run eval:agents
```

This runs rubric-based quality checks for Crash Course and Weekly Insights agents
using curated fixtures in `src/eval/fixtures.ts`.

## Frontend Agent Calls

Typed frontend helpers are available in `src/client/agents-api.ts`.

Example usage:

```ts
import { postCrashCourseAgent, postWeeklyInsightsAgent } from './src/client/agents-api.js';

const crashCourse = await postCrashCourseAgent(payload, {
  baseUrl: 'http://localhost:3000',
});

const weeklyInsights = await postWeeklyInsightsAgent(weeklyPayload, {
  baseUrl: 'http://localhost:3000',
});
```

UI flow helpers are also available in `src/client/frontend-flows.ts`.

```ts
import { createFrontendAgentFlows } from './src/client/frontend-flows.js';

const flows = createFrontendAgentFlows();

// Use on topic-card tap
const crashDeck = await flows.onTopicCardTap(
  { topic: 'Algebra', subtopic: 'Linear equations' },
  {
    student_id: 'student-001',
    error_classification: 'procedural_error',
    mastery_level: 'developing',
    known_strengths: ['isolating variables'],
    rag: {
      concept_explanations: ['Balance both sides.'],
      misconception_data: ['moving terms across equals without changing sign'],
      analogies: ['A balance scale'],
      worked_examples: ['2x + 3 = 11 -> x = 4'],
    },
  },
  { baseUrl: 'http://localhost:3000' }
);

// Use for weekly recap fetch flow
const weeklyRecap = await flows.fetchWeeklyRecap(weeklyPayload, {
  baseUrl: 'http://localhost:3000',
});
```

## Project Documentation

| Document | Purpose |
|----------|---------|
| `project-docs/ARCHITECTURE.md` | System overview & data flow |
| `project-docs/INFRASTRUCTURE.md` | Deployment details |
| `project-docs/DECISIONS.md` | Architectural decisions |
