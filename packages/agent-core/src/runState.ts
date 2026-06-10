import type { RunStatus } from '@alpha-agent/shared';

export const runStages: RunStatus[] = [
  'created',
  'clarifying',
  'planned',
  'located',
  'generated',
  'applied',
  'verifying',
  'requires_input',
  'completed'
];
