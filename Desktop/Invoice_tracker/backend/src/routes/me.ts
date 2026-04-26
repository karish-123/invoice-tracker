import { Router } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// /me/* → EXECUTIVE role only
router.use(authenticate, authorize(Role.EXECUTIVE));

// GET /me/outstanding
router.get('/outstanding', async (req: AuthRequest, res, next) => {
  try {
    const executiveId = req.user!.executiveId;
    if (!executiveId) {
      res.status(400).json({ error: 'No executive profile linked to this account' });
      return;
    }

    const rows = await prisma.checkout.findMany({
      where: { executiveId, inDatetime: null, voided: false },
      include: {
        route:     { select: { id: true, routeNumber: true } },
        shop:      { select: { id: true, name: true } },
        outByUser: { select: { id: true, name: true } },
      },
      orderBy: { outDatetime: 'asc' },
    });

    res.json(
      rows.map((c) => ({
        id:            c.id,
        invoiceNumber: c.invoiceNumber,
        route:         c.route,
        shop:          c.shop,
        outDatetime:   c.outDatetime,
        outByUser:     c.outByUser,
        status:        'OUTSTANDING',
      }))
    );
  } catch (err) {
    next(err);
  }
});

// GET /me/history
router.get('/history', async (req: AuthRequest, res, next) => {
  try {
    const executiveId = req.user!.executiveId;
    if (!executiveId) {
      res.status(400).json({ error: 'No executive profile linked to this account' });
      return;
    }

    const rows = await prisma.checkout.findMany({
      where:   { executiveId },
      include: {
        route:     { select: { id: true, routeNumber: true } },
        shop:      { select: { id: true, name: true } },
        outByUser: { select: { id: true, name: true } },
        inByUser:  { select: { id: true, name: true } },
      },
      orderBy: { outDatetime: 'desc' },
    });

    res.json(
      rows.map((c) => ({
        id:            c.id,
        invoiceNumber: c.invoiceNumber,
        route:         c.route,
        shop:          c.shop,
        outDatetime:   c.outDatetime,
        outByUser:     c.outByUser,
        inDatetime:    c.inDatetime,
        inByUser:      c.inByUser,
        status:        c.voided ? 'VOIDED' : c.inDatetime ? 'RETURNED' : 'OUTSTANDING',
      }))
    );
  } catch (err) {
    next(err);
  }
});

export default router;
