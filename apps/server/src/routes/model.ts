import { Router } from 'express';
import { checkModelHealth } from '../services/modelHealthService.js';

export const modelRouter = Router();

modelRouter.post('/api/model/health', async (_req, res, next) => {
  try {
    res.json(await checkModelHealth());
  } catch (error) {
    next(error);
  }
});
