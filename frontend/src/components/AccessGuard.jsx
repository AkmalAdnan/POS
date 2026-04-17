import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { MapPin, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Wraps captain/chef/cashier routes. If owner has enabled geofence or IP
 * whitelist in Settings, checks browser geolocation + server IP validation.
 * Blocks the UI with a full-screen error if not within premises.
 */
export default function AccessGuard({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState({ status: "checking", reason: "" });

  useEffect(() => {
    if (!user) return;
    // Owner/customer always allowed; skip check to avoid needless geo prompts
    if (user.role === "owner" || user.role === "customer") {
      setState({ status: "ok" });
      return;
    }

    const run = async (lat, lng) => {
      try {
        const { data } = await api.post("/guard/check", { lat, lng });
        if (data.allowed) setState({ status: "ok" });
        else setState({ status: "blocked", reason: data.reason, ip_ok: data.ip_ok, geo_ok: data.geo_ok });
      } catch {
        setState({ status: "blocked", reason: "Unable to verify location" });
      }
    };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => run(pos.coords.latitude, pos.coords.longitude),
        () => run(null, null),   // denied — backend will fail geofence if enabled
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      );
    } else {
      run(null, null);
    }
  }, [user]);

  if (state.status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F6F0]">
        <div className="text-center">
          <MapPin className="w-8 h-8 text-brand-500 mx-auto animate-pulse" />
          <div className="mt-3 text-xs tracking-[0.25em] uppercase text-brand-500">Verifying location…</div>
        </div>
      </div>
    );
  }

  if (state.status === "blocked") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F6F0] p-6">
        <div className="max-w-md text-center bg-white border border-earth-border rounded-2xl p-10">
          <ShieldAlert className="w-10 h-10 text-red-500 mx-auto" />
          <h1 className="font-heading text-2xl mt-4">Access restricted</h1>
          <p className="text-sm text-brand-900/70 mt-2">
            This app can only be used inside the restaurant premises and on the hotel WiFi.
          </p>
          <p className="text-xs text-red-600 mt-2" data-testid="guard-reason">{state.reason}</p>
          <Button
            className="mt-6 bg-brand-500 hover:bg-brand-600 text-white"
            onClick={() => window.location.reload()}
            data-testid="guard-retry-btn"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return children ?? <Outlet />;
}
