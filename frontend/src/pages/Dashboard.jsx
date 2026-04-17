import { useEffect, useState } from "react";
import { api, money } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, XAxis, YAxis, Bar, CartesianGrid } from "recharts";
import { Download, IndianRupee, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { API_BASE } from "@/lib/api";

const COLORS = ["#5C715E", "#E8B25C", "#C55E38", "#B4443A"];

export default function Dashboard() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState(null);

  const load = async (d) => {
    const { data } = await api.get("/analytics/summary", { params: { date: d } });
    setSummary(data);
  };

  useEffect(() => { load(date); }, [date]);

  const exportCsv = async () => {
    const token = localStorage.getItem("spice_token");
    const url = `${API_BASE}/analytics/export?date=${date}`;
    const res = await fetch(url, { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `orders_${date}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const pie = (summary?.pie || []).filter((p) => p.value > 0);
  const catData = Object.entries(summary?.category_sales || {}).map(([name, value]) => ({ name, value }));

  return (
    <AppShell>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl">Owner Dashboard</h1>
          <p className="text-sm text-brand-900/60 mt-1">Daily health of your restaurant at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 w-[170px]" data-testid="dashboard-date-input" />
          <Button onClick={exportCsv} className="h-11 bg-brand-500 hover:bg-brand-600 text-white" data-testid="dashboard-export-csv-btn">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={IndianRupee} label="Revenue" value={money(summary?.revenue || 0)} tint="text-brand-500" testid="kpi-revenue" />
        <Kpi icon={Receipt} label="Orders" value={summary?.orders_count ?? 0} tint="text-earth-sage" testid="kpi-orders" />
        <Kpi icon={TrendingDown} label="Spent" value={money(summary?.spent || 0)} tint="text-earth-gold" testid="kpi-spent" />
        <Kpi icon={TrendingUp} label="Net Profit" value={money(summary?.profit || 0)} tint={summary?.loss ? "text-red-500" : "text-emerald-600"} testid="kpi-profit" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4 mt-4">
        <div className="bg-white border border-earth-border rounded-2xl p-6">
          <h3 className="font-heading text-xl">Profit · Spent · Loss</h3>
          <p className="text-xs text-brand-900/50 mt-1">Break-down of the day</p>
          <div className="h-[320px] mt-2" data-testid="dashboard-pie-chart">
            {pie.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-brand-900/50">No data for this day yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={2}>
                    {pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => money(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white border border-earth-border rounded-2xl p-6">
          <h3 className="font-heading text-xl">Sales by Category</h3>
          <p className="text-xs text-brand-900/50 mt-1">Where the day’s revenue came from</p>
          <div className="h-[320px] mt-2">
            {catData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-brand-900/50">No sales yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catData} margin={{ top: 20, right: 20, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E1D8" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => money(v)} />
                  <Bar dataKey="value" fill="#C55E38" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Kpi({ icon: Icon, label, value, tint, testid }) {
  return (
    <div className="bg-white border border-earth-border rounded-2xl p-5" data-testid={testid}>
      <div className={`w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center ${tint}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-brand-900/50 mt-4">{label}</div>
      <div className="font-heading text-2xl mt-1">{value}</div>
    </div>
  );
}
