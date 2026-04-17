import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Settings() {
  const [s, setS] = useState(null);

  useEffect(() => { api.get("/settings").then(({ data }) => setS(data)); }, []);

  if (!s) return <AppShell><div className="py-20 text-center text-brand-900/60">Loading…</div></AppShell>;

  const save = async () => {
    try {
      const { data } = await api.put("/settings", {
        cgst_rate: Number(s.cgst_rate),
        sgst_rate: Number(s.sgst_rate),
        restaurant_name: s.restaurant_name,
        address: s.address,
        phone: s.phone,
        gstin: s.gstin,
      });
      setS(data);
      toast.success("Settings saved");
    } catch (e) {
      toast.error("Failed to save");
    }
  };

  return (
    <AppShell>
      <h1 className="font-heading text-3xl md:text-4xl">Settings</h1>
      <p className="text-sm text-brand-900/60 mt-1">Taxes and restaurant info used on all KOT and bills.</p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        <Field label="Restaurant name"><Input value={s.restaurant_name} onChange={(e) => setS({ ...s, restaurant_name: e.target.value })} data-testid="settings-name" /></Field>
        <Field label="GSTIN"><Input value={s.gstin} onChange={(e) => setS({ ...s, gstin: e.target.value })} data-testid="settings-gstin" /></Field>
        <Field label="Address"><Input value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} data-testid="settings-address" /></Field>
        <Field label="Phone"><Input value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} data-testid="settings-phone" /></Field>
        <Field label="CGST %"><Input type="number" step="0.01" value={s.cgst_rate} onChange={(e) => setS({ ...s, cgst_rate: e.target.value })} data-testid="settings-cgst" /></Field>
        <Field label="SGST %"><Input type="number" step="0.01" value={s.sgst_rate} onChange={(e) => setS({ ...s, sgst_rate: e.target.value })} data-testid="settings-sgst" /></Field>
      </div>

      <Button onClick={save} className="mt-6 bg-brand-500 hover:bg-brand-600 text-white h-11" data-testid="settings-save-btn">Save changes</Button>
    </AppShell>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
