import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Shield, ShieldCheck, ChefHat, CreditCard, UserCog } from "lucide-react";

const ROLES = [
  { value: "captain", label: "Captain / Steward", icon: UserCog, note: "Take orders at tables · edit · send KOT" },
  { value: "chef", label: "Chef", icon: ChefHat, note: "Kitchen display · mark items ready/served" },
  { value: "cashier", label: "Cashier", icon: CreditCard, note: "Collect payments · close day" },
];

const empty = { name: "", email: "", password: "", role: "captain" };

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);

  const load = async () => { const { data } = await api.get("/staff"); setStaff(data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editing) {
        const patch = { name: form.name, role: form.role };
        if (form.password) patch.password = form.password;
        await api.put(`/staff/${editing}`, patch);
        toast.success("Staff updated");
      } else {
        if (!form.password) return toast.error("Password required");
        await api.post("/staff", form);
        toast.success("Staff added");
      }
      setOpen(false); setForm(empty); setEditing(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const del = async (s) => {
    if (!window.confirm(`Remove ${s.name} (${s.role})?`)) return;
    try { await api.delete(`/staff/${s.id}`); toast.success("Removed"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const byRole = (r) => staff.filter((s) => s.role === r);

  return (
    <AppShell>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl">Staff & Permissions</h1>
          <p className="text-sm text-brand-900/60 mt-1">Add captains, chefs and cashiers. Permissions follow their role automatically (RBAC).</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-brand-500 hover:bg-brand-600 text-white" onClick={() => { setEditing(null); setForm(empty); }} data-testid="staff-add-btn">
              <Plus className="w-4 h-4 mr-2" /> Add staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">{editing ? "Edit staff" : "New staff member"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2"><Label>Full name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="staff-form-name" /></div>
              <div><Label>Email</Label><Input type="email" disabled={!!editing} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="staff-form-email" /></div>
              <div><Label>{editing ? "New password (optional)" : "Password"}</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="staff-form-password" /></div>
              <div className="md:col-span-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger data-testid="staff-form-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-brand-900/60 mt-1">{ROLES.find((r) => r.value === form.role)?.note}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} className="bg-brand-500 hover:bg-brand-600 text-white" data-testid="staff-form-save">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {ROLES.map((r) => (
          <div key={r.value} className="bg-white border border-earth-border rounded-2xl p-5" data-testid={`staff-role-${r.value}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-500 flex items-center justify-center">
                <r.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading text-lg">{r.label}</h3>
                <p className="text-[11px] text-brand-900/60">{r.note}</p>
              </div>
              <Badge className="ml-auto bg-brand-50 text-brand-500 border border-brand-100 text-[10px] uppercase tracking-widest">
                {byRole(r.value).length}
              </Badge>
            </div>
            <ul className="mt-4 divide-y divide-earth-border">
              {byRole(r.value).length === 0 && <li className="py-4 text-xs text-brand-900/50 text-center">No {r.label.toLowerCase()} yet.</li>}
              {byRole(r.value).map((s) => (
                <li key={s.id} className="py-3 flex items-center gap-2" data-testid={`staff-row-${s.id}`}>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-[11px] text-brand-900/50">{s.email}</div>
                  </div>
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => { setEditing(s.id); setForm({ name: s.name, email: s.email, password: "", role: s.role }); setOpen(true); }} data-testid={`staff-edit-${s.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => del(s)} data-testid={`staff-delete-${s.id}`}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-brand-50/50 border border-brand-100 rounded-2xl p-5 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
        <div className="text-sm text-brand-900/80">
          <b>RBAC is automatic.</b> Each role has a fixed set of permissions.
          <ul className="list-disc ml-5 mt-1 text-xs text-brand-900/70 space-y-0.5">
            <li><b>Captain</b>: Tables, Bills, edit/swap items, Inventory view, Send KOT</li>
            <li><b>Chef</b>: Kitchen Display, mark items ready/served</li>
            <li><b>Cashier</b>: Collect Cash/UPI/Card payments, Close Day</li>
            <li><b>Owner (you)</b>: Full access</li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
