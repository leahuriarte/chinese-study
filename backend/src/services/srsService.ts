export interface SM2Result {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: Date;
}

export function calculateSM2(
  quality: number,              // 0-5: 0-2 = wrong, 3 = hard, 4 = good, 5 = easy
  currentEaseFactor: number,
  currentInterval: number,
  currentRepetitions: number
): SM2Result {

  let newEaseFactor = currentEaseFactor;
  let newInterval: number;
  let newRepetitions: number;

  if (quality < 3) {
    // Failed: reset repetitions, short interval
    newRepetitions = 0;
    newInterval = 1;
  } else {
    // Passed
    newRepetitions = currentRepetitions + 1;

    if (newRepetitions === 1) {
      newInterval = 1;
    } else if (newRepetitions === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(currentInterval * currentEaseFactor);
    }

    // Update ease factor
    newEaseFactor = currentEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    newEaseFactor = Math.max(1.3, newEaseFactor); // minimum 1.3
  }

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

  return {
    easeFactor: newEaseFactor,
    interval: newInterval,
    repetitions: newRepetitions,
    nextReviewDate
  };
}
