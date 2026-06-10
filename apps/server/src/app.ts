import cors from 'cors';
import express from 'express';
import { pinoHttp } from 'pino-http';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { logger } from './logger.js';
import { healthRouter } from './routes/health.js';
import { memoriesRouter } from './routes/memories.js';
import { modelRouter } from './routes/model.js';
import { prRouter } from './routes/pr.js';
import { runsRouter } from './routes/runs.js';
import { sandboxRouter } from './routes/sandbox.js';
import { skillsRouter } from './routes/skills.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);
  app.use(pinoHttp({ logger }));

  app.use(healthRouter);
  app.use(modelRouter);
  app.use(prRouter);
  app.use(runsRouter);
  app.use(sandboxRouter);
  app.use(skillsRouter);
  app.use(memoriesRouter);

  app.use(errorHandler);

  return app;
}
