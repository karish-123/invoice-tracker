import { Router } from 'express';
import { z } from 'zod';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// All authenticated roles can use invoice endpoints
router.use(authenticate);

// ── Shared include for full checkout history rows ─────────────────────────────

const historyInclude = {
  executive:    { select: { id: true, name: true } },
  route:        { select: { id: true, routeNumber: true } },
  outByUser:    { select: { id: true, name: true } },
  inByUser:     { select: { id: true, name: true } },
  voidedByUser: { select: { id: true, name: true } },
} satisfies Prisma.CheckoutInclude;

type HistoryRow = Prisma.CheckoutGetPayload<{ include: typeof historyInclude }>;

function formatHistoryRow(c: HistoryRow) {
  return {
    id:            c.id,
    invoiceNumber: c.invoiceNumber,
    executive:     c.executive,
    route:         c.route,
    outDatetime:   c.outDatetime,
    outByUser:     c.outByUser,
    inDatetime:    c.inDatetime,
    inByUser:      c.inByUser,
    status:        c.voided ? 'VOIDED' : c.inDatetime ? 'RETURNED' : 'OUTSTANDING',
    voided:        c.voided,
    voidReason:    c.voidReason,
    voidedByUser:  c.voidedByUser,
    voidedAt:      c.voidedAt,
    createdAt:     c.createdAt,
  };
}

// ── GET /invoices/search ─────────────────────────────────────────────────────
// MUST be declared before /:invoiceNumber/history to avoid route conflict.

const searchSchema = z.object({
  invoiceNumber: z.string().optional(),
  executiveId:   z.string().uuid().optional(),
  routeId:       z.string().uuid().optional(),
  dateFrom:      z.string().optional(),
  dateTo:        z.string().optional(),
  status:        z.enum(['OUTSTANDING', 'RETURNED', 'VOIDED']).optional(),
});

router.get('/search', async (req: AuthRequest, res, next) => {
  try {
    const query = searchSchema.parse(req.query);
    const role  = req.user!.role;

    const where: Prisma.CheckoutWhereInput = {};

    if (query.invoiceNumber) {
      where.invoiceNumber = { contains: query.invoiceNumber, mode: 'insensitive' };
    }

    // EXECUTIVE is always scoped to their own executive ID
    if (role === Role.EXECUTIVE) {
      where.executiveId = req.user!.executiveId ?? undefined;
    } else if (query.executiveId) {
      where.executiveId = query.executiveId;
    }

    if (query.routeId) where.routeId = query.routeId;

    if (query.dateFrom || query.dateTo) {
      where.outDatetime = {};
      if (query.dateFrom) (where.outDatetime as Prisma.DateTimeFilter).gte = new Date(query.dateFrom);
      if (query.dateTo)   (where.outDatetime as Prisma.DateTimeFilter).lte = new Date(query.dateTo);
    }

    if (query.status === 'OUTSTANDING') { where.inDatetime = null; where.voided = false; }
    if (query.status === 'RETURNED')    { where.inDatetime = { not: null }; }
    if (query.status === 'VOIDED')      { where.voided = true; }

    const rows = await prisma.checkout.findMany({
      where,
      include: historyInclude,
      orderBy: { outDatetime: 'desc' },
      take:    500, // safety cap
    });

    res.json(rows.map(formatHistoryRow));
  } catch (err) {
    next(err);
  }
});

// ── GET /invoices/:invoiceNumber/history ──────────────────────────────────────

router.get('/:invoiceNumber/history', async (req: AuthRequest, res, next) => {
  try {
    const { invoiceNumber } = req.params;
    const role = req.user!.role;

    const rows = await prisma.checkout.findMany({
      where:   { invoiceNumber },
      include: historyInclude,
      orderBy: { outDatetime: 'desc' },
    });

    // EXECUTIVE: filter to only their own entries
    const filtered = role === Role.EXECUTIVE
      ? rows.filter(c => c.executiveId === req.user!.executiveId)
      : rows;

    const history = filtered.map(formatHistoryRow);

    res.json({ invoiceNumber, totalCheckouts: history.length, history });
  } catch (err) {
    next(err);
  }
});

export default router;
