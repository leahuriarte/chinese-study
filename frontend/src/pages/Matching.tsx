import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Card } from '../types';

type TileType = 'hanzi' | 'pinyin' | 'english';
type GamePhase = 'config' | 'playing' | 'complete';

interface Tile {
  id: string;
  cardId: string;
  type: TileType;
  content: string;
}

const TILE_TYPE_META: { value: TileType; label: string; icon: string; description: string }[] = [
  { value: 'hanzi', label: 'Hanzi', icon: '汉', description: 'Chinese characters' },
  { value: 'pinyin', label: 'Pinyin', icon: '拼', description: 'Romanized pronunciation' },
  { value: 'english', label: 'English', icon: 'Aa', description: 'English meaning' },
];

const MAX_PAIRS = 24;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getTileContent(card: Card, type: TileType): string {
  if (type === 'hanzi') return card.hanzi;
  if (type === 'pinyin') return card.pinyinDisplay || card.pinyin;
  return card.english;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export default function Matching() {
  const [studySource, setStudySource] = useState<'lesson' | 'folder'>('lesson');
  const [selectedPart, setSelectedPart] = useState<number | null>(1);
  const [selectedLessons, setSelectedLessons] = useState<number[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<[TileType, TileType]>(['hanzi', 'english']);

  const [phase, setPhase] = useState<GamePhase>('config');
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [matchedCardIds, setMatchedCardIds] = useState<Set<string>>(new Set());
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const filters = {
    textbookPart: studySource === 'lesson' ? (selectedPart || undefined) : undefined,
    lessonNumbers: studySource === 'lesson' && selectedLessons.length > 0 ? selectedLessons : undefined,
    folderId: studySource === 'folder' ? (selectedFolderId || undefined) : undefined,
  };

  const { data: foldersData } = useQuery({
    queryKey: ['folders'],
    queryFn: () => api.getFolders(),
  });

  const { data: cardsData, isLoading } = useQuery({
    queryKey: ['matchingCards', studySource, selectedPart, selectedLessons, selectedFolderId],
    queryFn: () => api.getCards({ ...filters, limit: 500 }),
    enabled: phase === 'config',
  });

  const cards = cardsData?.cards ?? [];

  useEffect(() => {
    if (phase === 'playing') {
      timerRef.current = setInterval(() => setElapsed(Date.now() - startTime), 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, startTime]);

  useEffect(() => {
    if (phase === 'playing' && tiles.length > 0 && matchedCardIds.size === tiles.length / 2) {
      setPhase('complete');
    }
  }, [matchedCardIds.size, tiles.length, phase]);

  function startGame() {
    if (cards.length === 0) return;
    const picked = shuffle(cards).slice(0, MAX_PAIRS);
    const [typeA, typeB] = selectedTypes;
    const newTiles = shuffle([
      ...picked.map(card => ({
        id: `${card.id}-${typeA}`,
        cardId: card.id,
        type: typeA,
        content: getTileContent(card, typeA),
      })),
      ...picked.map(card => ({
        id: `${card.id}-${typeB}`,
        cardId: card.id,
        type: typeB,
        content: getTileContent(card, typeB),
      })),
    ]);
    setTiles(newTiles);
    setMatchedCardIds(new Set());
    setSelectedTileId(null);
    setWrongPair(null);
    setStartTime(Date.now());
    setElapsed(0);
    setPhase('playing');
  }

  function handleTileClick(tile: Tile) {
    if (matchedCardIds.has(tile.cardId) || wrongPair) return;

    if (!selectedTileId) {
      setSelectedTileId(tile.id);
      return;
    }
    if (selectedTileId === tile.id) {
      setSelectedTileId(null);
      return;
    }

    const sel = tiles.find(t => t.id === selectedTileId)!;
    if (sel.cardId === tile.cardId) {
      setMatchedCardIds(prev => new Set([...prev, tile.cardId]));
      setSelectedTileId(null);
    } else {
      setWrongPair([selectedTileId, tile.id]);
      setTimeout(() => {
        setWrongPair(null);
        setSelectedTileId(null);
      }, 600);
    }
  }

  function selectType(type: TileType) {
    if (selectedTypes.includes(type)) return;
    setSelectedTypes([selectedTypes[1], type]);
  }

  function resetToConfig() {
    setPhase('config');
    setTiles([]);
    setMatchedCardIds(new Set());
    setSelectedTileId(null);
    setWrongPair(null);
  }

  if (phase === 'config') {
    return (
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-10 pt-8">
          <div className="inline-block mb-4">
            <span className="field-label">Game</span>
          </div>
          <h1 className="display-title text-4xl md:text-5xl text-ink mb-2">Matching</h1>
          <p className="text-ink-light text-sm">Match each card to its pair as fast as you can</p>
        </div>

        {/* Match Types */}
        <div className="document-card p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="field-label">Match Types</span>
            <div className="flex-1 border-t border-dashed border-border" />
            <span className="text-xs text-ink-light">pick 2 of 3</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {TILE_TYPE_META.map(({ value, label, icon, description }) => {
              const isSelected = selectedTypes.includes(value);
              return (
                <button
                  key={value}
                  onClick={() => selectType(value)}
                  className={`p-4 border-2 text-center transition-all ${
                    isSelected
                      ? 'bg-stamp-red text-accent-contrast border-stamp-red'
                      : 'bg-paper text-ink-light border-border hover:border-stamp-red hover:text-stamp-red'
                  }`}
                >
                  <div className={`text-2xl mb-1 ${value === 'hanzi' ? 'font-chinese' : 'font-mono'}`}>
                    {icon}
                  </div>
                  <div className="text-xs font-bold tracking-wider uppercase">{label}</div>
                  <div className={`text-xs mt-1 ${isSelected ? 'text-accent-contrast' : 'text-ink-light'}`}>
                    {description}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-ink-light mt-3 text-center">
            Matching{' '}
            <span className="text-ink font-medium">
              {TILE_TYPE_META.find(t => t.value === selectedTypes[0])?.label}
            </span>
            {' '}↔{' '}
            <span className="text-ink font-medium">
              {TILE_TYPE_META.find(t => t.value === selectedTypes[1])?.label}
            </span>
          </p>
        </div>

        {/* Study Source */}
        <div className="document-card p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="field-label">Card Source</span>
            <div className="flex-1 border-t border-dashed border-border" />
          </div>

          <div className="flex gap-3 mb-5">
            <FilterButton
              active={studySource === 'lesson'}
              onClick={() => { setStudySource('lesson'); setSelectedFolderId(null); }}
            >
              By Lesson
            </FilterButton>
            <FilterButton
              active={studySource === 'folder'}
              onClick={() => { setStudySource('folder'); setSelectedPart(null); setSelectedLessons([]); }}
            >
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
                <FilterButton active={selectedPart === 1} onClick={() => { setSelectedPart(1); setSelectedLessons([]); }}>
                  Part 1
                </FilterButton>
                <FilterButton active={selectedPart === 2} onClick={() => { setSelectedPart(2); setSelectedLessons([]); }}>
                  Part 2
                </FilterButton>
              </div>

              {selectedPart !== null && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs tracking-wider uppercase text-ink-light min-w-[50px]">Lesson:</span>
                  <FilterButton active={selectedLessons.length === 0} onClick={() => setSelectedLessons([])}>
                    All
                  </FilterButton>
                  {(selectedPart === 1 ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]).map(n => (
                    <FilterButton
                      key={n}
                      active={selectedLessons.includes(n)}
                      onClick={() => setSelectedLessons(prev =>
                        prev.includes(n) ? prev.filter(l => l !== n) : [...prev, n]
                      )}
                    >
                      {n}
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
                  {foldersData.map(folder => (
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

        {/* Start */}
        <div className="document-card p-6 text-center">
          {isLoading ? (
            <p className="text-ink-light text-sm">Loading cards...</p>
          ) : cards.length === 0 ? (
            <p className="text-ink-light text-sm">No cards found for this selection.</p>
          ) : (
            <>
              <p className="text-sm text-ink-light mb-4">
                {cards.length > MAX_PAIRS
                  ? `${cards.length} cards available — playing with ${MAX_PAIRS} random pairs`
                  : `${cards.length} card${cards.length === 1 ? '' : 's'} — ${cards.length} pair${cards.length === 1 ? '' : 's'}`}
              </p>
              <button onClick={startGame} className="vintage-btn vintage-btn-primary px-10 py-3 text-sm tracking-widest uppercase">
                Start Game
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'complete') {
    const totalPairs = tiles.length / 2;
    return (
      <div className="max-w-md mx-auto px-4 text-center pt-16">
        <div className="seal-stamp w-20 h-20 text-3xl mb-6 mx-auto animate-stamp-press">
          <span className="font-chinese">完</span>
        </div>
        <h2 className="display-title text-3xl text-ink mb-2">Complete!</h2>
        <p className="text-ink-light text-sm mb-8">All {totalPairs} pairs matched</p>

        <div className="document-card p-8 mb-8">
          <div className="text-5xl font-mono font-bold text-stamp-red mb-2">
            {formatTime(elapsed)}
          </div>
          <p className="text-xs tracking-widest uppercase text-ink-light">Final time</p>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={startGame}
            className="vintage-btn vintage-btn-primary px-8 py-3 text-sm tracking-widest uppercase"
          >
            Play Again
          </button>
          <button
            onClick={resetToConfig}
            className="vintage-btn px-8 py-3 text-sm tracking-widest uppercase border-ink text-ink hover:bg-ink hover:text-paper"
          >
            Change Settings
          </button>
        </div>
      </div>
    );
  }

  // Playing
  const totalPairs = tiles.length / 2;
  const remaining = totalPairs - matchedCardIds.size;

  return (
    <div className="max-w-6xl mx-auto px-4 pb-12">
      {/* HUD */}
      <div className="flex items-center justify-between py-4 mb-6 border-b border-border">
        <button
          onClick={resetToConfig}
          className="text-xs tracking-wider uppercase text-ink-light hover:text-stamp-red transition-colors"
        >
          ← Back
        </button>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-xs tracking-widest uppercase text-ink-light">Time</div>
            <div className="font-mono text-lg text-ink">{formatTime(elapsed)}</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <div className="text-xs tracking-widest uppercase text-ink-light">Remaining</div>
            <div className="font-mono text-lg text-ink">{remaining} / {totalPairs}</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <div className="text-xs tracking-widest uppercase text-ink-light">Matched</div>
            <div className="font-mono text-lg text-stamp-red">{matchedCardIds.size}</div>
          </div>
        </div>
        <div className="w-20" />
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-cream border border-border mb-8">
        <div
          className="h-full bg-stamp-red transition-all duration-300"
          style={{ width: `${(matchedCardIds.size / totalPairs) * 100}%` }}
        />
      </div>

      {/* Tile Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {tiles.map(tile => {
          const isMatched = matchedCardIds.has(tile.cardId);
          const isSelected = selectedTileId === tile.id;
          const isWrong = wrongPair?.includes(tile.id) ?? false;

          let tileClass = 'border-2 p-2 flex items-center justify-center text-center cursor-pointer transition-all select-none min-h-[64px] ';
          if (isMatched) {
            tileClass += 'bg-green-50 border-green-400 opacity-40 cursor-default pointer-events-none';
          } else if (isWrong) {
            tileClass += 'bg-red-50 border-red-400 text-red-700';
          } else if (isSelected) {
            tileClass += 'bg-amber-50 border-stamp-red shadow-md scale-105';
          } else {
            tileClass += 'bg-paper border-border hover:border-stamp-red hover:bg-cream';
          }

          return (
            <button
              key={tile.id}
              onClick={() => handleTileClick(tile)}
              className={tileClass}
              disabled={isMatched}
            >
              <span className={
                tile.type === 'hanzi'
                  ? 'font-chinese text-xl leading-tight'
                  : tile.type === 'pinyin'
                  ? 'text-sm leading-snug'
                  : 'text-xs leading-snug'
              }>
                {tile.content}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
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
