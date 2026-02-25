import prisma from '../db.js';

export const folderService = {
  async getFolders(userId: string) {
    const folders = await prisma.folder.findMany({
      where: { userId },
      include: {
        _count: { select: { cards: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return folders.map((f) => ({
      id: f.id,
      userId: f.userId,
      name: f.name,
      description: f.description,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      cardCount: f._count.cards,
    }));
  },

  async createFolder(userId: string, name: string, description?: string) {
    return prisma.folder.create({
      data: { userId, name, description },
    });
  },

  async updateFolder(userId: string, folderId: string, data: { name?: string; description?: string }) {
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder || folder.userId !== userId) {
      throw new Error('Folder not found');
    }
    return prisma.folder.update({
      where: { id: folderId },
      data,
    });
  },

  async deleteFolder(userId: string, folderId: string) {
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder || folder.userId !== userId) {
      throw new Error('Folder not found');
    }
    await prisma.folder.delete({ where: { id: folderId } });
  },

  async getFolderCards(userId: string, folderId: string) {
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder || folder.userId !== userId) {
      throw new Error('Folder not found');
    }
    const folderCards = await prisma.folderCard.findMany({
      where: { folderId },
      include: { card: true },
      orderBy: { addedAt: 'asc' },
    });
    return folderCards.map((fc) => fc.card);
  },

  async addCardsToFolder(userId: string, folderId: string, cardIds: string[]) {
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder || folder.userId !== userId) {
      throw new Error('Folder not found');
    }
    // Verify all cards belong to user
    const cards = await prisma.card.findMany({
      where: { id: { in: cardIds }, userId },
      select: { id: true },
    });
    const validCardIds = cards.map((c) => c.id);

    await prisma.folderCard.createMany({
      data: validCardIds.map((cardId) => ({ folderId, cardId })),
      skipDuplicates: true,
    });

    return { added: validCardIds.length };
  },

  async removeCardFromFolder(userId: string, folderId: string, cardId: string) {
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder || folder.userId !== userId) {
      throw new Error('Folder not found');
    }
    await prisma.folderCard.delete({
      where: { folderId_cardId: { folderId, cardId } },
    });
  },
};
