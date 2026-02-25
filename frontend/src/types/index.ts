export type QuizMode =
  | 'hanzi_to_pinyin'
  | 'pinyin_to_english'
  | 'english_to_hanzi'
  | 'english_to_pinyin'
  | 'pinyin_to_hanzi'
  | 'hanzi_to_english'
  | 'english_pinyin_to_hanzi';

export interface User {
  id: string;
  email: string;
  createdAt: string | Date;
  settings: UserSettings;
}

export interface UserSettings {
  dailyNewCards: number;        // default 20
  dailyReviewLimit: number;     // default 100
  preferredQuizModes: QuizMode[];
  showPinyinTones: 'numbers' | 'marks'; // e.g., "ma3" vs "mǎ"
}

export interface Card {
  id: string;
  userId: string;
  hanzi: string;
  pinyin: string;              // with tone numbers, e.g., "ni3 hao3"
  pinyinDisplay: string;       // with tone marks, e.g., "nǐ hǎo"
  english: string;             // primary meaning
  englishAlt: string[];        // alternate meanings
  exampleSentence?: string;
  examplePinyin?: string;
  exampleEnglish?: string;
  hskLevel?: number;           // 1-6, optional
  textbookPart?: number;       // 1 for Part 1, etc.
  lessonNumber?: number;       // 1-10 for IC Part 1
  tags: string[];              // user-defined tags like "food", "verbs"
  createdAt: Date;
  updatedAt: Date;
}

export interface CardProgress {
  id: string;
  cardId: string;
  userId: string;
  mode: QuizMode;

  // SRS fields (SM-2 algorithm)
  easeFactor: number;          // starts at 2.5
  interval: number;            // days until next review
  repetitions: number;         // consecutive correct answers
  nextReviewDate: Date;

  // Stats
  totalReviews: number;
  correctCount: number;
  lastReviewedAt: Date | null;
}

export interface StudySession {
  id: string;
  userId: string;
  startedAt: Date;
  endedAt: Date | null;
  mode: QuizMode;
  cardsReviewed: number;
  correctCount: number;
}

export interface ReviewLog {
  id: string;
  cardProgressId: string;
  userId: string;
  reviewedAt: Date;
  quality: number;             // 0-5 (SM-2 quality rating)
  responseTimeMs: number;
  wasCorrect: boolean;
}

export interface SM2Result {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: Date;
}

export interface Folder {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  cardCount?: number;
}
