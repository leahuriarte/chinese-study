import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import HanziWriter from 'hanzi-writer';
import type { Card } from '../../types';
import type { WritingMode } from '../../pages/Study';

interface WritingQuizProps {
  card: Card;
  prompt: string;
  subPrompt?: string;
  writingMode: WritingMode;
  onComplete: (wasCorrect: boolean) => void;
}

function getThemeColor(property: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
  return value || fallback;
}

export default function WritingQuiz({ card, prompt, subPrompt, writingMode, onComplete }: WritingQuizProps) {
  const writerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [writer, setWriter] = useState<HanziWriter | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [themeRevision, setThemeRevision] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [penSize, setPenSizeState] = useState(() => {
    const saved = localStorage.getItem('freehand-pen-size');
    return saved ? parseInt(saved, 10) : 8;
  });
  const setPenSize = (size: number) => {
    setPenSizeState(size);
    localStorage.setItem('freehand-pen-size', size.toString());
  };
  const [isEraser, setIsEraser] = useState(false);
  const [stylusOnly, setStylusOnlyState] = useState(() => {
    const saved = localStorage.getItem('freehand-stylus-only');
    return saved === 'true';
  });
  const setStylusOnly = (enabled: boolean) => {
    setStylusOnlyState(enabled);
    localStorage.setItem('freehand-stylus-only', enabled.toString());
  };
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const characters = useMemo(() => Array.from(card.hanzi), [card.hanzi]);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [charMistakes, setCharMistakes] = useState<number[]>([]);

  useEffect(() => {
    const handleThemeChange = () => setThemeRevision((revision) => revision + 1);

    window.addEventListener('app-theme-change', handleThemeChange);
    return () => window.removeEventListener('app-theme-change', handleThemeChange);
  }, []);

  useEffect(() => {
    if (writingMode !== 'stroke_order' || !writerRef.current) return;

    const currentChar = characters[currentCharIndex];
    if (!currentChar) return;

    writerRef.current.innerHTML = '';

    const newWriter = HanziWriter.create(writerRef.current, currentChar, {
      width: 300,
      height: 300,
      padding: 5,
      showOutline: showHint,
      showCharacter: false,
      highlightOnComplete: true,
      drawingWidth: 20,
      strokeColor: getThemeColor('--color-stamp-red', '#1d4ed8'),
      drawingColor: getThemeColor('--color-stamp-red', '#1d4ed8'),
      highlightColor: getThemeColor('--color-stamp-red-light', '#c4d4f6'),
      outlineColor: getThemeColor('--color-border', '#afd0f8'),
      radicalColor: getThemeColor('--color-stamp-red-dark', '#163ba4'),
    });

    setWriter(newWriter);

    return () => {
      if (newWriter) {
        newWriter.cancelQuiz();
      }
    };
  }, [card.hanzi, showHint, writingMode, currentCharIndex, characters, themeRevision]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 300 * dpr;
    canvas.height = 300 * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = getThemeColor('--color-paper', '#f8fbff');
    ctx.fillRect(0, 0, 300, 300);

    // Draw guide lines
    ctx.strokeStyle = getThemeColor('--color-border', '#afd0f8');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(150, 0);
    ctx.lineTo(150, 300);
    ctx.moveTo(0, 150);
    ctx.lineTo(300, 150);
    ctx.stroke();

    // Reset to drawing settings
    ctx.strokeStyle = getThemeColor('--color-stamp-red', '#1d4ed8');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    if (writingMode !== 'freehand' || !canvasRef.current) return;
    initCanvas();
  }, [writingMode, card.hanzi, initCanvas, themeRevision]);

  const startDrawing = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    if (!isEraser) setHasDrawn(true);
    lastPointRef.current = { x, y };

    // Set up stroke style
    ctx.strokeStyle = isEraser
      ? getThemeColor('--color-paper', '#f8fbff')
      : getThemeColor('--color-stamp-red', '#1d4ed8');
    ctx.lineWidth = isEraser ? penSize * 2 : penSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [isEraser, penSize]);

  const draw = useCallback((x: number, y: number) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !lastPointRef.current) return;

    // Use quadratic curve for smoother lines
    const midX = (lastPointRef.current.x + x) / 2;
    const midY = (lastPointRef.current.y + y) / 2;

    ctx.quadraticCurveTo(lastPointRef.current.x, lastPointRef.current.y, midX, midY);
    ctx.stroke();

    // Continue the path from the midpoint
    ctx.beginPath();
    ctx.moveTo(midX, midY);

    lastPointRef.current = { x, y };
  }, [isDrawing]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    lastPointRef.current = null;
  }, []);

  // Check if input should be allowed based on stylus-only mode
  const shouldAllowInput = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!stylusOnly) return true;
    // Only allow pen input when stylus-only mode is enabled
    return e.pointerType === 'pen';
  }, [stylusOnly]);

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!shouldAllowInput(e)) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    startDrawing(x, y);
  }, [shouldAllowInput, startDrawing]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!shouldAllowInput(e)) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    draw(x, y);
  }, [shouldAllowInput, draw]);

  const handleCanvasPointerUp = useCallback(() => {
    stopDrawing();
  }, [stopDrawing]);

  const handleQuiz = () => {
    if (!writer) return;

    setIsChecking(true);

    writer.quiz({
      onComplete: (summary: { totalMistakes: number }) => {
        const mistakes = summary.totalMistakes;
        const newCharMistakes = [...charMistakes, mistakes];
        setCharMistakes(newCharMistakes);

        if (currentCharIndex < characters.length - 1) {
          setTimeout(() => {
            setCurrentCharIndex(prev => prev + 1);
            setIsChecking(false);
          }, 500);
        } else {
          const totalMistakes = newCharMistakes.reduce((sum, m) => sum + m, 0);
          const wasCorrect = totalMistakes === 0;
          setTimeout(() => {
            onComplete(wasCorrect);
          }, 1000);
        }
      },
      onMistake: () => {},
    });
  };

  const handleReset = () => {
    if (writingMode === 'stroke_order') {
      if (writer) {
        writer.cancelQuiz();
        setIsChecking(false);
        setCurrentCharIndex(0);
        setCharMistakes([]);

        const currentChar = characters[0];
        if (writerRef.current && currentChar) {
          writerRef.current.innerHTML = '';
          const newWriter = HanziWriter.create(writerRef.current, currentChar, {
            width: 300,
            height: 300,
            padding: 5,
            showOutline: showHint,
            showCharacter: false,
            highlightOnComplete: true,
            drawingWidth: 20,
            strokeColor: getThemeColor('--color-stamp-red', '#1d4ed8'),
            drawingColor: getThemeColor('--color-stamp-red', '#1d4ed8'),
            highlightColor: getThemeColor('--color-stamp-red-light', '#c4d4f6'),
            outlineColor: getThemeColor('--color-border', '#afd0f8'),
            radicalColor: getThemeColor('--color-stamp-red-dark', '#163ba4'),
          });
          setWriter(newWriter);
        }
      }
    } else {
      initCanvas();
      setHasDrawn(false);
      setShowComparison(false);
      setIsEraser(false);
    }
  };

  const handleShowAnswer = () => {
    if (writingMode === 'stroke_order') {
      if (writer) {
        writer.showCharacter();
        setTimeout(() => {
          if (currentCharIndex < characters.length - 1) {
            setCharMistakes(prev => [...prev, 1]);
            setCurrentCharIndex(prev => prev + 1);
            setIsChecking(false);
          } else {
            onComplete(false);
          }
        }, 1500);
      }
    } else {
      setShowComparison(true);
    }
  };

  const handleFreehandCorrect = () => {
    onComplete(true);
  };

  const handleFreehandIncorrect = () => {
    onComplete(false);
  };

  if (writingMode === 'freehand') {
    return (
      <div className="flex flex-col items-center select-none" style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
        <div className="text-center mb-6">
          <span className="field-label mb-4 inline-block">Prompt</span>
          <div className="text-3xl font-display text-ink mt-4">{prompt}</div>
          {subPrompt && (
            <div className="text-lg text-ink-light mt-2">{subPrompt}</div>
          )}
        </div>

        {/* Pen controls */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEraser(false)}
              className={`px-3 py-1.5 text-xs tracking-wider uppercase border-2 transition ${
                !isEraser
                  ? 'bg-stamp-red border-stamp-red text-accent-contrast'
                  : 'border-border text-ink-light hover:border-stamp-red'
              }`}
            >
              Pen
            </button>
            <button
              onClick={() => setIsEraser(true)}
              className={`px-3 py-1.5 text-xs tracking-wider uppercase border-2 transition ${
                isEraser
                  ? 'bg-stamp-red border-stamp-red text-accent-contrast'
                  : 'border-border text-ink-light hover:border-stamp-red'
              }`}
            >
              Eraser
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-light">Size:</span>
            {[4, 8, 14, 22].map((size) => (
              <button
                key={size}
                onClick={() => setPenSize(size)}
                className={`w-8 h-8 flex items-center justify-center border-2 transition ${
                  penSize === size
                    ? 'border-stamp-red'
                    : 'border-border hover:border-stamp-red'
                }`}
              >
                <div
                  className="rounded-full bg-stamp-red"
                  style={{ width: size, height: size }}
                />
              </button>
            ))}
          </div>
          <button
            onClick={() => setStylusOnly(!stylusOnly)}
            className={`px-3 py-1.5 text-xs tracking-wider uppercase border-2 transition ${
              stylusOnly
                ? 'bg-stamp-red border-stamp-red text-accent-contrast'
                : 'border-border text-ink-light hover:border-stamp-red'
            }`}
            title="When enabled, only Apple Pencil/stylus input is accepted (palm rejection)"
          >
            ✏️ Stylus Only
          </button>
        </div>

        <div className="flex gap-6 items-start">
          <div className="flex flex-col items-center">
            <canvas
              ref={canvasRef}
              width={300}
              height={300}
              className={`writing-surface touch-none ${isEraser ? 'cursor-cell' : 'cursor-crosshair'}`}
              style={{
                width: 300,
                height: 300,
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
              }}
              draggable={false}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerLeave={handleCanvasPointerUp}
              onPointerCancel={handleCanvasPointerUp}
            />
            <span className="text-xs text-ink-light tracking-wider uppercase mt-2">Your drawing</span>
          </div>

          {showComparison && (
            <div className="flex flex-col items-center">
              <div
                className="writing-surface flex items-center justify-center overflow-hidden select-none"
                style={{ width: 300, height: 300, WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
              >
                <span
                  className="leading-none font-chinese text-stamp-red"
                  style={{
                    fontSize: card.hanzi.length === 1 ? '200px' :
                              card.hanzi.length === 2 ? '120px' :
                              card.hanzi.length === 3 ? '90px' : '70px'
                  }}
                >
                  {card.hanzi}
                </span>
              </div>
              <span className="text-xs text-ink-light tracking-wider uppercase mt-2">Correct character</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 w-full max-w-md mt-6">
          {!showComparison ? (
            <>
              <button
                onClick={handleShowAnswer}
                disabled={!hasDrawn}
                className="vintage-btn vintage-btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Compare with Answer
              </button>
              <button
                onClick={handleReset}
                className="vintage-btn w-full"
              >
                Clear & Restart
              </button>
            </>
          ) : (
            <>
              <div className="flex gap-3">
                <button
                  onClick={handleFreehandCorrect}
                  className="flex-1 py-3 bg-green-600 text-paper border-2 border-green-600 text-xs tracking-wider uppercase hover:bg-green-700 hover:border-green-700 transition"
                >
                  Got it
                </button>
                <button
                  onClick={handleFreehandIncorrect}
                  className="vintage-btn vintage-btn-primary flex-1"
                >
                  Missed it
                </button>
              </div>
              <button
                onClick={handleReset}
                className="vintage-btn w-full"
              >
                Try Again
              </button>
            </>
          )}
        </div>

      </div>
    );
  }

  // Stroke order mode
  return (
    <div className="flex flex-col items-center">
      <div className="text-center mb-6">
        <span className="field-label mb-4 inline-block">Prompt</span>
        <div className="text-3xl font-display text-ink mt-4">{prompt}</div>
        {subPrompt && (
          <div className="text-lg text-ink-light mt-2">{subPrompt}</div>
        )}
      </div>

      {/* Character progress indicator for multi-character cards */}
      {characters.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-ink-light tracking-wider uppercase">
            Character {currentCharIndex + 1} of {characters.length}:
          </span>
          <div className="flex gap-1">
            {characters.map((char, idx) => (
              <span
                key={idx}
                className={`text-xl px-2 py-1 font-chinese ${
                  idx < currentCharIndex
                    ? 'bg-green-100 text-green-600 border border-green-200'
                    : idx === currentCharIndex
                    ? 'bg-stamp-red-light text-stamp-red border border-stamp-red'
                    : 'bg-cream text-border border border-border'
                }`}
              >
                {idx < currentCharIndex ? char : idx === currentCharIndex ? char : '?'}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-ink-light text-sm mb-6">
        {characters.length > 1
          ? `Draw "${characters[currentCharIndex]}" (character ${currentCharIndex + 1}/${characters.length})`
          : 'Draw the character below'}
      </p>

      <div
        ref={writerRef}
        className="writing-surface mb-6"
        style={{ width: 300, height: 300 }}
      />

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {!isChecking ? (
          <>
            <button
              onClick={handleQuiz}
              className="vintage-btn vintage-btn-primary w-full"
            >
              Start Writing Quiz
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => setShowHint(!showHint)}
                className="vintage-btn flex-1"
              >
                {showHint ? 'Hide Outline' : 'Show Outline'}
              </button>
              <button
                onClick={handleShowAnswer}
                className="vintage-btn flex-1"
              >
                Show Answer
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={handleReset}
            className="vintage-btn w-full"
          >
            Reset
          </button>
        )}
      </div>

      <p className="text-xs text-ink-light mt-4 text-center tracking-wider">
        Draw the strokes in the correct order. The system will check your strokes automatically.
      </p>
    </div>
  );
}
