import type { Request, Response } from 'express';
import { validateWeeklyLearningState } from '../utils/validation.js';
import { runWeeklyInsightsAgent } from '../services/weekly-insights-agent.js';

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
    console.error('[handleWeeklyInsightsAgent] Agent error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
