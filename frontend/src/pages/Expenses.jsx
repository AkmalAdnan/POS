import { useEffect, useState } from "react";
import { api, money } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Expenses() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: "", amount: 0, category: "groceries" });

  const load = async () => {
    const { data } = await api.get("/expenses", { params: { date } });
    setItems(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date]);

  const add = async (e) => {
    e.preventDefault();
    try {
      await api.post("/expenses", { ...form, amount: Number(form.amount), date });
      toast.success("Expense added");
      setForm({ title: "", amount: 0, category: "groceries" });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save");
    }
  };
  const del = async (id) => { await api.delete(`/expenses/${id}`); load(); };

  const total = items.reduce((s, x) => s + x.amount, 0);

  return (
    <AppShell>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl">Expenses</h1>
          <p className="text-sm text-brand-900/60 mt-1">Track daily spends: groceries, staff wages, gas, utilities.</p>
        </div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 w-[170px]" data-testid="expenses-date-input" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
        <form onSubmit={add} className="bg-white border border-earth-border rounded-2xl p-6" data-testid="expenses-form">
          <h3 className="font-heading text-xl">New expense</h3>
          <div className="mt-4 space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required data-testid="expenses-title-input" /></div>
            <div><Label>Amount (₹)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required data-testid="expenses-amount-input" /></div>
            <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="expenses-category-input" /></div>
          </div>
          <Button type="submit" className="mt-5 w-full h-11 bg-brand-500 hover:bg-brand-600 text-white" data-testid="expenses-submit-btn">Add</Button>
        </form>

        <div className="bg-white border border-earth-border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-xl">{date}</h3>
            <div className="text-sm">Total: <span className="font-heading text-lg text-brand-500" data-testid="expenses-total">{money(total)}</span></div>
          </div>
          <ul className="mt-4 divide-y divide-earth-border">
            {items.length === 0 && <li className="py-8 text-center text-sm text-brand-900/50">No expenses for this day.</li>}
            {items.map((e) => (
              <li key={e.id} className="py-3 flex items-center gap-3" data-testid={`expenses-row-${e.id}`}>
                <div className="flex-1">
                  <div className="font-medium">{e.title}</div>
                  <div className="text-xs text-brand-900/50">{e.category}</div>
                </div>
                <div className="text-sm font-semibold">{money(e.amount)}</div>
                <Button size="icon" variant="outline" onClick={() => del(e.id)} data-testid={`expenses-delete-${e.id}`}><Trash2 className="w-4 h-4 text-red-500" /></Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
