import * as OpenCC from 'opencc-js';
import type { Card, CharacterSet, UserSettings } from '../types';

export const DEFAULT_CHARACTER_SET: CharacterSet = 'simplified';

const toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' });
const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });

export function getCharacterSetFromSettings(settings?: UserSettings | null): CharacterSet {
  return settings?.characterSet === 'traditional' ? 'traditional' : DEFAULT_CHARACTER_SET;
}

export function toTraditionalHanzi(value: string): string {
  return toTraditional(value);
}

export function toSimplifiedHanzi(value: string): string {
  return toSimplified(value);
}

export function getDisplayHanzi(card: Pick<Card, 'hanzi'>, characterSet: CharacterSet): string {
  return characterSet === 'traditional'
    ? toTraditionalHanzi(card.hanzi)
    : toSimplifiedHanzi(card.hanzi);
}

export function getHanziAnswerVariants(card: Pick<Card, 'hanzi'>): string[] {
  return Array.from(new Set([
    card.hanzi,
    toTraditionalHanzi(card.hanzi),
    toSimplifiedHanzi(card.hanzi),
  ].map(normalizeHanziAnswer).filter(Boolean)));
}

export function isHanziAnswerEquivalent(userAnswer: string, card: Pick<Card, 'hanzi'>): boolean {
  const normalizedAnswer = normalizeHanziAnswer(userAnswer);
  return getHanziAnswerVariants(card).includes(normalizedAnswer);
}

function normalizeHanziAnswer(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, '').trim();
}
