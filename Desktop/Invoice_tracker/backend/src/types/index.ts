import { Request } from 'express';
import { Role } from '@prisma/client';

export interface AuthPayload {
  userId:      string;
  role:        Role;
  executiveId: string | null;
}

/** Express Request enriched with the decoded JWT payload */
export interface AuthRequest extends Request {
  user?: AuthPayload;
}
