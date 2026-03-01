import type { Request, Response } from 'express';
import { validateWeeklyInsightsInput } from '../utils/validation.js';
import { runWeeklyInsightsAgent } from '../services/weekly-insights-agent.js';

export function createWeeklyInsightsHandler() {
  return async function handleWeeklyInsights(req: Request, res: Response): Promise<void> {
    const validation = validateWeeklyInsightsInput(req.body);

    if (!validation.valid) {
      res.status(400).json({ error: 'Validation failed', details: validation.errors });
      return;
    }

    try {
      const result = await runWeeklyInsightsAgent(validation.data!);
      res.status(200).json(result);
    } catch (err) {
      console.error('[handleWeeklyInsights] Agent error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
