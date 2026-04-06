import { useEffect, useState } from 'react';
import { decomposeHanzi, type DecompositionResult } from '../lib/hanziDecompose';

export default function RadicalBreakdown({ hanzi }: { hanzi: string }) {
  const [results, setResults] = useState<DecompositionResult[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    decomposeHanzi(hanzi).then((r) => {
      if (!cancelled) setResults(r);
    });
    return () => { cancelled = true; };
  }, [hanzi]);

  if (!results || results.length === 0) return null;

  return (
    <div className="pt-4 border-t border-dashed border-border">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs tracking-wider uppercase text-ink-light">Breakdown</span>
        <div className="flex-1 border-t border-dashed border-border" />
      </div>

      <div className="space-y-3">
        {results.map(({ character, components }) => (
          <div key={character}>
            {/* Only show per-character label when hanzi is multi-char */}
            {results.length > 1 && (
              <span className="text-xs text-ink-light mb-2 inline-block font-chinese">{character}</span>
            )}
            <div className="flex flex-wrap gap-2">
              {components.map((comp) => (
                <div
                  key={comp.character}
                  className={`flex flex-col items-center px-3 py-2 min-w-[52px] border ${
                    comp.type === 'phonetic'
                      ? 'border-blue-300 bg-blue-50'
                      : comp.type === 'semantic'
                      ? 'border-border bg-cream'
                      : 'border-border bg-paper'
                  }`}
                >
                  <span className="font-chinese text-stamp-red text-xl leading-tight">
                    {comp.character}
                  </span>
                  {comp.type === 'phonetic' && comp.phoneticPinyin && (
                    <span className="text-[10px] text-blue-500 mt-1 tracking-wide">
                      {comp.phoneticPinyin}
                    </span>
                  )}
                  {comp.meaning && (
                    <span className="text-[10px] text-ink-light mt-0.5 text-center leading-tight max-w-[64px]">
                      {comp.meaning}
                    </span>
                  )}
                  <span className={`text-[9px] mt-1 tracking-wider uppercase ${
                    comp.type === 'phonetic' ? 'text-blue-400' : 'text-ink-light/60'
                  }`}>
                    {comp.type === 'phonetic' ? 'sound' : comp.type === 'semantic' ? 'meaning' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
