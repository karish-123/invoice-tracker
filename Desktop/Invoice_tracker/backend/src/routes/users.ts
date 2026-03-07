import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../prisma';
import { config } from '../config';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All /users routes → ADMIN only
router.use(authenticate, authorize(Role.ADMIN));

const userSelect = {
  id: true, name: true, username: true,
  role: true, isActive: true, executiveId: true, createdAt: true,
} as const;

const createSchema = z.object({
  name:        z.string().min(1),
  username:    z.string().min(1),
  password:    z.string().min(8),
  role:        z.nativeEnum(Role),
  executiveId: z.string().uuid().nullable().optional(),
});

const updateSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// GET /users
router.get('/', async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({ select: userSelect, orderBy: { createdAt: 'desc' } });
    res.json(users);
  } catch (err) { next(err); }
});

// GET /users/:id
router.get('/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: userSelect });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch (err) { next(err); }
});

// POST /users
router.post('/', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, config.BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        name: data.name, username: data.username,
        passwordHash, role: data.role,
        executiveId: data.executiveId ?? null,
      },
      select: userSelect,
    });
    res.status(201).json(user);
  } catch (err) { next(err); }
});

// PATCH /users/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const update: Record<string, unknown> = {};

    if (data.name        !== undefined) update.name        = data.name;
    if (data.username    !== undefined) update.username    = data.username;
    if (data.role        !== undefined) update.role        = data.role;
    if (data.isActive    !== undefined) update.isActive    = data.isActive;
    if (data.executiveId !== undefined) update.executiveId = data.executiveId;
    if (data.password    !== undefined)
      update.passwordHash = await bcrypt.hash(data.password, config.BCRYPT_ROUNDS);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data:  update,
      select: userSelect,
    });
    res.json(user);
  } catch (err) { next(err); }
});

// DELETE /users/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
