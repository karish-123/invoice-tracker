import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

const createSchema = z.object({
  routeNumber: z.string().min(1),
  description: z.string().nullable().optional(),
  isActive:    z.boolean().optional(),
});

// ── READ — ADMIN + OFFICE_STAFF + EXECUTIVE ──────────────────────────────────

// GET /routes
router.get('/', authorize(Role.ADMIN, Role.OFFICE_STAFF, Role.EXECUTIVE), async (_req, res, next) => {
  try {
    const list = await prisma.route.findMany({ orderBy: { routeNumber: 'asc' } });
    res.json(list);
  } catch (err) { next(err); }
});

// GET /routes/:id
router.get('/:id', authorize(Role.ADMIN, Role.OFFICE_STAFF, Role.EXECUTIVE), async (req, res, next) => {
  try {
    const route = await prisma.route.findUnique({ where: { id: req.params.id } });
    if (!route) { res.status(404).json({ error: 'Route not found' }); return; }
    res.json(route);
  } catch (err) { next(err); }
});

// ── WRITE — ADMIN only ────────────────────────────────────────────────────────

// POST /routes
router.post('/', authorize(Role.ADMIN), async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const route = await prisma.route.create({
      data: { routeNumber: data.routeNumber, description: data.description ?? null },
    });
    res.status(201).json(route);
  } catch (err) { next(err); }
});

// PATCH /routes/:id
router.patch('/:id', authorize(Role.ADMIN), async (req, res, next) => {
  try {
    const data = createSchema.partial().parse(req.body);
    const route = await prisma.route.update({ where: { id: req.params.id }, data });
    res.json(route);
  } catch (err) { next(err); }
});

// DELETE /routes/:id
router.delete('/:id', authorize(Role.ADMIN), async (req, res, next) => {
  try {
    await prisma.route.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
