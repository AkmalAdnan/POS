import { useEffect, useMemo, useState } from "react";
import { api, money } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Printer, Utensils } from "lucide-react";

const DEPTS = ["All", "Main Kitchen", "Chinese Counter", "Sweets / Dessert", "Beverage Counter"];

const ST_COLOR = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  ready: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

export default function ChefKDS() {
  const [bills, setBills] = useState([]);
  const [dept, setDept] = useState("All");

  const load = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await api.get("/bills", { params: { date: today } });
    setBills(data.filter((b) => b.status !== "cancelled"));
  };
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, []);

  const setChef = async (billId, itemId, status) => {
    try {
      const { data } = await api.put(`/bills/${billId}/items/${itemId}/chef`, { chef_status: status });
      setBills((prev) => prev.map((b) => (b.id === billId ? data : b)));
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  // Flatten sent items and filter by department
  const cards = useMemo(() => {
    const list = [];
    for (const b of bills) {
      const sentItems = (b.items || []).filter((i) => i.sent_to_kitchen);
      // group by batch
      const batches = {};
      sentItems.forEach((i) => {
        if (dept !== "All" && i.department !== dept) return;
        (batches[i.kot_batch] = batches[i.kot_batch] || []).push(i);
      });
      Object.entries(batches).forEach(([batchNum, items]) => {
        const pendingCount = items.filter((i) => i.chef_status === "pending").length;
        const batchMeta = (b.kot_batches || []).find((x) => x.number === Number(batchNum));
        list.push({
          key: `${b.id}-${batchNum}`,
          billId: b.id,
          bill_number: b.bill_number,
          table_name: b.table_name,
          batch: Number(batchNum),
          sent_at: batchMeta?.sent_at || b.created_at,
          items,
          pending: pendingCount,
        });
      });
    }
    // keep active batches (has at least one pending or ready-but-not-served)
    return list
      .filter((c) => c.items.some((i) => i.chef_status !== "cancelled"))
      .sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
  }, [bills, dept]);

  return (
    <AppShell>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl">Kitchen Display</h1>
          <p className="text-sm text-brand-900/60 mt-1">Tick ✓ to mark item ready · ✗ to cancel. Live every 4s.</p>
        </div>
        <div className="flex flex-wrap gap-1 bg-white border border-earth-border rounded-xl p-1">
          {DEPTS.map((d) => (
            <button
              key={d}
              onClick={() => setDept(d)}
              className={`px-3 h-10 text-xs uppercase tracking-widest rounded-lg transition-colors ${
                dept === d ? "bg-brand-500 text-white" : "hover:bg-brand-50 text-brand-900"
              }`}
              data-testid={`kds-dept-${d.replace(/\s|\//g, "-")}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="bg-white border border-earth-border rounded-2xl p-14 text-center">
          <Utensils className="w-8 h-8 text-brand-500 mx-auto" />
          <div className="font-heading text-xl text-brand-900 mt-3">All caught up!</div>
          <p className="text-sm text-brand-900/60 mt-1">New orders will appear here as captains send KOTs.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((c) => (
            <article key={c.key} className="bg-white border border-earth-border rounded-2xl p-5 animate-slide-up" data-testid={`kds-card-${c.key}`}>
              <header className="flex items-center justify-between">
                <div>
                  <div className="font-heading text-2xl">#{c.bill_number} · KOT {c.batch}</div>
                  <div className="text-xs text-brand-900/50">Table {c.table_name} · {new Date(c.sent_at).toLocaleTimeString()}</div>
                </div>
                <Badge className="uppercase tracking-widest text-[10px] border bg-brand-50 text-brand-900">
                  {c.pending} pending
                </Badge>
              </header>
              <ul className="mt-4 divide-y divide-earth-border">
                {c.items.map((it) => (
                  <li key={it.id} className="py-3 flex items-start gap-3" data-testid={`kds-item-${it.id}`}>
                    <div className="flex-1">
                      <div className="text-sm"><b>{it.quantity}×</b> {it.name}</div>
                      <div className="text-[11px] uppercase tracking-widest text-brand-500 mt-0.5">{it.department}</div>
                      {it.notes && <div className="text-xs text-brand-900/60 italic mt-0.5">Note: {it.notes}</div>}
                      <Badge className={`mt-1 text-[9px] uppercase ${ST_COLOR[it.chef_status]}`}>{it.chef_status}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant={it.chef_status === "ready" ? "default" : "outline"}
                        className={it.chef_status === "ready" ? "bg-emerald-500 hover:bg-emerald-600 text-white h-9 w-9" : "h-9 w-9"}
                        title="Mark ready"
                        onClick={() => setChef(c.billId, it.id, it.chef_status === "ready" ? "pending" : "ready")}
                        data-testid={`kds-tick-${it.id}`}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant={it.chef_status === "cancelled" ? "default" : "outline"}
                        className={it.chef_status === "cancelled" ? "bg-red-500 hover:bg-red-600 text-white h-9 w-9" : "h-9 w-9"}
                        title="Cancel"
                        onClick={() => setChef(c.billId, it.id, it.chef_status === "cancelled" ? "pending" : "cancelled")}
                        data-testid={`kds-cross-${it.id}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-right">
                <button onClick={() => window.open(`/print/kot/${c.billId}?batch=${c.batch}`, "_blank")} className="text-xs text-brand-500 hover:underline inline-flex items-center gap-1">
                  <Printer className="w-3 h-3" /> Reprint KOT
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
