import type { Request, Response } from 'express';
import { validateCrashCourseAgentInput } from '../utils/validation.js';
import { runCrashCourseAgent } from '../services/crash-course-agent.js';

export async function handleCrashCourseAgent(req: Request, res: Response): Promise<void> {
  const validation = validateCrashCourseAgentInput(req.body);

  if (!validation.valid) {
    res.status(400).json({
      error: 'Validation failed',
      details: validation.errors,
    });
    return;
  }

  try {
    const result = await runCrashCourseAgent(validation.data!);
    res.status(200).json(result);
  } catch (err) {
    console.error('[handleCrashCourseAgent] Agent error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
