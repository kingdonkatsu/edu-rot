import type { Request, Response } from 'express';
import { runCrashCourseAgent } from '../services/crash-course-agent.js';
import { validateCrashCourseInput } from '../utils/validation.js';
import type { ITTSService } from '../adapters/azure-tts.js';
import { MockVideoAssemblyService, type IVideoAssemblyService } from '../services/video-assembly.js';
import type { TTSRequest, VideoAssemblyRequest } from '../types.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

export function createMediaHandlers(ttsService: ITTSService, videoService: IVideoAssemblyService) {
  async function postTTS(req: Request, res: Response): Promise<void> {
    if (!isObject(req.body) || !('script' in req.body)) {
      res.status(400).json({ error: 'Validation failed', details: ['script is required'] });
      return;
    }

    try {
      const request = req.body as unknown as TTSRequest;
      const result = await ttsService.synthesize(request);
      res.status(200).json(result);
    } catch (error) {
      console.error('[media.tts] error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async function postVideo(req: Request, res: Response): Promise<void> {
    if (!isObject(req.body) || typeof req.body.audio_url !== 'string' || typeof req.body.background_key !== 'string') {
      res.status(400).json({ error: 'Validation failed', details: ['audio_url and background_key are required strings'] });
      return;
    }

    try {
      const request = req.body as unknown as VideoAssemblyRequest;
      const result = await videoService.assemble(request);
      res.status(200).json(result);
    } catch (error) {
      console.error('[media.video] error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async function postCrashCourseVideo(req: Request, res: Response): Promise<void> {
    const validation = validateCrashCourseInput(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: 'Validation failed', details: validation.errors });
      return;
    }

    try {
      const input = validation.data!;
      const crashCourseResult = await runCrashCourseAgent(input);

      const audio = await ttsService.synthesize({
        script: crashCourseResult.script,
        student_id: input.student_id,
        topic: input.topic,
        output_basename: `${input.student_id}-${input.topic}-${input.subtopic}`,
      });

      // If TTS is in mock mode, force mock video assembly to avoid FFmpeg trying to fetch an unreachable mock URL.
      const effectiveVideoService = audio.audio_url.startsWith('https://mock.')
        ? new MockVideoAssemblyService()
        : videoService;

      const video = await effectiveVideoService.assemble({
        audio_url: audio.audio_url,
        background_key: input.topic,
        output_basename: `${input.student_id}-${input.topic}-${input.subtopic}`,
      });

      res.status(200).json({
        script: crashCourseResult.script,
        audio,
        video,
        attempts: crashCourseResult.attempts,
        checker_history: crashCourseResult.checker_history,
      });
    } catch (error) {
      console.error('[media.crash-course-video] error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  return {
    postTTS,
    postVideo,
    postCrashCourseVideo,
  };
}
