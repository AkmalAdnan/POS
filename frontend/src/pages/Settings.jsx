import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { MapPin, Shield } from "lucide-react";

export default function Settings() {
  const [s, setS] = useState(null);
  const [newIp, setNewIp] = useState("");

  useEffect(() => { api.get("/settings").then(({ data }) => setS(data)); }, []);

  if (!s) return <AppShell><div className="py-20 text-center text-brand-900/60">Loading…</div></AppShell>;

  const save = async () => {
    try {
      const payload = {
        cgst_rate: Number(s.cgst_rate), sgst_rate: Number(s.sgst_rate),
        restaurant_name: s.restaurant_name, address: s.address, phone: s.phone, gstin: s.gstin,
        restaurant_lat: Number(s.restaurant_lat || 0), restaurant_lng: Number(s.restaurant_lng || 0),
        geofence_radius_m: Number(s.geofence_radius_m || 200),
        geofence_enabled: !!s.geofence_enabled,
        ip_check_enabled: !!s.ip_check_enabled,
        allowed_ips: s.allowed_ips || [],
      };
      const { data } = await api.put("/settings", payload);
      setS(data);
      toast.success("Settings saved");
    } catch (e) { toast.error("Failed to save"); }
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) return toast.error("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (p) => setS({ ...s, restaurant_lat: p.coords.latitude, restaurant_lng: p.coords.longitude }),
      () => toast.error("Could not read location"),
    );
  };

  const addIp = () => {
    const v = newIp.trim();
    if (!v) return;
    setS({ ...s, allowed_ips: [...(s.allowed_ips || []), v] });
    setNewIp("");
  };
  const removeIp = (ip) => setS({ ...s, allowed_ips: (s.allowed_ips || []).filter((x) => x !== ip) });

  return (
    <AppShell>
      <h1 className="font-heading text-3xl md:text-4xl">Settings</h1>
      <p className="text-sm text-brand-900/60 mt-1">Restaurant info, taxes, and access control for captains.</p>

      {/* Restaurant & Tax */}
      <section className="mt-6 bg-white border border-earth-border rounded-2xl p-6">
        <h2 className="font-heading text-xl">Restaurant</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <F label="Restaurant name"><Input value={s.restaurant_name} onChange={(e) => setS({ ...s, restaurant_name: e.target.value })} data-testid="settings-name" /></F>
          <F label="GSTIN"><Input value={s.gstin} onChange={(e) => setS({ ...s, gstin: e.target.value })} data-testid="settings-gstin" /></F>
          <F label="Address"><Input value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} data-testid="settings-address" /></F>
          <F label="Phone"><Input value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} data-testid="settings-phone" /></F>
          <F label="CGST %"><Input type="number" step="0.01" value={s.cgst_rate} onChange={(e) => setS({ ...s, cgst_rate: e.target.value })} data-testid="settings-cgst" /></F>
          <F label="SGST %"><Input type="number" step="0.01" value={s.sgst_rate} onChange={(e) => setS({ ...s, sgst_rate: e.target.value })} data-testid="settings-sgst" /></F>
        </div>
      </section>

      {/* Access control */}
      <section className="mt-6 bg-white border border-earth-border rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-brand-500" />
          <h2 className="font-heading text-xl">Access control · restrict captains to premises</h2>
        </div>
        <p className="text-xs text-brand-900/60 mt-1">Enable either check. Captains must pass ALL enabled checks to use the POS.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5">
          {/* Geofence */}
          <div className="border border-earth-border rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div className="font-heading text-base flex items-center gap-2"><MapPin className="w-4 h-4 text-brand-500" /> GPS Geofence</div>
              <Switch checked={!!s.geofence_enabled} onCheckedChange={(v) => setS({ ...s, geofence_enabled: v })} data-testid="settings-geofence-toggle" />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <F label="Latitude"><Input value={s.restaurant_lat} onChange={(e) => setS({ ...s, restaurant_lat: e.target.value })} data-testid="settings-lat" /></F>
              <F label="Longitude"><Input value={s.restaurant_lng} onChange={(e) => setS({ ...s, restaurant_lng: e.target.value })} data-testid="settings-lng" /></F>
              <F label="Radius (metres)"><Input type="number" value={s.geofence_radius_m} onChange={(e) => setS({ ...s, geofence_radius_m: e.target.value })} data-testid="settings-radius" /></F>
              <div className="flex items-end">
                <Button variant="outline" onClick={useMyLocation} data-testid="settings-use-location-btn">Use my location</Button>
              </div>
            </div>
          </div>

          {/* IP Whitelist */}
          <div className="border border-earth-border rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div className="font-heading text-base">IP Whitelist (WiFi)</div>
              <Switch checked={!!s.ip_check_enabled} onCheckedChange={(v) => setS({ ...s, ip_check_enabled: v })} data-testid="settings-ip-toggle" />
            </div>
            <p className="text-xs text-brand-900/60 mt-1">Add the public IP (or CIDR like <code>203.0.113.0/24</code>) of your hotel WiFi.</p>
            <div className="flex gap-2 mt-3">
              <Input value={newIp} onChange={(e) => setNewIp(e.target.value)} placeholder="e.g. 203.0.113.42" data-testid="settings-ip-input" />
              <Button onClick={addIp} className="bg-brand-500 hover:bg-brand-600 text-white" data-testid="settings-ip-add-btn">Add</Button>
            </div>
            <ul className="mt-3 space-y-1">
              {(s.allowed_ips || []).length === 0 && <li className="text-xs text-brand-900/50">No IPs added yet.</li>}
              {(s.allowed_ips || []).map((ip) => (
                <li key={ip} className="flex items-center justify-between text-sm border border-earth-border rounded-md px-3 py-1.5" data-testid={`settings-ip-${ip}`}>
                  <span className="font-mono">{ip}</span>
                  <button onClick={() => removeIp(ip)} className="text-red-500 text-xs hover:underline">Remove</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <Button onClick={save} className="mt-6 bg-brand-500 hover:bg-brand-600 text-white h-11" data-testid="settings-save-btn">Save all settings</Button>
    </AppShell>
  );
}

function F({ label, children }) {
  return <div><Label>{label}</Label><div className="mt-1">{children}</div></div>;
}
