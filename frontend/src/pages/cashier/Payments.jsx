import { useEffect, useState } from "react";
import { api, money, API_BASE } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CreditCard, Wallet, Smartphone, ReceiptText, Printer, Download, Lock, Plus } from "lucide-react";
import NewOrderDialog from "@/components/NewOrderDialog";
import PaymentMethodPicker from "@/components/PaymentMethodPicker";

const METHODS = [
  { id: "cash", label: "Cash", icon: Wallet },
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "card", label: "Card", icon: CreditCard },
];

export default function CashierPayments() {
  const [bills, setBills] = useState([]);
  const [totals, setTotals] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [active, setActive] = useState(null);
  const [pay, setPay] = useState({ method: "cash", amount: 0 });
  const [newOrderOpen, setNewOrderOpen] = useState(false);

  const load = async () => {
    const { data } = await api.get("/bills", { params: { date } });
    setBills(data);
    const { data: t } = await api.get("/cashier/totals", { params: { date } });
    setTotals(t);
  };
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); /* eslint-disable-next-line */ }, [date]);

  const startPay = (b) => { setActive(b); setPay({ method: "cash", amount: b.total }); };
  const confirmPay = async () => {
    try {
      const body = { method: pay.method, amount: Number(pay.amount) };
      if (pay.method === "split") {
        body.cash_amount = Number(pay.cash_amount);
        body.digital_amount = Number(pay.digital_amount);
        body.digital_method = pay.digital_method;
      }
      await api.post(`/bills/${active.id}/payment`, body);
      const label = pay.method === "split"
        ? `Split · ₹${pay.cash_amount} cash + ₹${pay.digital_amount} ${pay.digital_method?.toUpperCase()}`
        : pay.method.toUpperCase();
      toast.success(`Payment received · ${label} · Bill #${active.bill_number}`);
      setActive(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Payment failed"); }
  };

  const closeDay = async () => {
    if (!window.confirm(`Close sales for ${date}? This seals today's totals.`)) return;
    try {
      await api.post("/cashier/close-day", null, { params: { date } });
      toast.success(`Day ${date} closed`);
      // trigger CSV download
      const token = localStorage.getItem("spice_token");
      const res = await fetch(`${API_BASE}/analytics/export?date=${date}`, { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const blob = await res.blob();
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `bills_${date}.csv`; document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const inProgress = bills.filter((b) => b.payment?.status !== "received" && b.status !== "cancelled");
  const completed = bills.filter((b) => b.payment?.status === "received");
  const cancelled = bills.filter((b) => b.status === "cancelled");

  return (
    <AppShell>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl">Payments</h1>
          <p className="text-sm text-brand-900/60 mt-1">Collect Cash, UPI or Card · or take a new order.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Button onClick={() => setNewOrderOpen(true)} className="bg-brand-500 hover:bg-brand-600 text-white h-11" data-testid="cashier-new-order-btn">
            <Plus className="w-4 h-4 mr-2" /> New Order
          </Button>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 w-[170px]" data-testid="cashier-date-input" />
        </div>
      </div>

      <Tabs defaultValue="inprogress">
        <TabsList className="bg-white border border-earth-border p-1 rounded-xl h-auto flex flex-wrap gap-1">
          <TabsTrigger value="inprogress" className="h-11 px-4 data-[state=active]:bg-brand-500 data-[state=active]:text-white rounded-lg" data-testid="cashier-tab-inprogress">
            In Progress ({inProgress.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="h-11 px-4 data-[state=active]:bg-brand-500 data-[state=active]:text-white rounded-lg" data-testid="cashier-tab-completed">
            Completed ({completed.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="h-11 px-4 data-[state=active]:bg-brand-500 data-[state=active]:text-white rounded-lg" data-testid="cashier-tab-cancelled">
            Cancelled ({cancelled.length})
          </TabsTrigger>
          <TabsTrigger value="totals" className="h-11 px-4 data-[state=active]:bg-brand-500 data-[state=active]:text-white rounded-lg" data-testid="cashier-tab-totals">
            Today's Totals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inprogress" className="mt-4">
          <BillGrid bills={inProgress} color="red" label="PAYMENT PENDING" onAction={startPay} actionLabel="Collect payment" />
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <BillGrid bills={completed} color="green" label={null} onAction={null} />
        </TabsContent>

        <TabsContent value="cancelled" className="mt-4">
          <BillGrid bills={cancelled} color="gray" label="CANCELLED" onAction={null} />
        </TabsContent>

        <TabsContent value="totals" className="mt-4">
          {totals && (
            <div className="bg-white border border-earth-border rounded-2xl p-6">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.25em] text-brand-500">Total collected on {totals.date}</div>
                  <div className="font-heading text-5xl md:text-6xl mt-2 text-brand-500" data-testid="cashier-total-collected">{money(totals.total_collected)}</div>
                  <div className="text-sm text-brand-900/60 mt-2">{totals.paid_count} paid bills · {totals.pending_count} pending ({money(totals.pending_amount)}) · {totals.cancelled_count} cancelled</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Button onClick={closeDay} className="bg-brand-500 hover:bg-brand-600 text-white h-11" data-testid="cashier-close-day-btn">
                    <Lock className="w-4 h-4 mr-2" /> Close day / export
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <MethodCard icon={Wallet} label="Cash" value={totals.payment_split.cash} tint="text-emerald-600" />
                <MethodCard icon={Smartphone} label="UPI" value={totals.payment_split.upi} tint="text-brand-500" />
                <MethodCard icon={CreditCard} label="Card" value={totals.payment_split.card} tint="text-amber-600" />
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent data-testid="cashier-dialog" className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Collect payment · Bill #{active?.bill_number}</DialogTitle></DialogHeader>
          {active && (
            <div>
              <div className="text-sm text-brand-900/70">{active.order_type === "takeaway" ? "🥡 Take-away" : `Table ${active.table_name}`} · {active.customer_name || "Walk-in"} {active.customer_mobile && `· ${active.customer_mobile}`}</div>
              <div className="font-heading text-4xl text-brand-500 mt-2">{money(active.total)}</div>
              <div className="mt-5">
                <PaymentMethodPicker
                  total={active.total}
                  value={pay}
                  onChange={setPay}
                  testPrefix="cashier"
                />
              </div>
              {pay.method !== "split" && (
                <div className="mt-4">
                  <label className="text-xs text-brand-900/60">Amount received</label>
                  <Input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} className="mt-1 h-11" data-testid="cashier-amount-input" />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>Cancel</Button>
            <Button onClick={confirmPay} className="bg-brand-500 hover:bg-brand-600 text-white" data-testid="cashier-confirm-pay-btn">Mark as received</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <NewOrderDialog open={newOrderOpen} onOpenChange={setNewOrderOpen} />
    </AppShell>
  );
}

function BillGrid({ bills, color, label, onAction, actionLabel = "Action" }) {
  if (bills.length === 0) return <div className="bg-white border border-earth-border rounded-2xl p-10 text-center text-brand-900/60">No bills in this status.</div>;
  const colorMap = {
    red: { bd: "border-red-300", pill: "bg-red-500" },
    green: { bd: "border-emerald-300", pill: "bg-emerald-600" },
    gray: { bd: "border-gray-300", pill: "bg-gray-500" },
  };
  const c = colorMap[color];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {bills.map((b) => {
        const paid = b.payment?.status === "received";
        const pillText = label || `PAYMENT RECEIVED · ${b.payment?.method?.toUpperCase() || "—"}`;
        return (
          <article key={b.id} className={`relative bg-white border-2 ${c.bd} rounded-2xl p-5`} data-testid={`cashier-card-${b.id}`}>
            <div className={`absolute -top-2 left-5 px-2 ${c.pill} text-white text-[10px] font-semibold tracking-widest rounded-sm`}>{pillText}</div>
            <header className="flex items-center justify-between mt-1">
              <div>
                <div className="font-heading text-2xl">#{b.bill_number}</div>
                <div className="text-xs text-brand-900/50">{b.order_type === "takeaway" ? "🥡 TAKEAWAY" : `Table ${b.table_name}`} · {new Date(b.created_at).toLocaleTimeString()}</div>
                {b.customer_name && <div className="text-[11px] text-brand-900/60 mt-0.5">{b.customer_name}{b.customer_mobile ? ` · ${b.customer_mobile}` : ""}</div>}
              </div>
              <div className="text-right">
                <div className={`font-heading text-2xl ${paid ? "text-emerald-600" : "text-brand-500"}`}>{money(paid ? b.payment.amount_received : b.total)}</div>
                <div className="text-[10px] uppercase tracking-widest text-brand-900/50">{b.items.filter((i) => i.chef_status !== "cancelled").length} items</div>
                {paid && b.payment.received_by_name && (
                  <div className="text-[10px] text-emerald-700 mt-1" data-testid={`cashier-collected-by-${b.id}`}>
                    by <b>{b.payment.received_by_name}</b>
                    <span className="ml-1 uppercase tracking-widest text-[9px] text-emerald-600/80">· {b.payment.received_by_role || "staff"}</span>
                  </div>
                )}
              </div>
            </header>
            <div className="mt-3 flex items-center gap-2">
              {onAction && (
                <Button className="flex-1 bg-brand-500 hover:bg-brand-600 text-white" onClick={() => onAction(b)} data-testid={`cashier-action-${b.id}`}>
                  {actionLabel}
                </Button>
              )}
              <Button variant="outline" onClick={() => window.open(`/print/bill/${b.id}`, "_blank")} data-testid={`cashier-print-${b.id}`}>
                <ReceiptText className="w-4 h-4" />
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function MethodCard({ icon: Icon, label, value, tint }) {
  return (
    <div className="bg-[#F9F6F0] border border-earth-border rounded-xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg bg-white flex items-center justify-center ${tint}`}><Icon className="w-5 h-5" /></div>
      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-brand-900/50">{label}</div>
        <div className="font-heading text-lg">{money(value)}</div>
      </div>
    </div>
  );
}
