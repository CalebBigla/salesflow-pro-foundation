# Permission Matrix (PRD Section 4.2)

Role hierarchy: **Owner > Manager > Storekeeper / Sales Representative**.
Transcribed verbatim from PRD 4.2. Nothing beyond this list is granted.

| Permission / Feature      | Owner | Manager           | Storekeeper | Sales Rep |
| ------------------------- | ----- | ----------------- | ----------- | --------- |
| View all dashboards       | ✔     | ✔                 | ✘           | ✘         |
| View own dashboard        | ✔     | ✔                 | ✔           | ✔         |
| Set monthly targets       | ✔     | ✔ (with approval) | ✘           | ✘         |
| Create/manage users       | ✔     | ✔ (own team)      | ✘           | ✘         |
| View inventory levels     | ✔     | ✔                 | ✔           | View only |
| Add / update stock        | ✔     | ✔                 | ✔           | ✘         |
| Approve stock requests    | ✔     | ✔                 | ✔           | ✘         |
| Submit stock request      | ✘     | ✘                 | ✘           | ✔         |
| Record daily sale         | ✘     | ✘                 | ✘           | ✔         |
| View all sales reps' sales| ✔     | ✔                 | ✘           | ✘         |
| View own sales only       | ✔     | ✔                 | ✘           | ✔         |
| Generate/export reports   | ✔     | ✔                 | Stock only  | Own only  |
| Configure business settings| ✔    | ✘                 | ✘           | ✘         |
| Manage product catalogue  | ✔     | ✔                 | ✔           | ✘         |
| View audit logs           | ✔     | ✔                 | ✘           | ✘         |

## How each row is enforced in SQL

| Permission | Enforcement |
| --- | --- |
| View all dashboards / all reps' sales | `sales_entries` SELECT policy allows owner/manager tenant-wide |
| View own dashboard / own sales | `sales_entries` SELECT also allows `sold_by = current_profile_id()` (sales rep) |
| Set monthly targets | `targets` INSERT/UPDATE limited to owner/manager; trigger forces manager rows to `status = 'pending'` and only owner may set `approved` |
| Create/manage users | `users` + `user_roles` + `invitations` write policies: owner tenant-wide, manager restricted to own team and to granting only `storekeeper` / `sales_rep` |
| View inventory levels | `products` SELECT allowed to every role in the tenant |
| Add / update stock, manage catalogue | `products` INSERT/UPDATE limited to owner/manager/storekeeper |
| Approve stock requests | `stock_requests` UPDATE limited to owner/manager/storekeeper |
| Submit stock request | `stock_requests` INSERT limited to `sales_rep` with `requested_by = current_profile_id()` |
| Record daily sale | `sales_entries` INSERT limited to `sales_rep` with `sold_by = current_profile_id()` |
| Generate/export reports | Derived from the SELECT policies above — a storekeeper can only read stock data, a rep only their own rows |
| Configure business settings | `tenants` UPDATE limited to owner |
| View audit logs | `audit_logs` SELECT limited to owner/manager |

Tenant isolation is a separate, unconditional layer: every policy on every table also
requires `tenant_id = public.current_tenant_id()`.

## Deviation from the PRD wording

The PRD describes `users.role` as an enum column. Roles are instead stored in a dedicated
`user_roles` table using the same `app_role` enum. A role column on a self-editable profile
row lets any user promote themselves to owner with a single update; the separate table is
written only by owner/manager policies and read by a `SECURITY DEFINER` helper. Behaviour and
role names are identical.
