import prisma from '../db.js';
import { integratedChineseVocab } from '../data/integratedChineseVocab.js';
import { integratedChineseVocabPart2 } from '../data/integratedChineseVocabPart2.js';

// Set of all pre-seeded hanzi for quick lookup
const preSeededHanzi = new Set([
  ...integratedChineseVocab.map(v => v.hanzi),
  ...integratedChineseVocabPart2.map(v => v.hanzi),
]);

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
  textbookPart?: number;
  lessonNumber?: number;
  tags?: string[];
}

export interface UpdateCardData extends Partial<CreateCardData> {}

export interface ListCardsParams {
  userId: string;
  page?: number;
  limit?: number;
  tags?: string[];
  hskLevel?: number;
  textbookPart?: number;
  lessonNumber?: number;
  search?: string;
  folderId?: string;
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
    const { userId, page = 1, limit = 20, tags, hskLevel, textbookPart, lessonNumber, search, folderId } = params;
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    if (hskLevel) {
      where.hskLevel = hskLevel;
    }

    if (textbookPart) {
      where.textbookPart = textbookPart;
    }

    if (lessonNumber) {
      where.lessonNumber = lessonNumber;
    }

    if (folderId) {
      where.folderCards = { some: { folderId } };
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

    // If this is a pre-seeded card, track it so it doesn't get re-seeded
    if (preSeededHanzi.has(card.hanzi)) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { settings: true },
      });

      const settings = (user?.settings as Record<string, any>) || {};
      const deletedVocab: string[] = settings.deletedVocab || [];

      if (!deletedVocab.includes(card.hanzi)) {
        deletedVocab.push(card.hanzi);
        await prisma.user.update({
          where: { id: userId },
          data: {
            settings: { ...settings, deletedVocab },
          },
        });
      }
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
