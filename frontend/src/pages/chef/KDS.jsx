import { useEffect, useMemo, useState } from "react";
import { api, money } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Check, X, Utensils, HandPlatter } from "lucide-react";

const DEPTS = ["All", "Main Kitchen", "Chinese Counter", "Sweets / Dessert", "Beverage Counter"];

const ST_COLOR = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  ready: "bg-emerald-100 text-emerald-800 border-emerald-200",
  served: "bg-sky-100 text-sky-800 border-sky-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

const BILL_COLOR = {
  open: "bg-amber-100 text-amber-800 border-amber-200",
  closed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

function fmtTime(iso) { return iso ? new Date(iso).toLocaleTimeString() : "—"; }

export default function ChefKDS() {
  const [bills, setBills] = useState([]);
  const [dept, setDept] = useState("All");

  const load = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await api.get("/bills", { params: { date: today } });
    setBills(data);
  };
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, []);

  const setChef = async (billId, itemId, status) => {
    try {
      const { data } = await api.put(`/bills/${billId}/items/${itemId}/chef`, { chef_status: status });
      setBills((prev) => prev.map((b) => (b.id === billId ? data : b)));
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  // Group by kot batch, filter by department
  const cards = useMemo(() => {
    const list = [];
    for (const b of bills) {
      if (b.status === "cancelled") continue;
      const sentItems = (b.items || []).filter((i) => i.sent_to_kitchen);
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
          billId: b.id, bill_number: b.bill_number, table_name: b.table_name,
          batch: Number(batchNum), sent_at: batchMeta?.sent_at || b.created_at,
          items, pending: pendingCount,
          captain_name: b.captain_name,
        });
      });
    }
    return list
      .filter((c) => c.items.some((i) => i.chef_status !== "cancelled"))
      .sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
  }, [bills, dept]);

  // Bills list for Orders tab
  const running = bills.filter((b) => b.status === "open");
  const closed = bills.filter((b) => b.status === "closed");
  const cancelled = bills.filter((b) => b.status === "cancelled");

  return (
    <AppShell>
      <div>
        <h1 className="font-heading text-3xl md:text-4xl">Kitchen</h1>
        <p className="text-sm text-brand-900/60 mt-1">Mark items ✓ ready · 🍽 served · ✗ cancel. Live every 4s.</p>
      </div>

      <Tabs defaultValue="live" className="mt-5">
        <TabsList className="bg-white border border-earth-border p-1 rounded-xl h-auto">
          <TabsTrigger value="live" className="h-11 px-4 data-[state=active]:bg-brand-500 data-[state=active]:text-white rounded-lg" data-testid="chef-tab-live">Live KDS</TabsTrigger>
          <TabsTrigger value="orders" className="h-11 px-4 data-[state=active]:bg-brand-500 data-[state=active]:text-white rounded-lg" data-testid="chef-tab-orders">Orders</TabsTrigger>
        </TabsList>

        {/* LIVE KDS */}
        <TabsContent value="live" className="mt-4">
          <div className="flex flex-wrap gap-1 bg-white border border-earth-border rounded-xl p-1 w-fit mb-4">
            {DEPTS.map((d) => (
              <button
                key={d}
                onClick={() => setDept(d)}
                className={`px-3 h-10 text-xs uppercase tracking-widest rounded-lg transition-colors ${dept === d ? "bg-brand-500 text-white" : "hover:bg-brand-50 text-brand-900"}`}
                data-testid={`kds-dept-${d.replace(/\s|\//g, "-")}`}
              >
                {d}
              </button>
            ))}
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
                      <div className="text-xs text-brand-900/50">Table {c.table_name} · Captain {c.captain_name}</div>
                      <div className="text-[11px] text-brand-900/50">Received {fmtTime(c.sent_at)}</div>
                    </div>
                    <Badge className="uppercase tracking-widest text-[10px] border bg-brand-50 text-brand-900">{c.pending} pending</Badge>
                  </header>
                  <ul className="mt-4 divide-y divide-earth-border">
                    {c.items.map((it) => (
                      <li key={it.id} className="py-3 flex items-start gap-3" data-testid={`kds-item-${it.id}`}>
                        <div className="flex-1">
                          <div className="text-sm"><b>{it.quantity}×</b> {it.name}</div>
                          <div className="text-[11px] uppercase tracking-widest text-brand-500 mt-0.5">{it.department}</div>
                          {it.notes && <div className="text-xs text-brand-900/60 italic mt-0.5">Note: {it.notes}</div>}
                          <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-brand-900/50">
                            <span>recv {fmtTime(it.received_at || it.sent_at)}</span>
                            {it.ready_at && <span>ready {fmtTime(it.ready_at)}</span>}
                            {it.served_at && <span>served {fmtTime(it.served_at)}</span>}
                          </div>
                          <Badge className={`mt-1 text-[9px] uppercase ${ST_COLOR[it.chef_status]}`}>{it.chef_status}</Badge>
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-1">
                            <Button size="icon" variant={it.chef_status === "ready" ? "default" : "outline"} className={it.chef_status === "ready" ? "bg-emerald-500 hover:bg-emerald-600 text-white h-8 w-8" : "h-8 w-8"} title="Mark ready" onClick={() => setChef(c.billId, it.id, it.chef_status === "ready" ? "pending" : "ready")} data-testid={`kds-tick-${it.id}`}>
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant={it.chef_status === "cancelled" ? "default" : "outline"} className={it.chef_status === "cancelled" ? "bg-red-500 hover:bg-red-600 text-white h-8 w-8" : "h-8 w-8"} title="Cancel" onClick={() => setChef(c.billId, it.id, it.chef_status === "cancelled" ? "pending" : "cancelled")} data-testid={`kds-cross-${it.id}`}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          <Button size="sm" variant={it.chef_status === "served" ? "default" : "outline"} className={it.chef_status === "served" ? "bg-sky-600 hover:bg-sky-700 text-white h-8 text-[11px]" : "h-8 text-[11px]"} title="Mark served" onClick={() => setChef(c.billId, it.id, "served")} data-testid={`kds-serve-${it.id}`}>
                            <HandPlatter className="w-3.5 h-3.5 mr-1" /> Serve
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ORDERS TAB */}
        <TabsContent value="orders" className="mt-4">
          <Tabs defaultValue="running">
            <TabsList className="bg-white border border-earth-border p-1 rounded-xl h-auto">
              <TabsTrigger value="running" className="h-10 px-4" data-testid="chef-orders-running">Running ({running.length})</TabsTrigger>
              <TabsTrigger value="closed" className="h-10 px-4" data-testid="chef-orders-closed">Closed ({closed.length})</TabsTrigger>
              <TabsTrigger value="cancelled" className="h-10 px-4" data-testid="chef-orders-cancelled">Cancelled ({cancelled.length})</TabsTrigger>
            </TabsList>
            {[{ key: "running", list: running }, { key: "closed", list: closed }, { key: "cancelled", list: cancelled }].map((grp) => (
              <TabsContent key={grp.key} value={grp.key} className="mt-4">
                {grp.list.length === 0 ? (
                  <div className="bg-white border border-earth-border rounded-2xl p-10 text-center text-brand-900/50 text-sm">Nothing here.</div>
                ) : (
                  <div className="space-y-3">
                    {grp.list.map((b) => (
                      <div key={b.id} className="bg-white border border-earth-border rounded-2xl p-4" data-testid={`chef-order-${b.id}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-heading text-lg">#{b.bill_number} · Table {b.table_name}</div>
                            <div className="text-xs text-brand-900/50">Captain {b.captain_name} · {fmtTime(b.created_at)}</div>
                          </div>
                          <Badge className={`uppercase tracking-widest text-[10px] border ${BILL_COLOR[b.status]}`}>{b.status}</Badge>
                        </div>
                        <ul className="mt-3 text-sm space-y-1">
                          {b.items.map((it) => (
                            <li key={it.id} className="flex items-center justify-between">
                              <span>
                                <b>{it.quantity}×</b> {it.name}
                                <span className="text-[10px] uppercase tracking-widest ml-2 text-brand-500">{it.department}</span>
                              </span>
                              <Badge className={`text-[9px] uppercase ${ST_COLOR[it.chef_status]}`}>{it.chef_status}</Badge>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
