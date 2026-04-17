import { useEffect, useState } from "react";
import { api, money } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Printer } from "lucide-react";

const STATUS_FLOW = { new: "preparing", preparing: "ready", ready: "served" };
const STATUS_COLORS = {
  new: "bg-blue-100 text-blue-800 border-blue-200",
  preparing: "bg-amber-100 text-amber-800 border-amber-200",
  ready: "bg-emerald-100 text-emerald-800 border-emerald-200",
  served: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function KDS() {
  const [orders, setOrders] = useState([]);

  const fetchOrders = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await api.get("/orders", { params: { date: today } });
    setOrders(data);
  };

  useEffect(() => {
    fetchOrders();
    const t = setInterval(fetchOrders, 4000);
    return () => clearInterval(t);
  }, []);

  const advance = async (o) => {
    const next = STATUS_FLOW[o.status];
    if (!next) return;
    try {
      const { data } = await api.put(`/orders/${o.id}/status`, { status: next });
      setOrders((prev) => prev.map((x) => (x.id === o.id ? data : x)));
      toast.success(`Order #${o.order_number} → ${next}`);
    } catch (e) {
      toast.error("Failed to update");
    }
  };

  const active = orders.filter((o) => o.status !== "served" && o.status !== "cancelled");
  const done = orders.filter((o) => o.status === "served");

  return (
    <AppShell>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl">Kitchen Display</h1>
          <p className="text-sm text-brand-900/60 mt-1">Live feed · auto-refresh every 4s</p>
        </div>
        <div className="flex gap-2">
          <span className="inline-flex items-center gap-2 bg-white border border-earth-border rounded-full px-3 py-1 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live
          </span>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="bg-white border border-earth-border rounded-2xl p-14 text-center">
          <div className="font-heading text-xl text-brand-900">All caught up! 🍽️</div>
          <p className="text-sm text-brand-900/60 mt-2">New orders will appear here as staff places them.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {active.map((o) => (
            <article key={o.id} className="bg-white border border-earth-border rounded-2xl p-5 animate-slide-up" data-testid={`kds-card-${o.id}`}>
              <header className="flex items-center justify-between">
                <div>
                  <div className="font-heading text-2xl">#{o.order_number}</div>
                  <div className="text-xs text-brand-900/50">Table {o.table_number || "—"} · {new Date(o.created_at).toLocaleTimeString()}</div>
                </div>
                <Badge className={`uppercase tracking-widest text-[10px] border ${STATUS_COLORS[o.status]}`}>{o.status}</Badge>
              </header>
              <ul className="mt-4 space-y-1">
                {o.items.map((it, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span><span className="font-semibold">{it.quantity}×</span> {it.name}</span>
                    <span className="text-brand-900/50">{money(it.price * it.quantity)}</span>
                  </li>
                ))}
              </ul>
              {o.notes && <div className="mt-3 text-xs bg-brand-50 border border-brand-100 text-brand-900 rounded-md p-2">Note: {o.notes}</div>}
              <div className="mt-4 flex gap-2">
                {STATUS_FLOW[o.status] && (
                  <Button className="flex-1 bg-brand-500 hover:bg-brand-600 text-white" onClick={() => advance(o)} data-testid={`kds-advance-${o.id}`}>
                    Mark {STATUS_FLOW[o.status]}
                  </Button>
                )}
                <Button variant="outline" onClick={() => window.open(`/print/kot/${o.id}`, "_blank")} data-testid={`kds-print-kot-${o.id}`}>
                  <Printer className="w-4 h-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <>
          <h2 className="font-heading text-xl mt-10 mb-3">Served today ({done.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {done.map((o) => (
              <div key={o.id} className="bg-white/60 border border-earth-border rounded-lg px-3 py-2 text-sm flex items-center justify-between">
                <span className="font-medium">#{o.order_number}</span>
                <span className="text-brand-900/50">{money(o.total)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
