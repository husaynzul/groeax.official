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
- Routes: `auth`, `payment`, `ai`, `news`, `chart`, `broker`, `mt5`, `intelligence`, `tradingSignal`, `marketIntelligence`
- WebSocket servers: `/api/ws/candles`, `/api/ws/mt5`, `/api/ws/app`

## Authentication System

JWT-based auth backed by PostgreSQL.

- **Signup**: `POST /api/auth/signup` — creates user with plan="silver", returns JWT
- **Login**: `POST /api/auth/login` — validates credentials, returns JWT
- **Me**: `GET /api/auth/me` — returns user from JWT
- **Subscribe**: `POST /api/auth/subscribe` — upgrades plan (requires blockchain-verified TX hash for ALL paid plans)
- **Payment Config**: `GET /api/payment/config` — returns wallet address + Binance ID from env vars
- **JWT Secret**: `SESSION_SECRET` env var
- **Token storage**: `groeax_token` in localStorage
- **Auth store**: `artifacts/trading-journal/src/store/authStore.ts`
- **Auth provider**: `artifacts/trading-journal/src/components/auth/AuthProvider.tsx`

## Subscription Plans (3-Tier)

| Plan | DB Value | Price | Features |
|------|----------|-------|---------|
| Silver | `silver` | $0 | Dashboard, Trades, Journal, Analytics, Risk Calc, delayed news feed |
| Platinum | `platinum` | $10/mo · $105/yr | All Silver + real-time news, all categories, basic AI, live chart, broker sync |
| Premium | `premium` | $105/mo · $1050/yr | All Platinum + advanced AI scoring, priority signals, early detection, VIP support |

### Payment Flow
1. User selects Platinum or Premium plan on `/pricing`
2. Frontend fetches wallet address + Binance ID from `GET /api/payment/config` (never hardcoded)
3. User sends exact USDT TRC20 amount to wallet
4. User submits TX hash via payment modal
5. Backend verifies TX on TRON blockchain via TRONSCAN API:
   - TX hash format validation
   - Transaction status (SUCCESS only)
   - Destination wallet match
   - Exact amount match (6 decimal precision)
   - Timestamp within ±30 minutes
6. On success → subscription activated, payment record saved to `payments` table

### Payment Env Vars
- `USDT_TRC20_WALLET` — TRON TRC20 receiving wallet address
- `BINANCE_MERCHANT_ID` — Binance Pay merchant ID
- `SESSION_SECRET` — JWT signing secret

### Backend Middleware (auth.ts)
- `authMiddleware` — validates JWT, loads user plan from DB
- `platinumMiddleware` — requires `platinum` or `premium` plan (all paid features)
- `premiumMiddleware` — requires `premium` plan only (advanced features)
- `optionalAuthMiddleware` — attaches user if token present (global)

## Database Schema (lib/db)

- `conversations` — AI chat sessions
- `messages` — AI chat messages
- `users` — Auth accounts (id, name, email, password_hash, plan, plan_expires_at, created_at)
- `payments` — Payment audit log (user_id, plan, amount, tx_hash, wallet_address, verified, verified_at, verification_error)

## Key Pages

- `/` — Landing page
- `/login` — Login
- `/signup` — Register
- `/pricing` — 3-tier pricing (Silver / Platinum / Premium)
- `/account` — Account & plan status
- `/dashboard` — Main dashboard (protected)
- `/trades`, `/journal`, `/analytics`, `/calculator`, `/news` — Silver features (protected)
- `/ai-coach`, `/intelligence`, `/chart`, `/brokers`, `/positions` — Platinum+ features (protected + gated)

See the `pnpm-workspace` skill for workspace structure and TypeScript setup.
