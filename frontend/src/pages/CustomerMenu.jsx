import { useEffect, useMemo, useState } from "react";
import { api, money } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Minus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function CustomerMenu() {
  const { user } = useAuth();
  const [menu, setMenu] = useState([]);
  const [settings, setSettings] = useState({ cgst_rate: 2.5, sgst_rate: 2.5 });
  const [cart, setCart] = useState([]);
  const [table, setTable] = useState("");

  useEffect(() => {
    (async () => {
      const [m, s] = await Promise.all([api.get("/menu"), api.get("/settings")]);
      setMenu(m.data);
      setSettings(s.data);
    })();
  }, []);

  const categories = useMemo(() => Array.from(new Set(menu.map((i) => i.category))), [menu]);

  const add = (i) => setCart((c) => {
    const ex = c.find((x) => x.menu_item_id === i.id);
    return ex
      ? c.map((x) => x.menu_item_id === i.id ? { ...x, quantity: x.quantity + 1 } : x)
      : [...c, { menu_item_id: i.id, name: i.name, price: i.price, quantity: 1 }];
  });
  const dec = (id) =>
    setCart((c) => c.flatMap((x) => x.menu_item_id === id ? (x.quantity > 1 ? [{ ...x, quantity: x.quantity - 1 }] : []) : [x]));

  const subtotal = cart.reduce((s, x) => s + x.price * x.quantity, 0);
  const cgst = +(subtotal * settings.cgst_rate / 100).toFixed(2);
  const sgst = +(subtotal * settings.sgst_rate / 100).toFixed(2);
  const total = +(subtotal + cgst + sgst).toFixed(2);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    try {
      const { data } = await api.post("/orders", { items: cart, table_number: table || null, customer_name: user?.name });
      toast.success(`Order #${data.order_number} placed — sent to kitchen!`);
      setCart([]);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to place order");
    }
  };

  return (
    <AppShell>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl">Today's Menu</h1>
          <p className="text-sm text-brand-900/60 mt-1">Browse our kitchen, add to cart and place your order.</p>
          {categories.length > 0 && (
            <Tabs defaultValue={categories[0]} className="mt-6">
              <TabsList className="h-auto flex flex-wrap gap-1 bg-white border border-earth-border p-1 rounded-xl">
                {categories.map((c) => (
                  <TabsTrigger key={c} value={c} className="h-11 px-4 data-[state=active]:bg-brand-500 data-[state=active]:text-white rounded-lg" data-testid={`customer-tab-${c.toLowerCase().replace(/\s+/g, "-")}`}>
                    {c}
                  </TabsTrigger>
                ))}
              </TabsList>
              {categories.map((c) => (
                <TabsContent key={c} value={c} className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {menu.filter((x) => x.category === c && x.is_available).map((it) => (
                    <div key={it.id} className="bg-white border border-earth-border rounded-xl p-4 flex items-start justify-between gap-3" data-testid={`customer-item-${it.id}`}>
                      <div>
                        <div className="font-heading text-lg leading-tight">{it.name}</div>
                        <div className="text-xs text-brand-900/60 mt-1">{it.description}</div>
                        <div className="text-sm font-medium mt-2">{money(it.price)}</div>
                      </div>
                      <Button size="sm" onClick={() => add(it)} className="bg-brand-500 hover:bg-brand-600 text-white" data-testid={`customer-add-${it.id}`}>
                        <Plus className="w-4 h-4 mr-1" /> Add
                      </Button>
                    </div>
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>

        <aside className="bg-white border border-earth-border rounded-2xl p-5 h-fit lg:sticky lg:top-24">
          <h3 className="font-heading text-xl">Your cart</h3>
          <Input placeholder="Table # (optional)" value={table} onChange={(e) => setTable(e.target.value)} className="mt-3" data-testid="customer-table-input" />
          <ul className="mt-4 divide-y divide-earth-border">
            {cart.length === 0 && <li className="py-10 text-center text-sm text-brand-900/50">No items yet.</li>}
            {cart.map((x) => (
              <li key={x.menu_item_id} className="py-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-sm font-medium">{x.name}</div>
                  <div className="text-xs text-brand-900/50">{money(x.price)} × {x.quantity}</div>
                </div>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => dec(x.menu_item_id)}><Minus className="w-3 h-3" /></Button>
                <span className="w-5 text-center text-sm">{x.quantity}</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => add({ id: x.menu_item_id, name: x.name, price: x.price })}><Plus className="w-3 h-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => setCart((c) => c.filter((y) => y.menu_item_id !== x.menu_item_id))}><Trash2 className="w-4 h-4 text-brand-500" /></Button>
              </li>
            ))}
          </ul>
          <div className="border-t border-earth-border mt-3 pt-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-brand-900/60">Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-brand-900/60">CGST {settings.cgst_rate}%</span><span>{money(cgst)}</span></div>
            <div className="flex justify-between"><span className="text-brand-900/60">SGST {settings.sgst_rate}%</span><span>{money(sgst)}</span></div>
            <div className="flex justify-between mt-2 pt-2 border-t border-earth-border">
              <span className="font-heading text-lg">Total</span>
              <span className="font-heading text-lg text-brand-500" data-testid="customer-cart-total">{money(total)}</span>
            </div>
          </div>
          <Button disabled={cart.length === 0} onClick={placeOrder} className="mt-4 w-full h-11 bg-brand-500 hover:bg-brand-600 text-white" data-testid="customer-place-order-btn">
            Place order
          </Button>
        </aside>
      </div>
    </AppShell>
  );
}
