# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **AI-driven multiplayer board game platform** focused on game teaching, real-time battles, and social features. It supports games like Summoner Wars, Dice Throne, Smash Up, and Tic-Tac-Toe with a custom game engine built on Koa + Socket.IO.

Live at: https://easyboardgame.top

## Development Commands

### Core Development

```bash
npm run dev              # Full stack development (game server + API + frontend with HMR)
npm run dev:lite        # Lite mode without persistent storage (in-memory only)
npm run build           # Production build (frontend only)
npm run build:full      # Full TypeScript compilation + Vite build
```

### Testing

```bash
npm test                # Run all tests once
npm run test:watch     # Watch mode
npm run test:games     # Game-specific tests
npm run test:api       # API tests
npm run test:api:docker # API tests with MongoDB
npm run test:games:core # Core game logic tests
npm run test:games:audit # Audit and property-based tests
npm run test:e2e       # Full E2E suite (Playwright)
npm run test:e2e:dev   # E2E with dev servers
npm run test:e2e:ci    # CI-optimized E2E
npm run test:e2e:critical # Critical path tests
```

### Asset & Build Management

```bash
npm run generate:manifests      # Regenerate game manifests
npm run generate:locales        # Generate card multilingual files
npm run compress:images         # Compress image assets
npm run compress:audio          # Compress audio (wav → ogg)
npm run assets:manifest         # Generate asset manifest
npm run assets:download         # Download resources from Cloudflare R2
npm run assets:upload           # Upload compressed resources to R2
npm run check:arch              # Architecture validation
```

### Audio Registry (Important)

After adding or modifying audio files, execute in order:
```bash
npm run compress:audio
node scripts/audio/generate_common_audio_registry.js
npm run assets:upload
```

Failure to do this will cause new audio to fail playback (missing keys in remote registry.json).

## Architecture Overview

### Monorepo Structure

```
src/
├── games/              # Game implementations (dicethrone, smashup, summonerwars, etc.)
├── engine/             # Custom game engine (Undo, Flow, Prompt, Tutorial, EventStream, Transport)
├── components/         # UI components (auth, game, lobby, review, social, tutorial, system, layout, settings)
├── contexts/           # React Context providers (Auth, Audio, Social, Modal, etc.)
├── services/           # Socket.IO services (lobby, match, social)
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries
├── shared/             # Shared types and constants
├── api/                # Frontend API client
├── server/             # Server-side shared modules (DB, storage, models)
├── ugc/                # User-generated content tools and runtime
├── pages/              # Page components
├── assets/             # Static assets
├── config/             # Configuration files
├── types/              # TypeScript type definitions
├── App.tsx             # Root component
└── main.tsx            # Frontend entry point

apps/api/               # NestJS API service (auth, admin, social)
server/                 # Server infrastructure (logger, middleware)
server.ts               # Game server entry (Koa + Socket.IO)
docker/                 # Docker configuration
scripts/                # Build, deployment, asset processing scripts
docs/                   # Project documentation
e2e/                    # Playwright end-to-end tests
```

### Key Technology Stack

**Frontend:** React 19, TypeScript 5.9, Vite 7.2, Tailwind CSS 4.1, Framer Motion, Three.js, React Router 7, TanStack Query, i18next, Socket.IO Client, Howler.js, Radix UI

**Backend:** Custom Game Engine (Koa + Socket.IO), NestJS 10, MongoDB 6, Redis 7, Winston (logging), JWT, Bcryptjs

**Infrastructure:** Docker, Docker Compose, GitHub Actions CI/CD, Cloudflare Pages/R2, Nginx

### Port Configuration

- Frontend dev server: 5173 (Vite)
- Game server: 18000 (Koa + Socket.IO)
- API server: 18001 (NestJS)
- Docker web: 3000 (Nginx)

## Game Engine Architecture

The custom game engine is the core of this platform. Key systems:

- **Transport Layer** — Socket.IO communication between client and server
- **EventStream** — Immutable event log for game state
- **Flow** — Turn/phase management and action validation
- **Undo System** — Reversible game actions
- **Prompt System** — Player decision prompts (choices, inputs)
- **Tutorial Engine** — Interactive step-by-step guides with AI auto-demo
- **Optimistic Updates** — Client-side prediction for low-latency UX

Games implement domain logic that plugs into this engine. See `src/games/` for examples.

## Adding New Games

The project has an AI-assisted workflow for creating new games (6 stages: skeleton → types → domain logic → system assembly → UI → finalization).

Use the `.windsurf/skills/create-new-game` skill in supported AI editors, or refer to existing game implementations in `src/games/` as templates.

## Testing Strategy

- **Vitest** — Unit/integration tests (2500+ test cases, 99.4% pass rate)
- **GameTestRunner** — Domain-specific test runner (input commands → execute pipeline → assert state)
- **Playwright** — E2E integration tests

Test files use `__tests__` directories or `.test.ts`/`.spec.ts` naming. Separate configs for core logic (`vitest.config.core.ts`) and audit tests (`vitest.config.audit.ts`).

## Code Quality & Git Hooks

**ESLint** — Flat config with TypeScript, React hooks, and custom game domain rules. Relaxed rules for test files.

**Pre-commit hooks** (via simple-git-hooks):
- Pre-commit: ESLint auto-fix
- Pre-push: Full validation (type check, build, i18n check, core tests)

## Environment Setup

Copy `.env.example` to `.env`. Development works with defaults. Key variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_DEV_PORT` | 5173 | Frontend dev port |
| `GAME_SERVER_PORT` | 18000 | Game server port |
| `API_SERVER_PORT` | 18001 | API server port |
| `MONGO_URI` | mongodb://localhost:27017/boardgame (local dev example, must be explicit) | Database |
| `JWT_SECRET` | dev default | JWT key (change in production) |
| `REDIS_HOST` / `REDIS_PORT` | localhost / 6379 | Redis cache |

For production, also configure: Cloudflare R2 credentials, SMTP/email, Sentry DSN, E2E test settings.

## Internationalization (i18n)

The platform supports Chinese and English. Locale files are in `public/locales/`. Use `npm run generate:locales` to regenerate multilingual card data.

## Logging System

Winston-based logging with daily rotation. Separate loggers for game and general operations. Structured logging for debugging. See `docs/logging-system.md` for details.

## Docker Deployment

**Development:**
```bash
docker compose up -d
# Access http://localhost:3000
```

**Production:** Use the deployment script (see README.md for details).

## Important Notes

- **Audio files:** Always compress and regenerate registry after adding/modifying audio
- **Pre-push validation:** Full test suite runs before push; fix failures before committing
- **Game logic:** Implement in domain layer, not UI layer. Use GameTestRunner for testing.
- **Socket.IO:** All real-time communication goes through Transport layer
- **State management:** Use React Context for UI state, EventStream for game state
- **Styling:** Tailwind CSS with custom design system components
- **Type safety:** Strict TypeScript; avoid `any` types
- **⭐ AGENTS.md:** This project has comprehensive AI development guidelines in [AGENTS.md](AGENTS.md). Read it for all development rules, testing requirements, and project-specific conventions.

## Documentation

- **[AGENTS.md](AGENTS.md)** ⭐ **MUST READ** — Complete AI development guidelines, rules, and specifications for this project
- [Architecture visualization](docs/architecture-visual.svg) — SVG diagram of system architecture
- [Architecture design](docs/architecture.md) — Complete technical architecture
- [Deployment guide](docs/deploy.md) — Deployment strategies
- [Frontend framework](docs/framework/frontend.md) — UI framework and component conventions
- [Backend framework](docs/framework/backend.md) — API and game server architecture
- [API documentation](docs/api/README.md) — Auth, social, admin endpoints
- [Automated testing](docs/automated-testing.md) — Test strategy and practices
- [Logging system](docs/logging-system.md) — Logging configuration and usage
