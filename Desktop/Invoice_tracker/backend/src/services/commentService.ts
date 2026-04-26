import { CommentEntityType } from '@prisma/client';
import { prisma } from '../prisma';

const commentInclude = {
  createdByUser: { select: { id: true, name: true } },
} as const;

export async function addComment(entityType: CommentEntityType, entityId: string, text: string, userId: string) {
  return prisma.comment.create({
    data: { entityType, entityId, text, createdByUserId: userId },
    include: commentInclude,
  });
}

export async function listComments(entityType: CommentEntityType, entityId: string) {
  return prisma.comment.findMany({
    where: { entityType, entityId },
    include: commentInclude,
    orderBy: { createdAt: 'asc' },
  });
}
