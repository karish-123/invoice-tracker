import { Router, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../prisma';
import { config } from '../config';
import { AuthPayload, AuthRequest } from '../types';

const router = Router();

// ── Auth: accept Bearer header OR ?token= query param (for browser downloads) ─

function authenticateExport(req: AuthRequest, res: Response, next: NextFunction): void {
  let token: string | undefined;

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ error: 'Missing authentication token' });
    return;
  }

  try {
    req.user = jwt.verify(token, config.JWT_SECRET) as AuthPayload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

router.use(authenticateExport);

// ── CSV helpers ───────────────────────────────────────────────────────────────

function csvEscape(value: string | null | undefined): string {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(headers: string[], rows: string[][]): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  return lines.join('\r\n');
}

const fmtDate = (d: Date | null | undefined) =>
  d ? d.toISOString().replace('T', ' ').slice(0, 19) : '';

// ── GET /export/history.csv ───────────────────────────────────────────────────

router.get('/history.csv', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const role = req.user!.role;
    const { executiveId, routeId, dateFrom, dateTo, status } = req.query;

    const where: Prisma.CheckoutWhereInput = {};

    // EXECUTIVE is auto-scoped to their own data
    if (role === Role.EXECUTIVE) {
      where.executiveId = req.user!.executiveId ?? undefined;
    } else if (typeof executiveId === 'string') {
      where.executiveId = executiveId;
    }

    if (typeof routeId === 'string') where.routeId = routeId;

    if (typeof dateFrom === 'string' || typeof dateTo === 'string') {
      where.outDatetime = {};
      if (typeof dateFrom === 'string') (where.outDatetime as Prisma.DateTimeFilter).gte = new Date(dateFrom);
      if (typeof dateTo   === 'string') (where.outDatetime as Prisma.DateTimeFilter).lte = new Date(dateTo);
    }

    if (status === 'OUTSTANDING') { where.inDatetime = null; where.voided = false; }
    if (status === 'RETURNED')    { where.inDatetime = { not: null }; }
    if (status === 'VOIDED')      { where.voided = true; }

    const rows = await prisma.checkout.findMany({
      where,
      include: {
        executive:   { select: { name: true } },
        route:       { select: { routeNumber: true } },
        outByUser:   { select: { name: true } },
        inByUser:    { select: { name: true } },
      },
      orderBy: { outDatetime: 'desc' },
    });

    const csv = toCSV(
      ['Invoice #', 'Executive', 'Route', 'Issued At', 'Issued By', 'Returned At', 'Returned By', 'Status', 'Void Reason'],
      rows.map(r => [
        r.invoiceNumber,
        r.executive.name,
        r.route.routeNumber,
        fmtDate(r.outDatetime),
        r.outByUser.name,
        fmtDate(r.inDatetime),
        r.inByUser?.name ?? '',
        r.voided ? 'VOIDED' : r.inDatetime ? 'RETURNED' : 'OUTSTANDING',
        r.voidReason ?? '',
      ]),
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="history.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// ── GET /export/outstanding.csv ───────────────────────────────────────────────

router.get('/outstanding.csv', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const role = req.user!.role;

    // EXECUTIVE cannot access the outstanding export
    if (role === Role.EXECUTIVE) {
      res.status(403).json({ error: 'Forbidden: requires role ADMIN | OFFICE_STAFF' });
      return;
    }

    const { executiveId, routeId, olderThanDays } = req.query;
    const where: Prisma.CheckoutWhereInput = { inDatetime: null, voided: false };

    if (typeof executiveId === 'string') where.executiveId = executiveId;
    if (typeof routeId     === 'string') where.routeId     = routeId;

    if (typeof olderThanDays === 'string') {
      const days = parseInt(olderThanDays, 10);
      if (!isNaN(days)) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        where.outDatetime = { lt: cutoff };
      }
    }

    const rows = await prisma.checkout.findMany({
      where,
      include: {
        executive: { select: { name: true } },
        route:     { select: { routeNumber: true } },
        outByUser: { select: { name: true } },
      },
      orderBy: { outDatetime: 'asc' },
    });

    const now = Date.now();
    const csv = toCSV(
      ['Invoice #', 'Executive', 'Route', 'Issued At', 'Days Out', 'Issued By'],
      rows.map(r => [
        r.invoiceNumber,
        r.executive.name,
        r.route.routeNumber,
        fmtDate(r.outDatetime),
        String(Math.floor((now - r.outDatetime.getTime()) / 86_400_000)),
        r.outByUser.name,
      ]),
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="outstanding.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

export default router;
