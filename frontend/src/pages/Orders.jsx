import { useEffect, useState } from "react";
import { api, money } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Printer, ReceiptText } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const STATUS_COLORS = {
  open: "bg-amber-100 text-amber-800 border-amber-200",
  closed: "bg-gray-100 text-gray-700 border-gray-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

export default function Orders() {
  const { user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("");
  const [bills, setBills] = useState([]);

  const load = async () => {
    const params = { date };
    if (status) params.status = status;
    const { data } = await api.get("/bills", { params });
    setBills(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date, status]);

  return (
    <AppShell>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl">{user?.role === "customer" ? "My Orders" : "Bills"}</h1>
          <p className="text-sm text-brand-900/60 mt-1">Filter by date & status. Click print to reprint KOT or bill.</p>
        </div>
        <div className="flex gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 w-[170px]" data-testid="orders-date-input" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-md border border-earth-border bg-white px-3 text-sm" data-testid="orders-status-select">
            <option value="">All statuses</option>
            {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white border border-earth-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F9F6F0] text-[11px] uppercase tracking-[0.2em] text-brand-900/60">
            <tr>
              <th className="text-left px-4 py-3">#</th>
              <th className="text-left px-4 py-3">Time</th>
              <th className="text-left px-4 py-3">Table</th>
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
              <tr><td colSpan={9} className="text-center py-12 text-brand-900/50">No bills for this filter.</td></tr>
            ) : bills.map((b) => {
              const paid = b.payment?.status === "received";
              const activeItems = b.items.filter((i) => i.chef_status !== "cancelled");
              return (
                <tr key={b.id} className="border-t border-earth-border" data-testid={`orders-row-${b.id}`}>
                  <td className="px-4 py-3 font-semibold">#{b.bill_number}</td>
                  <td className="px-4 py-3 text-brand-900/70">{new Date(b.created_at).toLocaleTimeString()}</td>
                  <td className="px-4 py-3">{b.table_name || "—"}</td>
                  <td className="px-4 py-3 text-brand-900/70 max-w-[240px] truncate">{activeItems.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</td>
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
                    <Link to={`/print/kot/${b.id}`} target="_blank" className="inline-flex items-center gap-1 text-brand-500 hover:underline mr-3" data-testid={`orders-kot-${b.id}`}>
                      <Printer className="w-4 h-4" /> KOT
                    </Link>
                    <Link to={`/print/bill/${b.id}`} target="_blank" className="inline-flex items-center gap-1 text-brand-500 hover:underline" data-testid={`orders-bill-${b.id}`}>
                      <ReceiptText className="w-4 h-4" /> Bill
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
