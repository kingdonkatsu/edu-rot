# edu-rot

AI-powered EdTech backend and web dashboard for adaptive learning interventions, voiceover crash courses, and analytics-driven progress tracking.

## What It Does

Edu-rot processes LMS learning events, updates student mastery using multiple learning algorithms, and provides:

- Crash Course Agent output as a 6-section, ~1-minute voiceover script
- Weekly Insights Agent recaps with actionable weekly quests
- Media pipeline: script -> Azure TTS MP3 -> FFmpeg assembled video
- Student analytics dashboard with 10 visualizations

## Architecture Overview

```text
LMS Event -> /api/v1/events
  -> Decay (Ebbinghaus)
  -> BKT
  -> EMA
  -> Flags + Intervention
  -> InMemoryStateStore (adapter)

Crash Course Input -> /api/v1/agents/crash-course
  -> Script Maker + Checker Gates (max 3 attempts)
  -> VoiceoverScript output

Crash Course Video -> /api/v1/agents/crash-course/video
  -> Crash Course Agent
  -> TTS Service (Azure or Mock)
  -> Video Assembly Service (FFmpeg or Mock)
  -> Blob URL outputs

Analytics API -> /api/v1/analytics/:studentId/*
  -> state-store.getAllForStudent()
  -> velocity, engagement, forgetting, spaced repetition, error heatmap
  -> dashboard payload for Chart.js frontend
```

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- Optional for real media pipeline: Azure Speech + Azure Blob configuration

### Install

```bash
npm install
```

### Run in Dev

```bash
npm run dev
```

Open `http://localhost:3000`.

### Build

```bash
npm run build
```

### Test

```bash
npm test
npm run eval:agents
```

## API Reference

### Core

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/v1/fixtures` | Fixture payloads for frontend demos |
| POST | `/api/v1/events` | Process one LMS event through Decay/BKT/EMA pipeline |

### Agents

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/agents/crash-course` | Generate voiceover script crash course |
| POST | `/api/v1/agents/weekly-insights` | Generate weekly recap + quest |
| POST | `/api/v1/agents/crash-course/video` | End-to-end pipeline (agent -> TTS -> FFmpeg video) |

### Analytics

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/analytics/:studentId/dashboard` | Full analytics payload for dashboard |
| GET | `/api/v1/analytics/:studentId/forgetting-curves` | Forgetting projections by concept |
| GET | `/api/v1/analytics/:studentId/review-schedule` | Spaced repetition schedule |
| GET | `/api/v1/analytics/:studentId/error-heatmap` | Error frequency heatmap matrix |

### Media

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/media/tts` | Convert script to MP3 |
| POST | `/api/v1/media/video` | Assemble MP4 from background + audio |

## Agents

### Crash Course Agent

Input: student/topic/subtopic/error + RAG snippets.

Output:

- `script.title`
- `script.target_duration_seconds` (~60)
- 6 ordered sections:
  - `hook`
  - `misconception_callout`
  - `intuition_bridge`
  - `concept_explanation`
  - `worked_example`
  - `practice_cta`
- `script.full_script`
- `script.word_count` (120-180 target)

Checker gates enforce tone, grounding, targeting, and coherence.

### Weekly Insights Agent

Generates:

- Main Character
- Flop Era
- Ghost Topics
- Plot Twist
- Weekly Quest

## Learning Algorithms

### Event Pipeline (existing)

- Ebbinghaus Decay
- Bayesian Knowledge Tracing (BKT)
- Exponential Moving Average (EMA)

### Analytics Layer (new)

- Learning Velocity
- Engagement Score
- Forgetting Curve Projection
- Spaced Repetition Scheduler
- Error Pattern Heatmap

## Media Pipeline

```text
Crash Course Script
  -> Azure TTS (or MockTTSService)
  -> MP3 in Blob (audio container)
  -> FFmpeg overlay with background video
  -> MP4 in Blob (output container)
```

Background selection convention:

- `backgrounds/{topic}.mp4`
- fallback `backgrounds/general.mp4`

## Dashboard Visualizations

The web UI renders 10 analytics views:

1. Mastery Over Time
2. Forgetting Curve Projection
3. EMA Momentum Trend
4. Error Pattern Heatmap
5. Engagement Score Radar
6. Topic Mastery Comparison
7. Spaced Repetition Calendar
8. Learning Velocity Gauge
9. Cumulative Accuracy Trend
10. Weekly Activity Heatmap

## Configuration

Set environment variables in `.env`.

| Variable | Description |
|---|---|
| `PORT` | Server port |
| `NODE_ENV` | Runtime environment |
| `AZURE_SPEECH_KEY` | Azure Speech subscription key |
| `AZURE_SPEECH_REGION` | Azure Speech region |
| `AZURE_SPEECH_VOICE` | Neural voice name (example: `en-US-JennyNeural`) |
| `AZURE_BLOB_CONNECTION_STRING` | Blob storage connection string |
| `AZURE_BLOB_CONTAINER_AUDIO` | Audio output container |
| `AZURE_BLOB_CONTAINER_VIDEO` | Background video container |
| `AZURE_BLOB_CONTAINER_OUTPUT` | Final assembled video container |

If Azure vars are missing, server auto-falls back to mock media services.

## Testing

```bash
npm run build
npm test
npm run eval:agents
```

- `npm test` runs unit + integration tests (Vitest)
- `npm run eval:agents` runs rubric checks for both agents

## Project Structure

```text
src/
  adapters/
    azure-tts.ts
    state-store.ts
  handlers/
    analytics.ts
    media.ts
    process-event.ts
    crash-course-agent.ts
    weekly-insights-agent.ts
  services/
    pipeline.ts
    crash-course-agent.ts
    weekly-insights-agent.ts
    learning-velocity.ts
    engagement.ts
    forgetting-projection.ts
    spaced-repetition.ts
    error-heatmap.ts
    video-assembly.ts
  eval/
  utils/
  types.ts
  server.ts

public/
  index.html
  app.js
  dashboard.js
  style.css

tests/
  unit/
  integration/
  CHECKLIST.md
```
