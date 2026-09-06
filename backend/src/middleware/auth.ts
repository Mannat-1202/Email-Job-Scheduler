import { NextFunction, Request, Response } from 'express';
import { db } from '../db/client';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string | null;
  };
}

export async function getOrCreateDefaultUser() {
  let user = await db.user.findFirst();
  if (!user) {
    user = await db.user.create({
      data: {
        googleId: 'demo-google-id',
        name: 'Alex Mercer',
        email: 'alex.mercer@reachinbox.test',
        avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
      },
    });
  }
  return user;
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const headerUserId = req.headers['x-user-id'] as string | undefined;
    const headerUserEmail = req.headers['x-user-email'] as string | undefined;

    let user = null;

    if (headerUserId) {
      user = await db.user.findUnique({ where: { id: headerUserId } });
    } else if (headerUserEmail) {
      user = await db.user.findUnique({ where: { email: headerUserEmail } });
    }

    if (!user) {
      user = await getOrCreateDefaultUser();
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };

    next();
  } catch (err) {
    next(err);
  }
}
