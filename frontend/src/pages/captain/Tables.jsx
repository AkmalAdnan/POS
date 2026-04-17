import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Users, Circle } from "lucide-react";
import { toast } from "sonner";

export default function CaptainTables() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    const { data } = await api.get("/tables");
    setTables(data);
  };
  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, []);

  const openTable = async (table) => {
    setLoading(true);
    try {
      if (table.open_bill) {
        navigate(`/captain/bill/${table.open_bill.id}`);
      } else {
        const { data } = await api.post("/bills", { table_id: table.id });
        toast.success(`Opened bill for ${table.name}`);
        navigate(`/captain/bill/${data.id}`);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to open bill");
    } finally { setLoading(false); }
  };

  const available = tables.filter(t => t.status === "available").length;
  const occupied = tables.filter(t => t.status === "occupied").length;

  return (
    <AppShell>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl">Tables</h1>
          <p className="text-sm text-brand-900/60 mt-1">Tap a table to open or resume its bill.</p>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="inline-flex items-center gap-2 bg-white border border-earth-border rounded-full px-4 py-2">
            <Circle className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500" /> Available <b className="ml-1">{available}</b>
          </span>
          <span className="inline-flex items-center gap-2 bg-white border border-earth-border rounded-full px-4 py-2">
            <Circle className="w-2.5 h-2.5 fill-brand-500 text-brand-500" /> Occupied <b className="ml-1">{occupied}</b>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {tables.map((t) => {
          const occ = t.status === "occupied";
          return (
            <button
              key={t.id}
              onClick={() => openTable(t)}
              disabled={loading}
              data-testid={`table-card-${t.name}`}
              className={`group rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 ${
                occ
                  ? "bg-brand-500 border-brand-500 text-white"
                  : "bg-white border-earth-border hover:border-brand-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] uppercase tracking-[0.25em] ${occ ? "text-white/80" : "text-brand-500"}`}>
                  {occ ? "Occupied" : "Available"}
                </span>
                <Users className={`w-4 h-4 ${occ ? "text-white/80" : "text-brand-500"}`} />
              </div>
              <div className={`font-heading text-4xl mt-3 ${occ ? "text-white" : "text-brand-900"}`}>{t.name}</div>
              <div className={`text-xs mt-1 ${occ ? "text-white/70" : "text-brand-900/50"}`}>{t.seats} seats</div>
              {occ && t.open_bill && (
                <div className="mt-3 text-xs text-white/90">
                  Bill #{t.open_bill.bill_number} · ₹{t.open_bill.total?.toFixed?.(0) ?? 0}
                  <div className="text-[10px] text-white/70 mt-0.5">{t.open_bill.captain_name}</div>
                </div>
              )}
            </button>
          );
        })}
        {tables.length === 0 && (
          <div className="col-span-full bg-white rounded-2xl border border-earth-border p-10 text-center text-brand-900/60">
            No tables configured. Ask the owner to add tables in Settings → Tables.
          </div>
        )}
      </div>
    </AppShell>
  );
}
