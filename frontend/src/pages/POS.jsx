import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, money } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Minus, Trash2, Printer, Send, ReceiptText } from "lucide-react";

export default function POS() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [menu, setMenu] = useState([]);
  const [settings, setSettings] = useState({ cgst_rate: 2.5, sgst_rate: 2.5 });
  const [cart, setCart] = useState([]);
  const [table, setTable] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [m, s] = await Promise.all([api.get("/menu"), api.get("/settings")]);
      setMenu(m.data);
      setSettings(s.data);
    })();
  }, []);

  const categories = useMemo(() => {
    const set = new Set(menu.map((i) => i.category));
    return Array.from(set);
  }, [menu]);

  const add = (item) => {
    setCart((c) => {
      const ex = c.find((x) => x.menu_item_id === item.id);
      if (ex) return c.map((x) => x.menu_item_id === item.id ? { ...x, quantity: x.quantity + 1 } : x);
      return [...c, { menu_item_id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };
  const dec = (id) =>
    setCart((c) => c.flatMap((x) => x.menu_item_id === id ? (x.quantity > 1 ? [{ ...x, quantity: x.quantity - 1 }] : []) : [x]));
  const remove = (id) => setCart((c) => c.filter((x) => x.menu_item_id !== id));
  const clear = () => setCart([]);

  const subtotal = cart.reduce((s, x) => s + x.price * x.quantity, 0);
  const cgst = +(subtotal * settings.cgst_rate / 100).toFixed(2);
  const sgst = +(subtotal * settings.sgst_rate / 100).toFixed(2);
  const total = +(subtotal + cgst + sgst).toFixed(2);

  const placeOrder = async (then) => {
    if (cart.length === 0) return toast.error("Cart is empty");
    setLoading(true);
    try {
      const { data } = await api.post("/orders", {
        items: cart,
        table_number: table || null,
        customer_name: customerName || null,
        notes,
      });
      toast.success(`Order #${data.order_number} sent to kitchen`);
      clear(); setTable(""); setCustomerName(""); setNotes("");
      if (then === "kot") window.open(`/print/kot/${data.id}`, "_blank");
      if (then === "bill") window.open(`/print/bill/${data.id}`, "_blank");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to place order");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <AppShell>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        {/* Menu */}
        <div>
          <div className="flex items-end justify-between mb-6">
            <div>
              <h1 className="font-heading text-3xl md:text-4xl">Take an Order</h1>
              <p className="text-sm text-brand-900/60 mt-1">Pick items from the menu. Taxes auto-calculate.</p>
            </div>
            <Button variant="outline" onClick={() => navigate("/kds")} data-testid="pos-goto-kds-btn">Open Kitchen Display</Button>
          </div>
          {categories.length === 0 ? (
            <div className="bg-white border border-earth-border rounded-2xl p-10 text-center text-brand-900/60">Loading menu…</div>
          ) : (
            <Tabs defaultValue={categories[0]} className="w-full">
              <TabsList className="h-auto flex flex-wrap gap-1 bg-white border border-earth-border p-1 rounded-xl">
                {categories.map((c) => (
                  <TabsTrigger key={c} value={c} className="h-11 px-4 data-[state=active]:bg-brand-500 data-[state=active]:text-white rounded-lg" data-testid={`pos-tab-${c.toLowerCase().replace(/\s+/g, "-")}`}>
                    {c}
                  </TabsTrigger>
                ))}
              </TabsList>
              {categories.map((c) => (
                <TabsContent key={c} value={c} className="mt-5">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {menu.filter((x) => x.category === c && x.is_available).map((it) => (
                      <button
                        key={it.id}
                        onClick={() => add(it)}
                        className="group text-left bg-white border border-earth-border rounded-xl p-4 hover:-translate-y-0.5 hover:border-brand-300 transition-all"
                        data-testid={`pos-item-${it.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-heading text-base leading-tight">{it.name}</div>
                            <div className="text-[11px] uppercase tracking-[0.18em] text-brand-500 mt-1">{it.category}</div>
                          </div>
                          <div className="text-sm font-medium text-brand-900">{money(it.price)}</div>
                        </div>
                        <div className="mt-3 text-xs text-brand-900/60 line-clamp-2">{it.description}</div>
                        <div className="mt-4 inline-flex items-center gap-1 text-xs text-brand-500 group-hover:text-brand-600">
                          <Plus className="w-3.5 h-3.5" /> Add to cart
                        </div>
                      </button>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>

        {/* Cart */}
        <aside className="bg-white border border-earth-border rounded-2xl p-5 h-fit lg:sticky lg:top-24" data-testid="pos-cart">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl">Current Order</h2>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clear} data-testid="pos-cart-clear-btn" className="text-brand-500 hover:text-brand-600">
                <Trash2 className="w-4 h-4 mr-1" /> Clear
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <Input placeholder="Table #" value={table} onChange={(e) => setTable(e.target.value)} data-testid="pos-table-input" />
            <Input placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} data-testid="pos-customer-input" />
          </div>
          <Input className="mt-2" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="pos-notes-input" />

          <ScrollArea className="mt-4 max-h-[46vh]">
            {cart.length === 0 ? (
              <div className="py-10 text-center text-sm text-brand-900/50">No items yet. Tap a dish to add.</div>
            ) : (
              <ul className="divide-y divide-earth-border">
                {cart.map((x) => (
                  <li key={x.menu_item_id} className="py-3 flex items-center gap-3" data-testid={`pos-cart-row-${x.menu_item_id}`}>
                    <div className="flex-1">
                      <div className="text-sm font-medium leading-tight">{x.name}</div>
                      <div className="text-xs text-brand-900/50">{money(x.price)} × {x.quantity}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => dec(x.menu_item_id)} data-testid={`pos-dec-${x.menu_item_id}`}><Minus className="w-3 h-3" /></Button>
                      <span className="w-6 text-center text-sm font-semibold">{x.quantity}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setCart((c) => c.map((i) => i.menu_item_id === x.menu_item_id ? { ...i, quantity: i.quantity + 1 } : i))} data-testid={`pos-inc-${x.menu_item_id}`}><Plus className="w-3 h-3" /></Button>
                    </div>
                    <div className="w-20 text-right text-sm font-semibold">{money(x.price * x.quantity)}</div>
                    <button onClick={() => remove(x.menu_item_id)} className="text-brand-500/60 hover:text-brand-500" data-testid={`pos-remove-${x.menu_item_id}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>

          <div className="border-t border-earth-border mt-4 pt-4 space-y-1 text-sm">
            <Row label="Subtotal" value={money(subtotal)} />
            <Row label={`CGST @ ${settings.cgst_rate}%`} value={money(cgst)} />
            <Row label={`SGST @ ${settings.sgst_rate}%`} value={money(sgst)} />
            <div className="flex items-center justify-between pt-2 border-t border-earth-border mt-2">
              <span className="font-heading text-lg">Total</span>
              <span className="font-heading text-xl text-brand-500" data-testid="pos-cart-total">{money(total)}</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2">
            <Button disabled={loading || cart.length === 0} onClick={() => placeOrder()} className="h-11 bg-brand-500 hover:bg-brand-600 text-white" data-testid="pos-send-kitchen-btn">
              <Send className="w-4 h-4 mr-2" /> Send to Kitchen
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button disabled={loading || cart.length === 0} variant="outline" onClick={() => placeOrder("kot")} data-testid="pos-print-kot-btn">
                <Printer className="w-4 h-4 mr-2" /> Print KOT
              </Button>
              <Button disabled={loading || cart.length === 0} variant="outline" onClick={() => placeOrder("bill")} data-testid="pos-print-bill-btn">
                <ReceiptText className="w-4 h-4 mr-2" /> Print Bill
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-brand-900/60">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
