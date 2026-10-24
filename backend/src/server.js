import app from './app.js';
import { env } from './config/env.js';

const port = Number(process.env.PORT) || env.port || 5000;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(
    `[server] csft-backend listening on http://0.0.0.0:${port} (${env.nodeEnv})`
  );
});

function shutdown(signal) {
  console.log(`[server] ${signal} received — closing server...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
