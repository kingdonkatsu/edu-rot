# CLAUDE.md — Project Instructions

---

## Critical Rules

### 0. NEVER Publish Sensitive Data

- NEVER commit passwords, API keys, tokens, or secrets to git/npm/docker
- NEVER commit `.env` files — ALWAYS verify `.env` is in `.gitignore`
- Before ANY commit: verify no secrets are included
- NEVER output secrets in suggestions, logs, or responses

### 1. NEVER Hardcode Credentials

- ALWAYS use environment variables for secrets
- NEVER put API keys, passwords, or tokens directly in code
- NEVER hardcode connection strings — use environment variables from .env

### 2. ALWAYS Ask Before Deploying

- NEVER auto-deploy, even if the fix seems simple
- NEVER assume approval — wait for explicit "yes, deploy"
- ALWAYS ask before deploying to production

---

## When Something Seems Wrong

Before jumping to conclusions:

- Missing UI element? → Check feature gates BEFORE assuming bug
- Empty data? → Check if services are running BEFORE assuming broken
- 404 error? → Check service separation BEFORE adding endpoint
- Auth failing? → Check which auth system BEFORE debugging
- Test failing? → Read the error message fully BEFORE changing code

---

## Project Documentation

| Document | Purpose | When to Read |
|----------|---------|--------------|
| `project-docs/ARCHITECTURE.md` | System overview & data flow | Before architectural changes |
| `project-docs/INFRASTRUCTURE.md` | Deployment details | Before environment changes |
| `project-docs/DECISIONS.md` | Architectural decisions | Before proposing alternatives |

**ALWAYS read relevant docs before making cross-service changes.**

---

## Git Workflow — Branch FIRST, Work Second

**Auto-branch hook is ON by default.** A hook blocks commits to `main`. **ALWAYS check and branch BEFORE editing any files:**

```bash
# MANDATORY first step — do this BEFORE writing or editing anything:
git branch --show-current
# If on main → create a feature branch IMMEDIATELY:
git checkout -b feat/<task-name>
# NOW start working.
```

If you edit files on `main` and then try to commit, the hook will block you. Branch first — it takes 1 second and avoids wasted work.

---

## Workflow Preferences

- Quality over speed — if unsure, ask before executing
- One task, one chat — `/clear` between unrelated tasks
- When testing: queue observations, fix in batch (not one at a time)

---

## Agent Architecture

### TypeScript Agents (src/services/)
Two agents implemented with **Maker → Checker → Retry** pattern (max 3 attempts, fail-open):

| Service | Endpoint | Input | Output |
|---------|----------|-------|--------|
| `crash-course-agent.ts` | `POST /api/v1/agents/crash-course` | `CrashCourseAgentInput` | 5 cards |
| `weekly-insights-agent.ts` | `POST /api/v1/agents/weekly-insights` | `WeeklyLearningState` | 5-section weekly recap |

### Key design rules
- Both agents accept optional `deps` (`{ maker?, checker? }`) for DI — always use DI in tests, never real makers
- Issues **accumulate** across retries (not replaced) — prevents whack-a-mole regressions
- Fail-open on max retries: return last draft regardless
- Sentence counter uses `/[.!?]+(?=\s|$)/` (terminal punctuation only) to handle embedded dots in code examples
### Quality gate commands
```bash
npm run build       # TypeScript must compile clean
npm test            # all unit + integration tests pass
npm run eval:agents # 115/115 rubric checks (12×5 CC + 11×5 WI)
```

### Files
- `src/types.ts` — all shared types including agent types
- `src/services/crash-course-agent.ts` — Maker, Checker (10 gates), control loop
- `src/services/weekly-insights-agent.ts` — Maker, Checker (11 gates), control loop
- `src/handlers/crash-course-agent.ts` / `weekly-insights-agent.ts` — Express handlers
- `src/client/agents-api.ts` — typed fetch client
- `src/client/frontend-flows.ts` — `onTopicCardTap()`, `fetchWeeklyRecap()`
- `src/utils/validation.ts` — `validateCrashCourseInput()`, `validateWeeklyInsightsInput()`
- `src/eval/agents-eval.ts` — rubric harness
- `src/eval/fixtures.ts` — 5 CC + 5 WI test fixtures
- `tests/unit/crash-course-agent.test.ts` — 16 unit tests
- `tests/unit/weekly-insights-agent.test.ts` — 22 unit tests

---

## Naming — NEVER Rename Mid-Project

If you must rename packages, modules, or key variables:

1. Create a checklist of ALL files and references first
2. Use IDE semantic rename (not search-and-replace)
3. Full project search for old name after renaming
4. Check: .md files, .txt files, .env files, comments, strings, paths
5. Start a FRESH Claude session after renaming
