import prisma from '../db.js';
import { integratedChineseVocab } from '../data/integratedChineseVocab.js';

/**
 * Seeds the Integrated Chinese Part 1 Level 1 vocabulary for a user.
 * This function checks if the user already has these cards to avoid duplicates.
 */
export async function seedVocabForUser(userId: string): Promise<{ created: number; skipped: number }> {
  // Get existing hanzi for this user to avoid duplicates
  const existingCards = await prisma.card.findMany({
    where: { userId },
    select: { hanzi: true },
  });

  const existingHanzi = new Set(existingCards.map(c => c.hanzi));

  // Filter out vocab that already exists
  const newVocab = integratedChineseVocab.filter(v => !existingHanzi.has(v.hanzi));

  if (newVocab.length === 0) {
    return { created: 0, skipped: integratedChineseVocab.length };
  }

  // Create cards in bulk
  const result = await prisma.card.createMany({
    data: newVocab.map(v => ({
      userId,
      hanzi: v.hanzi,
      pinyin: v.pinyin,
      pinyinDisplay: v.pinyinDisplay,
      english: v.english,
      englishAlt: [],
      tags: v.tags,
    })),
  });

  return {
    created: result.count,
    skipped: integratedChineseVocab.length - newVocab.length,
  };
}

/**
 * Seeds vocabulary for all existing users who don't have the IC vocab yet.
 */
export async function seedVocabForAllUsers(): Promise<{ usersProcessed: number; totalCardsCreated: number }> {
  const users = await prisma.user.findMany({
    select: { id: true },
  });

  let totalCardsCreated = 0;

  for (const user of users) {
    const result = await seedVocabForUser(user.id);
    totalCardsCreated += result.created;
    console.log(`User ${user.id}: created ${result.created} cards, skipped ${result.skipped}`);
  }

  return {
    usersProcessed: users.length,
    totalCardsCreated,
  };
}
