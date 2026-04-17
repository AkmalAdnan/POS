import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, AlertTriangle, Boxes } from "lucide-react";

const empty = { name: "", unit: "kg", quantity: 0, low_threshold: 0, category: "general", note: "" };

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);

  const load = async () => { const { data } = await api.get("/inventory"); setItems(data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const payload = { ...form, quantity: Number(form.quantity), low_threshold: Number(form.low_threshold) };
      if (editing) await api.put(`/inventory/${editing}`, payload);
      else await api.post("/inventory", payload);
      toast.success(editing ? "Stock updated" : "Stock item added");
      setOpen(false); setForm(empty); setEditing(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const del = async (id) => {
    if (!window.confirm("Delete this item?")) return;
    await api.delete(`/inventory/${id}`); load();
  };

  const low = items.filter((i) => i.quantity <= i.low_threshold);

  return (
    <AppShell>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl">Inventory</h1>
          <p className="text-sm text-brand-900/60 mt-1">Track stock of chicken, mutton, rice, groceries, vegetables and more.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-brand-500 hover:bg-brand-600 text-white" onClick={() => { setEditing(null); setForm(empty); }} data-testid="inv-add-btn">
              <Plus className="w-4 h-4 mr-2" /> Add stock item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">{editing ? "Edit stock" : "New stock item"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="inv-form-name" /></div>
              <div><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} data-testid="inv-form-qty" /></div>
              <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg / ltr / pcs" data-testid="inv-form-unit" /></div>
              <div><Label>Low threshold</Label><Input type="number" value={form.low_threshold} onChange={(e) => setForm({ ...form, low_threshold: e.target.value })} data-testid="inv-form-low" /></div>
              <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="meat / dairy / grains" data-testid="inv-form-category" /></div>
              <div className="col-span-2"><Label>Note</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} data-testid="inv-form-note" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} className="bg-brand-500 hover:bg-brand-600 text-white" data-testid="inv-form-save">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {low.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
          <div className="text-sm text-amber-900">
            <b>{low.length}</b> item{low.length > 1 ? "s" : ""} running low: {low.map((i) => i.name).join(", ")}
          </div>
        </div>
      )}

      <div className="bg-white border border-earth-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F9F6F0] text-[11px] uppercase tracking-[0.2em] text-brand-900/60">
            <tr>
              <th className="text-left px-4 py-3">Item</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-right px-4 py-3">Stock</th>
              <th className="text-right px-4 py-3">Low</th>
              <th className="text-left px-4 py-3">Note</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-brand-900/50">No stock added yet.</td></tr>}
            {items.map((i) => {
              const isLow = i.quantity <= i.low_threshold;
              return (
                <tr key={i.id} className="border-t border-earth-border" data-testid={`inv-row-${i.id}`}>
                  <td className="px-4 py-3 font-medium">
                    <Boxes className="w-4 h-4 inline-block mr-2 text-brand-500" />
                    {i.name}
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-900/60 uppercase tracking-widest">{i.category}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${isLow ? "text-red-600" : ""}`}>{i.quantity} {i.unit}</td>
                  <td className="px-4 py-3 text-right text-brand-900/60">{i.low_threshold} {i.unit}</td>
                  <td className="px-4 py-3 text-xs text-brand-900/60">{i.note}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {isLow && <Badge className="bg-red-100 text-red-800 border-red-200 mr-2 text-[10px] uppercase tracking-widest">LOW</Badge>}
                    <Button size="icon" variant="outline" onClick={() => { setEditing(i.id); setForm({ ...i }); setOpen(true); }} data-testid={`inv-edit-${i.id}`}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="outline" className="ml-2" onClick={() => del(i.id)} data-testid={`inv-delete-${i.id}`}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
