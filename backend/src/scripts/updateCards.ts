/**
 * Script to update existing cards with part/lesson data.
 * Compiled to JS and run in production.
 */

import prisma from '../db.js';
import { parseICTag } from '../data/integratedChineseVocab.js';

async function main() {
  console.log('Updating existing cards with part/lesson data...');

  // Find all cards that have IC tags but no textbookPart set
  const cardsToUpdate = await prisma.card.findMany({
    where: {
      textbookPart: null,
      tags: { hasSome: ['IC1-L1', 'IC1-L2', 'IC1-L3', 'IC1-L4', 'IC1-L5', 'IC1-L6', 'IC1-L7', 'IC1-L8', 'IC1-L9', 'IC1-L10'] },
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
