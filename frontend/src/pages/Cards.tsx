import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function Cards() {
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPart, setSelectedPart] = useState<number | null>(1); // Default to Part 1
  const [selectedLesson, setSelectedLesson] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['cards', searchTerm, selectedPart, selectedLesson],
    queryFn: () => api.getCards({
      search: searchTerm,
      textbookPart: selectedPart || undefined,
      lessonNumber: selectedLesson || undefined,
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
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">My Cards</h1>
        <button
          onClick={() => setIsAddingCard(true)}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          Add Card
        </button>
      </div>

      <div className="mb-6 space-y-4">
        <input
          type="text"
          placeholder="Search cards..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Part:</span>
          <button
            onClick={() => { setSelectedPart(null); setSelectedLesson(null); }}
            className={`px-3 py-1 rounded-lg transition ${
              selectedPart === null
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => { setSelectedPart(1); setSelectedLesson(null); }}
            className={`px-3 py-1 rounded-lg transition ${
              selectedPart === 1
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Part 1
          </button>
        </div>

        {selectedPart === 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Lesson:</span>
            <button
              onClick={() => setSelectedLesson(null)}
              className={`px-3 py-1 rounded-lg transition ${
                selectedLesson === null
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All
            </button>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lesson) => (
              <button
                key={lesson}
                onClick={() => setSelectedLesson(lesson)}
                className={`px-3 py-1 rounded-lg transition ${
                  selectedLesson === lesson
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {lesson}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.cards.map((card) => (
            <div key={card.id} className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1" />
                {card.lessonNumber && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                    L{card.lessonNumber}
                  </span>
                )}
              </div>

              <div className="text-4xl mb-2 text-center">{card.hanzi}</div>
              <div className="text-xl mb-2 text-center text-gray-600">{card.pinyinDisplay}</div>
              <div className="text-lg mb-4 text-center">{card.english}</div>

              {card.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {card.tags.map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleDelete(card.id)}
                  className="flex-1 px-4 py-2 bg-red-100 text-red-600 rounded hover:bg-red-200 transition text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAddingCard && <AddCardModal onClose={() => setIsAddingCard(false)} />}
    </div>
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-6">Add New Card</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Hanzi</label>
            <input
              type="text"
              value={formData.hanzi}
              onChange={(e) => setFormData({ ...formData, hanzi: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Pinyin (with numbers)</label>
            <input
              type="text"
              value={formData.pinyin}
              onChange={(e) => setFormData({ ...formData, pinyin: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              placeholder="ni3 hao3"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Pinyin Display (with marks)</label>
            <input
              type="text"
              value={formData.pinyinDisplay}
              onChange={(e) => setFormData({ ...formData, pinyinDisplay: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              placeholder="nǐ hǎo"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">English</label>
            <input
              type="text"
              value={formData.english}
              onChange={(e) => setFormData({ ...formData, english: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Textbook Part</label>
            <select
              value={formData.textbookPart}
              onChange={(e) => setFormData({ ...formData, textbookPart: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            >
              <option value="1">Part 1</option>
              <option value="2">Part 2</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Lesson Number</label>
            <select
              value={formData.lessonNumber}
              onChange={(e) => setFormData({ ...formData, lessonNumber: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            >
              <option value="">None</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lesson) => (
                <option key={lesson} value={lesson.toString()}>
                  Lesson {lesson}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma-separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              placeholder="greetings, verbs"
            />
          </div>

          <div className="flex gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
            >
              {createMutation.isPending ? 'Adding...' : 'Add Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
