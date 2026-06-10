import { z } from 'zod';

const booleanStringSchema = z
  .string()
  .optional()
  .default('false')
  .transform((value) => value === 'true');

export const serverEnvSchema = z.object({
  DOUBAO_BASE_URL: z.string().url(),
  DOUBAO_MODEL: z.string().min(1),
  DOUBAO_API_KEY: z.string().min(1),
  SERVER_PORT: z.coerce.number().int().positive().default(3002),
  WEB_PORT: z.coerce.number().int().positive().default(5173),
  DATABASE_URL: z.string().min(1),
  CONDUIT_SANDBOX_PATH: z.string().min(1),
  CONDUIT_DATABASE_URL: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  ENABLE_PR_CREATE: booleanStringSchema,
  MAX_REPAIR_ATTEMPTS: z.coerce.number().int().positive().default(3)
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(input: NodeJS.ProcessEnv): ServerEnv {
  return serverEnvSchema.parse(input);
}
