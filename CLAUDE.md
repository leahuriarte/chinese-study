# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (`cd backend`)
```bash
npm run dev           # Start dev server with hot reload (tsx watch)
npm run build         # Generate Prisma client + compile TypeScript
npm run prisma:migrate  # Create and run a new migration (dev)
npm run prisma:deploy   # Deploy migrations (production)
npm run prisma:studio   # Open Prisma Studio GUI
npm run seed:vocab    # Seed vocabulary cards
```

### Frontend (`cd frontend`)
```bash
npm run dev     # Start Vite dev server (http://localhost:5173)
npm run build   # Type-check + build
npm run lint    # Run ESLint
```

### Environment
Backend `.env` requires: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `PORT`
Frontend `.env` requires: `VITE_API_URL` (defaults to `http://localhost:3000`)

Run migrations manually: `cd backend && DATABASE_URL=... ./node_modules/.bin/prisma migrate dev --name <name>`

## Architecture

### Request flow
Frontend (`api` singleton in `frontend/src/lib/api.ts`) → Express routes (`/api/auth`, `/api/cards`, `/api/study`, `/api/folders`) → controllers → services → Prisma ORM → PostgreSQL

Auth uses JWT bearer tokens stored in localStorage. The `auth` middleware (`backend/src/middleware/auth.ts`) attaches `userId` to `AuthRequest` (extends Express `Request`).

### SRS system
Each card has separate `CardProgress` rows per quiz mode (7 modes: `hanzi_to_pinyin`, `pinyin_to_english`, `english_to_hanzi`, `english_to_pinyin`, `pinyin_to_hanzi`, `hanzi_to_english`, plus a stylus/writing mode). The SM-2 algorithm lives in the backend study service. Reviewing a card via `POST /api/study/review` updates `CardProgress` and creates a `ReviewLog`.

### Study session flow
`GET /api/study/due` returns cards where `nextReviewDate <= now` for a given mode. `GET /api/study/new` returns cards with no `CardProgress` record for that mode. The frontend mixes due + new cards into a session queue.

### Folders
Cards can belong to many folders (`FolderCard` join table). Filter cards or study sessions by `folderId`. Backend uses `folderCards: { some: { folderId } }` in Prisma queries for nested filtering.

### Frontend state
- TanStack Query for all server state (cards, study data, folders, stats)
- `AuthContext` (`frontend/src/contexts/AuthContext.tsx`) manages auth state
- `api` client singleton handles token management

### Radical/phonetic breakdown
`RadicalBreakdown` component (`frontend/src/components/RadicalBreakdown.tsx`) decomposes a hanzi string into its semantic (形旁) and phonetic (声旁) components. It is shown in the Study page result card and the Cards browser grid.

The decomposition uses three static JSON data files in `frontend/src/data/` (no npm dependency — data was extracted once from the `hanzipy` Python library and the `hanzi` npm package):
- `cjk_decomp.json` — 27k character → `string[]` components map (direct decomposition)
- `radical_with_meanings.json` — radical character → English meaning
- `phonetic_components.json` — 3,393 character → `{ component, pinyin, regularity }` phonetic entries

All three are lazy-loaded via dynamic `import()` in `frontend/src/lib/hanziDecompose.ts`, splitting them into separate chunks (`cjk_decomp` ~158KB gzip, `phonetic_components` ~20KB gzip). Loading kicks off immediately on module import so data is ready by the time a user reaches a card.

To regenerate the data files (only needed if updating the source data):
```bash
# cjk_decomp.json + radical_with_meanings.json: re-download from hanzipy repo
curl https://raw.githubusercontent.com/Synkied/hanzipy/master/hanzipy/data/radical_with_meanings.json > frontend/src/data/radical_with_meanings.json
# Then run the conversion script (see /tmp/convert_cjk_decomp.mjs for reference)

# phonetic_components.json: requires hanzi npm package temporarily installed
cd frontend && npm install hanzi && node -e "/* see hanziDecompose.ts comments */" && npm uninstall hanzi
```

## Key patterns

- `req.params.id as string` — needed due to Express 5 type issue where params can be `string | string[]`
- Backend uses ES modules (`"type": "module"`) — imports require `.js` extensions even for `.ts` files
- Prisma migrations live in `backend/prisma/migrations/`; never edit migration files directly
- Card fields `textbookPart` and `lessonNumber` are for textbook-based filtering alongside HSK levels
