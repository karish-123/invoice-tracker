import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApprovalStatus, ApprovalRequestType, Role } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { issueOne, returnOne } from '../services/checkoutService';

const router = Router();

router.use(authenticate);

const BACKDATE_TOLERANCE_MS = 5 * 60 * 1000;

// ── Zod schemas ──────────────────────────────────────────────────────────────

const createSchema = z.object({
  requestType:       z.nativeEnum(ApprovalRequestType),
  executiveId:       z.string().uuid().optional(),
  routeId:           z.string().uuid().optional(),
  invoiceNumbers:    z.array(z.string().min(1)).min(1),
  requestedDatetime: z.string().datetime(),
  reason:            z.string().min(1),
}).superRefine((data, ctx) => {
  if (data.requestType === ApprovalRequestType.CHECKOUT_BACKDATE) {
    if (!data.executiveId) {
      ctx.addIssue({ code: 'custom', path: ['executiveId'], message: 'executiveId is required for CHECKOUT_BACKDATE' });
    }
    if (!data.routeId) {
      ctx.addIssue({ code: 'custom', path: ['routeId'], message: 'routeId is required for CHECKOUT_BACKDATE' });
    }
  }
});

const rejectSchema = z.object({
  reviewReason: z.string().min(1),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const approvalInclude = {
  requestedBy: { select: { id: true, name: true } },
  reviewedBy:  { select: { id: true, name: true } },
} as const;

// ── POST /approvals ──────────────────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const role = req.user!.role;
    if (role !== Role.ADMIN && role !== Role.OFFICE_STAFF) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const data = createSchema.parse(req.body);
    const requestedAt = new Date(data.requestedDatetime);

    // The requested datetime must be in the past (backdate only)
    if (requestedAt >= new Date()) {
      res.status(400).json({ error: 'Requested datetime must be in the past.' });
      return;
    }

    // Must be more than the tolerance window in the past (otherwise just issue normally)
    const ageMs = Date.now() - requestedAt.getTime();
    if (ageMs <= BACKDATE_TOLERANCE_MS) {
      res.status(400).json({ error: 'Requested datetime is too recent. Issue normally instead.' });
      return;
    }

    const approval = await prisma.approvalRequest.create({
      data: {
        requestType:       data.requestType,
        requestedByUserId: req.user!.userId,
        payload: {
          executiveId:       data.executiveId,
          routeId:           data.routeId,
          invoiceNumbers:    data.invoiceNumbers,
          requestedDatetime: data.requestedDatetime,
          reason:            data.reason,
        },
      },
      include: approvalInclude,
    });

    res.status(201).json(approval);
  } catch (err) {
    next(err);
  }
});

// ── GET /approvals ───────────────────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const role = req.user!.role;
    if (role !== Role.ADMIN && role !== Role.OFFICE_STAFF) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const where: Record<string, unknown> = {};

    // OFFICE_STAFF can only see their own requests
    if (role === Role.OFFICE_STAFF) {
      where.requestedByUserId = req.user!.userId;
    }

    const { status } = req.query;
    if (typeof status === 'string' && Object.values(ApprovalStatus).includes(status as ApprovalStatus)) {
      where.status = status as ApprovalStatus;
    }

    const approvals = await prisma.approvalRequest.findMany({
      where,
      include:  approvalInclude,
      orderBy:  { requestedAt: 'desc' },
    });

    res.json(approvals);
  } catch (err) {
    next(err);
  }
});

// ── POST /approvals/:id/approve ──────────────────────────────────────────────

router.post('/:id/approve', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== Role.ADMIN) {
      res.status(403).json({ error: 'Forbidden: requires role ADMIN' });
      return;
    }

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: req.params.id },
    });
    if (!approval) {
      res.status(404).json({ error: 'Approval request not found' });
      return;
    }
    if (approval.status !== ApprovalStatus.PENDING) {
      res.status(400).json({ error: `Cannot approve a request with status ${approval.status}` });
      return;
    }

    const payload = approval.payload as {
      executiveId?: string;
      routeId?:     string;
      invoiceNumbers: string[];
      requestedDatetime: string;
      reason:       string;
    };

    const requestedAt = new Date(payload.requestedDatetime);
    const userId      = req.user!.userId;
    const results: { invoiceNumber: string; success: boolean; checkoutId?: string; error?: string }[] = [];

    if (approval.requestType === ApprovalRequestType.CHECKOUT_BACKDATE) {
      // Validate executive + route are still active
      const [executive, route] = await Promise.all([
        prisma.executive.findUnique({ where: { id: payload.executiveId! } }),
        prisma.route.findUnique({ where: { id: payload.routeId! } }),
      ]);
      if (!executive?.isActive) {
        res.status(400).json({ error: 'Executive is no longer active' });
        return;
      }
      if (!route?.isActive) {
        res.status(400).json({ error: 'Route is no longer active' });
        return;
      }

      for (const invoiceNumber of payload.invoiceNumbers) {
        const r = await prisma.$transaction(tx =>
          issueOne(tx, invoiceNumber, payload.executiveId!, payload.routeId, requestedAt, userId)
        );
        results.push(r);
      }
    } else {
      // RETURN_BACKDATE
      for (const invoiceNumber of payload.invoiceNumbers) {
        const r = await prisma.$transaction(tx =>
          returnOne(tx, invoiceNumber, requestedAt, userId)
        );
        results.push(r);
      }
    }

    // Mark approved regardless of per-invoice failures (partial success is valid)
    const updated = await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: {
        status:           ApprovalStatus.APPROVED,
        reviewedByUserId: userId,
        reviewedAt:       new Date(),
      },
      include: approvalInclude,
    });

    res.json({ approval: updated, results });
  } catch (err) {
    next(err);
  }
});

// ── POST /approvals/:id/reject ───────────────────────────────────────────────

router.post('/:id/reject', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== Role.ADMIN) {
      res.status(403).json({ error: 'Forbidden: requires role ADMIN' });
      return;
    }

    const { reviewReason } = rejectSchema.parse(req.body);

    const approval = await prisma.approvalRequest.findUnique({ where: { id: req.params.id } });
    if (!approval) {
      res.status(404).json({ error: 'Approval request not found' });
      return;
    }
    if (approval.status !== ApprovalStatus.PENDING) {
      res.status(400).json({ error: `Cannot reject a request with status ${approval.status}` });
      return;
    }

    const updated = await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: {
        status:           ApprovalStatus.REJECTED,
        reviewedByUserId: req.user!.userId,
        reviewedAt:       new Date(),
        reviewReason,
      },
      include: approvalInclude,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
