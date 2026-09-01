/**
 * Script to update existing cards with part/lesson data.
 * Compiled to JS and run in production.
 */

import prisma from '../db.js';
import { integratedChineseVocab, parseICTag } from '../data/integratedChineseVocab.js';
import { integratedChineseVocabPart2 } from '../data/integratedChineseVocabPart2.js';
import { integratedChineseVocabPart3 } from '../data/integratedChineseVocabPart3.js';

const integratedChineseLessonTags = [
  ...new Set(
    [
      ...integratedChineseVocab,
      ...integratedChineseVocabPart2,
      ...integratedChineseVocabPart3,
    ].flatMap(v => v.tags.filter(tag => /^IC\d+-L\d+$/.test(tag)))
  ),
];

async function main() {
  console.log('Updating existing cards with part/lesson data...');

  // Find all cards that have IC tags but no textbookPart set
  const cardsToUpdate = await prisma.card.findMany({
    where: {
      textbookPart: null,
      tags: { hasSome: integratedChineseLessonTags },
    },
    select: { id: true, tags: true },
  });

  console.log(`Found ${cardsToUpdate.length} cards to update`);

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

  console.log(`Updated ${updated} cards`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
