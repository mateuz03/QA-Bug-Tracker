import cors from 'cors';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRouter } from './routes/auth.js';
import { bugsRouter } from './routes/bugs.js';
import { dashboardRouter } from './routes/dashboard.js';
import { executionsRouter } from './routes/executions.js';
import { projectsRouter } from './routes/projects.js';
import { recordingsRouter } from './routes/recordings.js';
import { scenariosRouter } from './routes/scenarios.js';
import { usersRouter } from './routes/users.js';

export const app = express();

const allowedOrigins = new Set([
  config.frontendUrl,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || origin.startsWith('chrome-extension://')) callback(null, true);
    else callback(new Error('Origem não permitida.'));
  }
}));
app.use(express.json({ limit: '1mb' }));
app.use('/evidences', express.static(fileURLToPath(new URL('../storage', import.meta.url))));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'qa-truker-api' });
});
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/bugs', bugsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/scenarios', scenariosRouter);
app.use('/api/executions', executionsRouter);
app.use('/api/recordings', recordingsRouter);
app.use((_req, res) => res.status(404).json({ message: 'Rota não encontrada.' }));
app.use(errorHandler);
