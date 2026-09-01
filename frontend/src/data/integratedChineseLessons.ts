export const INTEGRATED_CHINESE_PARTS = [
  { part: 1, label: 'Part 1', lessons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { part: 2, label: 'Part 2', lessons: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
  { part: 3, label: 'Part 3', lessons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
];

export function getIntegratedChineseLessons(part: number | string) {
  const numericPart = typeof part === 'string' ? Number(part) : part;
  return INTEGRATED_CHINESE_PARTS.find(item => item.part === numericPart)?.lessons ?? [];
}
