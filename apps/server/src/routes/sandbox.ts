import { existsSync } from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { verifySandbox } from '@alpha-agent/agent-core';
import { config } from '../config.js';
import { runConduitRealDbFlow } from '../services/conduitRealDbFlowService.js';

const verifySandboxSchema = z.object({
  commands: z.array(z.string().min(1)).min(1).max(5).optional()
});

export const sandboxRouter = Router();

function resolveSandboxPath(configuredPath: string) {
  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }

  const candidates = [
    path.resolve(process.cwd(), configuredPath),
    path.resolve(process.cwd(), '../..', configuredPath)
  ];
  const found = candidates.find((candidate) => existsSync(path.join(candidate, 'package.json')));

  if (!found) {
    throw new Error(`Conduit sandbox path not found: ${configuredPath}`);
  }

  return found;
}

sandboxRouter.post('/api/sandbox/verify', async (req, res, next) => {
  try {
    const input = verifySandboxSchema.parse(req.body ?? {});
    const result = await verifySandbox(
      resolveSandboxPath(config.CONDUIT_SANDBOX_PATH),
      input.commands ?? ['npm run test', 'npm run build -w frontend'],
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

sandboxRouter.post('/api/sandbox/real-db-flow', async (_req, res, next) => {
  try {
    res.status(200).json(await runConduitRealDbFlow());
  } catch (error) {
    next(error);
  }
});
