# SalesFlow Pro

Multi-tenant sales and inventory management SaaS.

**Status: Phase 0 — scaffolding only.** No feature logic, no database tables, no auth yet.

## Stack

| Layer     | Tech                                                     |
| --------- | -------------------------------------------------------- |
| Frontend  | React 19 + TypeScript + Vite 7 + Tailwind CSS v4         |
| Routing   | TanStack Router (file-based, in `src/routes/`)            |
| Server    | TanStack Start server functions (`createServerFn`)        |
| Backend   | Postgres + Auth + Row Level Security + storage           |
| Tooling   | ESLint (flat config) + Prettier                          |

## Run locally

```bash
bun install        # or: npm install
cp .env.example .env
# fill in the backend URL and public key in .env
bun run dev        # http://localhost:8080
```

## Scripts

| Command             | What it does                          |
| ------------------- | ------------------------------------- |
| `bun run dev`       | Dev server with hot reload            |
| `bun run build`     | Production build                      |
| `bun run preview`   | Serve the production build            |
| `bun run lint`      | ESLint over the whole project         |
| `bun run format`    | Prettier write                        |

## Environment

All config comes from `.env`, which is gitignored. `.env.example` documents the required
keys. Values prefixed `VITE_` are exposed to the browser — only public keys belong there.
The service role key is server-only and must never be committed or imported in client code.

## Project layout

```
docs/SCHEMA.md          Planned database tables (Phase 1 target)
src/routes/             File-based routes; index.tsx is the landing page
src/integrations/       Generated backend client + auth helpers (do not edit)
src/styles.css          Design system: palette, 8px spacing, 4-size type scale
src/components/ui/      Shared UI primitives
```

## Design system

Defined once in `src/styles.css`, consumed through Tailwind utilities:

- **Palette** — navy (surfaces), slate (secondary text/borders), accent blue (actions),
  plus semantic success / warning / danger.
- **Spacing** — 8px base: `p-1` = 8px, `p-2` = 16px, `p-3` = 24px, and so on.
- **Type scale** — four sizes only: `text-caption`, `text-body`, `text-heading`,
  `text-display`.

Components must not hardcode colors. Add a token to `src/styles.css` first.

## Roadmap

- **Phase 0 (done)** — project skeleton, design system, schema plan, tooling, landing page.
- **Phase 1** — auth: sign-up/sign-in, tenant provisioning, `user_roles`, RLS policies.
- **Phase 2** — products, stock requests, sales entries, targets, audit logging.
