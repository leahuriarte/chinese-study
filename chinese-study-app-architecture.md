# Chinese Study App Architecture

## Overview

A PWA for studying Chinese that combines flashcard review (with spaced repetition), writing practice, and multiple quiz modes. Data persists to a backend so it syncs across devices.

## Quiz Modes

1. **Hanzi → Pinyin**: Show character, user types/selects pinyin
2. **Pinyin → English**: Show pinyin, user types/selects meaning
3. **English → Hanzi**: Show meaning, user writes or selects character
4. **English → Pinyin**: Show meaning, user types pinyin
5. **Pinyin → Hanzi**: Show pinyin, user writes or selects character
6. **Hanzi → English**: Show character, user types/selects meaning (implicit, good to have)

Each mode tracks its own SRS data separately, since recognizing a character doesn't mean you can produce it.

---

## Data Models

### User
```typescript
interface User {
  id: string;
  email: string;
  createdAt: Date;
  settings: UserSettings;
}

interface UserSettings {
  dailyNewCards: number;        // default 20
  dailyReviewLimit: number;     // default 100
  preferredQuizModes: QuizMode[];
  showPinyinTones: 'numbers' | 'marks'; // e.g., "ma3" vs "mǎ"
}
```

### Card (the vocabulary item)
```typescript
interface Card {
  id: string;
  userId: string;
  hanzi: string;
  pinyin: string;              // with tone numbers, e.g., "ni3 hao3"
  pinyinDisplay: string;       // with tone marks, e.g., "nǐ hǎo"
  english: string;             // primary meaning
  englishAlt: string[];        // alternate meanings
  exampleSentence?: string;
  examplePinyin?: string;
  exampleEnglish?: string;
  hskLevel?: number;           // 1-6, optional
  tags: string[];              // user-defined tags like "food", "verbs"
  createdAt: Date;
  updatedAt: Date;
}
```

### CardProgress (SRS state per card per mode)
```typescript
type QuizMode = 
  | 'hanzi_to_pinyin'
  | 'pinyin_to_english'
  | 'english_to_hanzi'
  | 'english_to_pinyin'
  | 'pinyin_to_hanzi'
  | 'hanzi_to_english';

interface CardProgress {
  id: string;
  cardId: string;
  userId: string;
  mode: QuizMode;
  
  // SRS fields (SM-2 algorithm)
  easeFactor: number;          // starts at 2.5
  interval: number;            // days until next review
  repetitions: number;         // consecutive correct answers
  nextReviewDate: Date;
  
  // Stats
  totalReviews: number;
  correctCount: number;
  lastReviewedAt: Date | null;
}
```

### StudySession (for analytics)
```typescript
interface StudySession {
  id: string;
  userId: string;
  startedAt: Date;
  endedAt: Date | null;
  mode: QuizMode;
  cardsReviewed: number;
  correctCount: number;
}
```

### ReviewLog (individual review events)
```typescript
interface ReviewLog {
  id: string;
  cardProgressId: string;
  userId: string;
  reviewedAt: Date;
  quality: number;             // 0-5 (SM-2 quality rating)
  responseTimeMs: number;
  wasCorrect: boolean;
}
```

---

## SM-2 Algorithm Implementation

```typescript
interface SM2Result {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: Date;
}

function calculateSM2(
  quality: number,              // 0-5: 0-2 = wrong, 3 = hard, 4 = good, 5 = easy
  currentEaseFactor: number,
  currentInterval: number,
  currentRepetitions: number
): SM2Result {
  
  let newEaseFactor = currentEaseFactor;
  let newInterval: number;
  let newRepetitions: number;

  if (quality < 3) {
    // Failed: reset repetitions, short interval
    newRepetitions = 0;
    newInterval = 1;
  } else {
    // Passed
    newRepetitions = currentRepetitions + 1;
    
    if (newRepetitions === 1) {
      newInterval = 1;
    } else if (newRepetitions === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(currentInterval * currentEaseFactor);
    }
    
    // Update ease factor
    newEaseFactor = currentEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    newEaseFactor = Math.max(1.3, newEaseFactor); // minimum 1.3
  }

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

  return {
    easeFactor: newEaseFactor,
    interval: newInterval,
    repetitions: newRepetitions,
    nextReviewDate
  };
}
```

---

## API Endpoints

### Auth
```
POST   /api/auth/register        - Create account
POST   /api/auth/login           - Login, returns JWT
POST   /api/auth/refresh         - Refresh JWT
POST   /api/auth/logout          - Invalidate refresh token
```

### Cards
```
GET    /api/cards                - List user's cards (paginated, filterable by tags/HSK)
POST   /api/cards                - Create new card
GET    /api/cards/:id            - Get single card
PUT    /api/cards/:id            - Update card
DELETE /api/cards/:id            - Delete card
POST   /api/cards/bulk           - Import multiple cards (CSV or JSON)
GET    /api/cards/export         - Export all cards as JSON
```

### Study
```
GET    /api/study/due?mode=X     - Get cards due for review in mode X
GET    /api/study/new?mode=X     - Get new cards to learn in mode X
POST   /api/study/review         - Submit review result, updates SRS
GET    /api/study/stats          - Get user's study statistics
GET    /api/study/heatmap        - Get review history for calendar heatmap
```

### Decks/Tags
```
GET    /api/tags                 - List user's tags with card counts
POST   /api/tags                 - Create tag
DELETE /api/tags/:name           - Delete tag (doesn't delete cards)
```

---

## Frontend Structure (React + TypeScript)

```
src/
├── components/
│   ├── common/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   └── LoadingSpinner.tsx
│   │
│   ├── study/
│   │   ├── StudySession.tsx       - Main study flow controller
│   │   ├── FlashcardDisplay.tsx   - Shows the prompt side
│   │   ├── AnswerInput.tsx        - Text input for typed answers
│   │   ├── MultipleChoice.tsx     - MC answer option
│   │   ├── WritingCanvas.tsx      - Handwriting input
│   │   ├── ResultFeedback.tsx     - Correct/incorrect display
│   │   └── SessionComplete.tsx    - End of session summary
│   │
│   ├── cards/
│   │   ├── CardList.tsx           - Browse/search cards
│   │   ├── CardEditor.tsx         - Add/edit card form
│   │   ├── CardImport.tsx         - Bulk import UI
│   │   └── CardDetail.tsx         - Single card view with stats
│   │
│   ├── stats/
│   │   ├── Dashboard.tsx          - Overview stats
│   │   ├── Heatmap.tsx            - GitHub-style activity calendar
│   │   ├── ProgressChart.tsx      - Cards learned over time
│   │   └── ModeBreakdown.tsx      - Stats per quiz mode
│   │
│   └── layout/
│       ├── Header.tsx
│       ├── Navigation.tsx
│       └── MobileNav.tsx
│
├── hooks/
│   ├── useAuth.ts
│   ├── useCards.ts
│   ├── useStudySession.ts
│   ├── useSRS.ts
│   └── useOfflineSync.ts
│
├── lib/
│   ├── api.ts                     - API client
│   ├── srs.ts                     - SM-2 implementation
│   ├── pinyin.ts                  - Pinyin utilities (tone conversion, etc.)
│   ├── hanziWriter.ts             - Hanzi Writer integration
│   └── storage.ts                 - IndexedDB for offline
│
├── pages/
│   ├── Home.tsx
│   ├── Study.tsx
│   ├── Cards.tsx
│   ├── Stats.tsx
│   ├── Settings.tsx
│   ├── Login.tsx
│   └── Register.tsx
│
├── contexts/
│   ├── AuthContext.tsx
│   └── StudyContext.tsx
│
├── types/
│   └── index.ts                   - All TypeScript interfaces
│
└── styles/
    └── globals.css                - Tailwind + custom styles
```

---

## Backend Structure (Node.js + Express + PostgreSQL)

```
server/
├── src/
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── cards.ts
│   │   ├── study.ts
│   │   └── tags.ts
│   │
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── cardsController.ts
│   │   ├── studyController.ts
│   │   └── tagsController.ts
│   │
│   ├── services/
│   │   ├── authService.ts
│   │   ├── cardService.ts
│   │   ├── srsService.ts          - SRS calculations
│   │   └── statsService.ts
│   │
│   ├── middleware/
│   │   ├── auth.ts                - JWT verification
│   │   ├── validate.ts            - Request validation
│   │   └── errorHandler.ts
│   │
│   ├── models/
│   │   ├── User.ts
│   │   ├── Card.ts
│   │   ├── CardProgress.ts
│   │   └── ReviewLog.ts
│   │
│   ├── db/
│   │   ├── index.ts               - Database connection
│   │   └── migrations/            - SQL migrations
│   │
│   └── utils/
│       ├── pinyin.ts
│       └── validators.ts
│
├── prisma/
│   └── schema.prisma              - Database schema (if using Prisma)
│
└── package.json
```

---

## Database Schema (PostgreSQL)

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cards
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  hanzi VARCHAR(50) NOT NULL,
  pinyin VARCHAR(100) NOT NULL,
  pinyin_display VARCHAR(100) NOT NULL,
  english VARCHAR(500) NOT NULL,
  english_alt TEXT[],
  example_sentence TEXT,
  example_pinyin TEXT,
  example_english TEXT,
  hsk_level SMALLINT,
  tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cards_user_id ON cards(user_id);
CREATE INDEX idx_cards_tags ON cards USING GIN(tags);

-- Card Progress (one per card per mode)
CREATE TABLE card_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mode VARCHAR(50) NOT NULL,
  ease_factor DECIMAL(4,2) DEFAULT 2.5,
  interval_days INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  next_review_date DATE,
  total_reviews INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  last_reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(card_id, mode)
);

CREATE INDEX idx_card_progress_next_review ON card_progress(user_id, mode, next_review_date);

-- Review Logs
CREATE TABLE review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_progress_id UUID REFERENCES card_progress(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  quality SMALLINT NOT NULL,
  response_time_ms INTEGER,
  was_correct BOOLEAN NOT NULL,
  reviewed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_review_logs_user_date ON review_logs(user_id, reviewed_at);

-- Study Sessions
CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mode VARCHAR(50) NOT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  cards_reviewed INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0
);
```

---

## Key Libraries

### Frontend
- **React** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Query (TanStack Query)** - Server state management
- **Hanzi Writer** - Stroke order animation and writing input
- **idb** - IndexedDB wrapper for offline storage
- **Workbox** - PWA/service worker tooling

### Backend
- **Express** - API framework
- **Prisma** or **pg** - Database ORM/client
- **bcrypt** - Password hashing
- **jsonwebtoken** - JWT auth
- **zod** - Request validation
- **helmet** - Security headers
- **cors** - CORS handling

---

## Writing Practice Integration (Hanzi Writer)

```typescript
import HanziWriter from 'hanzi-writer';

// Quiz mode: user draws, system checks
function createWritingQuiz(target: HTMLElement, character: string): Promise<boolean> {
  return new Promise((resolve) => {
    const writer = HanziWriter.create(target, character, {
      width: 300,
      height: 300,
      padding: 5,
      showOutline: false,
      showCharacter: false,
      highlightOnComplete: true,
      drawingWidth: 20,
    });

    writer.quiz({
      onComplete: (summary) => {
        const accuracy = summary.totalMistakes === 0;
        resolve(accuracy);
      },
      onCorrectStroke: () => {
        // Optional: play sound or show feedback
      },
      onMistake: (strokeData) => {
        // Optional: show hint
      }
    });
  });
}

// Practice mode: shows stroke order animation
function animateCharacter(target: HTMLElement, character: string) {
  const writer = HanziWriter.create(target, character, {
    width: 300,
    height: 300,
    delayBetweenStrokes: 300,
  });
  writer.animateCharacter();
}
```

---

## Offline Strategy

1. **Service Worker** caches app shell and static assets
2. **IndexedDB** stores:
   - Full card deck (synced from server)
   - Pending reviews (queued when offline)
   - Card progress snapshots
3. **Sync on reconnect**:
   - Push pending reviews to server
   - Pull any new cards or progress updates
   - Conflict resolution: server wins for progress, merge for cards

```typescript
// Simplified offline queue
interface PendingReview {
  cardProgressId: string;
  quality: number;
  responseTimeMs: number;
  timestamp: Date;
}

async function submitReview(review: PendingReview) {
  if (navigator.onLine) {
    await api.post('/study/review', review);
  } else {
    await offlineDb.pendingReviews.add(review);
  }
}

// On reconnect
window.addEventListener('online', async () => {
  const pending = await offlineDb.pendingReviews.getAll();
  for (const review of pending) {
    await api.post('/study/review', review);
    await offlineDb.pendingReviews.delete(review.id);
  }
});
```

---

## PWA Manifest

```json
{
  "name": "Chinese Study App",
  "short_name": "汉语",
  "description": "Learn Chinese with spaced repetition and writing practice",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#dc2626",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## Development Phases

### Phase 1: Core MVP
- [ ] User auth (register, login)
- [ ] Card CRUD (add, edit, delete, list)
- [ ] Single quiz mode working (hanzi → pinyin)
- [ ] Basic SRS implementation
- [ ] Simple UI, mobile-responsive

### Phase 2: All Quiz Modes
- [ ] Implement all 6 quiz modes
- [ ] Per-mode progress tracking
- [ ] Mode selection UI
- [ ] Answer validation for each mode type

### Phase 3: Writing Practice
- [ ] Integrate Hanzi Writer
- [ ] Writing quiz mode for english → hanzi and pinyin → hanzi
- [ ] Stroke order hints option
- [ ] Practice mode (non-graded)

### Phase 4: Polish & Stats
- [ ] Dashboard with stats
- [ ] Study streak tracking
- [ ] Heatmap calendar
- [ ] Progress charts

### Phase 5: PWA & Offline
- [ ] Service worker setup
- [ ] Offline card storage
- [ ] Review queue for offline
- [ ] Sync on reconnect

### Phase 6: Nice-to-haves
- [ ] Bulk import (CSV, Anki format)
- [ ] Pre-made HSK decks
- [ ] Audio pronunciations
- [ ] Example sentence generator
- [ ] Dark mode

---

## Hosting Recommendations

- **Frontend**: Vercel or Netlify (free tier works well for PWAs)
- **Backend**: Railway, Render, or Fly.io
- **Database**: Railway PostgreSQL, Supabase, or Neon (all have free tiers)
- **Alternative**: Supabase for both DB and auth (simplifies backend significantly)

---

## Environment Variables

```
# Frontend (.env)
VITE_API_URL=https://api.yourdomain.com

# Backend (.env)
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=another-secret-key
CORS_ORIGIN=https://yourdomain.com
```

---

## Notes for Claude Code

1. Start with Phase 1. Get basic auth and card management working first.
2. Use Prisma for the database layer; it handles migrations nicely.
3. For the frontend, Vite + React + TypeScript is a solid starting point.
4. The SM-2 algorithm code above is ready to use.
5. Hanzi Writer is well-documented at https://hanziwriter.org
6. For pinyin tone conversion, you can use the `pinyin-utils` npm package or write a simple converter.
7. Test on mobile early and often since that's the primary use case.
