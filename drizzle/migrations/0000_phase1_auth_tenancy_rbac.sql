-- ============================================================
-- Phase 1: tenancy, profiles, roles, invitations + all RLS
-- ============================================================

CREATE TYPE public.app_role AS ENUM ('owner', 'manager', 'storekeeper', 'sales_rep');

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------- tenants ----------
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'trial',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tenants_touch BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- users (profiles) ----------
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  full_name text,
  phone text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_tenant_idx ON public.users (tenant_id);
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER users_touch BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- user_roles ----------
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
CREATE INDEX user_roles_tenant_idx ON public.user_roles (tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ---------- helper functions (SECURITY DEFINER; bypass RLS) ----------
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.users WHERE auth_user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.current_has_role(_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(public.current_profile_id(), _role)
$$;

CREATE OR REPLACE FUNCTION public.current_is_owner()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.current_has_role('owner') $$;

CREATE OR REPLACE FUNCTION public.current_is_manager_or_owner()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.current_has_role('owner') OR public.current_has_role('manager') $$;

CREATE OR REPLACE FUNCTION public.current_can_manage_stock()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.current_has_role('owner')
      OR public.current_has_role('manager')
      OR public.current_has_role('storekeeper')
$$;

-- ---------- tenants policies ----------
CREATE POLICY tenants_select_own ON public.tenants
  FOR SELECT TO authenticated
  USING (id = public.current_tenant_id());

CREATE POLICY tenants_update_owner ON public.tenants
  FOR UPDATE TO authenticated
  USING (id = public.current_tenant_id() AND public.current_is_owner())
  WITH CHECK (id = public.current_tenant_id() AND public.current_is_owner());

-- ---------- users policies ----------
CREATE POLICY users_select_tenant ON public.users
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY users_update_self_or_admins ON public.users
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (id = public.current_profile_id() OR public.current_is_manager_or_owner())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (id = public.current_profile_id() OR public.current_is_manager_or_owner())
  );

CREATE POLICY users_insert_admins ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_is_manager_or_owner()
  );

-- block moving a profile between tenants
CREATE OR REPLACE FUNCTION public.users_lock_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id <> OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id cannot be changed';
  END IF;
  IF NEW.auth_user_id <> OLD.auth_user_id THEN
    RAISE EXCEPTION 'auth_user_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER users_lock_tenant_trg BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_lock_tenant();

-- ---------- user_roles policies ----------
CREATE POLICY user_roles_select_tenant ON public.user_roles
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- Owner may grant any role; manager may only grant storekeeper / sales_rep
CREATE POLICY user_roles_insert_admins ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.current_is_owner()
      OR (public.current_has_role('manager') AND role IN ('storekeeper', 'sales_rep'))
    )
  );

CREATE POLICY user_roles_delete_admins ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.current_is_owner()
      OR (public.current_has_role('manager') AND role IN ('storekeeper', 'sales_rep'))
    )
  );

-- ---------- invitations ----------
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL,
  token text NOT NULL UNIQUE,
  invited_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invitations_tenant_idx ON public.invitations (tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER invitations_touch BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY invitations_select_admins ON public.invitations
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_is_manager_or_owner());

CREATE POLICY invitations_insert_admins ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      (public.current_is_owner() AND role IN ('manager', 'storekeeper', 'sales_rep'))
      OR (public.current_has_role('manager') AND role IN ('storekeeper', 'sales_rep'))
    )
  );

CREATE POLICY invitations_delete_admins ON public.invitations
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_is_manager_or_owner());

-- ---------- products ----------
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sku text NOT NULL,
  name text NOT NULL,
  category text,
  unit text NOT NULL DEFAULT 'each',
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  stock_on_hand integer NOT NULL DEFAULT 0,
  reorder_level integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sku)
);
GRANT SELECT, INSERT, UPDATE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY products_select_tenant ON public.products
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY products_insert_stock_roles ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_can_manage_stock());

CREATE POLICY products_update_stock_roles ON public.products
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_can_manage_stock())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_can_manage_stock());

-- ---------- stock_requests ----------
CREATE TABLE public.stock_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_requests_tenant_status_idx ON public.stock_requests (tenant_id, status);
GRANT SELECT, INSERT, UPDATE ON public.stock_requests TO authenticated;
GRANT ALL ON public.stock_requests TO service_role;
ALTER TABLE public.stock_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER stock_requests_touch BEFORE UPDATE ON public.stock_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY stock_requests_select ON public.stock_requests
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.current_can_manage_stock() OR requested_by = public.current_profile_id())
  );

CREATE POLICY stock_requests_insert_rep ON public.stock_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_has_role('sales_rep')
    AND requested_by = public.current_profile_id()
  );

CREATE POLICY stock_requests_update_stock_roles ON public.stock_requests
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_can_manage_stock())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_can_manage_stock());

-- ---------- sales_entries ----------
CREATE TABLE public.sales_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  sold_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL,
  total_amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  customer_name text,
  sold_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sales_entries_tenant_sold_at_idx ON public.sales_entries (tenant_id, sold_at DESC);
GRANT SELECT, INSERT ON public.sales_entries TO authenticated;
GRANT ALL ON public.sales_entries TO service_role;
ALTER TABLE public.sales_entries ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER sales_entries_touch BEFORE UPDATE ON public.sales_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY sales_entries_select ON public.sales_entries
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.current_is_manager_or_owner() OR sold_by = public.current_profile_id())
  );

CREATE POLICY sales_entries_insert_rep ON public.sales_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_has_role('sales_rep')
    AND sold_by = public.current_profile_id()
  );

-- ---------- targets ----------
CREATE TABLE public.targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  period_type text NOT NULL DEFAULT 'monthly',
  period_start date NOT NULL,
  period_end date NOT NULL,
  target_amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX targets_tenant_idx ON public.targets (tenant_id);
GRANT SELECT, INSERT, UPDATE ON public.targets TO authenticated;
GRANT ALL ON public.targets TO service_role;
ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER targets_touch BEFORE UPDATE ON public.targets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Managers may only ever leave a target pending; only the owner may approve.
CREATE OR REPLACE FUNCTION public.targets_enforce_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_is_owner() THEN
    NEW.status := 'pending';
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  ELSIF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status <> 'approved') THEN
    NEW.approved_by := public.current_profile_id();
    NEW.approved_at := now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER targets_approval_trg BEFORE INSERT OR UPDATE ON public.targets
  FOR EACH ROW EXECUTE FUNCTION public.targets_enforce_approval();

CREATE POLICY targets_select ON public.targets
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.current_is_manager_or_owner() OR user_id = public.current_profile_id())
  );

CREATE POLICY targets_insert_admins ON public.targets
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_is_manager_or_owner());

CREATE POLICY targets_update_admins ON public.targets
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_is_manager_or_owner())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_is_manager_or_owner());

-- ---------- audit_logs ----------
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_tenant_created_idx ON public.audit_logs (tenant_id, created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_select_admins ON public.audit_logs
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_is_manager_or_owner());

CREATE POLICY audit_logs_insert_tenant ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
