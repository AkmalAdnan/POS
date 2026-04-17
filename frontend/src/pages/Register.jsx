import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UtensilsCrossed } from "lucide-react";

const HOME_BY_ROLE = { owner: "/dashboard", staff: "/pos", customer: "/browse" };

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "customer" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await register({ ...form, email: form.email.trim().toLowerCase() });
    setLoading(false);
    if (res.ok) {
      toast.success(`Welcome, ${res.user.name}!`);
      navigate(HOME_BY_ROLE[res.user.role] || "/", { replace: true });
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9F6F0] p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-earth-border p-8">
        <Link to="/" className="inline-flex items-center gap-2 mb-8" data-testid="register-logo">
          <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading text-xl">Spice Route</span>
        </Link>
        <h1 className="font-heading text-3xl">Create account</h1>
        <p className="text-sm text-brand-900/60 mt-1">Pick your role and start in seconds.</p>

        <form onSubmit={submit} className="mt-8 space-y-4" data-testid="register-form">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 h-11" data-testid="register-name-input" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 h-11" data-testid="register-email-input" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 h-11" data-testid="register-password-input" />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger className="mt-1 h-11" data-testid="register-role-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Customer — browse and order</SelectItem>
                <SelectItem value="staff">Staff — take orders at POS</SelectItem>
                <SelectItem value="owner">Owner — full access & reports</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11 bg-brand-500 hover:bg-brand-600 text-white" data-testid="register-submit-btn">
            {loading ? "Creating…" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-brand-900/70">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-500 hover:underline" data-testid="register-to-login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
