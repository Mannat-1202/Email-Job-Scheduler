import { Router } from 'express';
import { db } from '../db/client';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { search } from '../services/search';

const router = Router();

router.use(authMiddleware);

router.get('/search', async (req: AuthenticatedRequest, res, next) => {
  try {
    const q = (req.query.q as string) || '';
    const status = req.query.status as string | undefined;
    const userId = req.user!.id;

    const results = await search.searchEmails(q, userId, status);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const statusParam = (req.query.status as string)?.toLowerCase();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      campaign: {
        userId: req.user!.id,
      },
    };

    if (statusParam === 'scheduled') {
      where.status = 'SCHEDULED';
    } else if (statusParam === 'sent') {
      where.status = { in: ['SENT', 'FAILED'] };
    } else if (statusParam === 'failed') {
      where.status = 'FAILED';
    } else if (statusParam === 'processing') {
      where.status = 'PROCESSING';
    }

    const [total, emails] = await Promise.all([
      db.email.count({ where }),
      db.email.findMany({
        where,
        orderBy:
          statusParam === 'scheduled'
            ? { scheduledTime: 'asc' }
            : { sentTime: 'desc' },
        skip,
        take: limit,
        include: {
          campaign: {
            select: {
              id: true,
              subject: true,
              sender: {
                select: { email: true },
              },
            },
          },
        },
      }),
    ]);

    res.json({
      data: emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
