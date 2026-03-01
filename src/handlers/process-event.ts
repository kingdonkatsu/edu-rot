import type { Request, Response } from 'express';
import { validateLMSEvent } from '../utils/validation.js';
import { runPipeline } from '../services/pipeline.js';
import type { IStateStore } from '../adapters/state-store.js';

export function createProcessEventHandler(store: IStateStore) {
  return async function handleProcessEvent(req: Request, res: Response): Promise<void> {
    const validation = validateLMSEvent(req.body);

    if (!validation.valid) {
      res.status(400).json({
        error: 'Validation failed',
        details: validation.errors,
      });
      return;
    }

    try {
      const result = await runPipeline(validation.data!, store);
      res.status(200).json(result);
    } catch (err) {
      console.error('[handleProcessEvent] Pipeline error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
