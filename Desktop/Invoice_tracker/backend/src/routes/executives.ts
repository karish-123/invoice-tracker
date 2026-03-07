import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

const createSchema = z.object({
  name:     z.string().min(1),
  isActive: z.boolean().optional(),
});

// ── READ — ADMIN + OFFICE_STAFF ───────────────────────────────────────────────

// GET /executives
router.get('/', authorize(Role.ADMIN, Role.OFFICE_STAFF), async (_req, res, next) => {
  try {
    const list = await prisma.executive.findMany({ orderBy: { name: 'asc' } });
    res.json(list);
  } catch (err) { next(err); }
});

// GET /executives/:id
router.get('/:id', authorize(Role.ADMIN, Role.OFFICE_STAFF), async (req, res, next) => {
  try {
    const exec = await prisma.executive.findUnique({ where: { id: req.params.id } });
    if (!exec) { res.status(404).json({ error: 'Executive not found' }); return; }
    res.json(exec);
  } catch (err) { next(err); }
});

// ── WRITE — ADMIN only ────────────────────────────────────────────────────────

// POST /executives
router.post('/', authorize(Role.ADMIN), async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const exec = await prisma.executive.create({ data: { name: data.name } });
    res.status(201).json(exec);
  } catch (err) { next(err); }
});

// PATCH /executives/:id
router.patch('/:id', authorize(Role.ADMIN), async (req, res, next) => {
  try {
    const data = createSchema.partial().parse(req.body);
    const exec = await prisma.executive.update({ where: { id: req.params.id }, data });
    res.json(exec);
  } catch (err) { next(err); }
});

// DELETE /executives/:id
router.delete('/:id', authorize(Role.ADMIN), async (req, res, next) => {
  try {
    await prisma.executive.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
