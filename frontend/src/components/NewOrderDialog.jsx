import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShoppingBag, Utensils } from "lucide-react";

/**
 * Reusable "New Order" dialog used by Captain & Cashier.
 * Step 1: pick Dine-In or Takeaway
 * Step 2: capture customer info (and table for dine-in) → POST /bills → navigate to /bill/:id
 */
export default function NewOrderDialog({ open, onOpenChange, defaultType = null }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(defaultType ? 2 : 1);
  const [type, setType] = useState(defaultType || "dine_in");
  const [tables, setTables] = useState([]);
  const [tableId, setTableId] = useState("");
  const [form, setForm] = useState({ customer_name: "", customer_mobile: "", notes: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && step === 2 && type === "dine_in") {
      api.get("/tables").then(({ data }) => setTables(data));
    }
  }, [open, step, type]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(defaultType ? 2 : 1);
      setType(defaultType || "dine_in");
      setTableId("");
      setForm({ customer_name: "", customer_mobile: "", notes: "" });
    }
  }, [open, defaultType]);

  const pick = (t) => { setType(t); setStep(2); };

  const submit = async () => {
    if (type === "dine_in" && !tableId) return toast.error("Pick a table");
    setBusy(true);
    try {
      const payload = { order_type: type, ...form };
      if (type === "dine_in") payload.table_id = tableId;
      const { data } = await api.post("/bills", payload);
      toast.success(`${type === "takeaway" ? "Takeaway" : `Dine-In · ${data.table_name}`} order opened`);
      onOpenChange(false);
      navigate(`/orders/bill/${data.id}`);
    } catch (e) {
      if (e?.offlineQueued) {
        toast.warning("You're offline — order queued. It will sync when you're back online.");
        onOpenChange(false);
      } else {
        toast.error(e.response?.data?.detail || "Failed");
      }
    }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="new-order-dialog" className="max-w-md">
        <DialogHeader><DialogTitle className="font-heading">New order</DialogTitle></DialogHeader>

        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => pick("dine_in")} className="rounded-2xl border border-earth-border p-5 hover:border-brand-300 hover:bg-brand-50 text-left transition-all" data-testid="new-order-dine-in">
              <Utensils className="w-8 h-8 text-brand-500" />
              <div className="font-heading text-lg mt-3">Dine-In</div>
              <div className="text-xs text-brand-900/60 mt-1">Pick a table for the customer</div>
            </button>
            <button onClick={() => pick("takeaway")} className="rounded-2xl border border-earth-border p-5 hover:border-brand-300 hover:bg-brand-50 text-left transition-all" data-testid="new-order-takeaway">
              <ShoppingBag className="w-8 h-8 text-brand-500" />
              <div className="font-heading text-lg mt-3">Take-Away</div>
              <div className="text-xs text-brand-900/60 mt-1">Parcel order — no table needed</div>
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-[0.22em] text-brand-500" data-testid="new-order-type-label">
              {type === "takeaway" ? "Take-away order" : "Dine-In order"}
            </div>

            {type === "dine_in" && (
              <div>
                <Label>Table</Label>
                <select value={tableId} onChange={(e) => setTableId(e.target.value)} className="mt-1 w-full h-11 rounded-md border border-earth-border bg-white px-3 text-sm" data-testid="new-order-table-select">
                  <option value="">Choose a table…</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id} disabled={t.status === "occupied"}>
                      {t.name} — {t.status}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label>Customer name</Label>
              <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="e.g. Rohit S" data-testid="new-order-customer-name" />
            </div>
            <div>
              <Label>Mobile number</Label>
              <Input value={form.customer_mobile} onChange={(e) => setForm({ ...form, customer_mobile: e.target.value })} placeholder="+91 98xxxxxxxx" data-testid="new-order-customer-mobile" />
            </div>
            <div>
              <Label>Order instructions (optional)</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. jain, less oil" data-testid="new-order-notes" />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 2 && !defaultType && (
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {step === 2 && (
            <Button disabled={busy} onClick={submit} className="bg-brand-500 hover:bg-brand-600 text-white" data-testid="new-order-start-btn">
              Start order
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
