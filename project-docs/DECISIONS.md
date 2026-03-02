# Architectural Decisions

## Decision: Voiceover Script Replaces Card Deck Output
- **Date:** 2026-03-02
- **Status:** Accepted
- **Context:** Product pivot from static 5-card learning decks to voiceover-first content suitable for media generation.
- **Decision:** Replace crash-course output with a 6-section `VoiceoverScript` contract and enforce checker gates for script quality, grounding, and tone.
- **Consequences:** Existing card/Sora clients are no longer compatible (intentional breaking change). Enables direct TTS handoff.
- **Alternatives considered:** Dual-shape output (temporary compatibility), endpoint versioning.

## Decision: Add History to In-Memory State Instead of New Event Store
- **Date:** 2026-03-02
- **Status:** Accepted
- **Context:** New analytics require time-series/session context not available in snapshot-only state.
- **Decision:** Extend `StudentConceptState` with bounded `interaction_history` and add `getAllForStudent` adapter method.
- **Consequences:** Higher memory usage, bounded retention required. Avoids complexity of introducing another persistence layer.
- **Alternatives considered:** Separate event-log adapter, snapshot approximations.

## Decision: Chart.js for Dashboard Visualizations
- **Date:** 2026-03-02
- **Status:** Accepted
- **Context:** Frontend is vanilla JS without React build tooling.
- **Decision:** Use Chart.js via CDN for 10 dashboard visualizations.
- **Consequences:** Fast integration and small footprint; sufficient chart variety for all required visualizations.
- **Alternatives considered:** D3 (overkill), Recharts (requires React), Plotly (heavier bundle).

## Decision: Synchronous Media Pipeline Endpoint
- **Date:** 2026-03-02
- **Status:** Accepted
- **Context:** Need rapid delivery and simple API for demo workflows.
- **Decision:** Implement `/api/v1/agents/crash-course/video` as synchronous orchestration (agent -> TTS -> FFmpeg).
- **Consequences:** Request latency can be several seconds; simpler client integration and no job queue needed.
- **Alternatives considered:** Async job orchestration, hybrid timeout fallback.

## Decision: FFmpeg Static Binary for Video Assembly
- **Date:** 2026-03-02
- **Status:** Accepted
- **Context:** Deploy target may not provide system FFmpeg binaries by default.
- **Decision:** Use `fluent-ffmpeg` with `ffmpeg-static` binary packaging.
- **Consequences:** Portable runtime behavior across local/dev/deploy at cost of larger dependency footprint.
- **Alternatives considered:** System-level FFmpeg install requirement, cloud transcoding service.

## Decision: Azure Service Auto-Fallback to Mocks
- **Date:** 2026-03-02
- **Status:** Accepted
- **Context:** Local and CI environments should run without cloud credentials.
- **Decision:** Detect missing Azure env vars and use `MockTTSService` / `MockVideoAssemblyService` automatically.
- **Consequences:** High developer ergonomics; production requires explicit env configuration validation.
- **Alternatives considered:** Fail-fast startup, per-request failures when unconfigured.
