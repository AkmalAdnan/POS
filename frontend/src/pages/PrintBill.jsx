import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, money } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function PrintBill() {
  const { id } = useParams();
  const [o, setO] = useState(null);
  const [s, setS] = useState(null);

  useEffect(() => {
    (async () => {
      const [ord, set] = await Promise.all([api.get(`/orders/${id}`), api.get("/settings")]);
      setO(ord.data); setS(set.data);
      setTimeout(() => window.print(), 500);
    })();
  }, [id]);

  if (!o || !s) return <div className="p-10 text-center">Loading…</div>;

  return (
    <div className="min-h-screen bg-[#F9F6F0] p-6">
      <div className="no-print max-w-md mx-auto mb-4 flex gap-2 justify-end">
        <Button onClick={() => window.print()} className="bg-brand-500 hover:bg-brand-600 text-white" data-testid="print-bill-btn">Print</Button>
        <Button variant="outline" onClick={() => window.close()}>Close</Button>
      </div>

      <article className="print-area bg-white max-w-[360px] mx-auto p-6 font-receipt text-black border border-earth-border">
        <div className="text-center">
          <div className="font-heading text-xl">{s.restaurant_name}</div>
          <div className="text-[11px]">{s.address}</div>
          <div className="text-[11px]">Ph: {s.phone}</div>
          {s.gstin && <div className="text-[11px]">GSTIN: {s.gstin}</div>}
          <div className="text-[10px] tracking-[0.25em] mt-1">TAX INVOICE</div>
        </div>
        <hr className="my-3 border-dashed border-black/40" />
        <div className="flex justify-between text-xs">
          <span>Bill #{o.order_number}</span>
          <span>{new Date(o.created_at).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span>Table: {o.table_number || "—"}</span>
          <span>{o.customer_name || "Walk-in"}</span>
        </div>
        <hr className="my-3 border-dashed border-black/40" />
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs">
              <th className="pb-1">Item</th>
              <th className="pb-1 text-center">Qty</th>
              <th className="pb-1 text-right">Rate</th>
              <th className="pb-1 text-right">Amt</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((it, i) => (
              <tr key={i}>
                <td className="py-1 pr-1">{it.name}</td>
                <td className="py-1 text-center">{it.quantity}</td>
                <td className="py-1 text-right">{it.price.toFixed(2)}</td>
                <td className="py-1 text-right">{(it.price * it.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr className="my-3 border-dashed border-black/40" />
        <Row k="Subtotal" v={money(o.subtotal)} />
        <Row k={`CGST @ ${o.cgst_rate}%`} v={money(o.cgst)} />
        <Row k={`SGST @ ${o.sgst_rate}%`} v={money(o.sgst)} />
        <hr className="my-2 border-dashed border-black/40" />
        <div className="flex justify-between font-bold text-base">
          <span>TOTAL</span>
          <span>{money(o.total)}</span>
        </div>
        <hr className="my-3 border-dashed border-black/40" />
        <div className="text-center text-xs">Thank you! Please visit again.</div>
        <div className="text-center text-[10px] mt-2 tracking-[0.2em]">— {s.restaurant_name} —</div>
      </article>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between text-sm py-0.5">
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
