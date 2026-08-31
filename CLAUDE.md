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

### Study session flow
The Study page offers Mastery Mode and Quick Review. Both fetch ordinary card lists through `GET /api/cards` with lesson/folder filters, then manage the session queue entirely in frontend state. Spaced repetition mode and the `/api/study/due`, `/api/study/new`, and `/api/study/review` endpoints have been removed. Legacy Prisma `CardProgress` and `ReviewLog` models may still exist for old data but are not active runtime features.

### Folders
Cards can belong to many folders (`FolderCard` join table). Filter cards or study sessions by `folderId`. Backend uses `folderCards: { some: { folderId } }` in Prisma queries for nested filtering.

### Frontend state
- TanStack Query for all server state (cards, study data, folders, stats)
- `AuthContext` (`frontend/src/contexts/AuthContext.tsx`) manages auth state
- `api` client singleton handles token management

### Radical/phonetic breakdown
`RadicalBreakdown` component (`frontend/src/components/RadicalBreakdown.tsx`) decomposes a hanzi string into its semantic (形旁) and phonetic (声旁) components. It is shown in the Study page result card and the Cards browser grid.

The decomposition logic lives in `frontend/src/lib/hanziDecompose.ts` and uses three static JSON data files in `frontend/src/data/` (no npm dependency — data was extracted once from the `hanzipy` Python library and the `hanzi` npm package):
- `cjk_decomp.json` — character → `string[]` direct components map. Pre-filtered: artifact components appearing fewer than 4 times across the whole dataset AND with no known meaning are removed at build time.
- `radical_with_meanings.json` — ~783 entries: traditional Kangxi radicals + common phonetic/structural components (少, 各, 取, 合, 令, etc.) with English meanings.
- `phonetic_components.json` — 3,393 character → `{ component, pinyin, regularity }` entries identifying phonetic (声旁) components.

**Key decomposition rule**: if a character is itself in `radical_with_meanings.json` (i.e. it's already a known radical/atomic unit — 大, 生, 二, 走, etc.), it is skipped entirely and not decomposed further. This prevents unhelpful breakdowns like 二→一 or 生→stroke primitives. The breakdown section is hidden when there is nothing to show.

Component tiles are styled by type: cream border = semantic (形旁), blue border = phonetic (声旁, shows the associated pinyin).

All three data files are lazy-loaded via dynamic `import()`, splitting them into separate chunks (`cjk_decomp` ~147KB gzip, `phonetic_components` ~20KB gzip). Loading kicks off immediately on module import.

To regenerate the data files (only needed if updating source data):
```bash
# 1. Re-download radical_with_meanings.json base from hanzipy, then manually re-apply extensions
curl https://raw.githubusercontent.com/Synkied/hanzipy/master/hanzipy/data/radical_with_meanings.json > /tmp/base_meanings.json
# See /tmp/build_extended_meanings.mjs for the curation script

# 2. Re-convert cjk_decomp.txt from hanzipy, apply frequency filter (threshold=4)
curl https://raw.githubusercontent.com/Synkied/hanzipy/master/hanzipy/data/cjk_decomp.txt > /tmp/cjk_decomp.txt
# See /tmp/convert_cjk_decomp.mjs for the conversion script

# 3. Rebuild phonetic_components.json (requires hanzi npm package temporarily)
cd frontend && npm install hanzi
# Extract phonetic_sets_regularity_one/two from hanzi/lib/data/ and build reverse lookup
npm uninstall hanzi
```

## Key patterns

- `req.params.id as string` — needed due to Express 5 type issue where params can be `string | string[]`
- Backend uses ES modules (`"type": "module"`) — imports require `.js` extensions even for `.ts` files
- Prisma migrations live in `backend/prisma/migrations/`; never edit migration files directly
- Card fields `textbookPart` and `lessonNumber` are for textbook-based filtering alongside HSK levels
