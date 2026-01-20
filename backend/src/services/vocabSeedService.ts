import prisma from '../db.js';
import { integratedChineseVocab, parseICTag } from '../data/integratedChineseVocab.js';
import { integratedChineseVocabPart2 } from '../data/integratedChineseVocabPart2.js';

// Combined vocabulary from Part 1 and Part 2
const allIntegratedChineseVocab = [...integratedChineseVocab, ...integratedChineseVocabPart2];

/**
 * Seeds the Integrated Chinese Part 1 Level 1 & 2 vocabulary for a user.
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
  const newVocab = allIntegratedChineseVocab.filter(v => !existingHanzi.has(v.hanzi));

  if (newVocab.length === 0) {
    return { created: 0, skipped: allIntegratedChineseVocab.length };
  }

  // Create cards in bulk with textbookPart and lessonNumber
  const result = await prisma.card.createMany({
    data: newVocab.map(v => {
      const parsed = parseICTag(v.tags);
      return {
        userId,
        hanzi: v.hanzi,
        pinyin: v.pinyin,
        pinyinDisplay: v.pinyinDisplay,
        english: v.english,
        englishAlt: [],
        tags: v.tags,
        textbookPart: parsed?.textbookPart ?? null,
        lessonNumber: parsed?.lessonNumber ?? null,
      };
    }),
  });

  return {
    created: result.count,
    skipped: allIntegratedChineseVocab.length - newVocab.length,
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

/**
 * Updates existing cards that have IC tags but missing textbookPart/lessonNumber.
 * This is for migrating cards created before these fields existed.
 */
export async function updateExistingCardsWithPartLesson(): Promise<{ updated: number }> {
  // Find all cards that have IC tags but no textbookPart set (Part 1 and Part 2)
  const cardsToUpdate = await prisma.card.findMany({
    where: {
      textbookPart: null,
      tags: { hasSome: [
        // Part 1 tags
        'IC1-L1', 'IC1-L2', 'IC1-L3', 'IC1-L4', 'IC1-L5', 'IC1-L6', 'IC1-L7', 'IC1-L8', 'IC1-L9', 'IC1-L10',
        // Part 2 tags
        'IC2-L11', 'IC2-L12', 'IC2-L13', 'IC2-L14', 'IC2-L15', 'IC2-L16', 'IC2-L17', 'IC2-L18', 'IC2-L19', 'IC2-L20'
      ] },
    },
    select: { id: true, tags: true },
  });

  let updated = 0;

  for (const card of cardsToUpdate) {
    const parsed = parseICTag(card.tags);
    if (parsed) {
      await prisma.card.update({
        where: { id: card.id },
        data: {
          textbookPart: parsed.textbookPart,
          lessonNumber: parsed.lessonNumber,
        },
      });
      updated++;
    }
  }

  return { updated };
}
