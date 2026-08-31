import prisma from '../db.js';

export const studyService = {
  async getStats(userId: string) {
    const totalCards = await prisma.card.count({ where: { userId } });

    return {
      totalCards,
    };
  },
};
