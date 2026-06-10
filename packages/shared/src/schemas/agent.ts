import { z } from 'zod';
import { requirementDslSchema } from './requirement.js';

export const implementationPlanSchema = z.object({
  requirement: requirementDslSchema,
  level: z.enum(['L1', 'L2', 'L3']),
  summary: z.string().min(1),
  impact: z.array(z.string().min(1)),
  candidateFiles: z.array(z.string().min(1)),
  searchHints: z.array(z.string().min(1)),
  verifyCommands: z.array(z.string().min(1)),
  risks: z.array(z.string().min(1))
});

export const contextRequestSchema = z.object({
  sandboxPath: z.string().min(1),
  candidateFiles: z.array(z.string().min(1)),
  searchHints: z.array(z.string().min(1))
});

export const packedContextFileSchema = z.object({
  path: z.string().min(1),
  reason: z.string().min(1),
  content: z.string()
});

export const packedContextSchema = z.object({
  files: z.array(packedContextFileSchema),
  constraints: z.array(z.string().min(1)),
  searchedTerms: z.array(z.string().min(1)).default([])
});

export const patchOperationSchema = z.object({
  type: z.enum(['replace-file']),
  path: z.string().min(1),
  content: z.string(),
  reason: z.string().min(1)
});

export const patchSetSchema = z.object({
  summary: z.string().min(1),
  evidenceFiles: z.array(z.string().min(1)),
  operations: z.array(patchOperationSchema).min(1)
});

export const verifyCommandResultSchema = z.object({
  command: z.string().min(1),
  exitCode: z.number().nullable(),
  stdout: z.string(),
  stderr: z.string()
});

export const verifyResultSchema = z.object({
  success: z.boolean(),
  commands: z.array(verifyCommandResultSchema),
  attempts: z.number().int().min(1)
});

export const handoffSummarySchema = z.object({
  summary: z.string().min(1),
  changedFiles: z.array(z.string().min(1)),
  diffSummary: z.string(),
  verification: verifyResultSchema,
  risks: z.array(z.string().min(1)),
  prDraft: z.string().min(1)
});

export type ImplementationPlan = z.infer<typeof implementationPlanSchema>;
export type ContextRequest = z.infer<typeof contextRequestSchema>;
export type PackedContextFile = z.infer<typeof packedContextFileSchema>;
export type PackedContext = z.infer<typeof packedContextSchema>;
export type PatchOperation = z.infer<typeof patchOperationSchema>;
export type PatchSet = z.infer<typeof patchSetSchema>;
export type VerifyCommandResult = z.infer<typeof verifyCommandResultSchema>;
export type VerifyResult = z.infer<typeof verifyResultSchema>;
export type HandoffSummary = z.infer<typeof handoffSummarySchema>;
