# MysteryAI — The AI Mystery Room

Single-player AI-assisted mystery game built with Next.js (App Router),
TypeScript, Tailwind CSS, Prisma + Neon PostgreSQL, and the Gemini API
behind a provider-independent adapter.

**Spec:** see [`spec.md`](./spec.md) — the single source of truth (v0.3,
decisions D1–D11, roadmap phases P0–P8). This repository is currently at
**phase P1 — project setup**.

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **React 19**
- **Tailwind CSS 4** (PostCSS) for the cinematic-noir theme (spec §8.1)
- **Prisma** + **Neon PostgreSQL** (database initialized in phase P2)
- **NextAuth** credentials sessions + **bcryptjs** (auth in phase P2)
- **Gemini API** via plain-`fetch` adapter (phase P4)
- **Zod** validation, **Vitest** + **Playwright** testing

## Scripts

| Command                           | Purpose                                      |
| --------------------------------- | -------------------------------------------- |
| `npm run dev`                     | Start the dev server (http://localhost:3000) |
| `npm run build`                   | Production build                             |
| `npm start`                       | Serve the production build                   |
| `npm run lint`                    | ESLint                                       |
| `npm run typecheck`               | TypeScript (`tsc --noEmit`)                  |
| `npm run format` / `format:check` | Prettier write/check                         |

## Environment

Copy `.env.example` to `.env` and fill in real values. Real secrets are
never committed (`.env*` is git-ignored except the template). See spec §5.5
for the full variable list.

## Health check

`GET /api/health` returns `{ok, db, aiProvider, version}` (spec §7.8).
During P1 `db` reports `not_configured` (DB lands in P2) and `aiProvider`
reports `disabled` (Gemini lands in P4).

## Layout

```
app/          App Router pages + API routes (health check in P1)
components/   Shared UI components
lib/          Server/util code (Prisma client, AI adapter, scoring)
prisma/       Prisma schema + migrations (from P2)
tests/        Vitest unit + Playwright E2E tests (from P3+)
spec.md       Product & technical specification (source of truth)
```
