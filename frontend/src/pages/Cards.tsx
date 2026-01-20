import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function Cards() {
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPart, setSelectedPart] = useState<number | null>(1);
  const [selectedLesson, setSelectedLesson] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['cards', searchTerm, selectedPart, selectedLesson],
    queryFn: () => api.getCards({
      search: searchTerm,
      textbookPart: selectedPart || undefined,
      lessonNumber: selectedLesson || undefined,
      limit: 500,
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCard(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this card?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex justify-between items-start mb-10 pt-8">
        <div>
          <div className="inline-block mb-4">
            <span className="field-label">Collection</span>
          </div>
          <h1 className="display-title text-4xl md:text-5xl text-ink">My Cards</h1>
        </div>
        <button
          onClick={() => setIsAddingCard(true)}
          className="vintage-btn vintage-btn-primary"
        >
          + Add Card
        </button>
      </div>

      {/* Filters */}
      <div className="document-card p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="field-label">Filters</span>
          <div className="flex-1 border-t border-dashed border-border" />
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs tracking-wider uppercase text-ink-light mb-2">
              Search
            </label>
            <input
              type="text"
              placeholder="Search cards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs tracking-wider uppercase text-ink-light min-w-[50px]">Part:</span>
            <FilterButton
              active={selectedPart === null}
              onClick={() => { setSelectedPart(null); setSelectedLesson(null); }}
            >
              All
            </FilterButton>
            <FilterButton
              active={selectedPart === 1}
              onClick={() => { setSelectedPart(1); setSelectedLesson(null); }}
            >
              Part 1
            </FilterButton>
            <FilterButton
              active={selectedPart === 2}
              onClick={() => { setSelectedPart(2); setSelectedLesson(null); }}
            >
              Part 2
            </FilterButton>
          </div>

          {selectedPart !== null && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs tracking-wider uppercase text-ink-light min-w-[50px]">Lesson:</span>
              <FilterButton
                active={selectedLesson === null}
                onClick={() => setSelectedLesson(null)}
              >
                All
              </FilterButton>
              {(selectedPart === 1 ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]).map((lesson) => (
                <FilterButton
                  key={lesson}
                  active={selectedLesson === lesson}
                  onClick={() => setSelectedLesson(lesson)}
                >
                  {lesson}
                </FilterButton>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex flex-col items-center gap-6">
            <div className="seal-stamp animate-stamp-press">
              <span className="font-chinese">卡</span>
            </div>
            <div className="text-ink-light text-sm tracking-widest uppercase">Loading...</div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs tracking-wider uppercase text-ink-light">
              {data?.cards.length || 0} cards found
            </span>
            <div className="flex-1 border-t border-dashed border-border" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.cards.map((card) => (
              <div key={card.id} className="document-card p-6 group hover:shadow-document-hover transition-all">
                {/* Card Header */}
                <div className="flex justify-between items-start mb-4">
                  <span className="field-label">Card</span>
                  {card.lessonNumber && (
                    <span className="text-xs tracking-wider uppercase px-2 py-1 border border-stamp-red text-stamp-red">
                      L{card.lessonNumber}
                    </span>
                  )}
                </div>

                {/* Hanzi */}
                <div className="text-center py-4">
                  <div className="text-5xl font-chinese text-stamp-red mb-3">{card.hanzi}</div>
                  <div className="text-lg text-ink-light mb-1">{card.pinyinDisplay}</div>
                  <div className="text-sm text-ink">{card.english}</div>
                </div>

                {/* Tags */}
                {card.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4 pt-4 border-t border-dashed border-border">
                    {card.tags.map((tag) => (
                      <span key={tag} className="text-xs px-2 py-1 bg-cream text-ink-light border border-border">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="pt-4 border-t border-dashed border-border">
                  <button
                    onClick={() => handleDelete(card.id)}
                    className="text-xs tracking-wider uppercase text-ink-light hover:text-stamp-red transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {isAddingCard && <AddCardModal onClose={() => setIsAddingCard(false)} />}
    </div>
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
          ? 'bg-stamp-red text-white border-stamp-red'
          : 'bg-paper text-ink-light border-border hover:border-stamp-red hover:text-stamp-red'
      }`}
    >
      {children}
    </button>
  );
}

function AddCardModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    hanzi: '',
    pinyin: '',
    pinyinDisplay: '',
    english: '',
    tags: '',
    textbookPart: '1',
    lessonNumber: '',
  });
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createCard(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      hanzi: formData.hanzi,
      pinyin: formData.pinyin,
      pinyinDisplay: formData.pinyinDisplay,
      english: formData.english,
      englishAlt: [],
      tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean),
      textbookPart: formData.textbookPart ? parseInt(formData.textbookPart) : undefined,
      lessonNumber: formData.lessonNumber ? parseInt(formData.lessonNumber) : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-ink/50 flex items-center justify-center p-4 z-50">
      <div className="document-card p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-8">
          <span className="field-label">New Card</span>
          <div className="flex-1 border-t border-dashed border-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs tracking-wider uppercase text-ink-light mb-2">Hanzi</label>
            <input
              type="text"
              value={formData.hanzi}
              onChange={(e) => setFormData({ ...formData, hanzi: e.target.value })}
              className="w-full text-2xl font-chinese text-center"
              required
            />
          </div>

          <div>
            <label className="block text-xs tracking-wider uppercase text-ink-light mb-2">Pinyin (with numbers)</label>
            <input
              type="text"
              value={formData.pinyin}
              onChange={(e) => setFormData({ ...formData, pinyin: e.target.value })}
              className="w-full"
              placeholder="ni3 hao3"
              required
            />
          </div>

          <div>
            <label className="block text-xs tracking-wider uppercase text-ink-light mb-2">Pinyin Display (with marks)</label>
            <input
              type="text"
              value={formData.pinyinDisplay}
              onChange={(e) => setFormData({ ...formData, pinyinDisplay: e.target.value })}
              className="w-full"
              placeholder="nǐ hǎo"
              required
            />
          </div>

          <div>
            <label className="block text-xs tracking-wider uppercase text-ink-light mb-2">English</label>
            <input
              type="text"
              value={formData.english}
              onChange={(e) => setFormData({ ...formData, english: e.target.value })}
              className="w-full"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs tracking-wider uppercase text-ink-light mb-2">Part</label>
              <select
                value={formData.textbookPart}
                onChange={(e) => setFormData({ ...formData, textbookPart: e.target.value })}
                className="w-full"
              >
                <option value="1">Part 1</option>
                <option value="2">Part 2</option>
              </select>
            </div>

            <div>
              <label className="block text-xs tracking-wider uppercase text-ink-light mb-2">Lesson</label>
              <select
                value={formData.lessonNumber}
                onChange={(e) => setFormData({ ...formData, lessonNumber: e.target.value })}
                className="w-full"
              >
                <option value="">None</option>
                {(formData.textbookPart === '1' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]).map((lesson) => (
                  <option key={lesson} value={lesson.toString()}>
                    Lesson {lesson}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs tracking-wider uppercase text-ink-light mb-2">Tags (comma-separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full"
              placeholder="greetings, verbs"
            />
          </div>

          <div className="flex gap-4 pt-6 border-t border-dashed border-border">
            <button
              type="button"
              onClick={onClose}
              className="vintage-btn flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="vintage-btn vintage-btn-primary flex-1 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Adding...' : 'Add Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
