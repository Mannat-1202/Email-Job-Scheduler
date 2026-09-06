import { Router } from 'express';
import { db } from '../db/client';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { mailer } from '../services/mailer';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const senders = await db.sender.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        createdAt: true,
      },
    });
    res.json(senders);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { email } = req.body;
    const sender = await mailer.provisionSender(req.user!.id, email);
    res.status(201).json({
      id: sender.id,
      email: sender.email,
      smtpHost: sender.smtpHost,
      smtpPort: sender.smtpPort,
      smtpUser: sender.smtpUser,
      createdAt: sender.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
