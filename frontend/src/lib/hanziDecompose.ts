import radicalMeanings from '../data/radical_with_meanings.json';

export interface ComponentInfo {
  character: string;
  meaning: string | null;
  type: 'semantic' | 'phonetic' | 'unknown';
  phoneticPinyin?: string;
}

export interface DecompositionResult {
  character: string;
  components: ComponentInfo[];
}

interface PhoneticEntry {
  component: string;
  pinyin: string;
  regularity: number;
}

let decompositionMap: Record<string, string[]> | null = null;
let phoneticMap: Record<string, PhoneticEntry> | null = null;
let loadPromise: Promise<void> | null = null;

function ensureLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = Promise.all([
      import('../data/cjk_decomp.json'),
      import('../data/phonetic_components.json'),
    ]).then(([decomp, phonetic]) => {
      decompositionMap = decomp.default as Record<string, string[]>;
      phoneticMap = phonetic.default as Record<string, PhoneticEntry>;
    });
  }
  return loadPromise;
}

// Start loading immediately on module import
ensureLoaded();

export async function decomposeHanzi(hanziStr: string): Promise<DecompositionResult[]> {
  await ensureLoaded();

  const meanings = radicalMeanings as Record<string, string>;
  const results: DecompositionResult[] = [];

  for (const char of hanziStr) {
    const cp = char.codePointAt(0) ?? 0;
    if (cp < 0x3400 || cp > 0x9fff) continue;

    const components1 = decompositionMap![char];
    if (!components1 || components1.length === 0) continue;

    const phoneticEntry = phoneticMap![char] ?? null;

    const components: ComponentInfo[] = components1
      .filter((c) => !!c)
      .map((comp) => {
        const meaning = meanings[comp] ?? null;
        const isPhonetic = phoneticEntry?.component === comp;

        let type: ComponentInfo['type'];
        if (isPhonetic) {
          type = 'phonetic';
        } else if (meaning) {
          type = 'semantic';
        } else {
          type = 'unknown';
        }

        return {
          character: comp,
          meaning,
          type,
          phoneticPinyin: isPhonetic ? phoneticEntry.pinyin : undefined,
        };
      });

    if (components.length > 0) {
      results.push({ character: char, components });
    }
  }

  return results;
}
