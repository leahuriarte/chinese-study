import prisma from '../db.js';

export interface CreateCardData {
  hanzi: string;
  pinyin: string;
  pinyinDisplay: string;
  english: string;
  englishAlt?: string[];
  exampleSentence?: string;
  examplePinyin?: string;
  exampleEnglish?: string;
  hskLevel?: number;
  tags?: string[];
}

export interface UpdateCardData extends Partial<CreateCardData> {}

export interface ListCardsParams {
  userId: string;
  page?: number;
  limit?: number;
  tags?: string[];
  hskLevel?: number;
  search?: string;
}

export const cardService = {
  async createCard(userId: string, data: CreateCardData) {
    return prisma.card.create({
      data: {
        userId,
        ...data,
        englishAlt: data.englishAlt || [],
        tags: data.tags || [],
      },
    });
  },

  async listCards(params: ListCardsParams) {
    const { userId, page = 1, limit = 20, tags, hskLevel, search } = params;
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    if (hskLevel) {
      where.hskLevel = hskLevel;
    }

    if (search) {
      where.OR = [
        { hanzi: { contains: search, mode: 'insensitive' } },
        { pinyin: { contains: search, mode: 'insensitive' } },
        { english: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [cards, total] = await Promise.all([
      prisma.card.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.card.count({ where }),
    ]);

    return {
      cards,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getCard(cardId: string, userId: string) {
    const card = await prisma.card.findFirst({
      where: { id: cardId, userId },
      include: {
        cardProgress: true,
      },
    });

    if (!card) {
      throw new Error('Card not found');
    }

    return card;
  },

  async updateCard(cardId: string, userId: string, data: UpdateCardData) {
    const card = await prisma.card.findFirst({
      where: { id: cardId, userId },
    });

    if (!card) {
      throw new Error('Card not found');
    }

    return prisma.card.update({
      where: { id: cardId },
      data,
    });
  },

  async deleteCard(cardId: string, userId: string) {
    const card = await prisma.card.findFirst({
      where: { id: cardId, userId },
    });

    if (!card) {
      throw new Error('Card not found');
    }

    await prisma.card.delete({
      where: { id: cardId },
    });

    return { message: 'Card deleted successfully' };
  },

  async bulkCreateCards(userId: string, cards: CreateCardData[]) {
    const createdCards = await prisma.card.createMany({
      data: cards.map((card) => ({
        userId,
        ...card,
        englishAlt: card.englishAlt || [],
        tags: card.tags || [],
      })),
    });

    return createdCards;
  },

  async exportCards(userId: string) {
    return prisma.card.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  },
};
