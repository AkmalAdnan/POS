import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LogOut, UtensilsCrossed, Menu, WifiOff } from "lucide-react";

const linkCls = ({ isActive }) =>
  `px-3 py-2 rounded-md text-sm font-medium tracking-wide transition-colors ${
    isActive ? "bg-brand-500 text-white" : "text-brand-900 hover:bg-brand-50"
  }`;

const mobileLinkCls = ({ isActive }) =>
  `block px-4 py-3 rounded-lg text-base font-medium ${
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
    { to: "/orders/takeaway", label: "Take-away" },
    { to: "/settings", label: "Settings" },
  ],
  captain: [
    { to: "/captain", label: "Tables" },
    { to: "/captain/running", label: "Running Orders" },
    { to: "/captain/all", label: "All Orders" },
    { to: "/captain/closed", label: "Orders Closed" },
  ],
  chef: [{ to: "/kds", label: "Kitchen" }],
  cashier: [{ to: "/cashier", label: "Payments" }],
  customer: [
    { to: "/browse", label: "Menu" },
    { to: "/my-orders", label: "My Orders" },
  ],
};

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const online = useOnlineStatus();
  const links = user ? LINKS[user.role] || [] : [];

  const doLogout = async () => { await logout(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-[#F9F6F0]">
      {!online && (
        <div
          data-testid="offline-banner"
          className="no-print sticky top-0 z-50 w-full bg-amber-500 text-white text-sm font-medium px-4 py-2 flex items-center justify-center gap-2"
        >
          <WifiOff className="w-4 h-4" />
          Offline — orders & updates will sync automatically when you're back online.
        </div>
      )}
      <header className="no-print sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-earth-border">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 min-w-0" data-testid="nav-logo">
            <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight hidden xs:block sm:block">
              <div className="font-heading text-base md:text-lg font-semibold">Spice Route</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-brand-500 hidden sm:block">POS · KOT · Bill</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1 flex-wrap">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end className={linkCls} data-testid={`nav-${l.label.toLowerCase().replace(/\s+/g, "-")}`}>
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user && (
              <div className="hidden sm:flex flex-col items-end leading-tight">
                <span className="text-sm font-medium truncate max-w-[140px]">{user.name}</span>
                <span className="text-[10px] uppercase tracking-[0.22em] text-brand-500">{user.role}</span>
              </div>
            )}
            {user ? (
              <Button variant="outline" size="sm" onClick={doLogout} data-testid="nav-logout" className="hidden sm:inline-flex border-earth-border hover:bg-brand-50">
                <LogOut className="w-4 h-4 mr-1" /> Logout
              </Button>
            ) : (
              <Button asChild size="sm" className="bg-brand-500 hover:bg-brand-600 text-white" data-testid="nav-login">
                <Link to="/login">Sign in</Link>
              </Button>
            )}

            {/* Mobile menu button */}
            {user && (
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="lg:hidden h-10 w-10" data-testid="nav-mobile-toggle">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[84vw] max-w-[320px] p-0">
                  <div className="p-5 border-b border-earth-border">
                    <div className="font-heading text-lg">{user.name}</div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-brand-500 mt-0.5">{user.role}</div>
                  </div>
                  <nav className="p-3 space-y-1">
                    {links.map((l) => (
                      <NavLink
                        key={l.to}
                        to={l.to}
                        end
                        className={mobileLinkCls}
                        onClick={() => setOpen(false)}
                        data-testid={`nav-m-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {l.label}
                      </NavLink>
                    ))}
                  </nav>
                  <div className="p-3 border-t border-earth-border">
                    <Button variant="outline" onClick={doLogout} className="w-full h-11" data-testid="nav-m-logout">
                      <LogOut className="w-4 h-4 mr-2" /> Logout
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-[1400px] mx-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
