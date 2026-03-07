import { Router } from 'express';
import { z } from 'zod';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AuthRequest } from '../types';
import { issueOne, returnOne } from '../services/checkoutService';

const router = Router();

// All checkout routes require ADMIN or OFFICE_STAFF
router.use(authenticate, authorize(Role.ADMIN, Role.OFFICE_STAFF));

// 5-minute tolerance: if OFFICE_STAFF provides a datetime older than this, reject.
const BACKDATE_TOLERANCE_MS = 5 * 60 * 1000;

// ── Zod schemas ──────────────────────────────────────────────────────────────

const issueSchema = z.object({
  executiveId:    z.string().uuid(),
  routeId:        z.string().uuid(),
  outDatetime:    z.string().datetime().optional(),
  invoiceNumbers: z.array(z.string().min(1)).min(1),
});

const returnSchema = z.object({
  invoiceNumbers: z.array(z.string().min(1)).min(1),
  inDatetime:     z.string().datetime().optional(),
});

const voidSchema = z.object({
  voidReason: z.string().min(1),
});

// ── Prisma include / type helpers ────────────────────────────────────────────

const checkoutInclude = {
  executive:   { select: { id: true, name: true } },
  route:       { select: { id: true, routeNumber: true } },
  outByUser:   { select: { id: true, name: true } },
  inByUser:    { select: { id: true, name: true } },
} satisfies Prisma.CheckoutInclude;

type CheckoutRow = Prisma.CheckoutGetPayload<{ include: typeof checkoutInclude }>;

function formatCheckout(c: CheckoutRow) {
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
    createdAt:     c.createdAt,
  };
}

// ── POST /checkouts/issue ────────────────────────────────────────────────────

router.post('/issue', async (req: AuthRequest, res, next) => {
  try {
    const { executiveId, routeId, outDatetime, invoiceNumbers } = issueSchema.parse(req.body);
    const outAt  = outDatetime ? new Date(outDatetime) : new Date();
    const role   = req.user!.role;
    const userId = req.user!.userId;

    // Backdate guard: OFFICE_STAFF cannot issue with a timestamp older than the tolerance window
    if (outDatetime && role === Role.OFFICE_STAFF) {
      if (Date.now() - outAt.getTime() > BACKDATE_TOLERANCE_MS) {
        res.status(400).json({ error: 'Backdating requires approval. Use the backdate request form.' });
        return;
      }
    }

    // Validate executive + route exist and are active
    const [executive, route] = await Promise.all([
      prisma.executive.findUnique({ where: { id: executiveId } }),
      prisma.route.findUnique({ where: { id: routeId } }),
    ]);

    if (!executive?.isActive) {
      res.status(400).json({ error: 'Executive not found or inactive' });
      return;
    }
    if (!route?.isActive) {
      res.status(400).json({ error: 'Route not found or inactive' });
      return;
    }

    const results = [];
    // Process sequentially to avoid intra-batch deadlocks
    for (const invoiceNumber of invoiceNumbers) {
      const result = await prisma.$transaction(tx =>
        issueOne(tx, invoiceNumber, executiveId, routeId, outAt, userId)
      );
      results.push(result);
    }

    const allFailed = results.every(r => !r.success);
    res.status(allFailed ? 422 : 207).json({ results });
  } catch (err) {
    next(err);
  }
});

// ── POST /checkouts/return ───────────────────────────────────────────────────

router.post('/return', async (req: AuthRequest, res, next) => {
  try {
    const { invoiceNumbers, inDatetime } = returnSchema.parse(req.body);
    const inAt   = inDatetime ? new Date(inDatetime) : new Date();
    const role   = req.user!.role;
    const userId = req.user!.userId;

    // Backdate guard
    if (inDatetime && role === Role.OFFICE_STAFF) {
      if (Date.now() - inAt.getTime() > BACKDATE_TOLERANCE_MS) {
        res.status(400).json({ error: 'Backdating requires approval. Use the backdate request form.' });
        return;
      }
    }

    const results = [];
    for (const invoiceNumber of invoiceNumbers) {
      const result = await prisma.$transaction(tx =>
        returnOne(tx, invoiceNumber, inAt, userId)
      );
      results.push(result);
    }

    const allFailed = results.every(r => !r.success);
    res.status(allFailed ? 422 : 207).json({ results });
  } catch (err) {
    next(err);
  }
});

// ── GET /checkouts/outstanding ───────────────────────────────────────────────

router.get('/outstanding', async (req, res, next) => {
  try {
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
      include:  checkoutInclude,
      orderBy:  { outDatetime: 'asc' },
    });

    res.json(rows.map(formatCheckout));
  } catch (err) {
    next(err);
  }
});

// ── POST /checkouts/:id/void ─────────────────────────────────────────────────

router.post('/:id/void', async (req: AuthRequest, res, next) => {
  try {
    const { voidReason } = voidSchema.parse(req.body);

    const existing = await prisma.checkout.findUnique({ where: { id: req.params.id } });
    if (!existing)           { res.status(404).json({ error: 'Checkout not found' }); return; }
    if (existing.voided)     { res.status(400).json({ error: 'Checkout is already voided' }); return; }
    if (existing.inDatetime) { res.status(400).json({ error: 'Cannot void a returned checkout' }); return; }

    const voided = await prisma.checkout.update({
      where: { id: req.params.id },
      data: {
        voided:         true,
        voidReason,
        voidedByUserId: req.user!.userId,
        voidedAt:       new Date(),
      },
      include: checkoutInclude,
    });

    res.json(formatCheckout(voided));
  } catch (err) {
    next(err);
  }
});

export default router;
