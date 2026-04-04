import { Router } from 'express';
import { z } from 'zod';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AuthRequest } from '../types';
import { addMasterOne, addOldInvoiceOne, issueOne, returnOne, markPaymentReceived } from '../services/checkoutService';

const router = Router();

// All checkout routes require ADMIN or OFFICE_STAFF
router.use(authenticate, authorize(Role.ADMIN, Role.OFFICE_STAFF));

// 5-minute tolerance: if OFFICE_STAFF provides a datetime older than this, reject.
const BACKDATE_TOLERANCE_MS = 5 * 60 * 1000;

// ── Zod schemas ──────────────────────────────────────────────────────────────

const masterSchema = z.object({
  routeId:        z.string().uuid(),
  invoiceNumbers: z.array(z.string().min(1)).min(1),
});

const oldInvoiceSchema = z.object({
  routeId:        z.string().uuid(),
  invoiceNumbers: z.array(z.string().min(1)).min(1),
});

const issueSchema = z.object({
  executiveId:    z.string().uuid(),
  outDatetime:    z.string().datetime().optional(),
  invoiceNumbers: z.array(z.string().min(1)).min(1),
});

const returnSchema = z.object({
  invoiceNumbers: z.array(z.string().min(1)).min(1),
  inDatetime:     z.string().datetime().optional(),
});

const voidSchema = z.object({
  voidReason:      z.string().min(1),
  returnToPending: z.boolean().optional().default(false),
});

const editCheckoutSchema = z.object({
  routeId:       z.string().uuid().optional(),
  executiveId:   z.string().uuid().nullable().optional(),
  invoiceNumber: z.string().min(1).optional(),
  outDatetime:   z.string().datetime().optional(),
  status:        z.enum(['OUTSTANDING', 'RETURNED', 'PAID', 'VOIDED']).optional(),
});

const paymentSchema = z.object({
  invoiceNumbers: z.array(z.string().min(1)).min(1),
});

// ── Prisma include / type helpers ────────────────────────────────────────────

const checkoutInclude = {
  executive:              { select: { id: true, name: true } },
  route:                  { select: { id: true, routeNumber: true } },
  outByUser:              { select: { id: true, name: true } },
  inByUser:               { select: { id: true, name: true } },
  paymentReceivedByUser:  { select: { id: true, name: true } },
} satisfies Prisma.CheckoutInclude;

type CheckoutRow = Prisma.CheckoutGetPayload<{ include: typeof checkoutInclude }>;

function formatCheckout(c: CheckoutRow) {
  const status = c.voided ? 'VOIDED'
    : c.paymentReceived ? 'PAID'
    : c.inDatetime      ? 'RETURNED'
    : 'OUTSTANDING';
  return {
    id:                     c.id,
    invoiceNumber:          c.invoiceNumber,
    executive:              c.executive,
    route:                  c.route,
    outDatetime:            c.outDatetime,
    outByUser:              c.outByUser,
    inDatetime:             c.inDatetime,
    inByUser:               c.inByUser,
    status,
    voided:                 c.voided,
    voidReason:             c.voidReason,
    paymentReceived:        c.paymentReceived,
    paymentReceivedAt:      c.paymentReceivedAt,
    createdAt:              c.createdAt,
  };
}

// ── POST /checkouts/master ───────────────────────────────────────────────────
// Records invoices into the pending pool (no executive assigned yet).

router.post('/master', async (req: AuthRequest, res, next) => {
  try {
    const { routeId, invoiceNumbers } = masterSchema.parse(req.body);
    const addedAt = new Date();
    const userId  = req.user!.userId;

    const route = await prisma.route.findUnique({ where: { id: routeId } });
    if (!route?.isActive) {
      res.status(400).json({ error: 'Route not found or inactive' });
      return;
    }

    const results = [];
    for (const invoiceNumber of invoiceNumbers) {
      const result = await prisma.$transaction(tx =>
        addMasterOne(tx, invoiceNumber, routeId, addedAt, userId)
      );
      results.push(result);
    }

    const allFailed = results.every(r => !r.success);
    res.status(allFailed ? 422 : 207).json({ results });
  } catch (err) {
    next(err);
  }
});

// ── POST /checkouts/old-invoices ─────────────────────────────────────────────
// Records legacy invoices as already-returned so they can be issued directly.

router.post('/old-invoices', async (req: AuthRequest, res, next) => {
  try {
    const { routeId, invoiceNumbers } = oldInvoiceSchema.parse(req.body);
    const addedAt = new Date();
    const userId  = req.user!.userId;

    const route = await prisma.route.findUnique({ where: { id: routeId } });
    if (!route?.isActive) {
      res.status(400).json({ error: 'Route not found or inactive' });
      return;
    }

    const results = [];
    for (const invoiceNumber of invoiceNumbers) {
      const result = await prisma.$transaction(tx =>
        addOldInvoiceOne(tx, invoiceNumber, routeId, addedAt, userId)
      );
      results.push(result);
    }

    const allFailed = results.every(r => !r.success);
    res.status(allFailed ? 422 : 207).json({ results });
  } catch (err) {
    next(err);
  }
});

// ── GET /checkouts/pending ───────────────────────────────────────────────────
// Returns master invoices not yet assigned to an executive.

router.get('/pending', async (req, res, next) => {
  try {
    const { routeId } = req.query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Prisma.CheckoutWhereInput = {
      executiveId: null as any,
      inDatetime:  null,
      voided:      false,
    };

    if (typeof routeId === 'string') where.routeId = routeId;

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

// ── POST /checkouts/issue ────────────────────────────────────────────────────

router.post('/issue', async (req: AuthRequest, res, next) => {
  try {
    const { executiveId, outDatetime, invoiceNumbers } = issueSchema.parse(req.body);
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

    // Validate executive exists and is active
    const executive = await prisma.executive.findUnique({ where: { id: executiveId } });
    if (!executive?.isActive) {
      res.status(400).json({ error: 'Executive not found or inactive' });
      return;
    }

    const results = [];
    // Process sequentially to avoid intra-batch deadlocks
    for (const invoiceNumber of invoiceNumbers) {
      const result = await prisma.$transaction(tx =>
        issueOne(tx, invoiceNumber, executiveId, undefined, outAt, userId)
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

    // Exclude pending invoices (no executive assigned yet)
    const where: Prisma.CheckoutWhereInput = {
      inDatetime:  null,
      voided:      false,
      NOT: { executiveId: null as any },
    };

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

// ── GET /checkouts/paid ──────────────────────────────────────────────────────

router.get('/paid', async (req, res, next) => {
  try {
    const { executiveId, routeId } = req.query;
    const where: Prisma.CheckoutWhereInput = {
      paymentReceived: true,
      voided: false,
    };

    if (typeof executiveId === 'string') where.executiveId = executiveId;
    if (typeof routeId     === 'string') where.routeId     = routeId;

    const rows = await prisma.checkout.findMany({
      where,
      include:  checkoutInclude,
      orderBy:  { paymentReceivedAt: 'desc' },
    });

    res.json(rows.map(formatCheckout));
  } catch (err) {
    next(err);
  }
});

// ── POST /checkouts/payment ──────────────────────────────────────────────────

router.post('/payment', async (req: AuthRequest, res, next) => {
  try {
    const { invoiceNumbers } = paymentSchema.parse(req.body);
    const userId = req.user!.userId;

    const results = [];
    for (const invoiceNumber of invoiceNumbers) {
      const result = await prisma.$transaction(tx =>
        markPaymentReceived(tx, invoiceNumber, userId)
      );
      results.push(result);
    }

    const allFailed = results.every(r => !r.success);
    res.status(allFailed ? 422 : 207).json({ results });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /checkouts/:id ─────────────────────────────────────────────────────
// ADMIN only — correct any field on a checkout.

router.patch('/:id', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res, next) => {
  try {
    const data = editCheckoutSchema.parse(req.body);

    const existing = await prisma.checkout.findUnique({ where: { id: req.params.id } });
    if (!existing) { res.status(404).json({ error: 'Checkout not found' }); return; }

    if (data.routeId) {
      const route = await prisma.route.findUnique({ where: { id: data.routeId } });
      if (!route?.isActive) { res.status(400).json({ error: 'Route not found or inactive' }); return; }
    }

    if (data.executiveId) {
      const exec = await prisma.executive.findUnique({ where: { id: data.executiveId } });
      if (!exec?.isActive) { res.status(400).json({ error: 'Executive not found or inactive' }); return; }
    }

    if (data.invoiceNumber && data.invoiceNumber !== existing.invoiceNumber) {
      const conflict = await prisma.checkout.findFirst({
        where: {
          invoiceNumber: data.invoiceNumber,
          inDatetime: null,
          voided: false,
          NOT: { id: req.params.id },
        },
      });
      if (conflict) {
        res.status(400).json({ error: 'Another active checkout already uses that invoice number' });
        return;
      }
    }

    // Build status-related field updates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusFields: Record<string, any> = {};
    if (data.status) {
      const userId = req.user!.userId;
      const now    = new Date();
      switch (data.status) {
        case 'OUTSTANDING':
          statusFields.voided = false;
          statusFields.voidReason = null;
          statusFields.voidedByUserId = null;
          statusFields.voidedAt = null;
          statusFields.paymentReceived = false;
          statusFields.paymentReceivedAt = null;
          statusFields.paymentReceivedByUserId = null;
          statusFields.inDatetime = null;
          statusFields.inByUserId = null;
          break;
        case 'RETURNED':
          statusFields.voided = false;
          statusFields.voidReason = null;
          statusFields.voidedByUserId = null;
          statusFields.voidedAt = null;
          statusFields.paymentReceived = false;
          statusFields.paymentReceivedAt = null;
          statusFields.paymentReceivedByUserId = null;
          statusFields.inDatetime = existing.inDatetime ?? now;
          statusFields.inByUserId = existing.inByUserId ?? userId;
          break;
        case 'PAID':
          statusFields.voided = false;
          statusFields.voidReason = null;
          statusFields.voidedByUserId = null;
          statusFields.voidedAt = null;
          statusFields.paymentReceived = true;
          statusFields.paymentReceivedAt = existing.paymentReceivedAt ?? now;
          statusFields.paymentReceivedByUserId = existing.paymentReceivedByUserId ?? userId;
          statusFields.inDatetime = existing.inDatetime ?? now;
          statusFields.inByUserId = existing.inByUserId ?? userId;
          break;
        case 'VOIDED':
          statusFields.voided = true;
          statusFields.voidedAt = existing.voidedAt ?? now;
          statusFields.voidedByUserId = existing.voidedByUserId ?? userId;
          break;
      }
    }

    const updated = await prisma.checkout.update({
      where: { id: req.params.id },
      data: {
        ...(data.routeId       !== undefined && { routeId:       data.routeId }),
        ...(data.executiveId   !== undefined && { executiveId:   data.executiveId }),
        ...(data.invoiceNumber !== undefined && { invoiceNumber: data.invoiceNumber }),
        ...(data.outDatetime   !== undefined && { outDatetime:   new Date(data.outDatetime) }),
        ...statusFields,
      },
      include: checkoutInclude,
    });

    res.json(formatCheckout(updated));
  } catch (err) {
    next(err);
  }
});

// ── POST /checkouts/:id/void ─────────────────────────────────────────────────

router.post('/:id/void', async (req: AuthRequest, res, next) => {
  try {
    const { voidReason, returnToPending } = voidSchema.parse(req.body);

    const existing = await prisma.checkout.findUnique({ where: { id: req.params.id } });
    if (!existing)           { res.status(404).json({ error: 'Checkout not found' }); return; }
    if (existing.voided)     { res.status(400).json({ error: 'Checkout is already voided' }); return; }
    if (existing.inDatetime) { res.status(400).json({ error: 'Cannot void a returned checkout' }); return; }

    const now    = new Date();
    const userId = req.user!.userId;

    const voidedCheckout = await prisma.$transaction(async (tx) => {
      const voided = await tx.checkout.update({
        where: { id: req.params.id },
        data: {
          voided:         true,
          voidReason,
          voidedByUserId: userId,
          voidedAt:       now,
        },
      });

      if (returnToPending) {
        await tx.checkout.create({
          data: {
            invoiceNumber: existing.invoiceNumber,
            routeId:       existing.routeId,
            outDatetime:   now,
            outByUserId:   userId,
          },
        });
      }

      return voided;
    });

    const result = await prisma.checkout.findUnique({
      where:   { id: voidedCheckout.id },
      include: checkoutInclude,
    });

    res.json(formatCheckout(result!));
  } catch (err) {
    next(err);
  }
});

export default router;
