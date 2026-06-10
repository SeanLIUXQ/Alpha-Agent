import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';

const app = createApp();

app.listen(config.SERVER_PORT, () => {
  logger.info({ port: config.SERVER_PORT }, 'Alpha Agent server listening');
});
