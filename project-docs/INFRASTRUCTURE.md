# Infrastructure

> Deployment and environment details.

## Environments

| Environment | Description |
|-------------|-------------|
| Development | Local Express server with in-memory state store |

## Deployment

```bash
# Development
npm run dev          # Starts with tsx watch on port 3000

# Build
npm run build        # Compiles TypeScript to dist/

# Production (future)
npm start            # Runs compiled JS from dist/
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/v1/events` | Process LMS interaction event |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | HTTP server port |
| NODE_ENV | development | Runtime environment |

## Monitoring

Health check available at `GET /health`. Returns:
```json
{ "status": "ok", "service": "edu-rot-pipeline", "timestamp": "..." }
```
