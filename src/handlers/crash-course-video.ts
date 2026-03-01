import type { Request, Response } from 'express';
import { validateCrashCourseVideoRenderRequest } from '../utils/validation.js';
import {
  createCrashCourseVideoRender,
  getVideoContentBuffer,
  getVideoJobStatus,
} from '../services/sora-video-client.js';
import { AgentConfigError, OpenAIRequestError } from '../services/openai-agent-client.js';
import { AgentValidationError } from '../services/crash-course-agent.js';

export async function handleCreateCrashCourseVideo(req: Request, res: Response): Promise<void> {
  const validation = validateCrashCourseVideoRenderRequest(req.body);
  if (!validation.valid) {
    res.status(400).json({
      error: 'Validation failed',
      details: validation.errors,
    });
    return;
  }

  try {
    const result = await createCrashCourseVideoRender(validation.data!);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof AgentValidationError) {
      res.status(422).json({
        error: 'Crash course content failed validation after max retries',
        checker_history: err.checkerHistory,
      });
      return;
    }
    if (err instanceof AgentConfigError) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (err instanceof OpenAIRequestError) {
      res.status(502).json({
        error: 'Upstream provider request failed',
        status: err.status,
      });
      return;
    }
    console.error('[handleCreateCrashCourseVideo] Video render error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function handleGetVideoStatus(req: Request, res: Response): Promise<void> {
  const rawVideoId = req.params.videoId;
  const videoId = Array.isArray(rawVideoId) ? rawVideoId[0] : rawVideoId;
  if (!videoId) {
    res.status(400).json({ error: 'videoId is required' });
    return;
  }

  try {
    const status = await getVideoJobStatus(videoId);
    res.status(200).json(status);
  } catch (err) {
    if (err instanceof AgentConfigError) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (err instanceof OpenAIRequestError) {
      res.status(502).json({
        error: 'Upstream provider request failed',
        status: err.status,
      });
      return;
    }
    console.error('[handleGetVideoStatus] Video status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function handleGetVideoContent(req: Request, res: Response): Promise<void> {
  const rawVideoId = req.params.videoId;
  const videoId = Array.isArray(rawVideoId) ? rawVideoId[0] : rawVideoId;
  if (!videoId) {
    res.status(400).json({ error: 'videoId is required' });
    return;
  }

  try {
    const { contentType, data } = await getVideoContentBuffer(videoId);
    res.setHeader('Content-Type', contentType);
    res.status(200).send(data);
  } catch (err) {
    if (err instanceof AgentConfigError) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (err instanceof OpenAIRequestError) {
      res.status(502).json({
        error: 'Upstream provider request failed',
        status: err.status,
      });
      return;
    }
    console.error('[handleGetVideoContent] Video content error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
