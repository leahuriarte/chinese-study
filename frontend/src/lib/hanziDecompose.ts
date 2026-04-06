import radicalMeanings from '../data/radical_with_meanings.json';

export interface RadicalInfo {
  radical: string;
  meaning: string | null;
}

let decompositionMap: Record<string, string[]> | null = null;

async function getDecompositionMap(): Promise<Record<string, string[]>> {
  if (!decompositionMap) {
    const mod = await import('../data/cjk_decomp.json');
    decompositionMap = mod.default as Record<string, string[]>;
  }
  return decompositionMap;
}

export async function decomposeHanzi(hanzi: string): Promise<RadicalInfo[]> {
  const map = await getDecompositionMap();
  const meanings = radicalMeanings as Record<string, string>;

  const result: RadicalInfo[] = [];
  const seen = new Set<string>();

  for (const char of hanzi) {
    const components = map[char];
    if (!components) continue;

    for (const comp of components) {
      if (!comp || seen.has(comp)) continue;
      seen.add(comp);
      result.push({
        radical: comp,
        meaning: meanings[comp] ?? null,
      });
    }
  }

  return result;
}
