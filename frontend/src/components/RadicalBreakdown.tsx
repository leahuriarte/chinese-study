import { useEffect, useState } from 'react';
import { decomposeHanzi, type RadicalInfo } from '../lib/hanziDecompose';

export default function RadicalBreakdown({ hanzi }: { hanzi: string }) {
  const [radicals, setRadicals] = useState<RadicalInfo[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    decomposeHanzi(hanzi).then((result) => {
      if (!cancelled) setRadicals(result);
    });
    return () => { cancelled = true; };
  }, [hanzi]);

  if (!radicals || radicals.length === 0) return null;

  return (
    <div className="pt-4 border-t border-dashed border-border">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs tracking-wider uppercase text-ink-light">Radicals</span>
        <div className="flex-1 border-t border-dashed border-border" />
      </div>
      <div className="flex flex-wrap gap-2">
        {radicals.map((r) => (
          <div key={r.radical} className="flex flex-col items-center border border-border bg-cream px-3 py-2 min-w-[48px]">
            <span className="font-chinese text-stamp-red text-xl leading-tight">{r.radical}</span>
            {r.meaning && (
              <span className="text-[10px] text-ink-light mt-1 text-center leading-tight max-w-[64px]">
                {r.meaning}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
