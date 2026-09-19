# SalesFlow Pro — Roadmap

## Phase 0 — Scaffold (done)

- [x] Vite + React + TS + Tailwind design system (navy/slate/accent-blue, 8px, 4 type sizes)
- [x] docs/SCHEMA.md schema plan
- [x] .env.example + .env gitignored
- [x] ESLint + Prettier + README
- [x] Placeholder landing page confirming boot + backend connectivity

## Phase 1 — Auth, tenancy, RBAC (done)

- [x] Encode PRD 4.2 permission matrix (supplied as screenshots) in docs/PERMISSIONS.md
- [x] Tables: tenants, users, user_roles, invitations, products, stock_requests, sales_entries, targets, audit_logs
- [x] RLS: tenant isolation on every table + per-role action rules from 4.2
- [x] Onboarding: owner registers -> tenant created -> owner role; owner invites manager; manager invites storekeeper/sales rep
- [x] Login / Register / Forgot password / Reset password / Accept invite screens
- [x] Route guard: unauthenticated -> /login; authenticated -> own role dashboard root
- [x] RLS_TEST_PLAN.md and verification of tenant isolation (two tenants, direct API calls:
      cross-tenant reads return [], cross-tenant writes 403, anonymous reads [])

### Open / blocked

- Session lifetime (8h access / 30d refresh): not settable from here; needs to be set in the
  backend auth settings by a workspace admin. Documented in RLS_TEST_PLAN.md.


## Phase 2 — Operations (in progress)

- [x] Stock module (PRD 6.3 / 7.1): product list, low-stock flagging, stock request lifecycle
      (request -> approve/reject), atomic `fulfil_stock_request()` / `reject_stock_request()` with
      row locks so concurrent approvals cannot oversell, audit_logs entry on every stock action
- [x] Storekeeper dashboard: pending request queue, stock levels, add product
- [x] Sales rep dashboard: request stock, own request history, read-only inventory
- [ ] Sales entries, targets, reports, audit log views
