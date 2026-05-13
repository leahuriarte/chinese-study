import { useEffect, useState } from 'react';
import { decomposeHanzi, getCharDefinitions, type DecompositionResult, type CharDefinition } from '../lib/hanziDecompose';

export default function RadicalBreakdown({ hanzi }: { hanzi: string }) {
  const [decompositions, setDecompositions] = useState<DecompositionResult[] | null>(null);
  const [charDefs, setCharDefs] = useState<CharDefinition[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([decomposeHanzi(hanzi), getCharDefinitions(hanzi)]).then(([decomp, defs]) => {
      if (!cancelled) {
        setDecompositions(decomp);
        setCharDefs(defs);
      }
    });
    return () => { cancelled = true; };
  }, [hanzi]);

  const hasDecompositions = decompositions && decompositions.length > 0;
  const hasCharDefs = charDefs && charDefs.length > 0;

  if (!hasCharDefs && !hasDecompositions) return null;

  return (
    <div className="pt-4 border-t border-dashed border-border space-y-4">
      {/* Per-character definitions */}
      {hasCharDefs && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs tracking-wider uppercase text-ink-light">Characters</span>
            <div className="flex-1 border-t border-dashed border-border" />
          </div>
          <div className="flex flex-wrap gap-2">
            {charDefs.map(({ character, definition, pinyin }) => (
              <div
                key={character}
                className="flex flex-col items-center px-3 py-2 min-w-[64px] max-w-[120px] border border-border bg-cream"
              >
                <span className="font-chinese text-2xl leading-tight text-ink">{character}</span>
                {pinyin && (
                  <span className="text-[11px] text-ink-light mt-1 tracking-wide">{pinyin}</span>
                )}
                <span className="text-[10px] text-ink-light mt-1 text-center leading-tight">
                  {definition.split(';')[0].trim()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Component breakdown */}
      {hasDecompositions && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs tracking-wider uppercase text-ink-light">Breakdown</span>
            <div className="flex-1 border-t border-dashed border-border" />
          </div>
          <div className="space-y-3">
            {decompositions.map(({ character, components }) => (
              <div key={character}>
                {decompositions.length > 1 && (
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
      )}
    </div>
  );
}
