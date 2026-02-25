import type { User, Card, CardProgress, QuizMode, Folder } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (error) {
      // Network-level errors (Safari "Load failed", CORS issues, timeouts)
      const message = error instanceof Error ? error.message : 'Network error';
      console.error(`Fetch failed for ${endpoint}:`, message);
      throw new Error(`Network error: ${message}. Please check your connection and try again.`);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth endpoints
  async register(email: string, password: string) {
    return this.request<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async login(email: string, password: string) {
    return this.request<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    return this.request<{ message: string }>('/api/auth/logout', {
      method: 'POST',
    });
  }

  async getMe() {
    return this.request<{
      id: string;
      email: string;
      createdAt: string;
      settings: any;
    }>('/api/auth/me');
  }

  // Card endpoints
  async getCards(params?: {
    page?: number;
    limit?: number;
    tags?: string[];
    hskLevel?: number;
    textbookPart?: number;
    lessonNumber?: number;
    search?: string;
    folderId?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.tags) queryParams.set('tags', params.tags.join(','));
    if (params?.hskLevel) queryParams.set('hskLevel', params.hskLevel.toString());
    if (params?.textbookPart) queryParams.set('textbookPart', params.textbookPart.toString());
    if (params?.lessonNumber) queryParams.set('lessonNumber', params.lessonNumber.toString());
    if (params?.search) queryParams.set('search', params.search);
    if (params?.folderId) queryParams.set('folderId', params.folderId);

    return this.request<{
      cards: Card[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/api/cards?${queryParams}`);
  }

  async getCard(id: string) {
    return this.request<Card>(`/api/cards/${id}`);
  }

  async createCard(card: Omit<Card, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
    return this.request<Card>('/api/cards', {
      method: 'POST',
      body: JSON.stringify(card),
    });
  }

  async updateCard(id: string, card: Partial<Omit<Card, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>) {
    return this.request<Card>(`/api/cards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(card),
    });
  }

  async deleteCard(id: string) {
    return this.request<{ message: string }>(`/api/cards/${id}`, {
      method: 'DELETE',
    });
  }

  async exportCards() {
    return this.request<Card[]>('/api/cards/export');
  }

  // Study endpoints
  async getDueCards(mode: QuizMode, limit: number = 20, filters?: { textbookPart?: number; lessonNumber?: number; folderId?: string }) {
    const queryParams = new URLSearchParams();
    queryParams.set('mode', mode);
    queryParams.set('limit', limit.toString());
    if (filters?.textbookPart) queryParams.set('textbookPart', filters.textbookPart.toString());
    if (filters?.lessonNumber) queryParams.set('lessonNumber', filters.lessonNumber.toString());
    if (filters?.folderId) queryParams.set('folderId', filters.folderId);

    return this.request<Array<{ cardProgress: CardProgress; card: Card }>>(
      `/api/study/due?${queryParams}`
    );
  }

  async getNewCards(mode: QuizMode, limit: number = 10, filters?: { textbookPart?: number; lessonNumber?: number; folderId?: string }) {
    const queryParams = new URLSearchParams();
    queryParams.set('mode', mode);
    queryParams.set('limit', limit.toString());
    if (filters?.textbookPart) queryParams.set('textbookPart', filters.textbookPart.toString());
    if (filters?.lessonNumber) queryParams.set('lessonNumber', filters.lessonNumber.toString());
    if (filters?.folderId) queryParams.set('folderId', filters.folderId);

    return this.request<Card[]>(`/api/study/new?${queryParams}`);
  }

  async submitReview(data: {
    cardId: string;
    mode: QuizMode;
    quality: number;
    responseTimeMs: number;
  }) {
    return this.request<{
      cardProgress: CardProgress;
      wasCorrect: boolean;
      nextReview: Date;
    }>('/api/study/review', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getStats() {
    return this.request<{
      totalCards: number;
      totalReviews: number;
      dueCounts: Array<{ mode: QuizMode; count: number }>;
      recentSessions: any[];
    }>('/api/study/stats');
  }

  async getHeatmap(days: number = 90) {
    return this.request<Record<string, { total: number; correct: number }>>(
      `/api/study/heatmap?days=${days}`
    );
  }

  // Folder endpoints
  async getFolders() {
    return this.request<Folder[]>('/api/folders');
  }

  async createFolder(name: string, description?: string) {
    return this.request<Folder>('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  async updateFolder(id: string, data: { name?: string; description?: string }) {
    return this.request<Folder>(`/api/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteFolder(id: string) {
    return this.request<{ message: string }>(`/api/folders/${id}`, {
      method: 'DELETE',
    });
  }

  async getFolderCards(folderId: string) {
    return this.request<Card[]>(`/api/folders/${folderId}/cards`);
  }

  async addCardsToFolder(folderId: string, cardIds: string[]) {
    return this.request<{ added: number }>(`/api/folders/${folderId}/cards`, {
      method: 'POST',
      body: JSON.stringify({ cardIds }),
    });
  }

  async removeCardFromFolder(folderId: string, cardId: string) {
    return this.request<{ message: string }>(`/api/folders/${folderId}/cards/${cardId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
