import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, UtensilsCrossed } from "lucide-react";

const linkCls = ({ isActive }) =>
  `px-3 py-2 rounded-md text-sm font-medium tracking-wide transition-colors ${
    isActive ? "bg-brand-500 text-white" : "text-brand-900 hover:bg-brand-50"
  }`;

const LINKS = {
  owner: [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/owner/tables", label: "Tables" },
    { to: "/owner/staff", label: "Staff" },
    { to: "/menu", label: "Menu" },
    { to: "/inventory", label: "Inventory" },
    { to: "/orders", label: "Orders" },
    { to: "/settings", label: "Settings" },
  ],
  captain: [
    { to: "/captain", label: "Tables" },
    { to: "/captain/running", label: "Running Orders" },
    { to: "/captain/all", label: "All Orders" },
    { to: "/captain/closed", label: "Orders Closed" },
  ],
  chef: [
    { to: "/kds", label: "Kitchen" },
  ],
  cashier: [
    { to: "/cashier", label: "Payments" },
  ],
  customer: [
    { to: "/browse", label: "Menu" },
    { to: "/my-orders", label: "My Orders" },
  ],
};

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = user ? LINKS[user.role] || [] : [];

  return (
    <div className="min-h-screen bg-[#F9F6F0]">
      <header className="no-print sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-earth-border">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="nav-logo">
            <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-heading text-lg font-semibold">Spice Route</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-brand-500">POS · KOT · Bill</div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 flex-wrap">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end className={linkCls} data-testid={`nav-${l.label.toLowerCase().replace(/\s+/g, "-")}`}>
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden sm:flex flex-col items-end leading-tight">
                <span className="text-sm font-medium">{user.name}</span>
                <span className="text-[10px] uppercase tracking-[0.22em] text-brand-500">{user.role}</span>
              </div>
            )}
            {user ? (
              <Button variant="outline" size="sm" onClick={async () => { await logout(); navigate("/login"); }} data-testid="nav-logout" className="border-earth-border hover:bg-brand-50">
                <LogOut className="w-4 h-4 mr-1" /> Logout
              </Button>
            ) : (
              <Button asChild size="sm" className="bg-brand-500 hover:bg-brand-600 text-white" data-testid="nav-login">
                <Link to="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-[1400px] mx-auto p-6">{children}</main>
    </div>
  );
}
