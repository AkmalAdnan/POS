import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, Circle } from "lucide-react";
import { toast } from "sonner";

export default function CaptainTables() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState(null);  // { table } or null
  const [customer, setCustomer] = useState({ customer_name: "", customer_mobile: "", notes: "" });
  const navigate = useNavigate();

  const load = async () => { const { data } = await api.get("/tables"); setTables(data); };
  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, []);

  const clickTable = (table) => {
    if (table.open_bill) {
      // resume existing bill — no dialog
      navigate(`/captain/bill/${table.open_bill.id}`);
    } else {
      setCustomer({ customer_name: "", customer_mobile: "", notes: "" });
      setDialog({ table });
    }
  };

  const confirmOpen = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/bills", { table_id: dialog.table.id, ...customer });
      toast.success(`Opened bill for ${dialog.table.name}`);
      setDialog(null);
      navigate(`/captain/bill/${data.id}`);
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setLoading(false); }
  };

  const available = tables.filter(t => t.status === "available").length;
  const occupied = tables.filter(t => t.status === "occupied").length;

  return (
    <AppShell>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl">Tables</h1>
          <p className="text-sm text-brand-900/60 mt-1">Tap a table to take a new order or resume its bill.</p>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="inline-flex items-center gap-2 bg-white border border-earth-border rounded-full px-4 py-2" data-testid="tables-available-count">
            <Circle className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500" /> Available <b className="ml-1">{available}</b>
          </span>
          <span className="inline-flex items-center gap-2 bg-white border border-earth-border rounded-full px-4 py-2" data-testid="tables-occupied-count">
            <Circle className="w-2.5 h-2.5 fill-brand-500 text-brand-500" /> Occupied <b className="ml-1">{occupied}</b>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {tables.map((t) => {
          const occ = t.status === "occupied";
          return (
            <button
              key={t.id}
              onClick={() => clickTable(t)}
              disabled={loading}
              data-testid={`table-card-${t.name}`}
              className={`group rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 ${
                occ ? "bg-brand-500 border-brand-500 text-white" : "bg-white border-earth-border hover:border-brand-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] uppercase tracking-[0.2em] ${occ ? "text-white/80" : "text-brand-500"}`}>{occ ? "Occupied" : "Available"}</span>
                <Users className={`w-4 h-4 ${occ ? "text-white/80" : "text-brand-500"}`} />
              </div>
              <div className={`font-heading text-3xl mt-2 ${occ ? "text-white" : "text-brand-900"}`}>{t.name}</div>
              <div className={`text-xs mt-0.5 ${occ ? "text-white/70" : "text-brand-900/50"}`}>{t.seats} seats</div>
              {occ && t.open_bill && (
                <div className="mt-2 text-[11px] text-white/90">
                  #{t.open_bill.bill_number} · ₹{Math.round(t.open_bill.total || 0)}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent data-testid="tables-customer-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Take order at {dialog?.table.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Customer name</Label>
              <Input value={customer.customer_name} onChange={(e) => setCustomer({ ...customer, customer_name: e.target.value })} placeholder="e.g. Rohit S" data-testid="tables-customer-name" />
            </div>
            <div>
              <Label>Mobile number</Label>
              <Input value={customer.customer_mobile} onChange={(e) => setCustomer({ ...customer, customer_mobile: e.target.value })} placeholder="+91 98xxxxxx" data-testid="tables-customer-mobile" />
            </div>
            <div>
              <Label>Seats</Label>
              <Input value={dialog?.table.seats || 4} disabled />
            </div>
            <div className="md:col-span-2">
              <Label>Order instructions (optional)</Label>
              <Input value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} placeholder="e.g. jain, less oil, anniversary cake at the end…" data-testid="tables-customer-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={confirmOpen} disabled={loading} className="bg-brand-500 hover:bg-brand-600 text-white" data-testid="tables-start-order-btn">
              Start order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
