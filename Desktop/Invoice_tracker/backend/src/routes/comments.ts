import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CommentEntityType } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { addComment, listComments } from '../services/commentService';

const router = Router();

router.use(authenticate);

const createSchema = z.object({
  entityType: z.nativeEnum(CommentEntityType),
  entityId:   z.string().uuid(),
  text:       z.string().min(1),
});

// POST /comments
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId, text } = createSchema.parse(req.body);
    const comment = await addComment(entityType, entityId, text, req.user!.userId);
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
});

// GET /comments?entityType=X&entityId=Y
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const entityType = req.query.entityType as string;
    const entityId   = req.query.entityId as string;

    if (!entityType || !entityId) {
      res.status(400).json({ error: 'entityType and entityId are required' });
      return;
    }

    if (!Object.values(CommentEntityType).includes(entityType as CommentEntityType)) {
      res.status(400).json({ error: 'Invalid entityType' });
      return;
    }

    const comments = await listComments(entityType as CommentEntityType, entityId);
    res.json(comments);
  } catch (err) {
    next(err);
  }
});

export default router;
