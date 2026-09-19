import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createStockRequest, listProducts, listStockRequests } from "@/lib/stock.functions";

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

const statusLabels: Record<string, string> = {
  pending: "Waiting for approval",
  fulfilled: "Approved",
  rejected: "Rejected",
};

export function StockRequestForm() {
  const queryClient = useQueryClient();
  const fetchProducts = useServerFn(listProducts);
  const fetchRequests = useServerFn(listStockRequests);
  const submitRequest = useServerFn(createStockRequest);

  const products = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const requests = useQuery({ queryKey: ["stock-requests"], queryFn: () => fetchRequests() });

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const create = useMutation({
    mutationFn: async () =>
      submitRequest({
        data: {
          productId,
          quantity: Number(quantity),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      }),
    onMutate: () => {
      setFormError(null);
      setSent(false);
    },
    onError: (error) =>
      setFormError(error instanceof Error ? error.message : "Could not send the request"),
    onSuccess: () => {
      setProductId("");
      setQuantity("1");
      setNote("");
      setSent(true);
      void queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
    },
  });

  const mine = (requests.data ?? []).slice().reverse();

  return (
    <>
      <Panel title="Request stock" subtitle="A storekeeper or manager approves before stock moves.">
        {products.isPending ? (
          <p className="text-caption text-muted-foreground">Loading products…</p>
        ) : (products.data ?? []).length === 0 ? (
          <p className="text-caption text-muted-foreground">
            No products have been added to the catalogue yet.
          </p>
        ) : (
          <form
            className="grid gap-2 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <label className="text-caption text-muted-foreground">
              Product
              <select
                required
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="text-body mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-foreground"
              >
                <option value="">Choose a product…</option>
                {(products.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.stockOnHand} {p.unit} in stock)
                  </option>
                ))}
              </select>
            </label>
            <label className="text-caption text-muted-foreground">
              Quantity
              <input
                required
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="text-body mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-foreground"
              />
            </label>
            <label className="text-caption text-muted-foreground sm:col-span-2">
              Note (optional)
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                className="text-body mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-foreground"
              />
            </label>
            <div className="flex items-end">
              <button
                disabled={create.isPending}
                className="text-caption rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground disabled:opacity-50"
              >
                {create.isPending ? "Sending…" : "Send request"}
              </button>
            </div>
          </form>
        )}
        {formError && <p className="text-caption mt-2 text-destructive">{formError}</p>}
        {sent && <p className="text-caption mt-2 text-success">Request sent for approval.</p>}
      </Panel>

      <Panel title="My stock requests">
        {requests.isPending ? (
          <p className="text-caption text-muted-foreground">Loading your requests…</p>
        ) : mine.length === 0 ? (
          <p className="text-caption text-muted-foreground">
            You haven&apos;t requested stock yet.
          </p>
        ) : (
          <ul className="grid gap-2">
            {mine.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2"
              >
                <div>
                  <p className="text-body text-card-foreground">
                    {r.quantity} {r.unit} · {r.productName}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()}
                    {r.note ? ` · “${r.note}”` : ""}
                  </p>
                </div>
                <p
                  className={`text-caption font-medium ${
                    r.status === "fulfilled"
                      ? "text-success"
                      : r.status === "rejected"
                        ? "text-destructive"
                        : "text-warning"
                  }`}
                >
                  {statusLabels[r.status] ?? r.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Inventory" subtitle="Read only — stock is changed by storekeepers.">
        {products.isPending ? (
          <p className="text-caption text-muted-foreground">Loading stock…</p>
        ) : (products.data ?? []).length === 0 ? (
          <p className="text-caption text-muted-foreground">No products yet.</p>
        ) : (
          <ul className="grid gap-1">
            {(products.data ?? []).map((p) => (
              <li key={p.id} className="text-caption flex justify-between text-muted-foreground">
                <span>{p.name}</span>
                <span
                  className={
                    p.stockOnHand === 0
                      ? "text-destructive font-medium"
                      : p.lowStock
                        ? "text-warning font-medium"
                        : ""
                  }
                >
                  {p.stockOnHand} {p.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
