import { z } from 'zod';
export * from './schemas/requirement.js';
export * from './schemas/agent.js';

export const runStatusSchema = z.enum([
  'created',
  'clarifying',
  'planned',
  'located',
  'generated',
  'applied',
  'verifying',
  'repairing',
  'requires_input',
  'completed',
  'failed'
]);

export const runEventSchema = z.object({
  runId: z.string(),
  type: z.string().min(1),
  payload: z.record(z.unknown()).default({})
});

export type RunStatus = z.infer<typeof runStatusSchema>;
export type RunEventInput = z.infer<typeof runEventSchema>;
