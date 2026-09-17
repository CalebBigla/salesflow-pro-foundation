# RLS_TEST_PLAN.md — manual verification of tenant isolation and role rules

Authorization lives entirely in database policies (see `docs/PERMISSIONS.md`). This plan verifies
it at the API layer, not just through the UI — a UI-only check proves nothing, because the browser
can call the Data API directly.

## 0. What you need

- The app URL (preview or published).
- Two email addresses you can receive mail at, e.g. `owner-a@example.com`, `owner-b@example.com`,
  plus two more for invited members.
- The public API base URL and publishable key from `.env` (`VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`). These are safe to use in a terminal; never use a secret key.

## 1. Create two independent tenants

1. Open `/register`. Register **Tenant A**: business name `Alpha Traders`, owner `owner-a@example.com`.
2. Confirm the email if prompted, then sign in. Expect to land on `/owner`.
3. Repeat in a fresh browser profile (or after signing out) for **Tenant B**: `Beta Supplies`,
   owner `owner-b@example.com`.

**Pass:** each owner sees their own business name in the header and only their own workspace.

## 2. Populate distinguishable data

As Tenant A's owner, go to **Team → Invite someone**, invite a Manager, and copy the invite link.
Open it in a fresh browser profile, register the manager, and confirm the manager lands on
`/manager` and can invite a Storekeeper and a Sales Representative — but **not** another Manager
(that option must not appear, and the database rejects it even if forced).

Do the same for Tenant B with different names, so rows are easy to tell apart.

## 3. Capture an access token per tenant

Sign in as each user in the browser, open DevTools → Application → Local Storage, and copy the
`access_token` from the `sb-*-auth-token` entry. Call it `TOKEN_A` and `TOKEN_B`.

## 4. The isolation test (direct API calls)

Run for each table: `tenants`, `users`, `user_roles`, `invitations`, `products`,
`stock_requests`, `sales_entries`, `targets`, `audit_logs`.

```bash
BASE="$VITE_SUPABASE_URL/rest/v1"
KEY="$VITE_SUPABASE_PUBLISHABLE_KEY"

# 4a. Read a table as Tenant A
curl -s "$BASE/users?select=id,tenant_id,email" \
  -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN_A"
```

**Pass:** every returned row has Tenant A's `tenant_id`. No Tenant B email ever appears.

```bash
# 4b. Ask explicitly for Tenant B's rows while holding Tenant A's token
curl -s "$BASE/users?select=*&tenant_id=eq.$TENANT_B_ID" \
  -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN_A"
```

**Pass:** `[]` — an empty list, not an error page and never Tenant B's rows.

```bash
# 4c. Try to write into Tenant B
curl -s -X POST "$BASE/products" \
  -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d "{\"tenant_id\":\"$TENANT_B_ID\",\"sku\":\"X1\",\"name\":\"Smuggled\"}"
```

**Pass:** HTTP 403 with a row-level security violation. Then re-run 4a as `TOKEN_B` and confirm
no `Smuggled` product exists.

```bash
# 4d. Anonymous access (no user token at all)
curl -s "$BASE/users?select=*" -H "apikey: $KEY"
```

**Pass:** `[]` or a permission error. Nothing readable without signing in.

## 5. Role rules inside one tenant (all with Tenant A tokens)

| Attempt | Actor | Expected |
| --- | --- | --- |
| `POST /sales_entries` with `sold_by` = self | Sales Rep | 201 created |
| `POST /sales_entries` | Storekeeper or Manager | 403 |
| `POST /sales_entries` with `sold_by` = another rep | Sales Rep | 403 |
| `GET /sales_entries` | Owner / Manager | all reps' rows |
| `GET /sales_entries` | Sales Rep | only own rows |
| `POST /stock_requests` | Sales Rep (for self) | 201 |
| `POST /stock_requests` | Storekeeper | 403 |
| `PATCH /stock_requests?id=eq.…` status | Storekeeper / Manager / Owner | 200 |
| `PATCH /products` stock | Storekeeper / Manager / Owner | 200 |
| `PATCH /products` | Sales Rep | 403 (read-only) |
| `POST /targets` with `status=approved` | Manager | row stored as `pending` |
| `PATCH /targets` to `approved` | Owner | `approved_by` / `approved_at` filled in |
| `PATCH /tenants` (business settings) | Manager | 403 |
| `PATCH /tenants` | Owner | 200 |
| `GET /audit_logs` | Owner / Manager | rows returned |
| `GET /audit_logs` | Storekeeper / Sales Rep | `[]` |
| `POST /user_roles` role `owner` | Manager | 403 |
| `PATCH /users` own row | anyone | 200 |
| `PATCH /users` changing own `tenant_id` | anyone | error: tenant_id cannot be changed |

Record each result. Any mismatch is a policy bug, not a UI bug — fix it in SQL.

## 6. Route guard checks (UI layer, secondary)

- Visit `/owner` while signed out → redirected to `/login`.
- Sign in as a Sales Rep and visit `/owner` → sent to `/sales-rep`.
- Sign out → protected pages are not restorable with the browser Back button.

## Known limitation — session lifetime

The PRD asks for 8-hour access tokens and 30-day refresh tokens. That setting is not adjustable
from this workspace; a workspace administrator must set it in the backend auth settings
(JWT expiry = 28800 seconds, refresh token reuse window / inactivity timeout = 30 days).
Everything else in this plan is enforced in the database today.
