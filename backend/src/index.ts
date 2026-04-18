import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db';

import authRoutes     from './routes/auth';
import leadsRoutes    from './routes/leads';
import contactsRoutes from './routes/contacts';
import calendarRoutes from './routes/calendar';
import formsRoutes    from './routes/forms';
import settingsRoutes from './routes/settings';
import pipelinesRoutes from './routes/pipelines';

dotenv.config();

const app  = express();
const PORT = process.env.PORT ?? 4000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '5mb' }));   // 5mb for base64 logos

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/leads',     leadsRoutes);
app.use('/api/contacts',  contactsRoutes);
app.use('/api/calendar',  calendarRoutes);
app.use('/api/forms',     formsRoutes);
app.use('/api/settings',  settingsRoutes);
app.use('/api/pipelines', pipelinesRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  DigyGo CRM Backend running on http://localhost:${PORT}`);
  console.log(`📊  Health: http://localhost:${PORT}/health\n`);
});
