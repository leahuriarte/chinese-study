import prisma from '../db.js';
import { integratedChineseVocab, parseICTag } from '../data/integratedChineseVocab.js';
import { integratedChineseVocabPart2 } from '../data/integratedChineseVocabPart2.js';
import { integratedChineseVocabPart3 } from '../data/integratedChineseVocabPart3.js';

// Combined vocabulary from all preloaded Integrated Chinese volumes.
const allIntegratedChineseVocab = [
  ...integratedChineseVocab,
  ...integratedChineseVocabPart2,
  ...integratedChineseVocabPart3,
];

const allIntegratedChineseLessonTags = [
  ...new Set(
    allIntegratedChineseVocab.flatMap(v => v.tags.filter(tag => /^IC\d+-L\d+$/.test(tag)))
  ),
];

function getIntegratedChineseSeedKey(hanzi: string, tags: string[]): string {
  const icTag = tags.find(tag => /^IC\d+-L\d+$/.test(tag));
  return `${hanzi}|${icTag ?? 'untagged'}`;
}

/**
 * Seeds the Integrated Chinese vocabulary for a user.
 * This function checks if the user already has the same textbook entry to avoid duplicates.
 * It also respects cards that the user has deliberately deleted.
 */
export async function seedVocabForUser(userId: string): Promise<{ created: number; skipped: number }> {
  // Get existing textbook entries for this user to avoid duplicates.
  const existingCards = await prisma.card.findMany({
    where: { userId },
    select: {
      hanzi: true,
      tags: true,
      textbookPart: true,
      lessonNumber: true,
    },
  });

  const existingSeedKeys = new Set(
    existingCards.flatMap(c => {
      const keys = c.tags
        .filter(tag => /^IC\d+-L\d+$/.test(tag))
        .map(tag => getIntegratedChineseSeedKey(c.hanzi, [tag]));

      if (c.textbookPart && c.lessonNumber) {
        keys.push(getIntegratedChineseSeedKey(c.hanzi, [`IC${c.textbookPart}-L${c.lessonNumber}`]));
      }

      return keys;
    })
  );

  // Get user's deleted vocab list from settings
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });

  const settings = (user?.settings as Record<string, any>) || {};
  const deletedVocab: string[] = settings.deletedVocab || [];
  const deletedHanzi = new Set(deletedVocab);

  // Filter out vocab that already exists for the same textbook lesson OR was deliberately deleted.
  const newVocab = allIntegratedChineseVocab.filter(
    v => !existingSeedKeys.has(getIntegratedChineseSeedKey(v.hanzi, v.tags)) && !deletedHanzi.has(v.hanzi)
  );

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
    select: { id: true, settings: true },
  });

  let totalCardsCreated = 0;

  for (const user of users) {
    const settings = (user.settings as Record<string, any>) || {};
    const deletedCount = (settings.deletedVocab as string[] || []).length;

    const result = await seedVocabForUser(user.id);
    totalCardsCreated += result.created;
    console.log(`User ${user.id}: created ${result.created} cards, skipped ${result.skipped} (${deletedCount} deliberately deleted)`);
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
  // Find all cards that have IC tags but no textbookPart set.
  const cardsToUpdate = await prisma.card.findMany({
    where: {
      textbookPart: null,
      tags: { hasSome: allIntegratedChineseLessonTags },
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
