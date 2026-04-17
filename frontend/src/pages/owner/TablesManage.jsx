import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Users } from "lucide-react";

const empty = { name: "", seats: 4 };

export default function OwnerTables() {
  const [tables, setTables] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);

  const load = async () => { const { data } = await api.get("/tables"); setTables(data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const payload = { name: form.name, seats: Number(form.seats) };
      if (editing) await api.put(`/tables/${editing}`, payload);
      else await api.post("/tables", payload);
      toast.success(editing ? "Table updated" : "Table added");
      setOpen(false); setForm(empty); setEditing(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const del = async (t) => {
    if (!window.confirm(`Delete ${t.name}?`)) return;
    try { await api.delete(`/tables/${t.id}`); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  return (
    <AppShell>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl">Tables</h1>
          <p className="text-sm text-brand-900/60 mt-1">Configure the tables captains will see.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-brand-500 hover:bg-brand-600 text-white" onClick={() => { setEditing(null); setForm(empty); }} data-testid="tables-add-btn">
              <Plus className="w-4 h-4 mr-2" /> Add table
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">{editing ? "Edit table" : "New table"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="tables-form-name" /></div>
              <div><Label>Seats</Label><Input type="number" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} data-testid="tables-form-seats" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} className="bg-brand-500 hover:bg-brand-600 text-white" data-testid="tables-form-save">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {tables.map((t) => (
          <div key={t.id} className="bg-white border border-earth-border rounded-2xl p-5" data-testid={`tables-row-${t.name}`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] uppercase tracking-[0.25em] ${t.status === "occupied" ? "text-brand-500" : "text-emerald-600"}`}>{t.status}</span>
              <Users className="w-4 h-4 text-brand-500" />
            </div>
            <div className="font-heading text-4xl mt-2">{t.name}</div>
            <div className="text-xs text-brand-900/50">{t.seats} seats</div>
            <div className="mt-4 flex gap-2">
              <Button size="icon" variant="outline" onClick={() => { setEditing(t.id); setForm({ name: t.name, seats: t.seats }); setOpen(true); }} data-testid={`tables-edit-${t.name}`}><Pencil className="w-4 h-4" /></Button>
              <Button size="icon" variant="outline" onClick={() => del(t)} data-testid={`tables-delete-${t.name}`}><Trash2 className="w-4 h-4 text-red-500" /></Button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
