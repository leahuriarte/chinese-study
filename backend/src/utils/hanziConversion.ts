import * as OpenCC from 'opencc-js';

const toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' });
const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });

export function getHanziSearchVariants(value: string): string[] {
  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  return Array.from(new Set([
    trimmed,
    toTraditional(trimmed),
    toSimplified(trimmed),
  ]));
}
