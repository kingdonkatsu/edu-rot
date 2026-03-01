import type { Request, Response } from 'express';
import { validateWeeklyLearningState } from '../utils/validation.js';
import {
  AgentValidationError,
  runWeeklyInsightsAgent,
} from '../services/weekly-insights-agent.js';
import { AgentConfigError, OpenAIRequestError } from '../services/openai-agent-client.js';

export async function handleWeeklyInsightsAgent(req: Request, res: Response): Promise<void> {
  const validation = validateWeeklyLearningState(req.body);

  if (!validation.valid) {
    res.status(400).json({
      error: 'Validation failed',
      details: validation.errors,
    });
    return;
  }

  try {
    const result = await runWeeklyInsightsAgent(validation.data!);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof AgentValidationError) {
      res.status(422).json({
        error: 'Weekly insights content failed validation after max retries',
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
    console.error('[handleWeeklyInsightsAgent] Agent error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
