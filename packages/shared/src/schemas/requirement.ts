import { z } from 'zod';

export const requirementLevelSchema = z.enum(['L1', 'L2', 'L3']);

export const requirementDslSchema = z.object({
  id: z.string().min(1),
  rawText: z.string().min(1),
  level: requirementLevelSchema,
  intent: z.string().min(1),
  targetSurface: z.string().min(1),
  dataSources: z.array(z.string().min(1)).default([]),
  displayRules: z.array(z.string().min(1)).default([]),
  acceptanceCriteria: z.array(z.string().min(1)).default([]),
  constraints: z.array(z.string().min(1)).default([]),
  confidence: z.number().min(0).max(1)
});

export const clarifyQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  reason: z.string().min(1),
  blocking: z.boolean().default(true)
});

export type RequirementLevel = z.infer<typeof requirementLevelSchema>;
export type RequirementDsl = z.infer<typeof requirementDslSchema>;
export type ClarifyQuestion = z.infer<typeof clarifyQuestionSchema>;
