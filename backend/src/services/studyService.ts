import prisma from '../db.js';
import { calculateSM2 } from './srsService.js';

type QuizMode =
  | 'hanzi_to_pinyin'
  | 'pinyin_to_english'
  | 'english_to_hanzi'
  | 'english_to_pinyin'
  | 'pinyin_to_hanzi'
  | 'hanzi_to_english'
  | 'english_pinyin_to_hanzi';

export interface ReviewSubmission {
  cardId: string;
  mode: QuizMode;
  quality: number;  // 0-5
  responseTimeMs: number;
}

export interface StudyFilters {
  textbookPart?: number;
  lessonNumber?: number;
  folderId?: string;
}

export const studyService = {
  async getDueCards(userId: string, mode: QuizMode, limit: number = 20, filters?: StudyFilters) {
    const now = new Date();

    // Build card filter for part/lesson/folder
    const cardFilter: any = {};
    if (filters?.textbookPart) {
      cardFilter.textbookPart = filters.textbookPart;
    }
    if (filters?.lessonNumber) {
      cardFilter.lessonNumber = filters.lessonNumber;
    }
    if (filters?.folderId) {
      cardFilter.folderCards = { some: { folderId: filters.folderId } };
    }

    const dueProgress = await prisma.cardProgress.findMany({
      where: {
        userId,
        mode,
        nextReviewDate: {
          lte: now,
        },
        card: Object.keys(cardFilter).length > 0 ? cardFilter : undefined,
      },
      include: {
        card: true,
      },
      take: limit,
      orderBy: {
        nextReviewDate: 'asc',
      },
    });

    return dueProgress.map((p) => ({
      cardProgress: p,
      card: p.card,
    }));
  },

  async getNewCards(userId: string, mode: QuizMode, limit: number = 10, filters?: StudyFilters) {
    // Build filter for part/lesson/folder
    const cardFilter: any = {
      userId,
      cardProgress: {
        none: {
          mode,
        },
      },
    };

    if (filters?.textbookPart) {
      cardFilter.textbookPart = filters.textbookPart;
    }
    if (filters?.lessonNumber) {
      cardFilter.lessonNumber = filters.lessonNumber;
    }
    if (filters?.folderId) {
      cardFilter.folderCards = { some: { folderId: filters.folderId } };
    }

    // Find cards that don't have progress for this mode yet
    const cards = await prisma.card.findMany({
      where: cardFilter,
      take: limit,
      orderBy: {
        createdAt: 'asc',
      },
    });

    return cards;
  },

  async submitReview(userId: string, data: ReviewSubmission) {
    const { cardId, mode, quality, responseTimeMs } = data;

    // Get or create card progress
    let cardProgress = await prisma.cardProgress.findUnique({
      where: {
        cardId_mode: {
          cardId,
          mode,
        },
      },
    });

    if (!cardProgress) {
      // Create new card progress
      cardProgress = await prisma.cardProgress.create({
        data: {
          cardId,
          userId,
          mode,
          easeFactor: 2.5,
          intervalDays: 0,
          repetitions: 0,
          nextReviewDate: new Date(),
          totalReviews: 0,
          correctCount: 0,
        },
      });
    }

    // Calculate new SRS values using SM-2 algorithm
    const sm2Result = calculateSM2(
      quality,
      cardProgress.easeFactor,
      cardProgress.intervalDays,
      cardProgress.repetitions
    );

    const wasCorrect = quality >= 3;

    // Update card progress
    const updatedProgress = await prisma.cardProgress.update({
      where: { id: cardProgress.id },
      data: {
        easeFactor: sm2Result.easeFactor,
        intervalDays: sm2Result.interval,
        repetitions: sm2Result.repetitions,
        nextReviewDate: sm2Result.nextReviewDate,
        totalReviews: cardProgress.totalReviews + 1,
        correctCount: wasCorrect
          ? cardProgress.correctCount + 1
          : cardProgress.correctCount,
        lastReviewedAt: new Date(),
      },
    });

    // Log the review
    await prisma.reviewLog.create({
      data: {
        cardProgressId: cardProgress.id,
        userId,
        quality,
        responseTimeMs,
        wasCorrect,
      },
    });

    return {
      cardProgress: updatedProgress,
      wasCorrect,
      nextReview: sm2Result.nextReviewDate,
    };
  },

  async getStats(userId: string) {
    const [totalCards, totalReviews, studySessions] = await Promise.all([
      prisma.card.count({ where: { userId } }),
      prisma.reviewLog.count({ where: { userId } }),
      prisma.studySession.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        take: 10,
      }),
    ]);

    // Get due counts per mode
    const now = new Date();
    const modes: QuizMode[] = [
      'hanzi_to_pinyin',
      'pinyin_to_english',
      'english_to_hanzi',
      'english_to_pinyin',
      'pinyin_to_hanzi',
      'hanzi_to_english',
      'english_pinyin_to_hanzi',
    ];

    const dueCounts = await Promise.all(
      modes.map(async (mode) => {
        const count = await prisma.cardProgress.count({
          where: {
            userId,
            mode,
            nextReviewDate: {
              lte: now,
            },
          },
        });
        return { mode, count };
      })
    );

    return {
      totalCards,
      totalReviews,
      dueCounts,
      recentSessions: studySessions,
    };
  },

  async getHeatmap(userId: string, days: number = 90) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const reviews = await prisma.reviewLog.findMany({
      where: {
        userId,
        reviewedAt: {
          gte: startDate,
        },
      },
      select: {
        reviewedAt: true,
        wasCorrect: true,
      },
    });

    // Group by date
    const heatmapData: Record<string, { total: number; correct: number }> = {};

    reviews.forEach((review) => {
      const date = review.reviewedAt.toISOString().split('T')[0];
      if (!heatmapData[date]) {
        heatmapData[date] = { total: 0, correct: 0 };
      }
      heatmapData[date].total++;
      if (review.wasCorrect) {
        heatmapData[date].correct++;
      }
    });

    return heatmapData;
  },
};
