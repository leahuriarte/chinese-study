/**
 * Script to seed Integrated Chinese vocabulary for all existing users.
 *
 * Run with: npx tsx src/scripts/seedVocab.ts
 */

import { seedVocabForAllUsers, updateExistingCardsWithPartLesson } from '../services/vocabSeedService.js';

async function main() {
  console.log('Starting vocabulary seed for all users...');
  console.log('Vocabulary: Integrated Chinese Part 1 Level 1 (454 items)');
  console.log('');

  try {
    // First, update existing cards that don't have part/lesson set
    console.log('Updating existing cards with part/lesson data...');
    const updateResult = await updateExistingCardsWithPartLesson();
    console.log(`Updated ${updateResult.updated} existing cards with part/lesson numbers`);
    console.log('');

    // Then seed any missing vocab for users
    const result = await seedVocabForAllUsers();

    console.log('');
    console.log('=== Seed Complete ===');
    console.log(`Users processed: ${result.usersProcessed}`);
    console.log(`Total cards created: ${result.totalCardsCreated}`);
  } catch (error) {
    console.error('Error seeding vocabulary:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
