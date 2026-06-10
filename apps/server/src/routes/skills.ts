import { Router } from 'express';
import { listDefaultSkills } from '@alpha-agent/agent-core';

export const skillsRouter = Router();

skillsRouter.get('/api/skills', async (_req, res, next) => {
  try {
    res.json({ skills: await listDefaultSkills() });
  } catch (error) {
    next(error);
  }
});
