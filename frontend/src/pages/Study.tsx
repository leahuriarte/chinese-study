import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Card, QuizMode } from '../types';
import WritingQuiz from '../components/study/WritingQuiz';

const quizModes: { value: QuizMode; label: string; description: string }[] = [
  { value: 'hanzi_to_pinyin', label: 'Hanzi → Pinyin', description: 'See character, type pinyin' },
  { value: 'hanzi_to_english', label: 'Hanzi → English', description: 'See character, type meaning' },
  { value: 'pinyin_to_hanzi', label: 'Pinyin → Hanzi', description: 'See pinyin, write/select character' },
  { value: 'pinyin_to_english', label: 'Pinyin → English', description: 'See pinyin, type meaning' },
  { value: 'english_to_hanzi', label: 'English → Hanzi', description: 'See meaning, write/select character' },
  { value: 'english_to_pinyin', label: 'English → Pinyin', description: 'See meaning, type pinyin' },
];

export default function Study() {
  const [mode, setMode] = useState<QuizMode>('hanzi_to_pinyin');
  const [showModeSelector, setShowModeSelector] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const queryClient = useQueryClient();

  const { data: dueCardsData, isLoading } = useQuery({
    queryKey: ['dueCards', mode],
    queryFn: () => api.getDueCards(mode),
  });

  const { data: newCards } = useQuery({
    queryKey: ['newCards', mode],
    queryFn: () => api.getNewCards(mode, 5),
  });

  const reviewMutation = useMutation({
    mutationFn: (data: {
      cardId: string;
      mode: QuizMode;
      quality: number;
      responseTimeMs: number;
    }) => api.submitReview(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dueCards'] });
      queryClient.invalidateQueries({ queryKey: ['newCards'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  // Combine due cards and new cards
  const allCards: Card[] = [
    ...(dueCardsData?.map((d) => d.card) || []),
    ...(newCards || []),
  ];

  const currentCard = allCards[currentIndex];

  useEffect(() => {
    setStartTime(Date.now());
  }, [currentIndex]);

  const getCorrectAnswer = (card: Card, quizMode: QuizMode): string => {
    switch (quizMode) {
      case 'hanzi_to_pinyin':
      case 'english_to_pinyin':
        return card.pinyin.toLowerCase();
      case 'hanzi_to_english':
      case 'pinyin_to_english':
        return card.english.toLowerCase();
      case 'pinyin_to_hanzi':
      case 'english_to_hanzi':
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
        return card.english;
      default:
        return '';
    }
  };

  const getPlaceholder = (quizMode: QuizMode): string => {
    switch (quizMode) {
      case 'hanzi_to_pinyin':
      case 'english_to_pinyin':
        return 'e.g., ni3 hao3';
      case 'hanzi_to_english':
      case 'pinyin_to_english':
        return 'e.g., hello';
      case 'pinyin_to_hanzi':
      case 'english_to_hanzi':
        return 'e.g., 你好';
      default:
        return '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCard) return;

    const responseTime = Date.now() - startTime;
    const correctAnswer = getCorrectAnswer(currentCard, mode);
    const correct = answer.toLowerCase().trim() === correctAnswer.trim();

    setWasCorrect(correct);
    setShowResult(true);

    // Submit review
    const quality = correct ? 4 : 2; // 4 = good, 2 = failed
    reviewMutation.mutate({
      cardId: currentCard.id,
      mode,
      quality,
      responseTimeMs: responseTime,
    });
  };

  const handleNext = () => {
    setAnswer('');
    setShowResult(false);
    setCurrentIndex((prev) => prev + 1);
  };

  const handleWritingComplete = (wasCorrect: boolean) => {
    if (!currentCard) return;

    const responseTime = Date.now() - startTime;
    setWasCorrect(wasCorrect);
    setShowResult(true);

    // Submit review
    const quality = wasCorrect ? 4 : 2;
    reviewMutation.mutate({
      cardId: currentCard.id,
      mode,
      quality,
      responseTimeMs: responseTime,
    });
  };

  const startStudying = (selectedMode: QuizMode) => {
    setMode(selectedMode);
    setShowModeSelector(false);
    setCurrentIndex(0);
    setAnswer('');
    setShowResult(false);
  };

  const changeMode = () => {
    setShowModeSelector(true);
    setCurrentIndex(0);
    setAnswer('');
    setShowResult(false);
  };

  if (showModeSelector) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Choose Study Mode</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {quizModes.map((quizMode) => (
            <button
              key={quizMode.value}
              onClick={() => startStudying(quizMode.value)}
              className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition text-left"
            >
              <h3 className="text-xl font-bold mb-2 text-red-600">{quizMode.label}</h3>
              <p className="text-gray-600">{quizMode.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center">Loading...</div>;
  }

  if (!currentCard) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-4">All Done!</h1>
        <p className="text-xl text-gray-600 mb-8">
          You've completed all your reviews for this mode. Great job!
        </p>
        <button
          onClick={changeMode}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          Try Another Mode
        </button>
      </div>
    );
  }

  const currentModeLabel = quizModes.find((m) => m.value === mode)?.label || mode;
  const prompt = getPrompt(currentCard, mode);
  const placeholder = getPlaceholder(mode);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Study: {currentModeLabel}</h1>
          <button
            onClick={changeMode}
            className="text-sm text-gray-600 hover:text-red-600 transition mt-1"
          >
            Change Mode
          </button>
        </div>
        <span className="text-gray-600">
          Card {currentIndex + 1} of {allCards.length}
        </span>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8">
        {!showResult ? (
          mode === 'pinyin_to_hanzi' || mode === 'english_to_hanzi' ? (
            <WritingQuiz
              card={currentCard}
              prompt={prompt}
              onComplete={handleWritingComplete}
            />
          ) : (
            <>
              <div className={`mb-8 text-center ${mode.includes('hanzi') && mode.split('_')[0] !== 'english' ? 'text-8xl' : 'text-4xl'}`}>
                {prompt}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="w-full px-4 py-3 text-xl border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder={placeholder}
                  autoFocus
                  required
                />

                <button
                  type="submit"
                  className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-lg font-semibold"
                >
                  Check Answer
                </button>
              </form>
            </>
          )
        ) : (
          <>
            <div className={`text-6xl mb-6 text-center font-bold ${wasCorrect ? 'text-green-600' : 'text-red-600'}`}>
              {wasCorrect ? '✓ Correct!' : '✗ Incorrect'}
            </div>

            <div className="space-y-4 mb-8">
              <div className="text-center">
                <div className="text-6xl mb-2">{currentCard.hanzi}</div>
                <div className="text-3xl text-gray-600 mb-2">{currentCard.pinyinDisplay}</div>
                <div className="text-xl">{currentCard.english}</div>
              </div>

              {!wasCorrect && (
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-center text-red-700">
                    Your answer: <span className="font-semibold">{answer}</span>
                  </p>
                  <p className="text-center text-green-700 mt-2">
                    Correct answer: <span className="font-semibold">{getCorrectAnswer(currentCard, mode)}</span>
                  </p>
                </div>
              )}

              {currentCard.exampleSentence && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Example:</p>
                  <p className="font-semibold">{currentCard.exampleSentence}</p>
                  {currentCard.examplePinyin && (
                    <p className="text-gray-600 mt-1">{currentCard.examplePinyin}</p>
                  )}
                  {currentCard.exampleEnglish && (
                    <p className="text-gray-600 mt-1">{currentCard.exampleEnglish}</p>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleNext}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-lg font-semibold"
            >
              Next Card
            </button>
          </>
        )}
      </div>

      <div className="mt-4 text-center text-sm text-gray-600">
        <p>Progress: {currentIndex} / {allCards.length} cards reviewed</p>
      </div>
    </div>
  );
}
