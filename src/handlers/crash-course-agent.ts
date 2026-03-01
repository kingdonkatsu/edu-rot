import type { Request, Response } from 'express';
import { validateCrashCourseInput } from '../utils/validation.js';
import { runCrashCourseAgent } from '../services/crash-course-agent.js';

export function createCrashCourseHandler() {
  return async function handleCrashCourse(req: Request, res: Response): Promise<void> {
    const validation = validateCrashCourseInput(req.body);

    if (!validation.valid) {
      res.status(400).json({ error: 'Validation failed', details: validation.errors });
      return;
    }

    try {
      const result = await runCrashCourseAgent(validation.data!);

      // Generate video for CrashCourse (using first card summary)
      if (result.cards.length > 0) {
        try {
          const { generateBrainRotVideo } = await import('../services/video-service.js');
          result.video_url = await generateBrainRotVideo(result.cards[0].body, validation.data!.student_id);
        } catch (vErr) {
          console.error('[handleCrashCourse] Video generation failed:', vErr);
        }
      }

      res.status(200).json(result);
    } catch (err) {
      console.error('[handleCrashCourse] Agent error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
