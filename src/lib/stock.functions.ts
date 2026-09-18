import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StockProduct = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  stockOnHand: number;
  reorderLevel: number;
  lowStock: boolean;
};

export type StockRequestRow = {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  unit: string;
  stockOnHand: number;
  quantity: number;
  status: string;
  requestedBy: string;
  note: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

/** Products for the caller's tenant, low-stock flag computed server-side. */
export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StockProduct[]> => {
    const { data, error } = await context.supabase
      .from("products")
      .select("id, sku, name, unit, stock_on_hand, reorder_level")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      stockOnHand: p.stock_on_hand,
      reorderLevel: p.reorder_level,
      lowStock: p.stock_on_hand <= p.reorder_level,
    }));
  });

/** Stock requests visible to the caller under RLS, oldest first. */
export const listStockRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StockRequestRow[]> => {
    const { data, error } = await context.supabase
      .from("stock_requests")
      .select(
        "id, product_id, quantity, status, note, created_at, reviewed_at, products(name, sku, unit, stock_on_hand), users!stock_requests_requested_by_fkey(full_name, email)",
      )
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    type Joined = {
      products: { name: string; sku: string; unit: string; stock_on_hand: number } | null;
      users: { full_name: string | null; email: string } | null;
    };
    return (data ?? []).map((r) => {
      const row = r as unknown as Joined;
      return {
        id: r.id,
        productId: r.product_id,
        productName: row.products?.name ?? "Unknown product",
        productSku: row.products?.sku ?? "",
        unit: row.products?.unit ?? "each",
        stockOnHand: row.products?.stock_on_hand ?? 0,
        quantity: r.quantity,
        status: r.status,
        requestedBy: row.users?.full_name ?? row.users?.email ?? "Unknown",
        note: r.note,
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at,
      };
    });
  });

const productInput = z.object({
  sku: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(20),
  stockOnHand: z.number().int().min(0),
  reorderLevel: z.number().int().min(0),
});

/** Adds a product. RLS allows owner / manager / storekeeper only. */
export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => productInput.parse(data))
  .handler(async ({ context, data }) => {
    const { data: profile, error: profileError } = await context.supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_user_id", context.userId)
      .single();
    if (profileError || !profile) throw new Error("Profile not found");
    const { error } = await context.supabase.from("products").insert({
      tenant_id: profile.tenant_id,
      sku: data.sku,
      name: data.name,
      unit: data.unit,
      stock_on_hand: data.stockOnHand,
      reorder_level: data.reorderLevel,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Sales rep submits a stock request; RLS forces requested_by = self. */
export const createStockRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive().max(100000),
        note: z.string().trim().max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { data: profile, error: profileError } = await context.supabase
      .from("users")
      .select("id, tenant_id")
      .eq("auth_user_id", context.userId)
      .single();
    if (profileError || !profile) throw new Error("Profile not found");
    const { error } = await context.supabase.from("stock_requests").insert({
      tenant_id: profile.tenant_id,
      product_id: data.productId,
      requested_by: profile.id,
      quantity: data.quantity,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Approve: one atomic database transaction deducts stock and marks fulfilled. */
export const fulfilStockRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ requestId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("fulfil_stock_request", {
      _request_id: data.requestId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectStockRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ requestId: z.string().uuid(), note: z.string().trim().max(300).optional() })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("reject_stock_request", {
      _request_id: data.requestId,
      _note: data.note ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
