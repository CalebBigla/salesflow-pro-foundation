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
| status       | text        | NOT NULL, default `'invited'`             |
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
| created_at   | timestamptz   | NOT NULL                                     |
| updated_at   | timestamptz   | NOT NULL                                     |

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

## Planned indexes

- `tenant_id` on every tenant-scoped table
- `products (tenant_id, sku)` unique
- `sales_entries (tenant_id, sold_at)`
- `stock_requests (tenant_id, status)`
- `audit_logs (tenant_id, created_at desc)`

## Deferred to Phase 1

- Row Level Security policies and table grants
- `user_roles` table and `has_role()` security-definer function
- Tenant provisioning + invite flow
