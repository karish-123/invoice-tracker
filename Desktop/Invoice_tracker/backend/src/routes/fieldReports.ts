import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { FieldReportApprovalStatus, FieldReportRemark, FieldReportStatus, Role } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import { AuthRequest } from '../types';
import {
  createFieldReport,
  listFieldReports,
  getFieldReport,
  approveFieldReport,
  rejectFieldReport,
  updateFieldReport,
} from '../services/fieldReportService';

const router = Router();

router.use(authenticate);

// ── Zod schemas ──────────────────────────────────────────────────────────────

const createSchema = z.object({
  routeId:      z.string().uuid(),
  shopId:       z.string().uuid().optional(),
  newShopName:  z.string().min(1).optional(),
  isNewShop:    z.boolean().optional().default(false),
  status:       z.nativeEnum(FieldReportStatus),
  apprValue:    z.number().positive().optional(),
  remark:       z.nativeEnum(FieldReportRemark),
  customRemark: z.string().min(1).optional(),
  orderTakenBy: z.string().min(1),
  visitDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).superRefine((data, ctx) => {
  if (data.remark === FieldReportRemark.CUSTOM && !data.customRemark) {
    ctx.addIssue({ code: 'custom', path: ['customRemark'], message: 'customRemark is required when remark is CUSTOM' });
  }
  if (data.isNewShop && !data.shopId && !data.newShopName) {
    ctx.addIssue({ code: 'custom', path: ['newShopName'], message: 'Provide shopId or newShopName for a new shop' });
  }
  if (data.shopId && data.newShopName) {
    ctx.addIssue({ code: 'custom', path: ['shopId'], message: 'Provide either shopId or newShopName, not both' });
  }
});

const updateSchema = z.object({
  routeId:      z.string().uuid().optional(),
  shopId:       z.string().uuid().nullable().optional(),
  newShopName:  z.string().min(1).nullable().optional(),
  isNewShop:    z.boolean().optional(),
  status:       z.nativeEnum(FieldReportStatus).optional(),
  apprValue:    z.number().positive().nullable().optional(),
  remark:       z.nativeEnum(FieldReportRemark).optional(),
  customRemark: z.string().min(1).nullable().optional(),
  orderTakenBy: z.string().min(1).optional(),
  visitDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const approveSchema = z.object({
  // New format: array of objects with optional amounts
  invoices: z.array(z.object({
    invoiceNumber: z.string().min(1),
    invoiceAmount: z.number().positive().optional(),
  })).optional().default([]),
  // Legacy: plain invoice numbers (back-compat)
  invoiceNumbers: z.array(z.string().min(1)).optional(),
  reviewRemark:   z.string().optional(),
});

const rejectSchema = z.object({
  reviewRemark: z.string().min(1),
});

// ── POST /field-reports — EXECUTIVE ─────────────────────────────────────────

router.post('/', authorize(Role.EXECUTIVE), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    if (!user.executiveId) {
      res.status(400).json({ error: 'Your account is not linked to an executive profile' });
      return;
    }

    const data = createSchema.parse(req.body);
    const report = await createFieldReport({
      ...data,
      executiveId:     user.executiveId,
      createdByUserId: user.userId,
    });
    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
});

// ── GET /field-reports ───────────────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { routeId, approvalStatus } = req.query;

    const filters: { executiveId?: string; routeId?: string; approvalStatus?: FieldReportApprovalStatus } = {};

    // Executives can only see their own reports
    if (user.role === Role.EXECUTIVE) {
      if (!user.executiveId) { res.json([]); return; }
      filters.executiveId = user.executiveId;
    } else {
      // Admin/office staff can filter by executive
      if (typeof req.query.executiveId === 'string') {
        filters.executiveId = req.query.executiveId;
      }
    }

    if (typeof routeId === 'string') filters.routeId = routeId;
    if (typeof approvalStatus === 'string' && Object.values(FieldReportApprovalStatus).includes(approvalStatus as FieldReportApprovalStatus)) {
      filters.approvalStatus = approvalStatus as FieldReportApprovalStatus;
    }

    const reports = await listFieldReports(filters);
    res.json(reports);
  } catch (err) {
    next(err);
  }
});

// ── GET /field-reports/:id ───────────────────────────────────────────────────

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const report = await getFieldReport(req.params.id);
    if (!report) { res.status(404).json({ error: 'Field report not found' }); return; }

    // Executives can only view their own reports
    if (req.user!.role === Role.EXECUTIVE && report.executiveId !== req.user!.executiveId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.json(report);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /field-reports/:id — ADMIN or OFFICE_STAFF (PENDING only) ─────────

router.patch('/:id', authorize(Role.ADMIN, Role.OFFICE_STAFF), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data   = updateSchema.parse(req.body);
    const report = await updateFieldReport(req.params.id, data);
    res.json(report);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Update failed';
    if (msg.includes('not found'))   { res.status(404).json({ error: msg }); return; }
    if (msg.includes('Can only edit')) { res.status(400).json({ error: msg }); return; }
    next(err);
  }
});

// ── POST /field-reports/:id/approve — ADMIN or OFFICE_STAFF ─────────────────

router.post('/:id/approve', authorize(Role.ADMIN, Role.OFFICE_STAFF), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = approveSchema.parse(req.body);
    // Merge both formats: new invoices[] takes priority, fallback to legacy invoiceNumbers[]
    const invoices = parsed.invoices.length
      ? parsed.invoices
      : (parsed.invoiceNumbers ?? []).map(n => ({ invoiceNumber: n }));
    const result = await approveFieldReport(req.params.id, req.user!.userId, invoices, parsed.reviewRemark);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Approval failed';
    if (msg.includes('not found')) { res.status(404).json({ error: msg }); return; }
    if (msg.includes('Cannot approve')) { res.status(400).json({ error: msg }); return; }
    next(err);
  }
});

// ── POST /field-reports/:id/reject — ADMIN or OFFICE_STAFF ──────────────────

router.post('/:id/reject', authorize(Role.ADMIN, Role.OFFICE_STAFF), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { reviewRemark } = rejectSchema.parse(req.body);
    const report = await rejectFieldReport(req.params.id, req.user!.userId, reviewRemark);
    res.json(report);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Rejection failed';
    if (msg.includes('not found')) { res.status(404).json({ error: msg }); return; }
    if (msg.includes('Cannot reject')) { res.status(400).json({ error: msg }); return; }
    next(err);
  }
});

export default router;
