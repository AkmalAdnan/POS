import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UtensilsCrossed } from "lucide-react";

const HOME_BY_ROLE = { owner: "/dashboard", staff: "/pos", customer: "/browse" };

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await login(form.email.trim(), form.password);
    setLoading(false);
    if (res.ok) {
      toast.success(`Welcome back, ${res.user.name}`);
      const fallback = HOME_BY_ROLE[res.user.role] || "/";
      navigate(location.state?.from?.pathname || fallback, { replace: true });
    } else {
      toast.error(res.error);
    }
  };

  const quick = async (email, password) => {
    setForm({ email, password });
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) {
      toast.success(`Signed in as ${res.user.role}`);
      navigate(HOME_BY_ROLE[res.user.role] || "/", { replace: true });
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex relative items-end p-10 bg-brand-900 text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-40 bg-cover bg-center"
          style={{
            backgroundImage: `url(https://images.unsplash.com/photo-1727342427606-ce89e636330e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzOTB8MHwxfHNlYXJjaHwxfHx0ZXJyYWNvdHRhJTIwYWJzdHJhY3QlMjB0ZXh0dXJlfGVufDB8fHx8MTc3NjQzMjIwM3ww&ixlib=rb-4.1.0&q=85)`,
          }}
        />
        <div className="relative max-w-sm">
          <UtensilsCrossed className="w-10 h-10 text-[#E8B25C] mb-6" />
          <h2 className="font-heading text-4xl leading-tight">Your kitchen, finally in rhythm.</h2>
          <p className="mt-4 text-white/80 text-sm leading-relaxed">
            Sign in to take orders, push tickets to the kitchen, print bills with CGST & SGST and close the day with a tap.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-8 bg-[#F9F6F0]">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 mb-10" data-testid="login-logo">
            <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading text-xl">Spice Route</span>
          </Link>
          <h1 className="font-heading text-3xl">Welcome back</h1>
          <p className="text-sm text-brand-900/60 mt-1">Sign in to continue to your POS.</p>

          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="login-form">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                data-testid="login-email-input"
                className="mt-1 h-11"
                placeholder="owner@spice.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                data-testid="login-password-input"
                className="mt-1 h-11"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 bg-brand-500 hover:bg-brand-600 text-white" data-testid="login-submit-btn">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6">
            <div className="text-[11px] uppercase tracking-[0.22em] text-brand-500 mb-2">Demo accounts</div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={() => quick("owner@spice.com", "owner123")} data-testid="quick-owner-btn">Owner</Button>
              <Button variant="outline" size="sm" onClick={() => quick("staff@spice.com", "staff123")} data-testid="quick-staff-btn">Staff</Button>
              <Button variant="outline" size="sm" onClick={() => quick("guest@spice.com", "guest123")} data-testid="quick-customer-btn">Customer</Button>
            </div>
          </div>

          <p className="mt-8 text-sm text-brand-900/70">
            New here?{" "}
            <Link to="/register" className="text-brand-500 hover:underline" data-testid="login-to-register">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
