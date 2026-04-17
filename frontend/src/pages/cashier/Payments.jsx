import { useEffect, useState } from "react";
import { api, money } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CreditCard, Wallet, Smartphone, ReceiptText, Printer } from "lucide-react";

const METHODS = [
  { id: "cash", label: "Cash", icon: Wallet },
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "card", label: "Card", icon: CreditCard },
];

export default function CashierPayments() {
  const [bills, setBills] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [active, setActive] = useState(null);  // bill being paid
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState(0);

  const load = async () => {
    const { data } = await api.get("/bills", { params: { date } });
    setBills(data);
  };
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); /* eslint-disable-next-line */ }, [date]);

  const startPay = (b) => { setActive(b); setMethod("cash"); setAmount(b.total); };
  const confirmPay = async () => {
    try {
      await api.post(`/bills/${active.id}/payment`, { method, amount: Number(amount) });
      toast.success(`Payment received via ${method.toUpperCase()} for Bill #${active.bill_number}`);
      setActive(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Payment failed"); }
  };

  const pending = bills.filter((b) => b.payment?.status !== "received" && b.status !== "cancelled");
  const received = bills.filter((b) => b.payment?.status === "received");

  return (
    <AppShell>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl">Payments</h1>
          <p className="text-sm text-brand-900/60 mt-1">Collect Cash, UPI or Card for open bills.</p>
        </div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 w-[170px]" data-testid="cashier-date-input" />
      </div>

      <h2 className="font-heading text-xl mt-2 mb-2">Payment Pending ({pending.length})</h2>
      {pending.length === 0 ? (
        <div className="bg-white border border-earth-border rounded-2xl p-10 text-center text-brand-900/60">No pending bills. 🎉</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pending.map((b) => (
            <article key={b.id} className="relative bg-white border-2 border-red-300 rounded-2xl p-5" data-testid={`cashier-pending-${b.id}`}>
              <div className="absolute -top-2 left-5 px-2 bg-red-500 text-white text-[10px] font-semibold tracking-widest rounded-sm">PAYMENT PENDING</div>
              <header className="flex items-center justify-between mt-1">
                <div>
                  <div className="font-heading text-2xl">#{b.bill_number}</div>
                  <div className="text-xs text-brand-900/50">Table {b.table_name} · {new Date(b.created_at).toLocaleTimeString()}</div>
                </div>
                <div className="text-right">
                  <div className="font-heading text-2xl text-brand-500">{money(b.total)}</div>
                  <div className="text-[10px] uppercase tracking-widest text-brand-900/50">{b.items.length} items</div>
                </div>
              </header>
              <div className="mt-3 text-xs text-brand-900/60 line-clamp-2">
                {b.items.filter((i) => i.chef_status !== "cancelled").map((i) => `${i.quantity}× ${i.name}`).join(", ")}
              </div>
              <div className="mt-4 flex gap-2">
                <Button className="flex-1 bg-brand-500 hover:bg-brand-600 text-white" onClick={() => startPay(b)} data-testid={`cashier-collect-${b.id}`}>
                  Collect payment
                </Button>
                <Button variant="outline" onClick={() => window.open(`/print/bill/${b.id}`, "_blank")} data-testid={`cashier-bill-${b.id}`}>
                  <ReceiptText className="w-4 h-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <h2 className="font-heading text-xl mt-10 mb-2">Payment Received ({received.length})</h2>
      {received.length === 0 ? (
        <div className="bg-white border border-earth-border rounded-2xl p-8 text-center text-brand-900/50 text-sm">No payments received yet today.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {received.map((b) => (
            <article key={b.id} className="relative bg-white border-2 border-emerald-300 rounded-2xl p-5" data-testid={`cashier-received-${b.id}`}>
              <div className="absolute -top-2 left-5 px-2 bg-emerald-600 text-white text-[10px] font-semibold tracking-widest rounded-sm">
                PAYMENT RECEIVED · {b.payment.method?.toUpperCase()}
              </div>
              <header className="flex items-center justify-between mt-1">
                <div>
                  <div className="font-heading text-2xl">#{b.bill_number}</div>
                  <div className="text-xs text-brand-900/50">Table {b.table_name} · {new Date(b.payment.received_at).toLocaleTimeString()}</div>
                </div>
                <div className="text-right">
                  <div className="font-heading text-xl text-emerald-600">{money(b.payment.amount_received)}</div>
                  <div className="text-[10px] text-brand-900/50">by {b.payment.received_by_name}</div>
                </div>
              </header>
              <button onClick={() => window.open(`/print/bill/${b.id}`, "_blank")} className="mt-2 text-xs text-brand-500 hover:underline inline-flex items-center gap-1">
                <Printer className="w-3 h-3" /> Reprint bill
              </button>
            </article>
          ))}
        </div>
      )}

      {/* Payment dialog */}
      <Dialog open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent data-testid="cashier-dialog" className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Collect payment · Bill #{active?.bill_number}</DialogTitle></DialogHeader>
          {active && (
            <div>
              <div className="text-sm text-brand-900/70">Table {active.table_name} · {active.customer_name || "Walk-in"}</div>
              <div className="font-heading text-4xl text-brand-500 mt-2">{money(active.total)}</div>
              <div className="grid grid-cols-3 gap-2 mt-5">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={`rounded-xl border p-3 text-center transition-all ${
                      method === m.id ? "border-brand-500 bg-brand-50 text-brand-900" : "border-earth-border hover:border-brand-300"
                    }`}
                    data-testid={`cashier-method-${m.id}`}
                  >
                    <m.icon className="w-5 h-5 mx-auto" />
                    <div className="mt-1 text-xs font-medium uppercase tracking-widest">{m.label}</div>
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <label className="text-xs text-brand-900/60">Amount received</label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 h-11" data-testid="cashier-amount-input" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>Cancel</Button>
            <Button onClick={confirmPay} className="bg-brand-500 hover:bg-brand-600 text-white" data-testid="cashier-confirm-pay-btn">
              Mark as received
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
