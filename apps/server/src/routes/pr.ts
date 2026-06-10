import { Router } from 'express';
import { z } from 'zod';
import { createPullRequest, getPullRequestPreflight } from '../services/prService.js';

const createPullRequestSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  base: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
  draft: z.boolean().optional().default(true),
  files: z.array(z.string().min(1)).optional()
});

export const prRouter = Router();

prRouter.get('/api/pr/preflight', async (req, res, next) => {
  try {
    const files = typeof req.query.files === 'string' ? req.query.files.split(',').filter(Boolean) : undefined;
    const title = typeof req.query.title === 'string' ? req.query.title : undefined;
    const base = typeof req.query.base === 'string' ? req.query.base : undefined;
    res.json(await getPullRequestPreflight({ title, base, files }));
  } catch (error) {
    next(error);
  }
});

prRouter.post('/api/pr/create', async (req, res, next) => {
  try {
    const input = createPullRequestSchema.parse(req.body);
    const result = await createPullRequest(input);
    res.status(result.created ? 201 : 200).json(result);
  } catch (error) {
    next(error);
  }
});
