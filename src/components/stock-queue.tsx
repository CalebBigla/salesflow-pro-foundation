import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createProduct,
  fulfilStockRequest,
  listProducts,
  listStockRequests,
  rejectStockRequest,
} from "@/lib/stock.functions";

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-3 rounded-lg border border-border bg-card p-3">
      <h2 className="text-heading text-card-foreground">{title}</h2>
      {subtitle && <p className="text-caption mt-1 text-muted-foreground">{subtitle}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function StockQueue() {
  const queryClient = useQueryClient();
  const fetchRequests = useServerFn(listStockRequests);
  const fetchProducts = useServerFn(listProducts);
  const fulfil = useServerFn(fulfilStockRequest);
  const reject = useServerFn(rejectStockRequest);
  const addProduct = useServerFn(createProduct);
  const [actionError, setActionError] = useState<string | null>(null);

  const requests = useQuery({ queryKey: ["stock-requests"], queryFn: () => fetchRequests() });
  const products = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const decide = useMutation({
    mutationFn: async (input: { id: string; approve: boolean }) =>
      input.approve
        ? fulfil({ data: { requestId: input.id } })
        : reject({ data: { requestId: input.id } }),
    onMutate: () => setActionError(null),
    onError: (error) => setActionError(error instanceof Error ? error.message : "Action failed"),
    onSuccess: refresh,
  });

  const [form, setForm] = useState({
    sku: "",
    name: "",
    unit: "each",
    stockOnHand: "0",
    reorderLevel: "0",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () =>
      addProduct({
        data: {
          sku: form.sku,
          name: form.name,
          unit: form.unit,
          stockOnHand: Number(form.stockOnHand),
          reorderLevel: Number(form.reorderLevel),
        },
      }),
    onMutate: () => setFormError(null),
    onError: (error) =>
      setFormError(error instanceof Error ? error.message : "Could not add product"),
    onSuccess: () => {
      setForm({ sku: "", name: "", unit: "each", stockOnHand: "0", reorderLevel: "0" });
      refresh();
    },
  });

  const pending = (requests.data ?? []).filter((r) => r.status === "pending");
  const history = (requests.data ?? [])
    .filter((r) => r.status !== "pending")
    .slice(-10)
    .reverse();

  return (
    <>
      <Panel title="Pending stock requests" subtitle="Oldest requests first.">
        {actionError && <p className="text-caption mb-2 text-destructive">{actionError}</p>}
        {requests.isPending ? (
          <p className="text-caption text-muted-foreground">Loading requests…</p>
        ) : pending.length === 0 ? (
          <p className="text-caption text-muted-foreground">No requests waiting.</p>
        ) : (
          <ul className="grid gap-2">
            {pending.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2"
              >
                <div>
                  <p className="text-body text-card-foreground">
                    {r.quantity} {r.unit} · {r.productName}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {r.requestedBy} · {new Date(r.createdAt).toLocaleString()} · {r.stockOnHand}{" "}
                    {r.unit} in stock
                  </p>
                  {r.note && <p className="text-caption text-muted-foreground">“{r.note}”</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: r.id, approve: true })}
                    className="text-caption rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: r.id, approve: false })}
                    className="text-caption rounded-md border border-border px-3 py-1 font-medium text-foreground disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Stock levels" subtitle="Items at or below their low-stock level are flagged.">
        {products.isPending ? (
          <p className="text-caption text-muted-foreground">Loading stock…</p>
        ) : (products.data ?? []).length === 0 ? (
          <p className="text-caption text-muted-foreground">No products yet.</p>
        ) : (
          <ul className="grid gap-2">
            {(products.data ?? []).map((p) => {
              const critical = p.stockOnHand === 0;
              const tone = critical
                ? "border-destructive bg-destructive/10"
                : p.lowStock
                  ? "border-warning bg-warning/10"
                  : "border-border";
              return (
                <li
                  key={p.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 ${tone}`}
                >
                  <div>
                    <p className="text-body text-card-foreground">{p.name}</p>
                    <p className="text-caption text-muted-foreground">
                      {p.sku} · low-stock level {p.reorderLevel} {p.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-body text-card-foreground">
                      {p.stockOnHand} {p.unit}
                    </p>
                    {(critical || p.lowStock) && (
                      <p
                        className={`text-caption font-medium ${critical ? "text-destructive" : "text-warning"}`}
                      >
                        {critical ? "Out of stock" : "Low stock"}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Add a product">
        <form
          className="grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <label className="text-caption text-muted-foreground">
            Name
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="text-body mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-foreground"
            />
          </label>
          <label className="text-caption text-muted-foreground">
            Code / SKU
            <input
              required
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="text-body mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-foreground"
            />
          </label>
          <label className="text-caption text-muted-foreground">
            Unit
            <input
              required
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="text-body mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-foreground"
            />
          </label>
          <label className="text-caption text-muted-foreground">
            Quantity in stock
            <input
              required
              type="number"
              min={0}
              value={form.stockOnHand}
              onChange={(e) => setForm({ ...form, stockOnHand: e.target.value })}
              className="text-body mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-foreground"
            />
          </label>
          <label className="text-caption text-muted-foreground">
            Low-stock level
            <input
              required
              type="number"
              min={0}
              value={form.reorderLevel}
              onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
              className="text-body mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-foreground"
            />
          </label>
          <div className="flex items-end">
            <button
              disabled={create.isPending}
              className="text-caption rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground disabled:opacity-50"
            >
              {create.isPending ? "Saving…" : "Add product"}
            </button>
          </div>
        </form>
        {formError && <p className="text-caption mt-2 text-destructive">{formError}</p>}
      </Panel>

      {history.length > 0 && (
        <Panel title="Recently decided">
          <ul className="grid gap-1">
            {history.map((r) => (
              <li key={r.id} className="text-caption text-muted-foreground">
                {r.status === "fulfilled" ? "Approved" : "Rejected"} · {r.quantity} {r.unit} ·{" "}
                {r.productName} · {r.requestedBy}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
