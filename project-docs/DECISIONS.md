# Architectural Decisions

> Record of key technical decisions and their rationale.

## Template

### Decision: [Title]
- **Date:** YYYY-MM-DD
- **Status:** Accepted / Superseded / Deprecated
- **Context:** What prompted the decision
- **Decision:** What was decided
- **Consequences:** What are the trade-offs
- **Alternatives considered:** What else was evaluated

---

### Decision: Express over Azure Functions
- **Date:** 2026-03-01
- **Status:** Accepted
- **Context:** PRD specifies Azure Functions but this is a hackathon build needing fast local development
- **Decision:** Use Express for HTTP handling, running as a single Node.js process
- **Consequences:** No cloud dependency, instant startup, simpler debugging. Must be ported to Azure Functions for production.
- **Alternatives considered:** Azure Functions local emulator (too slow to set up), Fastify (Express is more familiar)

---

### Decision: In-memory Map over Cosmos DB
- **Date:** 2026-03-01
- **Status:** Accepted
- **Context:** PRD specifies Cosmos DB but hackathon needs zero-setup persistence
- **Decision:** Use a Map-based in-memory store behind an `IStateStore` adapter interface
- **Consequences:** Data lost on restart. Adapter pattern means Cosmos DB swap requires only implementing the interface — no pipeline code changes.
- **Alternatives considered:** SQLite (adds dependency), JSON file (race conditions), Cosmos DB emulator (heavyweight)

---

### Decision: Pure functions for algorithm modules
- **Date:** 2026-03-01
- **Status:** Accepted
- **Context:** Algorithm modules (decay, BKT, EMA) need to be independently testable
- **Decision:** Each module exports pure functions that take inputs and return results. No classes, no shared mutable state between modules.
- **Consequences:** Tests are trivial — import function, call with known inputs, assert outputs. No mocks needed for algorithm logic.
- **Alternatives considered:** Class-based services with DI (over-engineered for hackathon scope)
