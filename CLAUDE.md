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

## Agent Contract (Current Source of Truth)

### Crash Course Agent

- Trigger context: topic-card tap flow
- Output MUST include:
  - `cards` with **exactly 5** cards in this fixed order:
    1. `specific_mistake`
    2. `intuition_analogy`
    3. `actual_concept`
    4. `worked_example`
    5. `practice_question`
  - `sora_video_prompt` (NOT `sofa_video_prompt`)
- Tone target: playful brainrot, but never insulting, discouraging, or biased
- Purpose: produce context + prompt bundle for `sora.ai` video generation
- Anti-hallucination: concept/worked-example/practice content must stay grounded in RAG inputs

### Weekly Insights Agent

- Trigger context: weekly scheduled flow
- Output MUST preserve fixed 5 sections:
  1. `main_character`
  2. `flop_era`
  3. `ghost_topics`
  4. `plot_twist`
  5. `weekly_quest`
- No hallucinated stats: all numeric claims must match input data
- No bias/stereotyping language
- Weekly quest must be actionable, calibrated to prior completion rate, and aligned to struggling/untouched topics

### Required Quality Gates Before Commit/PR

Run all three:

```bash
npm run build
npm test
npm run eval:agents
```

Expect:
- tests pass
- eval report passes all rubric checks (Crash Course + Weekly Insights)

---

## Naming — NEVER Rename Mid-Project

If you must rename packages, modules, or key variables:

1. Create a checklist of ALL files and references first
2. Use IDE semantic rename (not search-and-replace)
3. Full project search for old name after renaming
4. Check: .md files, .txt files, .env files, comments, strings, paths
5. Start a FRESH Claude session after renaming
