# Infrastructure

## Runtime Environments

| Environment | Description |
|---|---|
| Development | Local Express + static frontend + in-memory state store |
| CI/Test | Vitest + eval harness, no cloud dependency required (mock fallbacks) |
| Production (target) | Azure App Service or container runtime with Blob + Speech configured |

## Deployment Commands

```bash
npm run dev
npm run build
npm start
```

## HTTP Endpoints

### Health and Fixtures

| Method | Path |
|---|---|
| GET | `/health` |
| GET | `/api/v1/fixtures` |

### Event Pipeline

| Method | Path |
|---|---|
| POST | `/api/v1/events` |

### Agents

| Method | Path |
|---|---|
| POST | `/api/v1/agents/crash-course` |
| POST | `/api/v1/agents/weekly-insights` |
| POST | `/api/v1/agents/crash-course/video` |

### Analytics

| Method | Path |
|---|---|
| GET | `/api/v1/analytics/:studentId/dashboard` |
| GET | `/api/v1/analytics/:studentId/forgetting-curves` |
| GET | `/api/v1/analytics/:studentId/review-schedule` |
| GET | `/api/v1/analytics/:studentId/error-heatmap` |

### Media

| Method | Path |
|---|---|
| POST | `/api/v1/media/tts` |
| POST | `/api/v1/media/video` |

## Environment Variables

| Variable | Required for Mock Mode | Required for Azure Mode | Description |
|---|---|---|---|
| `PORT` | No | No | HTTP port |
| `NODE_ENV` | No | No | Runtime mode |
| `AZURE_SPEECH_KEY` | No | Yes | Speech subscription key |
| `AZURE_SPEECH_REGION` | No | Yes | Speech region |
| `AZURE_SPEECH_VOICE` | No | Recommended | Neural TTS voice name |
| `AZURE_BLOB_CONNECTION_STRING` | No | Yes | Blob connection string |
| `AZURE_BLOB_CONTAINER_AUDIO` | No | Yes | MP3 output container |
| `AZURE_BLOB_CONTAINER_VIDEO` | No | Yes | Background video container |
| `AZURE_BLOB_CONTAINER_OUTPUT` | No | Yes | Final MP4 output container |

## Media Pipeline Infrastructure

### TTS

- Adapter: `AzureTTSService`
- Upload target: `AZURE_BLOB_CONTAINER_AUDIO`
- Output: direct blob URL + blob path + duration

### Video Assembly

- Service: `FFmpegVideoAssemblyService`
- Binary: `ffmpeg-static`
- Input background path convention:
  - `backgrounds/{topic}.mp4`
  - fallback `backgrounds/general.mp4`
- Output upload target: `AZURE_BLOB_CONTAINER_OUTPUT`

## Observability and Failure Modes

- `/health` returns service status and timestamp.
- Unhandled promise rejections and uncaught exceptions are logged and terminate process.
- Analytics/media handlers return `500` on internal failures.
- Media services fallback to mocks when Azure config is unavailable.

---

## Production Deployment (Azure App Service + Docker)

### Architecture

```
push to main → GitHub Actions → npm test → docker build → push to ACR → App Service redeploy
```

### One-Time Azure Provisioning

Run these once from your local machine with the Azure CLI:

```bash
# 1. Resource group
az group create --name edu-rot-rg --location eastus

# 2. Container Registry (Basic SKU ~$5/mo)
az acr create --resource-group edu-rot-rg --name edurotacr --sku Basic --admin-enabled true

# 3. App Service Plan (B1 Linux ~$13/mo — cheapest always-on plan)
az appservice plan create --name edu-rot-plan --resource-group edu-rot-rg --sku B1 --is-linux

# 4. Web App for Containers
az webapp create \
  --resource-group edu-rot-rg \
  --plan edu-rot-plan \
  --name edu-rot-app \
  --deployment-container-image-name edurotacr.azurecr.io/edu-rot:latest

# 5. Configure App Service to pull from ACR
az webapp config container set \
  --resource-group edu-rot-rg \
  --name edu-rot-app \
  --docker-registry-server-url https://edurotacr.azurecr.io \
  --docker-registry-server-user $(az acr credential show --name edurotacr --query username -o tsv) \
  --docker-registry-server-password $(az acr credential show --name edurotacr --query passwords[0].value -o tsv)

# 6. Set all environment variables
az webapp config appsettings set \
  --resource-group edu-rot-rg \
  --name edu-rot-app \
  --settings \
    NODE_ENV=production \
    PORT=8080 \
    ANTHROPIC_API_KEY=<your-key> \
    AZURE_SPEECH_KEY=<your-key> \
    AZURE_SPEECH_REGION=eastus \
    AZURE_SPEECH_VOICE=en-US-JennyNeural \
    AZURE_BLOB_CONNECTION_STRING="<your-connection-string>" \
    AZURE_BLOB_CONTAINER_AUDIO=audio \
    AZURE_BLOB_CONTAINER_VIDEO=background-videos \
    AZURE_BLOB_CONTAINER_OUTPUT=generated-videos

# 7. Create service principal for GitHub Actions
az ad sp create-for-rbac \
  --name edu-rot-gh-actions \
  --role contributor \
  --scopes /subscriptions/<your-subscription-id>/resourceGroups/edu-rot-rg \
  --json-auth
# Copy the JSON output — you'll paste it as the AZURE_CREDENTIALS GitHub secret
```

### GitHub Secrets (set in repo Settings → Secrets → Actions)

| Secret | Where to get it |
|---|---|
| `AZURE_CREDENTIALS` | JSON output of `az ad sp create-for-rbac` above |
| `REGISTRY_LOGIN_SERVER` | e.g. `edurotacr.azurecr.io` |
| `REGISTRY_USERNAME` | `az acr credential show --name edurotacr --query username` |
| `REGISTRY_PASSWORD` | `az acr credential show --name edurotacr --query passwords[0].value` |
| `WEBAPP_NAME` | `edu-rot-app` (or whatever you named it) |

### CI/CD Pipeline

Defined in `.github/workflows/deploy.yml`. On every push to `main`:

1. **test job** — `npm ci && npm run build && npm test` (136 tests must pass)
2. **build-and-deploy job** (only runs if test passes) —
   - Logs into ACR
   - Builds Docker image tagged with `$GITHUB_SHA` + `latest`
   - Pushes to ACR
   - Deploys to App Service via `azure/webapps-deploy@v3`

### Local Container Test

Before pushing to main, verify the Docker build locally:

```bash
npm run build   # compile TypeScript first
docker build -t edu-rot:local .
docker run -p 8080:8080 --env-file .env edu-rot:local
curl http://localhost:8080/health   # → { status: 'ok' }
```

### Post-Deploy Verification

```bash
curl https://edu-rot-app.azurewebsites.net/health
# → { "status": "ok", "service": "edu-rot-pipeline", "timestamp": "..." }
```

App Service URL format: `https://<WEBAPP_NAME>.azurewebsites.net`
