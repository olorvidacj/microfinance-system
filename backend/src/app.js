import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import routes from './routes/index.routes.js';
import { notFoundHandler, errorHandler } from './middleware/error.middleware.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());

const allowedOrigins = env.corsOrigins;
app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (mobile apps, curl) with no Origin header.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
  })
);

app.use(express.json({ limit: '100kb' }));

app.use('/api/v1', routes);

app.get('/', (_req, res) =>
  res.json({ success: true, data: { service: 'csft-backend', docs: '/api/v1' } })
);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
