import { useEffect, useState } from "react";
import { api, money } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

const CATEGORIES = ["Main Course", "Chinese", "Biryanis", "Roti", "Fried Rice", "Mandi", "Sweets", "Mutton"];

const empty = { name: "", category: CATEGORIES[0], price: 0, cost: 0, description: "", is_available: true };

export default function MenuManage() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const { data } = await api.get("/menu");
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const payload = { ...form, price: Number(form.price), cost: Number(form.cost) };
      if (editing) await api.put(`/menu/${editing}`, payload);
      else await api.post("/menu", payload);
      toast.success(editing ? "Item updated" : "Item added");
      setOpen(false); setForm(empty); setEditing(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save");
    }
  };

  const startEdit = (it) => {
    setEditing(it.id); setForm({ ...it }); setOpen(true);
  };
  const del = async (id) => {
    if (!window.confirm("Delete this item?")) return;
    await api.delete(`/menu/${id}`);
    load();
  };

  return (
    <AppShell>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl">Menu</h1>
          <p className="text-sm text-brand-900/60 mt-1">Add, edit or disable dishes. Cost is used for profit reports.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setForm(empty); }} className="bg-brand-500 hover:bg-brand-600 text-white" data-testid="menu-add-btn">
              <Plus className="w-4 h-4 mr-2" /> Add item
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="menu-dialog">
            <DialogHeader><DialogTitle className="font-heading">{editing ? "Edit item" : "New item"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="menu-form-name" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger data-testid="menu-form-category"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Price (₹)</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} data-testid="menu-form-price" />
              </div>
              <div>
                <Label>Cost (₹)</Label>
                <Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} data-testid="menu-form-cost" />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={!!form.is_available} onCheckedChange={(v) => setForm({ ...form, is_available: v })} data-testid="menu-form-available" />
                <span className="text-sm">Available</span>
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="menu-form-description" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} className="bg-brand-500 hover:bg-brand-600 text-white" data-testid="menu-form-save">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {CATEGORIES.map((cat) => {
        const rows = items.filter((x) => x.category === cat);
        if (!rows.length) return null;
        return (
          <section key={cat} className="mt-6">
            <div className="text-[11px] uppercase tracking-[0.22em] text-brand-500 mb-2">{cat}</div>
            <div className="bg-white border border-earth-border rounded-2xl divide-y divide-earth-border overflow-hidden">
              {rows.map((it) => (
                <div key={it.id} className="flex items-center gap-3 p-4" data-testid={`menu-row-${it.id}`}>
                  <div className="flex-1">
                    <div className="font-medium">{it.name} {!it.is_available && <span className="text-xs text-red-500">· disabled</span>}</div>
                    <div className="text-xs text-brand-900/50">{it.description}</div>
                  </div>
                  <div className="w-24 text-right text-sm">{money(it.price)}</div>
                  <div className="w-24 text-right text-xs text-brand-900/50">cost {money(it.cost)}</div>
                  <Button size="icon" variant="outline" onClick={() => startEdit(it)} data-testid={`menu-edit-${it.id}`}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="outline" onClick={() => del(it.id)} data-testid={`menu-delete-${it.id}`}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </AppShell>
  );
}
