-- Atomic fulfilment of a stock request: validates tenant + role, locks rows,
-- checks stock, deducts, marks fulfilled. No client-side read-then-write.
CREATE OR REPLACE FUNCTION public.fulfil_stock_request(_request_id uuid)
RETURNS public.stock_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.stock_requests;
  _prod public.products;
  _tenant uuid := public.current_tenant_id();
  _actor uuid := public.current_profile_id();
BEGIN
  IF _tenant IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.current_can_manage_stock() THEN
    RAISE EXCEPTION 'Not permitted to fulfil stock requests';
  END IF;

  SELECT * INTO _req FROM public.stock_requests
    WHERE id = _request_id AND tenant_id = _tenant FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock request not found';
  END IF;
  IF _req.status <> 'pending' THEN
    RAISE EXCEPTION 'Stock request is already %', _req.status;
  END IF;

  SELECT * INTO _prod FROM public.products
    WHERE id = _req.product_id AND tenant_id = _tenant FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  IF _prod.stock_on_hand < _req.quantity THEN
    RAISE EXCEPTION 'Insufficient stock: % available, % requested', _prod.stock_on_hand, _req.quantity;
  END IF;

  UPDATE public.products
     SET stock_on_hand = stock_on_hand - _req.quantity
   WHERE id = _prod.id;

  UPDATE public.stock_requests
     SET status = 'fulfilled', reviewed_by = _actor, reviewed_at = now()
   WHERE id = _req.id
  RETURNING * INTO _req;

  RETURN _req;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_stock_request(_request_id uuid, _note text DEFAULT NULL)
RETURNS public.stock_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.stock_requests;
  _tenant uuid := public.current_tenant_id();
  _actor uuid := public.current_profile_id();
BEGIN
  IF _tenant IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.current_can_manage_stock() THEN
    RAISE EXCEPTION 'Not permitted to review stock requests';
  END IF;

  SELECT * INTO _req FROM public.stock_requests
    WHERE id = _request_id AND tenant_id = _tenant FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock request not found';
  END IF;
  IF _req.status <> 'pending' THEN
    RAISE EXCEPTION 'Stock request is already %', _req.status;
  END IF;

  UPDATE public.stock_requests
     SET status = 'rejected', reviewed_by = _actor, reviewed_at = now(),
         note = COALESCE(_note, note)
   WHERE id = _req.id
  RETURNING * INTO _req;

  RETURN _req;
END;
$$;

REVOKE ALL ON FUNCTION public.fulfil_stock_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_stock_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfil_stock_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_stock_request(uuid, text) TO authenticated;

-- Audit every stock create/update/fulfil/reject, server-side.
CREATE OR REPLACE FUNCTION public.audit_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    NEW.tenant_id,
    public.current_profile_id(),
    CASE WHEN TG_OP = 'INSERT' THEN 'product.created' ELSE 'product.updated' END,
    'product',
    NEW.id,
    jsonb_strip_nulls(jsonb_build_object(
      'sku', NEW.sku,
      'name', NEW.name,
      'stock_on_hand', NEW.stock_on_hand,
      'previous_stock_on_hand', CASE WHEN TG_OP = 'UPDATE' THEN OLD.stock_on_hand END
    ))
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_stock_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    NEW.tenant_id,
    public.current_profile_id(),
    CASE
      WHEN TG_OP = 'INSERT' THEN 'stock_request.created'
      WHEN NEW.status = 'fulfilled' THEN 'stock_request.fulfilled'
      WHEN NEW.status = 'rejected' THEN 'stock_request.rejected'
      ELSE 'stock_request.updated'
    END,
    'stock_request',
    NEW.id,
    jsonb_strip_nulls(jsonb_build_object(
      'product_id', NEW.product_id,
      'quantity', NEW.quantity,
      'status', NEW.status,
      'requested_by', NEW.requested_by,
      'reviewed_by', NEW.reviewed_by
    ))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_audit ON public.products;
CREATE TRIGGER products_audit
AFTER INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.audit_products();

DROP TRIGGER IF EXISTS stock_requests_audit ON public.stock_requests;
CREATE TRIGGER stock_requests_audit
AFTER INSERT OR UPDATE ON public.stock_requests
FOR EACH ROW EXECUTE FUNCTION public.audit_stock_requests();

CREATE INDEX IF NOT EXISTS stock_requests_tenant_status_created_idx
  ON public.stock_requests (tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS products_tenant_name_idx
  ON public.products (tenant_id, name);
