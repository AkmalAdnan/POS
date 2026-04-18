import { useEffect, useMemo, useState } from "react";
import { api, money } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { Printer, ReceiptText } from "lucide-react";

const STATUS_COLORS = {
  open: "bg-amber-100 text-amber-800 border-amber-200",
  closed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

/**
 * Unified bills/orders screen used by captain (Running / All / Closed)
 * and owner. `mode` chooses the default tab:
 *   - "running" → only open bills
 *   - "closed"  → only closed bills
 *   - "all"     → all (default)
 */
export default function BillsView({ mode = "all" }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [bills, setBills] = useState([]);

  const load = async () => {
    const { data } = await api.get("/bills", { params: { date } });
    setBills(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date]);

  const running = bills.filter((b) => b.status === "open");
  const closed = bills.filter((b) => b.status === "closed");
  const cancelled = bills.filter((b) => b.status === "cancelled");

  const defaultTab = mode === "running" ? "running" : mode === "closed" ? "closed" : "all";
  const heading = mode === "running" ? "Running Orders" : mode === "closed" ? "Closed Orders" : "All Orders";

  return (
    <AppShell>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl">{heading}</h1>
          <p className="text-sm text-brand-900/60 mt-1">Click print to reprint KOT or bill.</p>
        </div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 w-[170px]" data-testid="bills-date-input" />
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="bg-white border border-earth-border p-1 rounded-xl h-auto">
          <TabsTrigger value="running" className="h-11 px-4 data-[state=active]:bg-brand-500 data-[state=active]:text-white rounded-lg" data-testid="bills-tab-running">Running ({running.length})</TabsTrigger>
          <TabsTrigger value="closed" className="h-11 px-4 data-[state=active]:bg-brand-500 data-[state=active]:text-white rounded-lg" data-testid="bills-tab-closed">Closed ({closed.length})</TabsTrigger>
          <TabsTrigger value="cancelled" className="h-11 px-4 data-[state=active]:bg-brand-500 data-[state=active]:text-white rounded-lg" data-testid="bills-tab-cancelled">Cancelled ({cancelled.length})</TabsTrigger>
          <TabsTrigger value="all" className="h-11 px-4 data-[state=active]:bg-brand-500 data-[state=active]:text-white rounded-lg" data-testid="bills-tab-all">All ({bills.length})</TabsTrigger>
        </TabsList>
        {[{ key: "running", list: running }, { key: "closed", list: closed }, { key: "cancelled", list: cancelled }, { key: "all", list: bills }].map((grp) => (
          <TabsContent key={grp.key} value={grp.key} className="mt-4">
            <Table bills={grp.list} />
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}

function Table({ bills }) {
  return (
    <div className="bg-white border border-earth-border rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[#F9F6F0] text-[11px] uppercase tracking-[0.2em] text-brand-900/60">
          <tr>
            <th className="text-left px-4 py-3">#</th>
            <th className="text-left px-4 py-3">Time</th>
            <th className="text-left px-4 py-3">Table</th>
            <th className="text-left px-4 py-3">Customer</th>
            <th className="text-left px-4 py-3">Items</th>
            <th className="text-left px-4 py-3">Captain</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-left px-4 py-3">Payment</th>
            <th className="text-right px-4 py-3">Total</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {bills.length === 0 ? (
            <tr><td colSpan={10} className="text-center py-12 text-brand-900/50">No bills.</td></tr>
          ) : bills.map((b) => {
            const paid = b.payment?.status === "received";
            const activeItems = b.items.filter((i) => i.chef_status !== "cancelled");
            return (
              <tr key={b.id} className="border-t border-earth-border" data-testid={`bills-row-${b.id}`}>
                <td className="px-4 py-3 font-semibold">#{b.bill_number}</td>
                <td className="px-4 py-3 text-brand-900/70">{new Date(b.created_at).toLocaleTimeString()}</td>
                <td className="px-4 py-3">{b.table_name || "—"}</td>
                <td className="px-4 py-3 text-brand-900/70">
                  {b.customer_name || "—"}
                  {b.customer_mobile && <div className="text-[10px] text-brand-900/40">{b.customer_mobile}</div>}
                </td>
                <td className="px-4 py-3 text-brand-900/70 max-w-[220px] truncate">{activeItems.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</td>
                <td className="px-4 py-3 text-brand-900/70">{b.captain_name}</td>
                <td className="px-4 py-3"><Badge className={`uppercase tracking-widest text-[10px] border ${STATUS_COLORS[b.status]}`}>{b.status}</Badge></td>
                <td className="px-4 py-3">
                  {paid ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 uppercase tracking-widest text-[10px]">
                      {b.payment.method?.toUpperCase() || "PAID"}
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800 border-red-200 uppercase tracking-widest text-[10px]">Pending</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-semibold">{money(b.total)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Link to={`/print/kot/${b.id}`} target="_blank" className="inline-flex items-center gap-1 text-brand-500 hover:underline mr-3">
                    <Printer className="w-4 h-4" /> KOT
                  </Link>
                  <Link to={`/print/bill/${b.id}`} target="_blank" className="inline-flex items-center gap-1 text-brand-500 hover:underline">
                    <ReceiptText className="w-4 h-4" /> Bill
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
