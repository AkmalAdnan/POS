import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function PrintKOT() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const batchFilter = params.get("batch") ? Number(params.get("batch")) : null;
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

  // Items to include: if batchFilter, only that batch; else all sent items
  const allItems = bill.items.filter((i) => i.sent_to_kitchen && i.chef_status !== "cancelled");
  const items = batchFilter ? allItems.filter((i) => i.kot_batch === batchFilter) : allItems;

  // group by department
  const byDept = items.reduce((acc, it) => {
    (acc[it.department] = acc[it.department] || []).push(it);
    return acc;
  }, {});
  const depts = Object.keys(byDept);

  return (
    <div className="min-h-screen bg-[#F9F6F0] p-6">
      <div className="no-print max-w-md mx-auto mb-4 flex gap-2 justify-end">
        <Button onClick={() => window.print()} className="bg-brand-500 hover:bg-brand-600 text-white" data-testid="print-kot-btn">
          <Printer className="w-4 h-4 mr-2" /> Print
        </Button>
        <Button variant="outline" onClick={() => window.close()}>Close</Button>
      </div>

      {/* Each department prints on its own slip */}
      <div className="print-area mx-auto space-y-4">
        {depts.length === 0 && <div className="bg-white p-6 text-center">No items to print.</div>}
        {depts.map((dept, idx) => (
          <article key={dept} className={`bg-white max-w-[360px] mx-auto p-6 font-receipt text-black border border-earth-border ${idx !== depts.length - 1 ? "kot-slip-break" : ""}`}>
            <div className="text-center">
              <div className="text-[10px] tracking-[0.3em]">KITCHEN ORDER TICKET</div>
              <div className="mt-1 font-heading text-lg">{s.restaurant_name}</div>
              <div className="text-xs mt-1 font-bold tracking-[0.2em] uppercase">{dept}</div>
            </div>
            <hr className="my-3 border-dashed border-black/40" />
            <div className="flex justify-between text-xs">
              <span>Bill #{bill.bill_number}{batchFilter ? ` · KOT ${batchFilter}` : ""}</span>
              <span>{new Date().toLocaleTimeString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Table: {bill.table_name}</span>
              <span>Captain: {bill.captain_name}</span>
            </div>
            <hr className="my-3 border-dashed border-black/40" />
            <table className="w-full text-sm">
              <thead><tr className="text-left"><th className="pb-2">Qty</th><th className="pb-2">Item</th></tr></thead>
              <tbody>
                {byDept[dept].map((it) => (
                  <tr key={it.id}>
                    <td className="py-1 pr-2 align-top font-bold">{it.quantity}</td>
                    <td className="py-1">
                      {it.name}
                      {it.notes && <div className="text-[10px] italic mt-0.5">Note: {it.notes}</div>}
                      <div className="text-[9px] text-black/60">Added {new Date(it.added_at).toLocaleTimeString()}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bill.notes && <><hr className="my-3 border-dashed border-black/40" /><div className="text-xs">Bill note: {bill.notes}</div></>}
            <hr className="my-3 border-dashed border-black/40" />
            <div className="text-center text-[10px] tracking-widest">*** {dept.toUpperCase()} ***</div>
          </article>
        ))}
      </div>

      <style>{`@media print { .kot-slip-break { page-break-after: always; } }`}</style>
    </div>
  );
}
