import app from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.port, () => {
  console.log(
    `[server] csft-backend listening on port ${env.port} (${env.nodeEnv})`
  );
});

function shutdown(signal) {
  console.log(`[server] ${signal} received — closing server...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
