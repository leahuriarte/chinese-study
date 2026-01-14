import { useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import type { Card } from '../../types';

interface WritingQuizProps {
  card: Card;
  prompt: string;
  onComplete: (wasCorrect: boolean) => void;
}

export default function WritingQuiz({ card, prompt, onComplete }: WritingQuizProps) {
  const writerRef = useRef<HTMLDivElement>(null);
  const [writer, setWriter] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (writerRef.current) {
      // Clear previous writer
      writerRef.current.innerHTML = '';

      // Create new Hanzi Writer instance
      const newWriter = HanziWriter.create(writerRef.current, card.hanzi, {
        width: 300,
        height: 300,
        padding: 5,
        showOutline: showHint,
        showCharacter: false,
        highlightOnComplete: true,
        drawingWidth: 20,
        strokeColor: '#dc2626',
        outlineColor: '#e5e7eb',
        radicalColor: '#dc2626',
      });

      setWriter(newWriter);

      return () => {
        if (newWriter) {
          newWriter.cancelQuiz();
        }
      };
    }
  }, [card.hanzi, showHint]);

  const handleQuiz = () => {
    if (!writer) return;

    setIsChecking(true);

    writer.quiz({
      onComplete: (summary: any) => {
        const wasCorrect = summary.totalMistakes === 0;
        setTimeout(() => {
          onComplete(wasCorrect);
        }, 1000);
      },
      onMistake: () => {
        // Optionally show feedback on mistakes
      },
    });
  };

  const handleReset = () => {
    if (writer) {
      writer.cancelQuiz();
      setIsChecking(false);

      // Recreate writer
      if (writerRef.current) {
        writerRef.current.innerHTML = '';
        const newWriter = HanziWriter.create(writerRef.current, card.hanzi, {
          width: 300,
          height: 300,
          padding: 5,
          showOutline: showHint,
          showCharacter: false,
          highlightOnComplete: true,
          drawingWidth: 20,
          strokeColor: '#dc2626',
          outlineColor: '#e5e7eb',
          radicalColor: '#dc2626',
        });
        setWriter(newWriter);
      }
    }
  };

  const handleShowAnswer = () => {
    if (writer) {
      writer.showCharacter();
      setTimeout(() => {
        onComplete(false);
      }, 2000);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="text-4xl mb-6 text-center">{prompt}</div>
      <p className="text-center text-gray-600 mb-6">Draw the character below</p>

      <div
        ref={writerRef}
        className="border-2 border-gray-300 rounded-lg mb-6"
        style={{ width: 300, height: 300 }}
      />

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {!isChecking ? (
          <>
            <button
              onClick={handleQuiz}
              className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-lg font-semibold"
            >
              Start Writing Quiz
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => setShowHint(!showHint)}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                {showHint ? 'Hide Outline' : 'Show Outline'}
              </button>
              <button
                onClick={handleShowAnswer}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Show Answer
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={handleReset}
            className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Reset
          </button>
        )}
      </div>

      <p className="text-sm text-gray-500 mt-4 text-center">
        Draw the strokes in the correct order. The system will check your strokes automatically.
      </p>
    </div>
  );
}
