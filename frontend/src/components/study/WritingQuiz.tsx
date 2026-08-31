import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import HanziWriter from 'hanzi-writer';
import { getStroke } from 'perfect-freehand';
import { useAuth } from '../../contexts/AuthContext';
import { getWritingSettingsFromSettings } from '../../lib/theme';
import type { Card } from '../../types';
import type { WritingMode } from '../../pages/Study';
import type { StrokeOptions } from 'perfect-freehand';

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

type DrawingPoint = [x: number, y: number, pressure: number];

type CanvasStroke = {
  kind: 'smooth' | 'brush' | 'eraser';
  points: DrawingPoint[];
  size: number;
  color: string;
  sensitivity: number;
};

function getCanvasContext(canvas: HTMLCanvasElement) {
  return canvas.getContext('2d', { alpha: false });
}

function getPointerPressure(e: PointerEvent) {
  return e.pressure > 0 ? e.pressure : 0.45;
}

function getCanvasPoint(e: PointerEvent, rect: DOMRect): DrawingPoint {
  return [e.clientX - rect.left, e.clientY - rect.top, getPointerPressure(e)];
}

function getCoalescedPointerEvents(e: React.PointerEvent<HTMLCanvasElement>) {
  return typeof e.nativeEvent.getCoalescedEvents === 'function'
    ? e.nativeEvent.getCoalescedEvents()
    : [e.nativeEvent];
}

function paintCanvasBackground(ctx: CanvasRenderingContext2D) {
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = getThemeColor('--color-paper', '#f8fbff');
  ctx.fillRect(0, 0, 300, 300);

  ctx.strokeStyle = getThemeColor('--color-border', '#afd0f8');
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(150, 0);
  ctx.lineTo(150, 300);
  ctx.moveTo(0, 150);
  ctx.lineTo(300, 150);
  ctx.stroke();
}

function drawBrushDab(ctx: CanvasRenderingContext2D, point: DrawingPoint, penSize: number) {
  const width = Math.max(2, penSize * (0.85 + point[2] * 1.35));

  ctx.globalAlpha = 0.86;
  ctx.beginPath();
  ctx.ellipse(point[0], point[1], width * 0.5, width * 0.26, -Math.PI / 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function getAdjustedBrushPoints(points: DrawingPoint[], sensitivity: number): DrawingPoint[] {
  const sensitivityAmount = sensitivity / 100;
  const pressureFloor = 0.32 + sensitivityAmount * 0.06;
  const pressureMultiplier = 0.85 + sensitivityAmount * 0.75;

  return points.map(([x, y, pressure]) => [
    x,
    y,
    Math.min(1, Math.max(pressureFloor, pressure * pressureMultiplier)),
  ] as DrawingPoint);
}

function drawSmoothStroke(ctx: CanvasRenderingContext2D, stroke: CanvasStroke) {
  const [firstPoint, ...restPoints] = stroke.points;
  if (!firstPoint) return;

  ctx.globalAlpha = 1;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.kind === 'eraser' ? stroke.size * 2 : stroke.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (restPoints.length === 0) {
    ctx.beginPath();
    ctx.arc(firstPoint[0], firstPoint[1], ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  let lastPoint = firstPoint;
  ctx.beginPath();
  ctx.moveTo(firstPoint[0], firstPoint[1]);

  restPoints.forEach((point) => {
    const midX = (lastPoint[0] + point[0]) / 2;
    const midY = (lastPoint[1] + point[1]) / 2;

    ctx.quadraticCurveTo(lastPoint[0], lastPoint[1], midX, midY);
    lastPoint = point;
  });

  ctx.lineTo(lastPoint[0], lastPoint[1]);
  ctx.stroke();
}

function drawFreehandStroke(
  ctx: CanvasRenderingContext2D,
  points: DrawingPoint[],
  penSize: number,
  sensitivity: number,
  isComplete: boolean
) {
  if (points.length === 0) return;

  if (points.length < 2) {
    drawBrushDab(ctx, getAdjustedBrushPoints(points, sensitivity)[0], penSize);
    return;
  }

  const sensitivityAmount = sensitivity / 100;
  const options: StrokeOptions = {
    size: penSize * (2.25 + sensitivityAmount * 0.25),
    thinning: 0.42 + sensitivityAmount * 0.4,
    smoothing: 0.62,
    streamline: 0.42,
    simulatePressure: false,
    last: isComplete,
    start: {
      cap: true,
    },
    end: {
      cap: true,
    },
  };
  const outline = getStroke(getAdjustedBrushPoints(points, sensitivity), options);

  if (outline.length < 2) return;

  ctx.globalAlpha = 0.88;
  ctx.beginPath();
  ctx.moveTo(outline[0][0], outline[0][1]);
  for (let index = 1; index < outline.length; index += 1) {
    ctx.lineTo(outline[index][0], outline[index][1]);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawCanvasStroke(
  ctx: CanvasRenderingContext2D,
  stroke: CanvasStroke,
  isComplete: boolean
) {
  if (stroke.kind === 'brush') {
    ctx.fillStyle = stroke.color;
    drawFreehandStroke(ctx, stroke.points, stroke.size, stroke.sensitivity, isComplete);
    return;
  }

  drawSmoothStroke(ctx, stroke);
}

export default function WritingQuiz({ card, prompt, subPrompt, writingMode, onComplete }: WritingQuizProps) {
  const { user } = useAuth();
  const writingSettings = useMemo(
    () => getWritingSettingsFromSettings(user?.settings),
    [user?.settings]
  );
  const writerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [writer, setWriter] = useState<HanziWriter | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [themeRevision, setThemeRevision] = useState(0);
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
  const isDrawingRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const pendingPointsRef = useRef<DrawingPoint[]>([]);
  const completedStrokesRef = useRef<CanvasStroke[]>([]);
  const activeStrokeRef = useRef<CanvasStroke | null>(null);

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
    const ctx = canvas ? getCanvasContext(canvas) : null;
    if (!ctx || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 300 * dpr;
    canvas.height = 300 * dpr;
    ctx.scale(dpr, dpr);

    completedStrokesRef.current = [];
    activeStrokeRef.current = null;
    pendingPointsRef.current = [];
    paintCanvasBackground(ctx);
  }, []);

  useEffect(() => {
    if (writingMode !== 'freehand' || !canvasRef.current) return;
    initCanvas();
  }, [writingMode, card.hanzi, initCanvas, themeRevision]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const renderCanvas = useCallback((activeStrokeComplete = false) => {
    const canvas = canvasRef.current;
    const ctx = canvas ? getCanvasContext(canvas) : null;
    if (!ctx) return;

    paintCanvasBackground(ctx);
    completedStrokesRef.current.forEach((stroke) => drawCanvasStroke(ctx, stroke, true));
    if (activeStrokeRef.current) {
      drawCanvasStroke(ctx, activeStrokeRef.current, activeStrokeComplete);
    }
  }, []);

  const flushPendingPoints = useCallback(() => {
    frameRef.current = null;
    const points = pendingPointsRef.current.splice(0);

    if (activeStrokeRef.current) {
      activeStrokeRef.current.points.push(...points);
      renderCanvas(false);
    }
  }, [renderCanvas]);

  const queueDrawingPoints = useCallback((points: DrawingPoint[]) => {
    if (!isDrawingRef.current || points.length === 0) return;

    pendingPointsRef.current.push(...points);

    if (frameRef.current === null) {
      frameRef.current = window.requestAnimationFrame(flushPendingPoints);
    }
  }, [flushPendingPoints]);

  const startDrawing = useCallback((point: DrawingPoint) => {
    const canvas = canvasRef.current;
    const ctx = canvas ? getCanvasContext(canvas) : null;
    if (!ctx) return;

    isDrawingRef.current = true;
    if (!isEraser) setHasDrawn(true);
    pendingPointsRef.current = [];
    activeStrokeRef.current = {
      kind: isEraser ? 'eraser' : writingSettings.penStyle,
      points: [point],
      size: penSize,
      color: isEraser
        ? getThemeColor('--color-paper', '#f8fbff')
        : getThemeColor('--color-stamp-red', '#1d4ed8'),
      sensitivity: writingSettings.brushSensitivity,
    };
    renderCanvas(false);
  }, [isEraser, penSize, renderCanvas, writingSettings.brushSensitivity, writingSettings.penStyle]);

  const stopDrawing = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (activeStrokeRef.current) {
      activeStrokeRef.current.points.push(...pendingPointsRef.current);
      completedStrokesRef.current.push(activeStrokeRef.current);
      activeStrokeRef.current = null;
      renderCanvas(true);
    }

    pendingPointsRef.current = [];
    isDrawingRef.current = false;
  }, [renderCanvas]);

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
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    startDrawing(getCanvasPoint(e.nativeEvent, rect));
  }, [shouldAllowInput, startDrawing]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!shouldAllowInput(e)) return;
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    queueDrawingPoints(getCoalescedPointerEvents(e).map((event) => getCanvasPoint(event, rect)));
  }, [shouldAllowInput, queueDrawingPoints]);

  const handleCanvasPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
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
