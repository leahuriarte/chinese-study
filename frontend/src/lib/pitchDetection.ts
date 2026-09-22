export interface PitchSample {
  time: number;
  frequency: number | null;
}

/**
 * Estimate the fundamental frequency of a short voice sample with normalized
 * autocorrelation. It intentionally favors Mandarin's usual speaking range
 * and returns null when the signal is too quiet or periodicity is weak.
 */
export function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  let mean = 0;
  for (let i = 0; i < buffer.length; i += 1) mean += buffer[i];
  mean /= buffer.length;

  let energy = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const centered = buffer[i] - mean;
    energy += centered * centered;
  }

  const rms = Math.sqrt(energy / buffer.length);
  if (rms < 0.012) return null;

  const minLag = Math.floor(sampleRate / 500);
  const maxLag = Math.min(Math.floor(sampleRate / 70), buffer.length - 2);
  let bestLag = -1;
  let bestCorrelation = 0;
  const correlations = new Float32Array(maxLag + 1);

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let numerator = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    const length = buffer.length - lag;

    for (let i = 0; i < length; i += 1) {
      const left = buffer[i] - mean;
      const right = buffer[i + lag] - mean;
      numerator += left * right;
      leftEnergy += left * left;
      rightEnergy += right * right;
    }

    const denominator = Math.sqrt(leftEnergy * rightEnergy);
    const correlation = denominator > 0 ? numerator / denominator : 0;
    correlations[lag] = correlation;
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  if (bestLag < 0 || bestCorrelation < 0.68) return null;

  // A periodic signal also correlates at 2x and 3x its true period. Prefer the
  // earliest strong local maximum so those repeats do not create octave drops.
  const strongPeakThreshold = Math.max(0.68, bestCorrelation * 0.9);
  for (let lag = minLag + 1; lag < maxLag; lag += 1) {
    if (
      correlations[lag] >= strongPeakThreshold
      && correlations[lag] >= correlations[lag - 1]
      && correlations[lag] >= correlations[lag + 1]
    ) {
      bestLag = lag;
      bestCorrelation = correlations[lag];
      break;
    }
  }

  // Parabolic interpolation makes the trace less stair-stepped between lags.
  const left = correlations[bestLag - 1] ?? bestCorrelation;
  const right = correlations[bestLag + 1] ?? bestCorrelation;
  const divisor = 2 * (2 * bestCorrelation - left - right);
  const adjustment = divisor === 0 ? 0 : (right - left) / divisor;
  const refinedLag = bestLag + Math.max(-1, Math.min(1, adjustment));
  const frequency = sampleRate / refinedLag;

  return frequency >= 70 && frequency <= 500 ? frequency : null;
}

const toneMarks: Record<string, number> = {
  ā: 1, á: 2, ǎ: 3, à: 4,
  ē: 1, é: 2, ě: 3, è: 4,
  ī: 1, í: 2, ǐ: 3, ì: 4,
  ō: 1, ó: 2, ǒ: 3, ò: 4,
  ū: 1, ú: 2, ǔ: 3, ù: 4,
  ǖ: 1, ǘ: 2, ǚ: 3, ǜ: 4,
  ń: 2, ň: 3, ǹ: 4,
  ḿ: 2,
};

export function extractTones(pinyin: string): number[] {
  const numbered = Array.from(pinyin.matchAll(/[1-5]/g), match => Number(match[0]));
  if (numbered.length > 0) return numbered;

  return Array.from(pinyin.toLowerCase().normalize('NFC'))
    .map(character => toneMarks[character])
    .filter((tone): tone is number => tone !== undefined);
}

export const toneNames: Record<number, string> = {
  1: 'high & level',
  2: 'rising',
  3: 'dip then rise',
  4: 'falling',
  5: 'neutral',
};
