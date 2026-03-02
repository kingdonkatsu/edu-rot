# Architecture

## Overview

Edu-rot is an Express-based AI learning platform backend with a static web dashboard. It combines:

- Event-driven mastery updates (Decay + BKT + EMA)
- Two LLM-style agents (Crash Course and Weekly Insights)
- Media generation pipeline (Azure TTS + FFmpeg)
- Analytics API and Chart.js frontend

State is stored behind an adapter interface (`IStateStore`). The current implementation is in-memory for local/hackathon velocity.

## Core Components

| Component | Path | Responsibility |
|---|---|---|
| Server | `src/server.ts` | Route wiring, static hosting, service initialization |
| State Adapter | `src/adapters/state-store.ts` | Student concept state persistence + lookup |
| Event Handler | `src/handlers/process-event.ts` | Validates LMS events and runs event pipeline |
| Pipeline Orchestrator | `src/services/pipeline.ts` | Decay -> BKT -> EMA -> flags -> intervention |
| Crash Course Agent | `src/services/crash-course-agent.ts` | Voiceover script maker/checker control loop |
| Weekly Insights Agent | `src/services/weekly-insights-agent.ts` | Weekly recap maker/checker control loop |
| Analytics Services | `src/services/*.ts` | Velocity, engagement, forgetting, spaced repetition, heatmap |
| Analytics Handler | `src/handlers/analytics.ts` | Dashboard + analytics endpoints |
| Azure TTS Adapter | `src/adapters/azure-tts.ts` | Script-to-MP3 synthesis + Blob upload |
| Video Assembly Service | `src/services/video-assembly.ts` | FFmpeg MP4 assembly + Blob upload |
| Media Handler | `src/handlers/media.ts` | `/media/*` and crash-course/video orchestration |
| Frontend | `public/*` | Agent panels + analytics dashboard rendering |

## Data Flow

### Event Processing

```text
POST /api/v1/events
  -> validateLMSEvent
  -> load or initialize StudentConceptState
  -> computeDecay
  -> computeBKT
  -> computeEMA
  -> evaluateFlags
  -> computeIntervention
  -> append bounded interaction_history
  -> persist state
  -> return PipelineResponse
```

### Crash Course Script Generation

```text
POST /api/v1/agents/crash-course
  -> validateCrashCourseInput
  -> runCrashCourseAgent (max 3 attempts)
     -> defaultCrashCourseMaker
     -> defaultCrashCourseChecker (12 gates)
  -> return VoiceoverScript output
```

### Crash Course Video Pipeline

```text
POST /api/v1/agents/crash-course/video
  -> validate crash-course input
  -> runCrashCourseAgent
  -> ttsService.synthesize(script)
  -> videoService.assemble(audio + background)
  -> return script + audio + video URLs
```

### Analytics Dashboard

```text
GET /api/v1/analytics/:studentId/dashboard
  -> stateStore.getAllForStudent(studentId)
  -> compute analytics services
  -> build timeline/heatmap aggregates
  -> return dashboard payload
```

## State Model Notes

`StudentConceptState` now tracks:

- current mastery fields (`p_mastery`, `stability`, `ema`)
- attempts/streak counters
- bounded `interaction_history` for analytics
- `first_interaction_at` and `last_interaction_at`

This supports dashboard metrics without introducing a separate event-log store.

## Runtime Strategy

- If Azure config is present, use real Azure services.
- If Azure config is missing, auto-fallback to mock TTS/video services.
- This keeps local development and CI fully runnable without cloud credentials.
