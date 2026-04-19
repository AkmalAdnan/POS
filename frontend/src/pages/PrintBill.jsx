import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, money } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function PrintBill() {
  const { id } = useParams();
  const [bill, setBill] = useState(null);
  const [s, setS] = useState(null);

  useEffect(() => {
    (async () => {
      const [b, set] = await Promise.all([api.get(`/bills/${id}`), api.get("/settings")]);
      setBill(b.data); setS(set.data);
      setTimeout(() => window.print(), 600);
    })();
  }, [id]);

  if (!bill || !s) return <div className="p-10 text-center">Loading…</div>;
  const items = bill.items.filter((i) => i.chef_status !== "cancelled");

  return (
    <div className="min-h-screen bg-[#F9F6F0] p-6">
      <div className="no-print max-w-md mx-auto mb-4 flex gap-2 justify-end">
        <Button onClick={() => window.print()} className="bg-brand-500 hover:bg-brand-600 text-white" data-testid="print-bill-btn">
          <Printer className="w-4 h-4 mr-2" /> Print
        </Button>
        <Button variant="outline" onClick={() => window.close()}>Close</Button>
      </div>

      <article className="print-area bg-white max-w-[360px] mx-auto p-6 font-receipt text-black border border-earth-border">
        <div className="text-center">
          <div className="font-heading text-xl">{s.restaurant_name}</div>
          <div className="text-[11px]">{s.address}</div>
          <div className="text-[11px]">Ph: {s.phone}</div>
          {s.gstin && <div className="text-[11px]">GSTIN: {s.gstin}</div>}
          <div className="text-[10px] tracking-[0.25em] mt-1">TAX INVOICE</div>
          <div className={`mt-2 inline-block px-3 py-1 text-[12px] font-bold tracking-[0.25em] border-2 border-black ${bill.order_type === "takeaway" ? "bg-black text-white" : ""}`}>
            {bill.order_type === "takeaway" ? "🥡 TAKEAWAY" : `DINE-IN · ${bill.table_name}`}
          </div>
        </div>
        <hr className="my-3 border-dashed border-black/40" />
        <div className="flex justify-between text-xs">
          <span>Bill #{bill.bill_number}</span>
          <span>{new Date(bill.created_at).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span>Table: {bill.table_name}</span>
          <span>{bill.customer_name || "Walk-in"}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span>Captain: {bill.captain_name}</span>
          {bill.payment?.status === "received" && <span>Paid: {bill.payment.method?.toUpperCase()}</span>}
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
            {items.map((it) => (
              <tr key={it.id}>
                <td className="py-1 pr-1">
                  {it.name}
                  {it.notes && <div className="text-[10px] italic">{it.notes}</div>}
                </td>
                <td className="py-1 text-center">{it.quantity}</td>
                <td className="py-1 text-right">{it.price.toFixed(2)}</td>
                <td className="py-1 text-right">{(it.price * it.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr className="my-3 border-dashed border-black/40" />
        <Row k="Subtotal" v={money(bill.subtotal)} />
        <Row k={`CGST @ ${bill.cgst_rate}%`} v={money(bill.cgst)} />
        <Row k={`SGST @ ${bill.sgst_rate}%`} v={money(bill.sgst)} />
        <hr className="my-2 border-dashed border-black/40" />
        <div className="flex justify-between font-bold text-base">
          <span>TOTAL</span>
          <span>{money(bill.total)}</span>
        </div>
        {bill.payment?.status === "received" && (
          <>
            <hr className="my-3 border-dashed border-black/40" />
            <div className="text-center text-[11px] font-bold">PAID · {bill.payment.method?.toUpperCase()} · {new Date(bill.payment.received_at).toLocaleTimeString()}</div>
          </>
        )}
        <hr className="my-3 border-dashed border-black/40" />
        <div className="text-center text-xs">Thank you! Please visit again.</div>
        <div className="text-center text-[10px] mt-2 tracking-[0.2em]">— {s.restaurant_name} —</div>
      </article>
    </div>
  );
}

function Row({ k, v }) {
  return <div className="flex justify-between text-sm py-0.5"><span>{k}</span><span>{v}</span></div>;
}
