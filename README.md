# Chinese Study App

A progressive web app for studying Chinese with flashcard review, spaced repetition (SM-2 algorithm), writing practice, and multiple quiz modes.

## Features

### Phase 1 & 2 (Completed)

- **Authentication**: User registration, login with JWT tokens
- **Card Management**: Create, read, update, delete vocabulary cards
- **Spaced Repetition**: SM-2 algorithm for intelligent review scheduling
- **6 Quiz Modes**:
  - Hanzi → Pinyin (see character, type pinyin)
  - Hanzi → English (see character, type meaning)
  - Pinyin → Hanzi (see pinyin, write character)
  - Pinyin → English (see pinyin, type meaning)
  - English → Hanzi (see meaning, write character)
  - English → Pinyin (see meaning, type pinyin)
- **Writing Practice**: Integrated Hanzi Writer for stroke-by-stroke character writing practice
- **HSK Level Management**: Filter and organize cards by HSK levels 1-6
- **Study Statistics**: Track progress, review history, and accuracy across all quiz modes
- **Mobile-Responsive UI**: Works seamlessly on desktop and mobile devices

## Tech Stack

### Frontend
- React 19 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- React Router for navigation
- TanStack Query for data fetching
- React Context for authentication

### Backend
- Node.js with Express
- TypeScript
- PostgreSQL database
- Prisma ORM
- JWT authentication
- bcrypt for password hashing

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or pnpm

### Database Setup

1. Install PostgreSQL if you haven't already
2. Create a new database:
```bash
createdb chinese_study
```

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Update the `.env` file with your database credentials:
```
DATABASE_URL="postgresql://user:password@localhost:5432/chinese_study?schema=public"
JWT_SECRET="your-secure-secret-key"
JWT_REFRESH_SECRET="your-secure-refresh-secret"
CORS_ORIGIN="http://localhost:5173"
PORT=3000
```

5. Generate Prisma client and run migrations:
```bash
npm run prisma:generate
npm run prisma:migrate
```

6. Start the development server:
```bash
npm run dev
```

The backend will be running at `http://localhost:3000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. The default configuration should work if your backend is running on port 3000:
```
VITE_API_URL=http://localhost:3000
```

5. Start the development server:
```bash
npm run dev
```

The frontend will be running at `http://localhost:5173`

## Usage

1. Open `http://localhost:5173` in your browser
2. Register a new account
3. Add some vocabulary cards
4. Start studying with the hanzi → pinyin mode
5. Track your progress in the Stats page

## Project Structure

```
chinese-study/
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── contexts/      # React contexts (Auth, etc.)
│   │   ├── lib/          # Utilities and API client
│   │   ├── pages/        # Page components
│   │   ├── types/        # TypeScript type definitions
│   │   └── App.tsx       # Main app component
│   └── package.json
│
├── backend/              # Express backend
│   ├── src/
│   │   ├── controllers/  # Request handlers
│   │   ├── services/     # Business logic
│   │   ├── routes/       # API routes
│   │   ├── middleware/   # Express middleware
│   │   ├── utils/        # Helper functions
│   │   ├── db.ts         # Prisma client
│   │   └── index.ts      # Server entry point
│   ├── prisma/
│   │   └── schema.prisma # Database schema
│   └── package.json
│
└── chinese-study-app-architecture.md  # Full architecture doc
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout

### Cards
- `GET /api/cards` - List cards (with pagination, filters)
- `POST /api/cards` - Create card
- `GET /api/cards/:id` - Get single card
- `PUT /api/cards/:id` - Update card
- `DELETE /api/cards/:id` - Delete card
- `POST /api/cards/bulk` - Bulk import cards
- `GET /api/cards/export` - Export all cards

### Study
- `GET /api/study/due?mode=X` - Get due cards for review
- `GET /api/study/new?mode=X` - Get new cards to learn
- `POST /api/study/review` - Submit review result
- `GET /api/study/stats` - Get study statistics
- `GET /api/study/heatmap` - Get activity heatmap

## Development Roadmap

See `chinese-study-app-architecture.md` for the full roadmap. Phase 1 (MVP) is complete!

### Completed (Phase 1)
- [x] User authentication
- [x] Card CRUD operations
- [x] Basic spaced repetition (SM-2)
- [x] Single quiz mode (hanzi → pinyin)
- [x] Study statistics
- [x] Mobile-responsive UI

### Next Steps (Phase 2+)
- [ ] All 6 quiz modes
- [ ] Hanzi writing practice with Hanzi Writer
- [ ] Offline support (PWA)
- [ ] Enhanced statistics and heatmaps
- [ ] Bulk import (CSV, Anki format)
- [ ] HSK level filtering
- [ ] Audio pronunciations

## Contributing

This is a personal learning project, but suggestions and feedback are welcome!

## License

MIT
