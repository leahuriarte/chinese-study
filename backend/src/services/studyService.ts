import prisma from '../db.js';
import { Prisma } from '@prisma/client';

export interface StudySessionFilters {
  textbookPart?: number;
  lessonNumbers?: number[];
  folderId?: string;
}

export interface StudySessionQueueItem {
  cardId: string;
  correctCount: number;
  totalAttempts: number;
}

export interface StudySessionState {
  queue: StudySessionQueueItem[];
  masteredCardIds: string[];
  completedCardIds: string[];
  wrongCardIds: string[];
  totalCards?: number;
}

export interface SaveStudySessionData {
  mode: string;
  sessionType: string;
  writingMode: string;
  studySource: string;
  filters: StudySessionFilters;
  state: StudySessionState;
}

const normalizeState = (state: Prisma.JsonValue): StudySessionState => {
  const raw = state && typeof state === 'object' && !Array.isArray(state)
    ? state as Record<string, unknown>
    : {};

  const queue = Array.isArray(raw.queue)
    ? raw.queue
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
      .map((item) => ({
        cardId: typeof item.cardId === 'string' ? item.cardId : '',
        correctCount: typeof item.correctCount === 'number' ? item.correctCount : 0,
        totalAttempts: typeof item.totalAttempts === 'number' ? item.totalAttempts : 0,
      }))
      .filter(item => item.cardId.length > 0)
    : [];

  const stringArray = (value: unknown) => Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    queue,
    masteredCardIds: stringArray(raw.masteredCardIds),
    completedCardIds: stringArray(raw.completedCardIds),
    wrongCardIds: stringArray(raw.wrongCardIds),
    totalCards: typeof raw.totalCards === 'number' ? raw.totalCards : undefined,
  };
};

const toJsonInput = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

const countCompletedCards = (state: StudySessionState) => (
  state.masteredCardIds.length + state.completedCardIds.length
);

export const studyService = {
  async getStats(userId: string) {
    const totalCards = await prisma.card.count({ where: { userId } });

    return {
      totalCards,
    };
  },

  async getLatestSession(userId: string) {
    const session = await prisma.studySession.findFirst({
      where: { userId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });

    if (!session) {
      return null;
    }

    const state = normalizeState(session.state);
    const queueCardIds = state.queue.map(item => item.cardId);
    const cards = queueCardIds.length > 0
      ? await prisma.card.findMany({
        where: {
          userId,
          id: { in: queueCardIds },
        },
      })
      : [];
    const cardsById = new Map(cards.map(card => [card.id, card]));
    const hydratedQueue = state.queue
      .filter(item => cardsById.has(item.cardId))
      .map(item => ({
        ...cardsById.get(item.cardId)!,
        correctCount: item.correctCount,
        totalAttempts: item.totalAttempts,
      }));
    const validCardIds = new Set(cardsById.keys());

    return {
      ...session,
      state: {
        ...state,
        queue: state.queue.filter(item => validCardIds.has(item.cardId)),
      },
      queueCards: hydratedQueue,
    };
  },

  async createSession(userId: string, data: SaveStudySessionData) {
    const completedCount = countCompletedCards(data.state);

    return prisma.studySession.create({
      data: {
        userId,
        mode: data.mode,
        sessionType: data.sessionType,
        writingMode: data.writingMode,
        studySource: data.studySource,
        filters: toJsonInput(data.filters),
        state: toJsonInput(data.state),
        cardsReviewed: completedCount,
        correctCount: completedCount,
        status: 'active',
      },
    });
  },

  async updateSession(userId: string, sessionId: string, data: SaveStudySessionData) {
    const session = await prisma.studySession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new Error('Study session not found');
    }

    const completedCount = countCompletedCards(data.state);

    return prisma.studySession.update({
      where: { id: sessionId },
      data: {
        mode: data.mode,
        sessionType: data.sessionType,
        writingMode: data.writingMode,
        studySource: data.studySource,
        filters: toJsonInput(data.filters),
        state: toJsonInput(data.state),
        cardsReviewed: completedCount,
        correctCount: completedCount,
      },
    });
  },

  async completeSession(userId: string, sessionId: string, data: SaveStudySessionData) {
    const session = await prisma.studySession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new Error('Study session not found');
    }

    const completedCount = countCompletedCards(data.state);

    return prisma.studySession.update({
      where: { id: sessionId },
      data: {
        mode: data.mode,
        sessionType: data.sessionType,
        writingMode: data.writingMode,
        studySource: data.studySource,
        filters: toJsonInput(data.filters),
        state: toJsonInput(data.state),
        cardsReviewed: completedCount,
        correctCount: completedCount,
        status: 'completed',
        endedAt: new Date(),
      },
    });
  },
};
