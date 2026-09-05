import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  Card,
  QuizMode,
  SaveStudySessionPayload,
  StudySessionFilters,
  StudySessionState,
  StudySessionType,
  StudySource,
  WritingMode as StudyWritingMode,
} from '../types';
import WritingQuiz from '../components/study/WritingQuiz';
import HandwrittenTextAnswer from '../components/study/HandwrittenTextAnswer';
import RadicalBreakdown from '../components/RadicalBreakdown';
import { getIntegratedChineseLessons, INTEGRATED_CHINESE_PARTS } from '../data/integratedChineseLessons';

const quizModes: { value: QuizMode; label: string; description: string; icon: string }[] = [
  { value: 'hanzi_to_pinyin', label: 'Hanzi → Pinyin', description: 'See character, type pinyin', icon: '拼' },
  { value: 'hanzi_to_english', label: 'Hanzi → English', description: 'See character, type meaning', icon: 'Aa' },
  { value: 'pinyin_to_hanzi', label: 'Pinyin → Hanzi', description: 'See pinyin, write character', icon: '写' },
  { value: 'pinyin_to_english', label: 'Pinyin → English', description: 'See pinyin, type meaning', icon: '译' },
  { value: 'english_to_hanzi', label: 'English → Hanzi', description: 'See meaning, write character', icon: '字' },
  { value: 'english_pinyin_to_hanzi', label: 'English + Pinyin → Hanzi', description: 'See meaning & pinyin, write character', icon: '全' },
  { value: 'english_to_pinyin', label: 'English → Pinyin', description: 'See meaning, type pinyin', icon: '音' },
];

export type WritingMode = StudyWritingMode;
export type SessionType = StudySessionType;
type TextAnswerInputMode = 'typing' | 'writing';

interface CardWithProgress extends Card {
  correctCount: number;
  totalAttempts: number;
}

const getQuizModeLabel = (quizMode: QuizMode) => (
  quizModes.find((item) => item.value === quizMode)?.label || quizMode
);

const getSessionTypeLabel = (type: SessionType) => (
  type === 'mastery' ? 'Mastery' : 'Quick Review'
);

const pinyinAnswerModes = new Set<QuizMode>([
  'hanzi_to_pinyin',
  'english_to_pinyin',
]);

const hanziPromptModes = new Set<QuizMode>([
  'hanzi_to_pinyin',
  'hanzi_to_english',
]);

const hanziWritingModes = new Set<QuizMode>([
  'pinyin_to_hanzi',
  'english_to_hanzi',
  'english_pinyin_to_hanzi',
]);

const pinyinToneMarks: Record<string, [letter: string, tone: string]> = {
  ā: ['a', '1'],
  á: ['a', '2'],
  ǎ: ['a', '3'],
  à: ['a', '4'],
  ē: ['e', '1'],
  é: ['e', '2'],
  ě: ['e', '3'],
  è: ['e', '4'],
  ī: ['i', '1'],
  í: ['i', '2'],
  ǐ: ['i', '3'],
  ì: ['i', '4'],
  ō: ['o', '1'],
  ó: ['o', '2'],
  ǒ: ['o', '3'],
  ò: ['o', '4'],
  ū: ['u', '1'],
  ú: ['u', '2'],
  ǔ: ['u', '3'],
  ù: ['u', '4'],
  ǖ: ['v', '1'],
  ǘ: ['v', '2'],
  ǚ: ['v', '3'],
  ǜ: ['v', '4'],
};

const normalizePinyinToneComparable = (value: string) => {
  let letters = '';
  let tones = '';

  Array.from(value.toLowerCase().normalize('NFC')).forEach((char) => {
    const toneMark = pinyinToneMarks[char];
    if (toneMark) {
      letters += toneMark[0];
      tones += toneMark[1];
      return;
    }

    if (/[1-4]/.test(char)) {
      tones += char;
      return;
    }

    if (char === 'ü') {
      letters += 'v';
      return;
    }

    if (/[a-z]/.test(char)) {
      letters += char;
    }
  });

  return { letters, tones };
};

const isPinyinToneEquivalent = (userAnswer: string, correctAnswer: string) => {
  const user = normalizePinyinToneComparable(userAnswer);
  const correct = normalizePinyinToneComparable(correctAnswer);

  return user.letters.length > 0
    && user.letters === correct.letters
    && user.tones === correct.tones;
};

const buildStudySessionState = (
  queue: CardWithProgress[],
  masteredCardIds: Set<string>,
  completedCardIds: Set<string>,
  wrongCardIds: Set<string>,
  totalCards: number
): StudySessionState => ({
  queue: queue.map(card => ({
    cardId: card.id,
    correctCount: card.correctCount,
    totalAttempts: card.totalAttempts,
  })),
  masteredCardIds: [...masteredCardIds],
  completedCardIds: [...completedCardIds],
  wrongCardIds: [...wrongCardIds],
  totalCards,
});

const buildStudySessionPayload = (
  quizMode: QuizMode,
  type: SessionType,
  currentWritingMode: WritingMode,
  source: StudySource,
  currentFilters: StudySessionFilters,
  state: StudySessionState
): SaveStudySessionPayload => ({
  mode: quizMode,
  sessionType: type,
  writingMode: currentWritingMode,
  studySource: source,
  filters: currentFilters,
  state,
});

export default function Study() {
  const [mode, setMode] = useState<QuizMode>('hanzi_to_pinyin');
  const [writingMode, setWritingMode] = useState<WritingMode>('freehand');
  const [sessionType, setSessionType] = useState<SessionType>('mastery');
  const [showModeSelector, setShowModeSelector] = useState(true);
  const [studySource, setStudySource] = useState<StudySource>('lesson');
  const [selectedPart, setSelectedPart] = useState<number | null>(1);
  const [selectedLessons, setSelectedLessons] = useState<number[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [textAnswerInputMode, setTextAnswerInputMode] = useState<TextAnswerInputMode>('typing');
  const [showResult, setShowResult] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [answeredCard, setAnsweredCard] = useState<Card | null>(null);
  const [wasOverridden, setWasOverridden] = useState(false);
  const queryClient = useQueryClient();

  const [cardQueue, setCardQueue] = useState<CardWithProgress[]>([]);
  const [masteredCards, setMasteredCards] = useState<Set<string>>(new Set());
  const [completedCards, setCompletedCards] = useState<Set<string>>(new Set());
  const [wrongCardIds, setWrongCardIds] = useState<Set<string>>(new Set());
  const [folderPromptName, setFolderPromptName] = useState('');
  const [folderPromptState, setFolderPromptState] = useState<'idle' | 'asking' | 'naming' | 'done'>('idle');
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionTotalCards, setSessionTotalCards] = useState(0);
  const [sessionSaveError, setSessionSaveError] = useState<string | null>(null);
  const completedSessionIdsRef = useRef<Set<string>>(new Set());

  const filters = useMemo<StudySessionFilters>(() => ({
    textbookPart: studySource === 'lesson' ? (selectedPart || undefined) : undefined,
    lessonNumbers: studySource === 'lesson' && selectedLessons.length > 0 ? selectedLessons : undefined,
    folderId: studySource === 'folder' ? (selectedFolderId || undefined) : undefined,
  }), [selectedFolderId, selectedLessons, selectedPart, studySource]);

  const { data: foldersData } = useQuery({
    queryKey: ['folders'],
    queryFn: () => api.getFolders(),
  });

  const { data: allCardsData, isLoading: isLoadingAll, refetch: refetchCards } = useQuery({
    queryKey: ['allCards', studySource, selectedPart, selectedLessons, selectedFolderId],
    queryFn: () => api.getCards({ ...filters, limit: 500 }),
  });

  const {
    data: latestStudySession,
    isLoading: isLoadingLatestStudySession,
    refetch: refetchLatestStudySession,
  } = useQuery({
    queryKey: ['latestStudySession'],
    queryFn: () => api.getLatestStudySession(),
  });

  const createMissedFolderMutation = useMutation({
    mutationFn: async ({ name, cardIds }: { name: string; cardIds: string[] }) => {
      const folder = await api.createFolder(name);
      await api.addCardsToFolder(folder.id, cardIds);
      return folder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      setFolderPromptState('done');
    },
  });

  const isLoading = isStartingSession || (!activeSessionId && isLoadingAll);

  const sessionState = useMemo(() => buildStudySessionState(
    cardQueue,
    masteredCards,
    completedCards,
    wrongCardIds,
    sessionTotalCards || allCardsData?.cards?.length || 0
  ), [allCardsData?.cards?.length, cardQueue, completedCards, masteredCards, sessionTotalCards, wrongCardIds]);

  const sessionPayload = useMemo(() => buildStudySessionPayload(
    mode,
    sessionType,
    writingMode,
    studySource,
    filters,
    sessionState
  ), [filters, mode, sessionState, sessionType, studySource, writingMode]);

  useEffect(() => {
    if (!activeSessionId || showModeSelector || isStartingSession) {
      return;
    }

    const hasSessionProgress = sessionPayload.state.queue.length > 0
      || sessionPayload.state.masteredCardIds.length > 0
      || sessionPayload.state.completedCardIds.length > 0;

    if (!hasSessionProgress) {
      return;
    }

    const isComplete = sessionPayload.state.queue.length === 0
      && (
        sessionPayload.state.masteredCardIds.length > 0
        || sessionPayload.state.completedCardIds.length > 0
      );
    const sessionId = activeSessionId;

    const timeoutId = window.setTimeout(() => {
      const savePromise = isComplete
        ? completedSessionIdsRef.current.has(sessionId)
          ? Promise.resolve()
          : api.completeStudySession(sessionId, sessionPayload).then(() => {
            completedSessionIdsRef.current.add(sessionId);
            setActiveSessionId(null);
            queryClient.invalidateQueries({ queryKey: ['latestStudySession'] });
          })
        : api.updateStudySession(sessionId, sessionPayload);

      savePromise
        .then(() => setSessionSaveError(null))
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Unable to save study session';
          setSessionSaveError(message);
        });
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [activeSessionId, isStartingSession, queryClient, sessionPayload, showModeSelector]);

  const getCurrentCard = useCallback((): Card | null => {
    return cardQueue[0] || null;
  }, [cardQueue]);

  const currentCard = getCurrentCard();

  const getCorrectAnswer = (card: Card, quizMode: QuizMode): string => {
    switch (quizMode) {
      case 'hanzi_to_pinyin':
      case 'english_to_pinyin':
        return card.pinyinDisplay.toLowerCase();
      case 'hanzi_to_english':
      case 'pinyin_to_english':
        return card.english.toLowerCase();
      case 'pinyin_to_hanzi':
      case 'english_to_hanzi':
      case 'english_pinyin_to_hanzi':
        return card.hanzi;
      default:
        return '';
    }
  };

  const getPrompt = (card: Card, quizMode: QuizMode): string => {
    switch (quizMode) {
      case 'hanzi_to_pinyin':
      case 'hanzi_to_english':
        return card.hanzi;
      case 'pinyin_to_hanzi':
      case 'pinyin_to_english':
        return card.pinyinDisplay;
      case 'english_to_hanzi':
      case 'english_to_pinyin':
      case 'english_pinyin_to_hanzi':
        return card.english;
      default:
        return '';
    }
  };

  const getPlaceholder = (quizMode: QuizMode): string => {
    switch (quizMode) {
      case 'hanzi_to_pinyin':
      case 'english_to_pinyin':
        return 'Type pinyin (e.g., ni3 hao3)';
      case 'hanzi_to_english':
      case 'pinyin_to_english':
        return 'Type the meaning in English';
      case 'pinyin_to_hanzi':
      case 'english_to_hanzi':
      case 'english_pinyin_to_hanzi':
        return 'Type the character';
      default:
        return '';
    }
  };

  const checkAnswerSmart = (userAnswer: string, correctAnswer: string, quizMode: QuizMode, card: Card): boolean => {
    const normalizedUser = userAnswer.toLowerCase().trim();
    const normalizedCorrect = correctAnswer.toLowerCase().trim();

    if (normalizedUser === normalizedCorrect) {
      return true;
    }

    // For pinyin modes, accept both tone marks (pinyinDisplay) and tone numbers (pinyin)
    if (quizMode === 'hanzi_to_pinyin' || quizMode === 'english_to_pinyin') {
      const pinyinWithMarks = card.pinyinDisplay.toLowerCase().trim();
      const pinyinWithNumbers = card.pinyin.toLowerCase().trim();
      const markedAnswer = normalizePinyinToneComparable(pinyinWithMarks);
      const storedPinyinHasTones = /[1-5]/.test(pinyinWithNumbers);

      if (normalizedUser === pinyinWithMarks) {
        return true;
      }

      if (storedPinyinHasTones && normalizedUser === pinyinWithNumbers) {
        return true;
      }

      if (isPinyinToneEquivalent(normalizedUser, pinyinWithMarks)) {
        return true;
      }

      if ((storedPinyinHasTones || markedAnswer.tones.length === 0) && isPinyinToneEquivalent(normalizedUser, pinyinWithNumbers)) {
        return true;
      }
    }

    if (quizMode === 'hanzi_to_english' || quizMode === 'pinyin_to_english') {
      const parts = normalizedCorrect.split(/[;,/]/).map(p => p.trim()).filter(p => p.length > 0);

      for (const part of parts) {
        if (normalizedUser === part) {
          return true;
        }
        if (part === normalizedUser) {
          return true;
        }
      }

      for (const part of parts) {
        const partWords = part.split(/\s+/).filter(w => w.length > 2);
        const userWords = normalizedUser.split(/\s+/);
        if (partWords.length > 0 && partWords.every(pw => userWords.some(uw => uw === pw || uw.includes(pw)))) {
          return true;
        }
      }
    }

    return false;
  };

  const processAnswer = (correct: boolean) => {
    if (!currentCard) return;

    setAnsweredCard(currentCard);
    setWasCorrect(correct);
    setShowResult(true);

    if (!correct) {
      setWrongCardIds(prev => new Set([...prev, currentCard.id]));
    }

  };

  const submitTextAnswer = (submittedAnswer: string) => {
    if (!currentCard) return;

    const correctAnswer = getCorrectAnswer(currentCard, mode);
    const correct = checkAnswerSmart(submittedAnswer, correctAnswer, mode, currentCard);
    setAnswer(submittedAnswer);
    processAnswer(correct);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitTextAnswer(answer);
  };

  const handleHandwrittenTextGrade = (correct: boolean) => {
    setAnswer('');
    processAnswer(correct);
  };

  const handleWritingComplete = (correct: boolean) => {
    processAnswer(correct);
  };

  const handleOverrideCorrect = () => {
    if (!answeredCard) return;

    setWasCorrect(true);
    setWasOverridden(true);
  };

  const handleNext = () => {
    if (!currentCard) return;

    setAnswer('');
    setShowResult(false);
    setAnsweredCard(null);
    setWasOverridden(false);

    if (sessionType === 'quick') {
      if (wasCorrect) {
        // Correct: remove from queue and mark as completed
        setCompletedCards(prev => new Set(prev).add(currentCard.id));
        setCardQueue(prev => prev.slice(1));
      } else {
        // Wrong: move to back of queue to try again
        setCardQueue(prev => [...prev.slice(1), prev[0]]);
      }
    } else if (sessionType === 'mastery') {
      const currentCardWithProgress = cardQueue[0];

      if (wasCorrect) {
        const newCorrectCount = currentCardWithProgress.correctCount + 1;

        if (newCorrectCount >= 3) {
          setMasteredCards(prev => new Set(prev).add(currentCard.id));
          setCardQueue(prev => prev.slice(1));
        } else {
          const minPosition = newCorrectCount === 1 ? 3 : 6;
          const maxPosition = newCorrectCount === 1 ? 5 : 10;
          const position = Math.min(
            minPosition + Math.floor(Math.random() * (maxPosition - minPosition + 1)),
            cardQueue.length - 1
          );

          setCardQueue(prev => {
            const updated = { ...prev[0], correctCount: newCorrectCount, totalAttempts: prev[0].totalAttempts + 1 };
            const rest = prev.slice(1);
            const newQueue = [...rest];
            newQueue.splice(Math.max(0, position - 1), 0, updated);
            return newQueue;
          });
        }
      } else {
        const position = 1 + Math.floor(Math.random() * 2);
        setCardQueue(prev => {
          const updated = { ...prev[0], correctCount: 0, totalAttempts: prev[0].totalAttempts + 1 };
          const rest = prev.slice(1);
          const newQueue = [...rest];
          newQueue.splice(Math.min(position, newQueue.length), 0, updated);
          return newQueue;
        });
      }
    }
  };

  const startStudying = async (selectedMode: QuizMode) => {
    setIsStartingSession(true);
    setMode(selectedMode);
    setAnswer('');
    setTextAnswerInputMode('typing');
    setShowResult(false);
    setAnsweredCard(null);
    setWasOverridden(false);
    setCardQueue([]);
    setMasteredCards(new Set());
    setCompletedCards(new Set());
    setWrongCardIds(new Set());
    setFolderPromptState('idle');
    setFolderPromptName('');
    setActiveSessionId(null);
    setSessionSaveError(null);

    try {
      const cardsData = allCardsData?.cards ? allCardsData : (await refetchCards()).data;
      const shuffled = [...(cardsData?.cards || [])]
        .sort(() => Math.random() - 0.5)
        .map(card => ({ ...card, correctCount: 0, totalAttempts: 0 }));
      const totalCards = shuffled.length;
      const initialState = buildStudySessionState(shuffled, new Set(), new Set(), new Set(), totalCards);
      const session = await api.createStudySession(buildStudySessionPayload(
        selectedMode,
        sessionType,
        writingMode,
        studySource,
        filters,
        initialState
      ));

      setActiveSessionId(session.id);
      setSessionTotalCards(totalCards);
      setCardQueue(shuffled);
      setShowModeSelector(false);
      queryClient.invalidateQueries({ queryKey: ['latestStudySession'] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start study session';
      setSessionSaveError(message);
    } finally {
      setIsStartingSession(false);
    }
  };

  const resumeLatestSession = async () => {
    setIsStartingSession(true);
    setSessionSaveError(null);

    try {
      const latest = latestStudySession || (await refetchLatestStudySession()).data;

      if (!latest || latest.queueCards.length === 0) {
        setSessionSaveError('No unfinished session is available to resume.');
        return;
      }

      const nextSessionType = latest.sessionType;
      const nextWritingMode = latest.writingMode;
      const nextStudySource = latest.studySource;
      const nextFilters = latest.filters || {};

      setActiveSessionId(latest.id);
      setMode(latest.mode);
      setSessionType(nextSessionType);
      setWritingMode(nextWritingMode);
      setStudySource(nextStudySource);
      setSelectedPart(nextStudySource === 'lesson' ? nextFilters.textbookPart ?? null : null);
      setSelectedLessons(nextStudySource === 'lesson' ? nextFilters.lessonNumbers || [] : []);
      setSelectedFolderId(nextStudySource === 'folder' ? nextFilters.folderId || null : null);
      setAnswer('');
      setTextAnswerInputMode('typing');
      setShowResult(false);
      setWasCorrect(false);
      setAnsweredCard(null);
      setWasOverridden(false);
      setCardQueue(latest.queueCards);
      setMasteredCards(new Set(latest.state.masteredCardIds));
      setCompletedCards(new Set(latest.state.completedCardIds));
      setWrongCardIds(new Set(latest.state.wrongCardIds));
      setFolderPromptState('idle');
      setFolderPromptName('');
      setSessionTotalCards(
        latest.state.totalCards
        || latest.queueCards.length
          + latest.state.masteredCardIds.length
          + latest.state.completedCardIds.length
      );
      setShowModeSelector(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to resume study session';
      setSessionSaveError(message);
    } finally {
      setIsStartingSession(false);
    }
  };

  const changeMode = () => {
    setShowModeSelector(true);
    setAnswer('');
    setTextAnswerInputMode('typing');
    setShowResult(false);
    setAnsweredCard(null);
    setWasOverridden(false);
    setCardQueue([]);
    setMasteredCards(new Set());
    setCompletedCards(new Set());
    setWrongCardIds(new Set());
    setFolderPromptState('idle');
    setFolderPromptName('');
    setIsStartingSession(false);
    setActiveSessionId(null);
    setSessionTotalCards(0);
    setStudySource('lesson');
    setSelectedFolderId(null);
    setSelectedPart(1);
    setSelectedLessons([]);
    queryClient.invalidateQueries({ queryKey: ['latestStudySession'] });
  };

  const getProgress = () => {
    const total = sessionTotalCards || (allCardsData?.cards?.length || 0);
    if (sessionType === 'quick') {
      return { current: completedCards.size, total };
    } else {
      return { current: masteredCards.size, total };
    }
  };

  const progress = getProgress();

  const isSessionComplete = () => {
    return cardQueue.length === 0 && (masteredCards.size > 0 || completedCards.size > 0);
  };

  const latestStudySessionProgress = latestStudySession
    ? latestStudySession.sessionType === 'quick'
      ? latestStudySession.state.completedCardIds.length
      : latestStudySession.state.masteredCardIds.length
    : 0;
  const latestStudySessionTotal = latestStudySession
    ? latestStudySession.state.totalCards
      || latestStudySession.queueCards.length
        + latestStudySession.state.masteredCardIds.length
        + latestStudySession.state.completedCardIds.length
    : 0;
  const latestStudySessionDescription = isLoadingLatestStudySession
    ? 'Checking for saved progress...'
    : latestStudySession
      ? `${getSessionTypeLabel(latestStudySession.sessionType)} • ${getQuizModeLabel(latestStudySession.mode)} • ${latestStudySessionProgress}/${latestStudySessionTotal}`
      : 'No unfinished session yet';
  const canResumeLatestSession = Boolean(latestStudySession && latestStudySession.queueCards.length > 0);

  // Mode Selector Screen
  if (showModeSelector) {
    return (
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12 pt-8">
          <div className="inline-block mb-4">
            <span className="field-label">Study</span>
          </div>
          <h1 className="display-title text-4xl md:text-5xl text-ink mb-2">
            Study Mode
          </h1>
          <p className="text-ink-light text-sm">Choose how you want to practice today</p>
        </div>

        {/* Session Type Selection */}
        <div className="document-card p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="field-label">Session Type</span>
            <div className="flex-1 border-t border-dashed border-border" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SessionTypeButton
              active={sessionType === 'mastery'}
              onClick={() => setSessionType('mastery')}
              icon="精"
              title="Mastery Mode"
              description="Get each card right 3x with smart spacing"
            />
            <SessionTypeButton
              active={sessionType === 'quick'}
              onClick={() => setSessionType('quick')}
              icon="快"
              title="Quick Review"
              description="Go through all cards once"
            />
            <SessionTypeButton
              active={false}
              disabled={!canResumeLatestSession || isStartingSession}
              onClick={() => void resumeLatestSession()}
              icon="续"
              title="Resume Latest"
              description={latestStudySessionDescription}
            />
          </div>
          {sessionSaveError && (
            <p className="text-xs text-stamp-red mt-4">{sessionSaveError}</p>
          )}
        </div>

        {/* Study Source */}
        <div className="document-card p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="field-label">Study Source</span>
            <div className="flex-1 border-t border-dashed border-border" />
          </div>

          <div className="flex gap-3 mb-6">
            <FilterButton active={studySource === 'lesson'} onClick={() => { setStudySource('lesson'); setSelectedFolderId(null); }}>
              By Lesson
            </FilterButton>
            <FilterButton active={studySource === 'folder'} onClick={() => { setStudySource('folder'); setSelectedPart(null); setSelectedLessons([]); }}>
              By Folder
            </FilterButton>
          </div>

          {studySource === 'lesson' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs tracking-wider uppercase text-ink-light min-w-[50px]">Part:</span>
                <FilterButton active={selectedPart === null} onClick={() => { setSelectedPart(null); setSelectedLessons([]); }}>
                  All Parts
                </FilterButton>
                {INTEGRATED_CHINESE_PARTS.map(({ part, label }) => (
                  <FilterButton key={part} active={selectedPart === part} onClick={() => { setSelectedPart(part); setSelectedLessons([]); }}>
                    {label}
                  </FilterButton>
                ))}
              </div>

              {selectedPart !== null && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs tracking-wider uppercase text-ink-light min-w-[50px]">Lesson:</span>
                  <FilterButton active={selectedLessons.length === 0} onClick={() => setSelectedLessons([])}>
                    All
                  </FilterButton>
                  {getIntegratedChineseLessons(selectedPart).map((lesson) => (
                    <FilterButton
                      key={lesson}
                      active={selectedLessons.includes(lesson)}
                      onClick={() => setSelectedLessons(prev =>
                        prev.includes(lesson) ? prev.filter(l => l !== lesson) : [...prev, lesson]
                      )}
                    >
                      {lesson}
                    </FilterButton>
                  ))}
                </div>
              )}
            </div>
          )}

          {studySource === 'folder' && (
            <div>
              {!foldersData || foldersData.length === 0 ? (
                <p className="text-sm text-ink-light">
                  No folders yet.{' '}
                  <a href="/folders" className="text-stamp-red hover:underline">Create one</a> to organize your cards.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {foldersData.map((folder) => (
                    <FilterButton
                      key={folder.id}
                      active={selectedFolderId === folder.id}
                      onClick={() => setSelectedFolderId(folder.id)}
                    >
                      {folder.name} ({folder.cardCount ?? 0})
                    </FilterButton>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Writing Mode Selection */}
        <div className="document-card p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="field-label">Writing Mode</span>
            <div className="flex-1 border-t border-dashed border-border" />
            <span className="text-xs text-ink-light">For character writing practice</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <WritingModeButton
              active={writingMode === 'freehand'}
              onClick={() => setWritingMode('freehand')}
              icon="画"
              title="Freehand"
              description="Draw freely and self-assess"
            />
            <WritingModeButton
              active={writingMode === 'stroke_order'}
              onClick={() => setWritingMode('stroke_order')}
              icon="笔"
              title="Stroke Order"
              description="Guided practice with stroke validation (still in development)"
            />
          </div>
        </div>

        {/* Quiz Mode Cards */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="field-label">Select Quiz Type</span>
            <div className="flex-1 border-t border-dashed border-border" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quizModes.map((quizMode) => (
              <button
                key={quizMode.value}
                onClick={() => void startStudying(quizMode.value)}
                className="group document-card p-5 text-left hover:shadow-document-hover transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 border-2 border-stamp-red flex items-center justify-center text-stamp-red font-chinese text-xl font-bold shrink-0">
                    {quizMode.icon}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-ink group-hover:text-stamp-red transition-colors">
                      {quizMode.label}
                    </h3>
                    <p className="text-xs text-ink-light mt-1">{quizMode.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Loading State
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-6">
          <div className="seal-stamp animate-stamp-press">
            <span className="font-chinese">学</span>
          </div>
          <div className="text-ink-light text-sm tracking-widest uppercase">Loading cards...</div>
        </div>
      </div>
    );
  }

  // Session Complete State
  if (isSessionComplete() || (!currentCard && !isLoading)) {
    const sessionLabel = sessionType === 'mastery' ? 'Mastery' : 'Quick Review';

    const buildDefaultFolderName = () => {
      const typeLabel = sessionType === 'mastery' ? 'Mastery' : 'Quick';
      const sourceLabel = studySource === 'folder'
        ? foldersData?.find(f => f.id === selectedFolderId)?.name || 'Folder'
        : selectedLessons.length > 0
        ? `L${[...selectedLessons].sort((a, b) => a - b).join(', ')}`
        : selectedPart ? `Part ${selectedPart}` : 'All';
      return `Missed: ${sourceLabel} (${typeLabel})`;
    };

    return (
      <div className="max-w-2xl mx-auto px-4 pt-12">
        <div className="document-card p-10 text-center">
          <div className="seal-stamp mx-auto mb-8 animate-stamp-press bg-green-50 border-green-600 text-green-600">
            <span className="font-chinese">成</span>
          </div>
          <h1 className="display-title text-3xl md:text-4xl text-ink mb-4">
            {sessionType === 'mastery' ? 'All Cards Mastered!' : 'All Done!'}
          </h1>
          <p className="text-ink-light mb-2">
            {sessionType === 'mastery' && `You got all ${masteredCards.size} cards correct 3 times each!`}
            {sessionType === 'quick' && `You reviewed all ${completedCards.size} cards.`}
          </p>
          <p className="text-xs text-ink-light tracking-wider uppercase mb-8">
            Session: {sessionLabel}
          </p>

          {/* Missed-cards folder prompt */}
          {wrongCardIds.size > 0 && folderPromptState !== 'done' && (
            <div className="border border-dashed border-border p-6 mb-8 text-left">
              {folderPromptState === 'idle' && (
                <>
                  <p className="text-sm text-ink mb-4">
                    You missed <span className="font-bold text-stamp-red">{wrongCardIds.size}</span> card{wrongCardIds.size === 1 ? '' : 's'}.
                    Save them to a folder for focused review?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setFolderPromptName(buildDefaultFolderName());
                        setFolderPromptState('naming');
                      }}
                      className="vintage-btn vintage-btn-primary text-xs px-5 py-2"
                    >
                      Yes, save to folder
                    </button>
                    <button
                      onClick={() => setFolderPromptState('done')}
                      className="vintage-btn text-xs px-5 py-2 border-ink-light text-ink-light hover:border-ink hover:text-ink"
                    >
                      Skip
                    </button>
                  </div>
                </>
              )}

              {folderPromptState === 'naming' && (
                <>
                  <p className="text-xs tracking-wider uppercase text-ink-light mb-3">Folder name</p>
                  <input
                    type="text"
                    value={folderPromptName}
                    onChange={e => setFolderPromptName(e.target.value)}
                    className="w-full border border-border bg-paper px-3 py-2 text-sm text-ink mb-4 focus:outline-none focus:border-stamp-red"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter' && folderPromptName.trim()) {
                        createMissedFolderMutation.mutate({
                          name: folderPromptName.trim(),
                          cardIds: [...wrongCardIds],
                        });
                      }
                    }}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        if (folderPromptName.trim()) {
                          createMissedFolderMutation.mutate({
                            name: folderPromptName.trim(),
                            cardIds: [...wrongCardIds],
                          });
                        }
                      }}
                      disabled={!folderPromptName.trim() || createMissedFolderMutation.isPending}
                      className="vintage-btn vintage-btn-primary text-xs px-5 py-2 disabled:opacity-50"
                    >
                      {createMissedFolderMutation.isPending ? 'Saving...' : 'Create Folder'}
                    </button>
                    <button
                      onClick={() => setFolderPromptState('idle')}
                      className="vintage-btn text-xs px-5 py-2 border-ink-light text-ink-light hover:border-ink hover:text-ink"
                    >
                      Back
                    </button>
                  </div>
                  {createMissedFolderMutation.isError && (
                    <p className="text-xs text-stamp-red mt-2">Failed to create folder. Try again.</p>
                  )}
                </>
              )}
            </div>
          )}

          {folderPromptState === 'done' && wrongCardIds.size > 0 && (
            <div className="border border-green-300 bg-green-50 px-4 py-3 mb-8 text-sm text-green-700">
              Folder created with {wrongCardIds.size} card{wrongCardIds.size === 1 ? '' : 's'}.
            </div>
          )}

          <button
            onClick={changeMode}
            className="vintage-btn vintage-btn-primary"
          >
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  const currentModeLabel = quizModes.find((m) => m.value === mode)?.label || mode;
  const prompt = currentCard ? getPrompt(currentCard, mode) : '';
  const placeholder = getPlaceholder(mode);
  const sessionLabel = sessionType === 'mastery' ? 'Mastery' : 'Quick';

  const currentMasteryCard = sessionType === 'mastery' && cardQueue[0]
    ? cardQueue[0]
    : null;

  // Main Study Interface
  return (
    <div className="max-w-2xl mx-auto px-4 pt-8">
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="display-title text-2xl md:text-3xl text-ink">{currentModeLabel}</h1>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={changeMode}
              className="text-xs tracking-wider uppercase text-ink-light hover:text-stamp-red transition flex items-center gap-1"
            >
              ← Save & Exit
            </button>
            <span className="text-xs px-2 py-1 border border-stamp-red text-stamp-red tracking-wider uppercase">
              {sessionLabel}
            </span>
            {studySource === 'lesson' && (selectedPart || selectedLessons.length > 0) && (
              <span className="text-xs text-ink-light">
                Part {selectedPart}{selectedLessons.length > 0 ? `, L${[...selectedLessons].sort((a, b) => a - b).join(', ')}` : ''}
              </span>
            )}
            {studySource === 'folder' && selectedFolderId && (
              <span className="text-xs text-ink-light">
                {foldersData?.find((f) => f.id === selectedFolderId)?.name || 'Folder'}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs tracking-wider uppercase text-ink-light">
            {sessionType === 'mastery' ? 'Mastered' : 'Progress'}
          </div>
          <div className="font-display-alt text-2xl font-semibold text-ink">
            {progress.current} / {progress.total}
          </div>
          {sessionType === 'mastery' && currentMasteryCard && (
            <div className="flex gap-1 justify-end mt-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={`w-2 h-2 ${
                    i < currentMasteryCard.correctCount
                      ? 'bg-green-600'
                      : 'bg-border'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-border mb-8 overflow-hidden">
        <div
          className="h-full bg-stamp-red transition-all duration-300"
          style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
        />
      </div>
      {sessionSaveError && (
        <div className="border border-stamp-red bg-stamp-red-light px-4 py-3 mb-6 text-sm text-stamp-red">
          {sessionSaveError}
        </div>
      )}

      {/* Main Card */}
      <div className="document-card p-8">
        {!showResult && currentCard ? (
          hanziWritingModes.has(mode) ? (
            <WritingQuiz
              key={`${currentCard.id}-${writingMode}`}
              card={currentCard}
              prompt={prompt}
              subPrompt={mode === 'english_pinyin_to_hanzi' ? currentCard.pinyinDisplay : undefined}
              writingMode={writingMode}
              onComplete={handleWritingComplete}
            />
          ) : (
            <>
              {/* Prompt Display */}
              <div className="text-center mb-10">
                <span className="field-label mb-4 inline-block">
                  {hanziPromptModes.has(mode) ? 'Character' : 'Prompt'}
                </span>
                <div className={`mt-4 ${
                  hanziPromptModes.has(mode)
                    ? 'text-8xl font-kaiti text-stamp-red'
                    : 'text-3xl font-display text-ink'
                }`}>
                  {prompt}
                </div>
              </div>

              <div className="flex justify-center mb-6">
                <div className="inline-flex border-2 border-border bg-paper">
                  <button
                    type="button"
                    onClick={() => setTextAnswerInputMode('typing')}
                    className={`px-4 py-2 text-xs tracking-wider uppercase transition ${
                      textAnswerInputMode === 'typing'
                        ? 'bg-stamp-red text-accent-contrast'
                        : 'text-ink-light hover:text-stamp-red'
                    }`}
                  >
                    Type
                  </button>
                  <button
                    type="button"
                    onClick={() => setTextAnswerInputMode('writing')}
                    className={`px-4 py-2 text-xs tracking-wider uppercase transition border-l-2 border-border ${
                      textAnswerInputMode === 'writing'
                        ? 'bg-stamp-red text-accent-contrast'
                        : 'text-ink-light hover:text-stamp-red'
                    }`}
                  >
                    Write
                  </button>
                </div>
              </div>

              {/* Answer Form */}
              {textAnswerInputMode === 'typing' ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-xs tracking-wider uppercase text-ink-light mb-2">
                      Your Answer
                    </label>
                    <input
                      type="text"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      className="w-full text-xl"
                      placeholder={placeholder}
                      autoFocus
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="vintage-btn vintage-btn-primary w-full"
                  >
                    Check Answer
                  </button>
                </form>
              ) : (
                <HandwrittenTextAnswer
                  key={`${currentCard.id}-${mode}`}
                  answerLanguage={pinyinAnswerModes.has(mode) ? 'pinyin' : 'english'}
                  correctAnswer={getCorrectAnswer(currentCard, mode)}
                  onRecognizedSubmit={submitTextAnswer}
                  onManualGrade={handleHandwrittenTextGrade}
                />
              )}
            </>
          )
        ) : answeredCard ? (
          <>
            {/* Result Display */}
            <div className="text-center mb-8">
              <div className={`seal-stamp mx-auto mb-4 ${
                wasCorrect
                  ? 'border-green-600 text-green-600 bg-green-50'
                  : 'border-stamp-red text-stamp-red bg-stamp-red-light'
              }`}>
                <span className="font-chinese">{wasCorrect ? '对' : '错'}</span>
              </div>
              <div className={`display-title text-2xl ${wasCorrect ? 'text-green-600' : 'text-stamp-red'}`}>
                {wasCorrect ? 'Correct!' : 'Incorrect'}
              </div>
              {sessionType === 'mastery' && wasCorrect && currentMasteryCard && (
                <div className="text-sm text-ink-light mt-2">
                  {currentMasteryCard.correctCount + 1 >= 3
                    ? 'Card mastered!'
                    : `${currentMasteryCard.correctCount + 1}/3 correct`}
                </div>
              )}
            </div>

            {/* Card Details */}
            <div className="space-y-4 mb-8">
              <div className="py-6 bg-cream border border-border px-6">
                <div className="text-center">
                  <div className="text-6xl font-kaiti text-stamp-red mb-3">{answeredCard.hanzi}</div>
                  <div className="text-xl text-ink-light mb-1">{answeredCard.pinyinDisplay}</div>
                  <div className="text-ink">{answeredCard.english}</div>
                </div>
                <RadicalBreakdown hanzi={answeredCard.hanzi} />
              </div>

              {!wasCorrect && answer && (
                <div className="p-4 bg-stamp-red-light border border-stamp-red">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-stamp-red-dark">Your answer:</span>
                    <span className="font-medium text-stamp-red">{answer}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-sm">
                    <span className="text-green-700">Correct answer:</span>
                    <span className="font-medium text-green-700">{getCorrectAnswer(answeredCard, mode)}</span>
                  </div>
                </div>
              )}

              {!wasCorrect && !wasOverridden && !(writingMode === 'freehand' && hanziWritingModes.has(mode)) && (
                <button
                  onClick={handleOverrideCorrect}
                  className="w-full py-3 bg-cream text-ink-light border border-border hover:border-ink text-xs tracking-wider uppercase transition"
                >
                  Actually, I was correct
                </button>
              )}

              {wasOverridden && (
                <div className="text-center text-sm text-green-600 py-2">
                  Updated to correct
                </div>
              )}

              {answeredCard.exampleSentence && (
                <div className="p-4 bg-cream border border-border">
                  <p className="text-xs tracking-wider uppercase text-ink-light mb-2">Example Sentence:</p>
                  <p className="text-lg font-chinese">{answeredCard.exampleSentence}</p>
                  {answeredCard.examplePinyin && (
                    <p className="text-ink-light mt-1">{answeredCard.examplePinyin}</p>
                  )}
                  {answeredCard.exampleEnglish && (
                    <p className="text-ink-light text-sm mt-1">{answeredCard.exampleEnglish}</p>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleNext}
              className="vintage-btn w-full border-ink text-ink hover:bg-ink hover:text-paper"
            >
              Next Card →
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

// Helper Components
function SessionTypeButton({
  active,
  onClick,
  icon,
  title,
  description,
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative p-4 text-left transition-all border-2 disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? 'bg-stamp-red border-stamp-red text-accent-contrast'
          : 'bg-paper border-border text-ink hover:border-stamp-red'
      }`}
    >
      {active && (
        <div className="absolute top-2 right-2 w-4 h-4 border border-accent-contrast flex items-center justify-center text-xs text-accent-contrast">
          ✓
        </div>
      )}
      <div className={`text-2xl font-chinese mb-2 ${active ? 'text-accent-contrast' : 'text-stamp-red'}`}>{icon}</div>
      <div className={`font-display font-semibold ${active ? 'text-accent-contrast' : 'text-ink'}`}>{title}</div>
      <div className={`text-xs mt-1 ${active ? 'text-accent-contrast' : 'text-ink-light'}`}>
        {description}
      </div>
    </button>
  );
}

function WritingModeButton({
  active,
  onClick,
  icon,
  title,
  description
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative p-4 text-left transition-all border-2 ${
        active
          ? 'bg-stamp-red border-stamp-red text-accent-contrast'
          : 'bg-paper border-border text-ink hover:border-stamp-red'
      }`}
    >
      {active && (
        <div className="absolute top-2 right-2 w-4 h-4 border border-accent-contrast flex items-center justify-center text-xs text-accent-contrast">
          ✓
        </div>
      )}
      <div className={`text-2xl font-chinese mb-2 ${active ? 'text-accent-contrast' : 'text-stamp-red'}`}>{icon}</div>
      <div className={`font-display font-semibold ${active ? 'text-accent-contrast' : 'text-ink'}`}>{title}</div>
      <div className={`text-xs mt-1 ${active ? 'text-accent-contrast' : 'text-ink-light'}`}>
        {description}
      </div>
    </button>
  );
}

function FilterButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-xs tracking-wider uppercase transition-all border-2 font-medium ${
        active
          ? 'bg-stamp-red text-accent-contrast border-stamp-red'
          : 'bg-paper text-ink-light border-border hover:border-stamp-red hover:text-stamp-red'
      }`}
    >
      {children}
    </button>
  );
}
