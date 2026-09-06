import { Router } from 'express';
import { db } from '../db/client';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await db.user.findUnique({
      where: { id: req.user.id },
      include: {
        slack: {
          select: {
            teamId: true,
            connectedAt: true,
          },
        },
        senders: {
          select: {
            id: true,
            email: true,
            smtpHost: true,
            smtpPort: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      slackConnected: !!user.slack,
      slackInfo: user.slack,
      senders: user.senders,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/sync', async (req, res, next) => {
  try {
    const { googleId, name, email, avatarUrl } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = await db.user.upsert({
      where: { email },
      create: {
        googleId: googleId || `google-${Date.now()}`,
        name: name || email.split('@')[0],
        email,
        avatarUrl,
      },
      update: {
        name: name || undefined,
        avatarUrl: avatarUrl || undefined,
      },
    });

    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
