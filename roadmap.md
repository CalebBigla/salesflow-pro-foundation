# SalesFlow Pro — Roadmap

## Phase 0 — Scaffold (done)

- [x] Vite + React + TS + Tailwind design system (navy/slate/accent-blue, 8px, 4 type sizes)
- [x] docs/SCHEMA.md schema plan
- [x] .env.example + .env gitignored
- [x] ESLint + Prettier + README
- [x] Placeholder landing page confirming boot + backend connectivity

## Phase 1 — Auth, tenancy, RBAC (in progress)

- [x] Encode PRD 4.2 permission matrix (supplied as screenshots) in docs/PERMISSIONS.md
- [ ] Tables: tenants, users, user_roles, invitations, products, stock_requests, sales_entries, targets, audit_logs
- [ ] RLS: tenant isolation on every table + per-role action rules from 4.2
- [ ] Onboarding: owner registers -> tenant created -> owner role; owner invites manager; manager invites storekeeper/sales rep
- [ ] Login / Register / Forgot password / Reset password / Accept invite screens
- [ ] Route guard: unauthenticated -> /login; authenticated -> own role dashboard root
- [ ] RLS_TEST_PLAN.md and manual verification of tenant isolation

### Open / blocked

- Session lifetime (8h access / 30d refresh): not settable from here; needs to be set in the
  backend auth settings by a workspace admin. Documented in RLS_TEST_PLAN.md.

## Phase 2 — Operations (not started)

- [ ] Products, stock requests, sales entries, targets, reports, audit log views
