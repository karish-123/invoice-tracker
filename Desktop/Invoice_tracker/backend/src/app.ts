import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { errorHandler } from './middleware/error';
import authRoutes      from './routes/auth';
import userRoutes      from './routes/users';
import executiveRoutes from './routes/executives';
import routeRoutes     from './routes/routes';
import checkoutRoutes  from './routes/checkouts';
import invoiceRoutes   from './routes/invoices';
import meRoutes        from './routes/me';
import approvalRoutes  from './routes/approvals';
import exportRoutes    from './routes/export';

const app = express();

app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ── API routes ──────────────────────────────────────────────────────────────
app.use('/auth',       authRoutes);
app.use('/users',      userRoutes);
app.use('/executives', executiveRoutes);
app.use('/routes',     routeRoutes);
app.use('/checkouts',  checkoutRoutes);
app.use('/invoices',   invoiceRoutes);
app.use('/me',         meRoutes);
app.use('/approvals',  approvalRoutes);
app.use('/export',     exportRoutes);

// ── 404 ─────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Central error handler ────────────────────────────────────────────────────
app.use(errorHandler);

const port = config.PORT;
app.listen(port, () =>
  console.log(`Infobells Tracker API running on http://localhost:${port}`)
);

export default app;
