import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Card, Folder } from '../types';

export default function Folders() {
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDesc, setNewFolderDesc] = useState('');
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [showAddCards, setShowAddCards] = useState(false);
  const [cardSearch, setCardSearch] = useState('');
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: folders = [], isLoading } = useQuery({
    queryKey: ['folders'],
    queryFn: () => api.getFolders(),
  });

  const { data: folderCards = [], isLoading: isLoadingCards } = useQuery({
    queryKey: ['folderCards', selectedFolder?.id],
    queryFn: () => api.getFolderCards(selectedFolder!.id),
    enabled: !!selectedFolder,
  });

  const { data: allCardsData } = useQuery({
    queryKey: ['cards', 'all'],
    queryFn: () => api.getCards({ limit: 1000 }),
    enabled: showAddCards,
  });

  const createMutation = useMutation({
    mutationFn: ({ name, desc }: { name: string; desc: string }) =>
      api.createFolder(name, desc || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      setIsCreating(false);
      setNewFolderName('');
      setNewFolderDesc('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name, desc }: { id: string; name: string; desc: string }) =>
      api.updateFolder(id, { name, description: desc || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      setEditingFolder(null);
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => api.deleteFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      if (selectedFolder) setSelectedFolder(null);
    },
  });

  const addCardsMutation = useMutation({
    mutationFn: ({ folderId, cardIds }: { folderId: string; cardIds: string[] }) =>
      api.addCardsToFolder(folderId, cardIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folderCards', selectedFolder?.id] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      setShowAddCards(false);
      setSelectedCardIds(new Set());
      setCardSearch('');
    },
  });

  const removeCardMutation = useMutation({
    mutationFn: ({ folderId, cardId }: { folderId: string; cardId: string }) =>
      api.removeCardFromFolder(folderId, cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folderCards', selectedFolder?.id] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    createMutation.mutate({ name: newFolderName.trim(), desc: newFolderDesc.trim() });
  };

  const handleUpdateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolder || !editName.trim()) return;
    updateMutation.mutate({ id: editingFolder.id, name: editName.trim(), desc: editDesc.trim() });
  };

  const handleDeleteFolder = (folder: Folder) => {
    if (!confirm(`Delete folder "${folder.name}"? The cards won't be deleted.`)) return;
    deleteFolderMutation.mutate(folder.id);
  };

  const handleAddCards = () => {
    if (!selectedFolder || selectedCardIds.size === 0) return;
    addCardsMutation.mutate({
      folderId: selectedFolder.id,
      cardIds: Array.from(selectedCardIds),
    });
  };

  const toggleCardSelection = (cardId: string) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const folderCardIds = new Set(folderCards.map((c: Card) => c.id));
  const filteredAllCards = (allCardsData?.cards || []).filter((c: Card) => {
    if (folderCardIds.has(c.id)) return false;
    if (!cardSearch) return true;
    const s = cardSearch.toLowerCase();
    return c.hanzi.includes(s) || c.pinyinDisplay.toLowerCase().includes(s) || c.english.toLowerCase().includes(s);
  });

  // Drill-down view for a selected folder
  if (selectedFolder) {
    return (
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-10 pt-8">
          <div>
            <button
              onClick={() => setSelectedFolder(null)}
              className="text-xs tracking-wider uppercase text-ink-light hover:text-stamp-red transition flex items-center gap-1 mb-4"
            >
              ← All Folders
            </button>
            <div className="inline-block mb-2">
              <span className="field-label">Folder</span>
            </div>
            <h1 className="display-title text-4xl md:text-5xl text-ink">{selectedFolder.name}</h1>
            {selectedFolder.description && (
              <p className="text-ink-light text-sm mt-2">{selectedFolder.description}</p>
            )}
          </div>
          <button
            onClick={() => setShowAddCards(true)}
            className="vintage-btn vintage-btn-primary"
          >
            + Add Cards
          </button>
        </div>

        {/* Cards in folder */}
        {isLoadingCards ? (
          <div className="text-ink-light text-sm tracking-widest uppercase text-center py-16">Loading...</div>
        ) : folderCards.length === 0 ? (
          <div className="document-card p-12 text-center">
            <div className="text-4xl font-chinese text-stamp-red mb-4">空</div>
            <p className="text-ink-light">This folder is empty. Add some cards to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {folderCards.map((card: Card) => (
              <div key={card.id} className="document-card p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-6 min-w-0">
                  <span className="text-3xl font-kaiti text-stamp-red shrink-0">{card.hanzi}</span>
                  <div className="min-w-0">
                    <div className="text-sm text-ink-light">{card.pinyinDisplay}</div>
                    <div className="text-sm text-ink truncate">{card.english}</div>
                  </div>
                </div>
                <button
                  onClick={() => removeCardMutation.mutate({ folderId: selectedFolder.id, cardId: card.id })}
                  className="shrink-0 text-xs tracking-wider uppercase text-ink-light hover:text-stamp-red transition"
                  title="Remove from folder"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Cards Modal */}
        {showAddCards && (
          <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
            <div className="bg-paper border-2 border-ink max-w-lg w-full max-h-[80vh] flex flex-col">
              <div className="p-6 border-b border-border flex justify-between items-center">
                <h2 className="font-display font-bold text-xl text-ink">Add Cards to Folder</h2>
                <button
                  onClick={() => { setShowAddCards(false); setSelectedCardIds(new Set()); setCardSearch(''); }}
                  className="text-ink-light hover:text-stamp-red transition"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 border-b border-border">
                <input
                  type="text"
                  value={cardSearch}
                  onChange={(e) => setCardSearch(e.target.value)}
                  placeholder="Search cards..."
                  className="w-full text-sm"
                />
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-2">
                {filteredAllCards.length === 0 ? (
                  <p className="text-ink-light text-sm text-center py-8">No cards to add</p>
                ) : (
                  filteredAllCards.map((card: Card) => (
                    <button
                      key={card.id}
                      onClick={() => toggleCardSelection(card.id)}
                      className={`w-full text-left p-3 border-2 transition-all flex items-center gap-4 ${
                        selectedCardIds.has(card.id)
                          ? 'border-stamp-red bg-stamp-red-light'
                          : 'border-border hover:border-stamp-red'
                      }`}
                    >
                      <span className="text-2xl font-kaiti text-stamp-red shrink-0">{card.hanzi}</span>
                      <div className="min-w-0">
                        <div className="text-xs text-ink-light">{card.pinyinDisplay}</div>
                        <div className="text-sm text-ink truncate">{card.english}</div>
                      </div>
                      {selectedCardIds.has(card.id) && (
                        <span className="ml-auto text-stamp-red text-xs font-bold shrink-0">✓</span>
                      )}
                    </button>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-border flex justify-between items-center">
                <span className="text-xs text-ink-light">{selectedCardIds.size} selected</span>
                <button
                  onClick={handleAddCards}
                  disabled={selectedCardIds.size === 0 || addCardsMutation.isPending}
                  className="vintage-btn vintage-btn-primary disabled:opacity-50"
                >
                  Add Selected
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Folder list view
  return (
    <div className="max-w-4xl mx-auto px-4">
      {/* Header */}
      <div className="flex justify-between items-start mb-10 pt-8">
        <div>
          <div className="inline-block mb-4">
            <span className="field-label">Organization</span>
          </div>
          <h1 className="display-title text-4xl md:text-5xl text-ink">Folders</h1>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="vintage-btn vintage-btn-primary"
        >
          + New Folder
        </button>
      </div>

      {/* Create folder form */}
      {isCreating && (
        <div className="document-card p-6 mb-6">
          <form onSubmit={handleCreateFolder} className="space-y-4">
            <div>
              <label className="block text-xs tracking-wider uppercase text-ink-light mb-2">Folder Name</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g., Food Vocabulary"
                className="w-full"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-xs tracking-wider uppercase text-ink-light mb-2">Description (optional)</label>
              <input
                type="text"
                value={newFolderDesc}
                onChange={(e) => setNewFolderDesc(e.target.value)}
                placeholder="Short description..."
                className="w-full"
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={createMutation.isPending} className="vintage-btn vintage-btn-primary">
                Create
              </button>
              <button
                type="button"
                onClick={() => { setIsCreating(false); setNewFolderName(''); setNewFolderDesc(''); }}
                className="vintage-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Folder list */}
      {isLoading ? (
        <div className="text-ink-light text-sm tracking-widest uppercase text-center py-16">Loading...</div>
      ) : folders.length === 0 && !isCreating ? (
        <div className="document-card p-12 text-center">
          <div className="text-4xl font-chinese text-stamp-red mb-4">文</div>
          <p className="text-ink-light mb-6">No folders yet. Create one to organize your vocabulary cards.</p>
          <button onClick={() => setIsCreating(true)} className="vintage-btn vintage-btn-primary">
            + New Folder
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {folders.map((folder) => {
            if (editingFolder?.id === folder.id) {
              return (
                <div key={folder.id} className="document-card p-5">
                  <form onSubmit={handleUpdateFolder} className="space-y-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full"
                      required
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full"
                    />
                    <div className="flex gap-3">
                      <button type="submit" disabled={updateMutation.isPending} className="vintage-btn vintage-btn-primary text-sm">
                        Save
                      </button>
                      <button type="button" onClick={() => setEditingFolder(null)} className="vintage-btn text-sm">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              );
            }

            return (
              <div
                key={folder.id}
                className="document-card p-5 flex items-center justify-between gap-4 hover:shadow-document-hover transition-all cursor-pointer group"
                onClick={() => setSelectedFolder(folder)}
              >
                <div className="flex items-center gap-5 min-w-0">
                  <div className="w-12 h-12 border-2 border-stamp-red flex items-center justify-center text-stamp-red font-chinese text-xl shrink-0">
                    文
                  </div>
                  <div className="min-w-0">
                    <div className="font-display font-bold text-ink group-hover:text-stamp-red transition-colors">
                      {folder.name}
                    </div>
                    {folder.description && (
                      <div className="text-xs text-ink-light truncate mt-0.5">{folder.description}</div>
                    )}
                    <div className="text-xs text-ink-light tracking-wider uppercase mt-1">
                      {folder.cardCount ?? 0} {folder.cardCount === 1 ? 'card' : 'cards'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      setEditingFolder(folder);
                      setEditName(folder.name);
                      setEditDesc(folder.description || '');
                    }}
                    className="text-xs tracking-wider uppercase text-ink-light hover:text-ink transition px-2 py-1"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDeleteFolder(folder)}
                    className="text-xs tracking-wider uppercase text-ink-light hover:text-stamp-red transition px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
