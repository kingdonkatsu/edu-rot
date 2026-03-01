# Architecture

> Data Analytics Pipeline for AI-Powered EdTech Platform

## Overview

Stateless, event-driven HTTP API that receives LMS interaction events and produces a rich student knowledge state. A single Express process runs three sequential algorithms per event (Ebbinghaus Decay, Bayesian Knowledge Tracing, Exponential Moving Average), evaluates analytical flags, and returns an intervention recommendation.

State is persisted via an `IStateStore` adapter interface. The hackathon build uses an in-memory Map; swap to Cosmos DB by implementing the interface.

## Components

| Component | Path | Responsibility |
|-----------|------|----------------|
| Server | `src/server.ts` | Express app, routes, health check |
| Handler | `src/handlers/process-event.ts` | HTTP validation, error handling |
| Pipeline | `src/services/pipeline.ts` | Orchestrates algorithm steps |
| Decay | `src/services/decay.ts` | Ebbinghaus forgetting curve |
| BKT | `src/services/bkt.ts` | Bayesian Knowledge Tracing |
| EMA | `src/services/ema.ts` | Exponential Moving Average |
| Flags | `src/services/flags.ts` | Analytical flag evaluation |
| Intervention | `src/services/intervention.ts` | Priority + recommended actions |
| State Store | `src/adapters/state-store.ts` | IStateStore interface + InMemoryStateStore |

## Data Flow

```
POST /api/v1/events
  -> Validate payload (400 on failure)
  -> Load/init student-concept state
  -> Detect rapid-fire guessing
  -> Step 1: Ebbinghaus Decay (time-adjusted mastery prior)
  -> Step 2: BKT Update (Bayesian posterior + transition)
  -> Step 3: EMA Update (performance momentum)
  -> Update stability, streaks, history
  -> Evaluate flags (careless, lucky, decay, stagnation, improvement, mastery)
  -> Compute intervention priority
  -> Persist updated state
  -> Return JSON response
```

Critical: Decay runs before BKT so the Bayesian update uses a time-adjusted prior.

## Dependencies

| Package | Purpose |
|---------|---------|
| express | HTTP server |
| uuid | Event ID validation |
| typescript | Type safety (strict mode) |
| tsx | Dev runtime (watch mode) |
| vitest | Test runner |
