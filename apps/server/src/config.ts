import 'dotenv/config';
import { parseServerEnv } from '@alpha-agent/shared';

export const config = parseServerEnv(process.env);
