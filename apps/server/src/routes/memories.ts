import { Router } from 'express';
import { listMemories, recallMemories } from '../repositories/runRepository.js';

export const memoriesRouter = Router();

memoriesRouter.get('/api/memories', async (req, res, next) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    res.json({ memories: query ? await recallMemories(query) : await listMemories() });
  } catch (error) {
    next(error);
  }
});
