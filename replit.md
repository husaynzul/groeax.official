# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (`lib/db`)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild
- **Frontend**: React + Vite + Wouter + Tailwind v4 + Framer Motion + Zustand

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Artifacts

### Trading Journal (`artifacts/trading-journal`)
- React + Vite SPA mounted at `/`
- Zustand stores: `tradeStore`, `authStore`, `brokerStore`, `mt5Store`
- Local persistence: IndexedDB (`GroeaxDB`) + localStorage fallback

### API Server (`artifacts/api-server`)
- Express 5 REST API mounted at `/api`
- Routes: `auth`, `ai`, `news`, `chart`, `broker`, `mt5`, `intelligence`, `tradingSignal`, `marketIntelligence`
- WebSocket servers: `/api/ws/candles`, `/api/ws/mt5`, `/api/ws/app`

## Authentication System

JWT-based auth backed by PostgreSQL.

- **Signup**: `POST /api/auth/signup` — creates user, returns JWT
- **Login**: `POST /api/auth/login` — validates credentials, returns JWT
- **Me**: `GET /api/auth/me` — returns user from JWT
- **Subscribe**: `POST /api/auth/subscribe` — upgrades plan (monthly/yearly)
- **JWT Secret**: `SESSION_SECRET` env var
- **Token storage**: `groeax_token` in localStorage
- **Auth store**: `artifacts/trading-journal/src/store/authStore.ts`
- **Auth provider**: `artifacts/trading-journal/src/components/auth/AuthProvider.tsx`

## Subscription Plans

| Plan | Price | Features |
|------|-------|---------|
| Free | $0 | Dashboard, Trades, Journal, Analytics, Risk Calc, Market News |
| Monthly | $7/mo | All free features + AI Coach, Intelligence, Live Chart, Broker Sync, Positions |
| Yearly | $95/yr | All premium features (saves 32%) |

- Premium gate component: `artifacts/trading-journal/src/components/auth/PremiumGate.tsx`
- Upgrade banner shown in sidebar for free users
- Crown icon shown on locked nav items

## Database Schema (lib/db)

- `conversations` — AI chat sessions
- `messages` — AI chat messages
- `users` — Auth accounts (id, name, email, password_hash, plan, plan_expires_at, created_at)

## Key Pages

- `/` — Landing page
- `/login` — Login
- `/signup` — Register
- `/pricing` — Pricing ($7/mo · $95/yr)
- `/dashboard` — Main dashboard (protected)
- `/trades`, `/journal`, `/analytics`, `/calculator`, `/news` — Free features (protected)
- `/ai-coach`, `/intelligence`, `/chart`, `/brokers`, `/positions` — Premium features (protected + gated)

See the `pnpm-workspace` skill for workspace structure and TypeScript setup.
