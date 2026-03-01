import express from 'express';
import { createProcessEventHandler } from './handlers/process-event.js';
import { handleCrashCourseAgent } from './handlers/crash-course-agent.js';
import { handleWeeklyInsightsAgent } from './handlers/weekly-insights-agent.js';
import { stateStore } from './adapters/state-store.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'edu-rot-pipeline',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/v1/events', createProcessEventHandler(stateStore));
app.post('/api/v1/agents/crash-course', handleCrashCourseAgent);
app.post('/api/v1/agents/weekly-insights', handleWeeklyInsightsAgent);

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error);
  process.exit(1);
});

app.listen(PORT, () => {
  console.log(`edu-rot-pipeline running on port ${PORT}`);
});

export { app };
