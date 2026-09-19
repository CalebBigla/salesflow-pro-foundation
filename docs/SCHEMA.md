# SalesFlow Pro — Schema

**Status: applied.** Every table below exists in the database, with row level security
enabled, grants issued to `authenticated` / `service_role`, and the PRD 4.2 role rules
enforced as SQL policies (see `docs/PERMISSIONS.md`). Two tables were added beyond the
Phase 0 plan: `user_roles` and `invitations` (documented at the end of this file).

## Multi-tenancy rule

Every table except `tenants` carries `tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`.
All future RLS policies will be scoped through `tenant_id` plus the caller's `auth.uid()`.
Roles will live in a dedicated `user_roles` table (never on `users`) to avoid privilege escalation.

Shared conventions:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()` (maintained by trigger)

---

## tenants

| Column      | Type        | Notes                          |
| ----------- | ----------- | ------------------------------ |
| id          | uuid        | PK                             |
| name        | text        | NOT NULL                       |
| slug        | text        | NOT NULL, UNIQUE               |
| plan        | text        | NOT NULL, default `'trial'`    |
| status      | text        | NOT NULL, default `'active'`   |
| created_at  | timestamptz | NOT NULL                       |
| updated_at  | timestamptz | NOT NULL                       |

## users

Application profile row mirroring an auth account. `auth_user_id` references the managed
auth user; no foreign key is declared against the auth schema.

| Column       | Type        | Notes                                    |
| ------------ | ----------- | ---------------------------------------- |
| id           | uuid        | PK                                       |
| tenant_id    | uuid        | FK → tenants(id), NOT NULL               |
| auth_user_id | uuid        | NOT NULL, UNIQUE                         |
| email        | text        | NOT NULL                                 |
| full_name    | text        |                                          |
| phone        | text        |                                          |
| status       | text        | NOT NULL, default `'active'`              |
| last_seen_at | timestamptz |                                          |
| created_at   | timestamptz | NOT NULL                                 |
| updated_at   | timestamptz | NOT NULL                                 |

## products

| Column       | Type          | Notes                            |
| ------------ | ------------- | -------------------------------- |
| id           | uuid          | PK                               |
| tenant_id    | uuid          | FK → tenants(id), NOT NULL       |
| sku          | text          | NOT NULL, UNIQUE per tenant      |
| name         | text          | NOT NULL                         |
| category     | text          |                                  |
| unit         | text          | NOT NULL, default `'each'`       |
| unit_price   | numeric(12,2) | NOT NULL, default 0              |
| currency     | text          | NOT NULL, default `'USD'`        |
| stock_on_hand| integer       | NOT NULL, default 0              |
| reorder_level| integer       | NOT NULL, default 0              |
| is_active    | boolean       | NOT NULL, default true           |
| created_at   | timestamptz   | NOT NULL                         |
| updated_at   | timestamptz   | NOT NULL                         |

## stock_requests

| Column          | Type        | Notes                                                    |
| --------------- | ----------- | -------------------------------------------------------- |
| id              | uuid        | PK                                                       |
| tenant_id       | uuid        | FK → tenants(id), NOT NULL                               |
| product_id      | uuid        | FK → products(id), NOT NULL                              |
| requested_by    | uuid        | FK → users(id), NOT NULL                                 |
| quantity        | integer     | NOT NULL, > 0                                            |
| status          | text        | NOT NULL, default `'pending'` (pending/approved/rejected/fulfilled) |
| reviewed_by     | uuid        | FK → users(id)                                           |
| reviewed_at     | timestamptz |                                                          |
| note            | text        |                                                          |
| created_at      | timestamptz | NOT NULL                                                 |
| updated_at      | timestamptz | NOT NULL                                                 |

## sales_entries

| Column        | Type          | Notes                            |
| ------------- | ------------- | -------------------------------- |
| id            | uuid          | PK                               |
| tenant_id     | uuid          | FK → tenants(id), NOT NULL       |
| product_id    | uuid          | FK → products(id), NOT NULL      |
| sold_by       | uuid          | FK → users(id), NOT NULL         |
| quantity      | integer       | NOT NULL, > 0                    |
| unit_price    | numeric(12,2) | NOT NULL                         |
| total_amount  | numeric(12,2) | NOT NULL                         |
| currency      | text          | NOT NULL, default `'USD'`        |
| customer_name | text          |                                  |
| sold_at       | timestamptz   | NOT NULL, default now()          |
| created_at    | timestamptz   | NOT NULL                         |
| updated_at    | timestamptz   | NOT NULL                         |

## targets

| Column       | Type          | Notes                                        |
| ------------ | ------------- | -------------------------------------------- |
| id           | uuid          | PK                                           |
| tenant_id    | uuid          | FK → tenants(id), NOT NULL                   |
| user_id      | uuid          | FK → users(id) — null means a tenant target  |
| period_type  | text          | NOT NULL (`monthly` / `quarterly`)           |
| period_start | date          | NOT NULL                                     |
| period_end   | date          | NOT NULL                                     |
| target_amount| numeric(12,2) | NOT NULL                                     |
| currency     | text          | NOT NULL, default `'USD'`                    |
| status       | text          | NOT NULL, default `'pending'` (pending/approved) |
| created_by   | uuid          | FK → users(id)                               |
| approved_by  | uuid          | FK → users(id)                               |
| approved_at  | timestamptz   |                                              |
| created_at   | timestamptz   | NOT NULL                                     |
| updated_at   | timestamptz   | NOT NULL                                     |

The `targets_enforce_approval()` trigger forces any non-owner write to `pending` and clears
approval fields; only an owner can set a target to `approved`.

## audit_logs

| Column      | Type        | Notes                                       |
| ----------- | ----------- | ------------------------------------------- |
| id          | uuid        | PK                                          |
| tenant_id   | uuid        | FK → tenants(id), NOT NULL                  |
| actor_id    | uuid        | FK → users(id) — null for system actions    |
| action      | text        | NOT NULL (e.g. `stock_request.approved`)    |
| entity_type | text        | NOT NULL                                    |
| entity_id   | uuid        |                                             |
| metadata    | jsonb       | NOT NULL, default `'{}'`                    |
| ip_address  | inet        |                                             |
| created_at  | timestamptz | NOT NULL                                    |

---

## user_roles

Roles live here, never on `users` (see `docs/PERMISSIONS.md` for why).

| Column    | Type        | Notes                                        |
| --------- | ----------- | -------------------------------------------- |
| id        | uuid        | PK                                           |
| tenant_id | uuid        | FK → tenants(id), NOT NULL                   |
| user_id   | uuid        | FK → users(id) ON DELETE CASCADE, NOT NULL   |
| role      | app_role    | NOT NULL (`owner`/`manager`/`storekeeper`/`sales_rep`) |
| created_at| timestamptz | NOT NULL                                     |

`UNIQUE (user_id, role)`. Read by the `has_role()` security-definer function.

## invitations

| Column      | Type        | Notes                                        |
| ----------- | ----------- | -------------------------------------------- |
| id          | uuid        | PK                                           |
| tenant_id   | uuid        | FK → tenants(id), NOT NULL                   |
| email       | text        | NOT NULL                                     |
| role        | app_role    | NOT NULL                                     |
| token       | text        | NOT NULL, UNIQUE                             |
| invited_by  | uuid        | FK → users(id) ON DELETE SET NULL            |
| expires_at  | timestamptz | NOT NULL, default `now() + 14 days`          |
| accepted_at | timestamptz | null until the invite is used                |
| created_at  | timestamptz | NOT NULL                                     |
| updated_at  | timestamptz | NOT NULL                                     |

## Indexes (applied)

- `tenant_id` on every tenant-scoped table
- `products (tenant_id, sku)` unique
- `sales_entries (tenant_id, sold_at)`
- `stock_requests (tenant_id, status)`
- `audit_logs (tenant_id, created_at desc)`

## Phase 1 items (applied)

- Row Level Security policies and table grants on every table
- `user_roles` table and `has_role()` / `current_has_role()` security-definer functions
- Tenant provisioning + invite flow (see `src/lib/auth.functions.ts`)

## Phase 2 — stock module (applied)

- `fulfil_stock_request(_request_id uuid)` — security definer. Locks the request row and the
  product row (`for update`), checks tenant + caller permission (`current_can_manage_stock()`),
  refuses if the request is not pending or stock is insufficient, deducts
  `products.stock_on_hand`, sets `status = 'fulfilled'`, `reviewed_by`, `reviewed_at`, and writes
  an `audit_logs` row — all in one transaction, so concurrent approvals cannot oversell.
- `reject_stock_request(_request_id uuid, _note text)` — same locking and checks, sets
  `status = 'rejected'` and audits; stock is untouched.
- `audit_products()` / `audit_stock_requests()` triggers write an `audit_logs` row on every
  product create/update and stock request create/update.
- Low-stock flagging is derived, not stored: `stock_on_hand <= reorder_level` (amber) and
  `stock_on_hand = 0` (red) in the storekeeper's stock list.
