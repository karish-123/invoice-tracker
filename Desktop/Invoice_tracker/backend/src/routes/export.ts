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
      if (typeof dateTo   === 'string') (where.outDatetime as Prisma.DateTimeFilter).lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    if (status === 'OUTSTANDING') { where.inDatetime = null; where.voided = false; where.paymentReceived = false; }
    if (status === 'RETURNED')    { where.inDatetime = { not: null }; where.voided = false; where.paymentReceived = false; }
    if (status === 'VOIDED')      { where.voided = true; }
    if (status === 'PAID')        { where.paymentReceived = true; where.voided = false; }

    const rows = await prisma.checkout.findMany({
      where,
      include: {
        executive:             { select: { name: true } },
        route:                 { select: { routeNumber: true } },
        shop:                  { select: { name: true } },
        outByUser:             { select: { name: true } },
        inByUser:              { select: { name: true } },
        paymentReceivedByUser: { select: { name: true } },
      },
      orderBy: { outDatetime: 'desc' },
    });

    const csv = toCSV(
      ['Invoice #', 'Invoice Amount', 'Executive', 'Route', 'Shop', 'Issued At', 'Issued By', 'Returned At', 'Returned By', 'Status', 'Paid At', 'Paid By', 'Void Reason', 'Remarks'],
      rows.map(r => [
        r.invoiceNumber,
        r.invoiceAmount != null ? String(Number(r.invoiceAmount)) : '',
        r.executive?.name ?? '',
        r.route.routeNumber,
        r.shop?.name ?? '',
        fmtDate(r.outDatetime),
        r.outByUser.name,
        fmtDate(r.inDatetime),
        r.inByUser?.name ?? '',
        r.voided ? 'VOIDED' : r.paymentReceived ? 'PAID' : r.inDatetime ? 'RETURNED' : 'OUTSTANDING',
        fmtDate(r.paymentReceivedAt),
        r.paymentReceivedByUser?.name ?? '',
        r.voidReason ?? '',
        r.remarks ?? '',
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
        r.executive?.name ?? '',
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

// ── GET /export/pending-on-date.csv ──────────────────────────────────────────

router.get('/pending-on-date.csv', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const role = req.user!.role;
    if (role === Role.EXECUTIVE) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const dateStr = typeof req.query.date === 'string' ? req.query.date : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      res.status(400).json({ error: 'Provide date in YYYY-MM-DD format' });
      return;
    }

    const dayEnd = new Date(dateStr + 'T23:59:59.999Z');

    const rows = await prisma.checkout.findMany({
      where: {
        outDatetime: { lte: dayEnd },
        OR: [
          { inDatetime: null },
          { inDatetime: { gt: dayEnd } },
        ],
        AND: [{ OR: [{ voided: false }, { voidedAt: { gt: dayEnd } }] }],
      },
      include: {
        executive: { select: { name: true } },
        route:     { select: { routeNumber: true } },
        shop:      { select: { name: true } },
        outByUser: { select: { name: true } },
      },
      orderBy: { outDatetime: 'asc' },
    });

    const refDate = dayEnd.getTime();
    const csv = toCSV(
      ['Invoice #', 'Executive', 'Route', 'Shop', 'Issued At', 'Days Pending', 'Issued By', 'Remarks'],
      rows.map(r => [
        r.invoiceNumber,
        r.executive?.name ?? '',
        r.route.routeNumber,
        r.shop?.name ?? '',
        fmtDate(r.outDatetime),
        String(Math.floor((refDate - r.outDatetime.getTime()) / 86_400_000)),
        r.outByUser.name,
        r.remarks ?? '',
      ]),
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pending-${dateStr}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// ── GET /export/dashboard ─────────────────────────────────────────────────────
// JSON dashboard: totals, byExecutive, byRoute, full rows (with invoiceAmount)

router.get('/dashboard', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const role = req.user!.role;
    const { executiveId, routeId, dateFrom, dateTo, status } = req.query;

    const where: Prisma.CheckoutWhereInput = {};

    if (role === Role.EXECUTIVE) {
      where.executiveId = req.user!.executiveId ?? undefined;
    } else if (typeof executiveId === 'string') {
      where.executiveId = executiveId;
    }

    if (typeof routeId === 'string') where.routeId = routeId;

    if (typeof dateFrom === 'string' || typeof dateTo === 'string') {
      where.outDatetime = {};
      if (typeof dateFrom === 'string') (where.outDatetime as Prisma.DateTimeFilter).gte = new Date(dateFrom);
      if (typeof dateTo   === 'string') (where.outDatetime as Prisma.DateTimeFilter).lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    if (status === 'OUTSTANDING') { where.inDatetime = null; where.voided = false; where.paymentReceived = false; }
    if (status === 'RETURNED')    { where.inDatetime = { not: null }; where.voided = false; where.paymentReceived = false; }
    if (status === 'VOIDED')      { where.voided = true; }
    if (status === 'PAID')        { where.paymentReceived = true; where.voided = false; }

    const rows = await prisma.checkout.findMany({
      where,
      include: {
        executive:             { select: { id: true, name: true } },
        route:                 { select: { id: true, routeNumber: true } },
        shop:                  { select: { id: true, name: true } },
        outByUser:             { select: { id: true, name: true } },
        inByUser:              { select: { id: true, name: true } },
        paymentReceivedByUser: { select: { id: true, name: true } },
        voidedByUser:          { select: { id: true, name: true } },
      },
      orderBy: { outDatetime: 'desc' },
    });

    // Totals
    let invoiceValue   = 0;
    let collectedValue = 0;
    let outstandingCount = 0, returnedCount = 0, paidCount = 0, voidedCount = 0;

    // Group by executive and route
    const execMap = new Map<string, { name: string; issuedCount: number; returnedCount: number; paidCount: number; outstandingCount: number; invoiceValue: number; collectedValue: number }>();
    const routeMap = new Map<string, { routeNumber: string; issuedCount: number; paidCount: number; outstandingCount: number; invoiceValue: number }>();

    for (const r of rows) {
      const amt = r.invoiceAmount ? Number(r.invoiceAmount) : 0;
      invoiceValue += amt;
      const isOutstanding = !r.voided && !r.paymentReceived && !r.inDatetime;
      const isReturned    = !r.voided && !r.paymentReceived && !!r.inDatetime;
      const isPaid        = r.paymentReceived && !r.voided;
      const isVoided      = r.voided;

      if (isOutstanding) outstandingCount++;
      if (isReturned)    returnedCount++;
      if (isPaid)        { paidCount++; collectedValue += amt; }
      if (isVoided)      voidedCount++;

      if (r.executive) {
        const ex = execMap.get(r.executive.id) ?? { name: r.executive.name, issuedCount: 0, returnedCount: 0, paidCount: 0, outstandingCount: 0, invoiceValue: 0, collectedValue: 0 };
        ex.issuedCount++;
        ex.invoiceValue += amt;
        if (isReturned)    ex.returnedCount++;
        if (isPaid)        { ex.paidCount++; ex.collectedValue += amt; }
        if (isOutstanding) ex.outstandingCount++;
        execMap.set(r.executive.id, ex);
      }

      const rt = routeMap.get(r.route.id) ?? { routeNumber: r.route.routeNumber, issuedCount: 0, paidCount: 0, outstandingCount: 0, invoiceValue: 0 };
      rt.issuedCount++;
      rt.invoiceValue += amt;
      if (isPaid)        rt.paidCount++;
      if (isOutstanding) rt.outstandingCount++;
      routeMap.set(r.route.id, rt);
    }

    const byExecutive = [...execMap.entries()].map(([executiveId, v]) => ({ executiveId, ...v }));
    const byRoute     = [...routeMap.entries()].map(([routeId, v])     => ({ routeId, ...v }));

    // Format rows like formatCheckout
    const formattedRows = rows.map(r => ({
      id:            r.id,
      invoiceNumber: r.invoiceNumber,
      remarks:       r.remarks,
      executive:     r.executive,
      route:         r.route,
      shop:          r.shop,
      outDatetime:   r.outDatetime,
      outByUser:     r.outByUser,
      inDatetime:    r.inDatetime,
      inByUser:      r.inByUser,
      status:        r.voided ? 'VOIDED' : r.paymentReceived ? 'PAID' : r.inDatetime ? 'RETURNED' : 'OUTSTANDING',
      voided:        r.voided,
      voidReason:    r.voidReason,
      voidedByUser:  r.voidedByUser,
      voidedAt:      r.voidedAt,
      paymentReceived:   r.paymentReceived,
      paymentReceivedAt: r.paymentReceivedAt,
      paymentReceivedByUser: r.paymentReceivedByUser,
      invoiceAmount: r.invoiceAmount ? Number(r.invoiceAmount) : null,
      createdAt:     r.createdAt,
    }));

    res.json({
      totals: {
        checkoutCount:   rows.length,
        outstandingCount,
        returnedCount,
        paidCount,
        voidedCount,
        invoiceValue,
        collectedValue,
      },
      byExecutive,
      byRoute,
      rows: formattedRows,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
