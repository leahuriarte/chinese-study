/**
 * Script to seed Integrated Chinese vocabulary for all existing users.
 *
 * Run with: npx tsx src/scripts/seedVocab.ts
 */

import { seedVocabForAllUsers } from '../services/vocabSeedService.js';

async function main() {
  console.log('Starting vocabulary seed for all users...');
  console.log('Vocabulary: Integrated Chinese Part 1 Level 1 (471 items)');
  console.log('');

  try {
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
