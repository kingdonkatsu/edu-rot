import type { Request, Response } from 'express';
import { validateCrashCourseAgentInput } from '../utils/validation.js';
import {
  AgentValidationError,
  runCrashCourseAgent,
} from '../services/crash-course-agent.js';
import { AgentConfigError, OpenAIRequestError } from '../services/openai-agent-client.js';

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
        error: 'Upstream LLM provider request failed',
        status: err.status,
      });
      return;
    }
    console.error('[handleCrashCourseAgent] Agent error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
