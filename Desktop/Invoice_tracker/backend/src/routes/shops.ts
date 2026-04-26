import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import { AuthRequest } from '../types';
import { listShops, createShop, updateShop, bulkCreateShops } from '../services/shopService';

const router = Router();

router.use(authenticate);

const createSchema = z.object({
  routeId: z.string().uuid(),
  name:    z.string().min(1),
});

const updateSchema = z.object({
  name:     z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

const bulkSchema = z.object({
  rows: z.array(z.object({
    routeNumber: z.string().min(1),
    shopName:    z.string().min(1),
  })).min(1),
});

// GET /shops?routeId=<uuid>&includeInactive=true
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const routeId = typeof req.query.routeId === 'string' ? req.query.routeId : undefined;
    const includeInactive = req.query.includeInactive === 'true';
    const shops = await listShops(routeId, includeInactive);
    res.json(shops);
  } catch (err) {
    next(err);
  }
});

// POST /shops
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { routeId, name } = createSchema.parse(req.body);
    const shop = await createShop(routeId, name);
    res.status(201).json(shop);
  } catch (err) {
    next(err);
  }
});

// POST /shops/bulk — ADMIN or OFFICE_STAFF
router.post('/bulk', authorize(Role.ADMIN, Role.OFFICE_STAFF), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = bulkSchema.parse(req.body);
    const result = await bulkCreateShops(rows);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /shops/:id — ADMIN or OFFICE_STAFF
router.patch('/:id', authorize(Role.ADMIN, Role.OFFICE_STAFF), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = updateSchema.parse(req.body);
    const shop = await updateShop(req.params.id, data);
    res.json(shop);
  } catch (err) {
    next(err);
  }
});

export default router;
