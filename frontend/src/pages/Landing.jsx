import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UtensilsCrossed, Printer, ChefHat, BarChart3, FileSpreadsheet, ShieldCheck } from "lucide-react";

export default function Landing() {
  const bg =
    "https://images.unsplash.com/photo-1727342427606-ce89e636330e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzOTB8MHwxfHNlYXJjaHwxfHx0ZXJyYWNvdHRhJTIwYWJzdHJhY3QlMjB0ZXh0dXJlfGVufDB8fHx8MTc3NjQzMjIwM3ww&ixlib=rb-4.1.0&q=85";

  const features = [
    { icon: Printer, title: "KOT & Bill Printing", text: "One-tap printable Kitchen Order Tickets and customer bills with GSTIN, CGST & SGST breakdown." },
    { icon: ChefHat, title: "Live Kitchen Display", text: "Orders pop up on the kitchen screen the moment staff place them. Toggle status New → Ready → Served." },
    { icon: BarChart3, title: "Owner Dashboard", text: "Revenue, expenses, profit or loss — all visualised in a clean pie chart, refreshed live." },
    { icon: FileSpreadsheet, title: "End-of-Day CSV Export", text: "Download every order of the day as a CSV with one click. Perfect for accounting." },
    { icon: ShieldCheck, title: "Role-Based Access", text: "Owners, Staff and Customers each get their own dedicated experience — with secure JWT auth." },
    { icon: UtensilsCrossed, title: "Indian Menu Ready", text: "Seeded with Mains, Chinese, Biryanis, Roti, Fried Rice, Mandi, Sweets and Mutton categories." },
  ];

  return (
    <div className="min-h-screen bg-[#F9F6F0]">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 bg-cover bg-center"
          style={{ backgroundImage: `url(${bg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#F9F6F0]/80 via-[#F9F6F0]/60 to-[#F9F6F0]" />
        <div className="relative max-w-[1200px] mx-auto px-6 pt-20 pb-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-earth-border bg-white/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-brand-500">
            <UtensilsCrossed className="w-3.5 h-3.5" /> Restaurant POS · India ready
          </div>
          <h1 className="font-heading mt-6 text-5xl md:text-7xl font-semibold leading-[0.95] max-w-3xl">
            Run your <span className="text-brand-500">kitchen</span>,<br />not your paperwork.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-brand-900/80">
            A warm, no-nonsense POS for Indian restaurants. Take orders, print KOT & bills with
            CGST + SGST, see every plate on the kitchen display, and close the day with a single CSV.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-brand-500 hover:bg-brand-600 text-white h-12 px-6" data-testid="cta-get-started">
              <Link to="/login">Sign in to your POS</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 border-earth-border" data-testid="cta-register">
              <Link to="/register">Create account</Link>
            </Button>
          </div>
          <div className="mt-6 text-xs text-brand-900/60">
            Demo owner: <span className="font-mono">owner@spice.com / owner123</span> · staff@spice.com / staff123 · guest@spice.com / guest123
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-[1200px] mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl border border-earth-border p-7 hover:-translate-y-0.5 transition-transform">
              <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-500 flex items-center justify-center">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-heading text-xl mt-5">{f.title}</h3>
              <p className="mt-2 text-sm text-brand-900/70 leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-earth-border py-8 text-center text-xs text-brand-900/60">
        Built for small Indian restaurants. © Spice Route POS
      </footer>
    </div>
  );
}
