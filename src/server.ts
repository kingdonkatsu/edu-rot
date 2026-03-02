import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { stateStore } from './adapters/state-store.js';
import { createProcessEventHandler } from './handlers/process-event.js';
import { createCrashCourseHandler } from './handlers/crash-course-agent.js';
import { createWeeklyInsightsHandler } from './handlers/weekly-insights-agent.js';
import { createAnalyticsHandlers } from './handlers/analytics.js';
import {
  AzureTTSService,
  MockTTSService,
  hasAzureTTSConfig,
  type ITTSService,
} from './adapters/azure-tts.js';
import {
  FFmpegVideoAssemblyService,
  MockVideoAssemblyService,
  hasAzureVideoAssemblyConfig,
  type IVideoAssemblyService,
} from './services/video-assembly.js';
import { createMediaHandlers } from './handlers/media.js';
import { crashCourseFixtures, weeklyInsightsFixtures } from './eval/fixtures.js';
import { seedStoreFromFixtures } from './utils/seed-store.js';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/api/v1/fixtures', (_req, res) => {
  res.json({
    crashCourse: crashCourseFixtures,
    weeklyInsights: weeklyInsightsFixtures,
  });
});

const analyticsHandlers = createAnalyticsHandlers(stateStore);

let ttsService: ITTSService;
if (hasAzureTTSConfig()) {
  try {
    ttsService = new AzureTTSService();
  } catch (error) {
    console.warn('[server] AzureTTSService init failed, falling back to MockTTSService:', error);
    ttsService = new MockTTSService();
  }
} else {
  ttsService = new MockTTSService();
}

let videoService: IVideoAssemblyService;
if (hasAzureVideoAssemblyConfig()) {
  try {
    videoService = new FFmpegVideoAssemblyService();
  } catch (error) {
    console.warn('[server] FFmpegVideoAssemblyService init failed, falling back to MockVideoAssemblyService:', error);
    videoService = new MockVideoAssemblyService();
  }
} else {
  videoService = new MockVideoAssemblyService();
}

const mediaHandlers = createMediaHandlers(ttsService, videoService);

app.post('/api/v1/events', createProcessEventHandler(stateStore));
app.post('/api/v1/agents/crash-course', createCrashCourseHandler());
app.post('/api/v1/agents/weekly-insights', createWeeklyInsightsHandler());

app.get('/api/v1/analytics/:studentId/dashboard', analyticsHandlers.getDashboard);
app.get('/api/v1/analytics/:studentId/forgetting-curves', analyticsHandlers.getForgettingCurves);
app.get('/api/v1/analytics/:studentId/review-schedule', analyticsHandlers.getReviewSchedule);
app.get('/api/v1/analytics/:studentId/error-heatmap', analyticsHandlers.getErrorHeatmap);

app.post('/api/v1/media/tts', mediaHandlers.postTTS);
app.post('/api/v1/media/video', mediaHandlers.postVideo);
app.post('/api/v1/agents/crash-course/video', mediaHandlers.postCrashCourseVideo);

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
  seedStoreFromFixtures(stateStore).catch((err) => {
    console.error('[server] Failed to seed store:', err);
  });
});

export { app };
