import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, money } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function PrintKOT() {
  const { id } = useParams();
  const [o, setO] = useState(null);
  const [s, setS] = useState({ restaurant_name: "" });

  useEffect(() => {
    (async () => {
      const [ord, set] = await Promise.all([api.get(`/orders/${id}`), api.get("/settings")]);
      setO(ord.data); setS(set.data);
      setTimeout(() => window.print(), 400);
    })();
  }, [id]);

  if (!o) return <div className="p-10 text-center">Loading…</div>;

  return (
    <div className="min-h-screen bg-[#F9F6F0] p-6">
      <div className="no-print max-w-md mx-auto mb-4 flex gap-2 justify-end">
        <Button onClick={() => window.print()} className="bg-brand-500 hover:bg-brand-600 text-white" data-testid="print-kot-btn">Print</Button>
        <Button variant="outline" onClick={() => window.close()}>Close</Button>
      </div>

      <article className="print-area bg-white max-w-[360px] mx-auto p-6 font-receipt text-black border border-earth-border">
        <div className="text-center">
          <div className="text-xs tracking-[0.3em]">KITCHEN ORDER TICKET</div>
          <div className="mt-1 font-heading text-lg">{s.restaurant_name}</div>
        </div>
        <hr className="my-3 border-dashed border-black/40" />
        <div className="flex justify-between text-xs">
          <span>KOT #{o.order_number}</span>
          <span>{new Date(o.created_at).toLocaleTimeString()}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span>Table: {o.table_number || "—"}</span>
          <span>Staff: {o.created_by_name}</span>
        </div>
        <hr className="my-3 border-dashed border-black/40" />
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="pb-2">Qty</th>
              <th className="pb-2">Item</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((it, i) => (
              <tr key={i}>
                <td className="py-1 pr-2 align-top font-bold">{it.quantity}</td>
                <td className="py-1">{it.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {o.notes && (
          <>
            <hr className="my-3 border-dashed border-black/40" />
            <div className="text-xs"><strong>Note:</strong> {o.notes}</div>
          </>
        )}
        <hr className="my-3 border-dashed border-black/40" />
        <div className="text-center text-[10px] tracking-widest">*** KOT ***</div>
      </article>
    </div>
  );
}
