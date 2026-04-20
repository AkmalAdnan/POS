import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { CreditCard, Wallet, Smartphone, Split } from "lucide-react";

const TILES = [
  { id: "cash", label: "Cash", icon: Wallet },
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "split", label: "Split", icon: Split },
];

/**
 * Reusable payment-method picker used by Captain (Bill.jsx) and Cashier (Payments.jsx).
 *
 * Props:
 *   total           — grand total of the bill (₹)
 *   value           — { method, amount, cash_amount, digital_amount, digital_method }
 *   onChange(value) — called on every change
 *   testPrefix      — prefix for data-testid (e.g. "bill-pay" or "cashier")
 *
 * When method === "split":
 *   - user fills `cash_amount`; digital is auto-computed as (total - cash)
 *   - user picks digital_method: "upi" | "card"
 *   - `amount` is always equal to total
 */
export default function PaymentMethodPicker({ total, value, onChange, testPrefix = "pay" }) {
  const { method } = value;
  const [cashStr, setCashStr] = useState(String(value.cash_amount ?? Math.round(total / 2)));

  useEffect(() => {
    if (method === "split") {
      const cash = Math.max(0, Math.min(total, Number(cashStr) || 0));
      const digital = Math.max(0, Number((total - cash).toFixed(2)));
      onChange({
        ...value,
        amount: total,
        cash_amount: cash,
        digital_amount: digital,
        digital_method: value.digital_method || "upi",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cashStr, method, total]);

  const pick = (id) => {
    if (id === "split") {
      onChange({
        method: "split", amount: total,
        cash_amount: Math.round(total / 2),
        digital_amount: Math.round(total / 2),
        digital_method: "upi",
      });
      setCashStr(String(Math.round(total / 2)));
    } else {
      onChange({ method: id, amount: total });
    }
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {TILES.map((m) => (
          <button
            key={m.id}
            onClick={() => pick(m.id)}
            type="button"
            className={`rounded-xl border p-3 text-center transition-all ${
              method === m.id
                ? "border-brand-500 bg-brand-50 text-brand-900"
                : "border-earth-border hover:border-brand-300"
            }`}
            data-testid={`${testPrefix}-method-${m.id}`}
          >
            <m.icon className="w-5 h-5 mx-auto" />
            <div className="mt-1 text-[11px] font-medium uppercase tracking-widest">{m.label}</div>
          </button>
        ))}
      </div>

      {method === "split" && (
        <div className="mt-4 space-y-3 rounded-xl border border-earth-border bg-[#F9F6F0] p-3" data-testid={`${testPrefix}-split-panel`}>
          <div className="text-[10px] uppercase tracking-[0.22em] text-brand-500">Split payment</div>

          <div>
            <label className="text-xs text-brand-900/60">Amount paid via Cash</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={cashStr}
              onChange={(e) => setCashStr(e.target.value)}
              className="mt-1 h-11"
              data-testid={`${testPrefix}-split-cash`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-brand-900/60">Amount paid via UPI / Card</label>
              <div className="flex gap-1">
                {["upi", "card"].map((dm) => (
                  <button
                    key={dm}
                    type="button"
                    onClick={() => onChange({ ...value, digital_method: dm })}
                    className={`px-2 h-7 text-[10px] uppercase tracking-widest rounded-md border transition-colors ${
                      value.digital_method === dm
                        ? "bg-brand-500 text-white border-brand-500"
                        : "bg-white border-earth-border hover:border-brand-300"
                    }`}
                    data-testid={`${testPrefix}-split-dm-${dm}`}
                  >
                    {dm}
                  </button>
                ))}
              </div>
            </div>
            <Input
              type="number"
              value={value.digital_amount ?? 0}
              readOnly
              className="mt-1 h-11 bg-white"
              data-testid={`${testPrefix}-split-digital`}
            />
            <div className="mt-1 text-[11px] text-brand-900/50">
              Auto-computed from Cash amount. Total must equal ₹{total.toFixed(2)}.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
