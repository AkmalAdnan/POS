import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, money } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Plus, Minus, Trash2, Printer, Search, Send, RefreshCw, Pencil, ReceiptText, Wallet, Smartphone, CreditCard, Check, X } from "lucide-react";

const STATUS_COLOR = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  ready: "bg-emerald-100 text-emerald-800 border-emerald-200",
  served: "bg-sky-100 text-sky-800 border-sky-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
};

const PAY_METHODS = [
  { id: "cash", label: "Cash", icon: Wallet },
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "card", label: "Card", icon: CreditCard },
];

export default function CaptainBill() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [bill, setBill] = useState(null);
  const [menu, setMenu] = useState([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("All");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [itemNotes, setItemNotes] = useState({});
  const [editing, setEditing] = useState(null); // {item, newMenuItemId, qty, notes}
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("cash");
  const [payAmount, setPayAmount] = useState(0);

  const load = async () => {
    const [b, m] = await Promise.all([api.get(`/bills/${id}`), api.get("/menu")]);
    setBill(b.data); setMenu(m.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  // when user types a search, jump to the "All" tab for best results
  useEffect(() => { if (query.trim()) setTab("All"); }, [query]);

  if (!bill) return <AppShell><div className="py-20 text-center text-brand-900/60">Loading bill…</div></AppShell>;

  const categories = ["All", ...Array.from(new Set(menu.map((i) => i.category)))];
  const filteredMenu = menu.filter((i) =>
    i.is_available && i.name.toLowerCase().includes(query.toLowerCase())
  );

  const pending = bill.items.filter((i) => !i.sent_to_kitchen);
  const sent = bill.items.filter((i) => i.sent_to_kitchen);

  const addItem = async (m) => {
    try {
      const notes = itemNotes[m.id] || "";
      const { data } = await api.post(`/bills/${id}/items`, { items: [{ menu_item_id: m.id, quantity: 1, notes }] });
      setBill(data); setItemNotes((s) => ({ ...s, [m.id]: "" }));
      toast.success(`${m.name} added`);
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to add"); }
  };

  const changeQty = async (itemId, delta) => {
    const target = bill.items.find((i) => i.id === itemId);
    if (!target) return;
    const q = Math.max(1, target.quantity + delta);
    const { data } = await api.put(`/bills/${id}/items/${itemId}`, { quantity: q });
    setBill(data);
  };

  const deleteItem = async (itemId) => {
    if (!window.confirm("Remove this item?")) return;
    const { data } = await api.delete(`/bills/${id}/items/${itemId}`);
    setBill(data);
  };

  const saveEdit = async () => {
    try {
      const { data } = await api.put(`/bills/${id}/items/${editing.item.id}`, {
        menu_item_id: editing.newMenuItemId || editing.item.menu_item_id,
        quantity: editing.qty,
        notes: editing.notes,
      });
      setBill(data); setEditing(null);
      toast.success("Item updated");
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const sendKot = async () => {
    try {
      const { data } = await api.post(`/bills/${id}/send-kot`);
      setBill(data); setPreviewOpen(false);
      toast.success("KOT sent to kitchen");
      // Open per-department print page
      const latest = data.kot_batches[data.kot_batches.length - 1].number;
      window.open(`/print/kot/${id}?batch=${latest}`, "_blank");
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const paid = bill.payment?.status === "received";

  const collectPayment = async () => {
    try {
      const { data } = await api.post(`/bills/${id}/payment`, { method: payMethod, amount: Number(payAmount) });
      setBill(data); setPayOpen(false);
      toast.success(`Payment received · ${payMethod.toUpperCase()}`);
    } catch (e) { toast.error(e.response?.data?.detail || "Payment failed"); }
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("/captain")} data-testid="bill-back-btn"><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-brand-500">Bill #{bill.bill_number} · Table {bill.table_name}</div>
            <h1 className="font-heading text-3xl">Captain: {bill.captain_name}</h1>
            <div className="text-xs text-brand-900/50">Opened {new Date(bill.created_at).toLocaleTimeString()} · {bill.kot_batches.length} KOT batch{bill.kot_batches.length === 1 ? "" : "es"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={paid ? "bg-emerald-100 text-emerald-800 border-emerald-200 uppercase tracking-widest" : "bg-red-100 text-red-800 border-red-200 uppercase tracking-widest"} data-testid="bill-payment-badge">
            {paid ? `Payment received · ${bill.payment.method?.toUpperCase()}` : "Payment pending"}
          </Badge>
          <Button variant="outline" onClick={() => window.open(`/print/bill/${id}`, "_blank")} data-testid="bill-print-bill-btn">
            <ReceiptText className="w-4 h-4 mr-2" /> Print Bill
          </Button>
          <Button variant="outline" onClick={load} data-testid="bill-refresh-btn"><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
        {/* Menu */}
        <div>
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-brand-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search menu…"
              className="pl-9 h-11"
              data-testid="bill-search-input"
            />
          </div>
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="h-auto flex flex-wrap gap-1 bg-white border border-earth-border p-1 rounded-xl">
              {categories.map((c) => (
                <TabsTrigger key={c} value={c} className="h-11 px-4 data-[state=active]:bg-brand-500 data-[state=active]:text-white rounded-lg" data-testid={`bill-tab-${c.toLowerCase().replace(/\s|\//g, "-")}`}>
                  {c}
                </TabsTrigger>
              ))}
            </TabsList>
            {categories.map((c) => (
              <TabsContent key={c} value={c} className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredMenu.filter((x) => c === "All" ? true : x.category === c).map((it) => (
                    <div key={it.id} className="bg-white border border-earth-border rounded-xl p-4" data-testid={`bill-menu-${it.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-heading text-base leading-tight">{it.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] uppercase tracking-[0.18em] text-brand-500">{it.category}</span>
                            <span className="text-[10px] uppercase tracking-[0.18em] text-brand-900/40">→ {it.department}</span>
                          </div>
                          <div className="text-xs text-brand-900/60 mt-1 line-clamp-2">{it.description}</div>
                        </div>
                        <div className="text-sm font-semibold whitespace-nowrap">{money(it.price)}</div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Input
                          value={itemNotes[it.id] || ""}
                          onChange={(e) => setItemNotes((s) => ({ ...s, [it.id]: e.target.value }))}
                          placeholder="Notes (no spice, extra spice…)"
                          className="h-9 text-xs"
                          data-testid={`bill-menu-notes-${it.id}`}
                        />
                        <Button size="sm" className="bg-brand-500 hover:bg-brand-600 text-white" onClick={() => addItem(it)} data-testid={`bill-menu-add-${it.id}`}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredMenu.filter((x) => c === "All" ? true : x.category === c).length === 0 && (
                    <div className="col-span-full text-center py-8 text-sm text-brand-900/50">No matches for "{query}".</div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Cart / Bill sidebar */}
        <aside className="bg-white border border-earth-border rounded-2xl p-5 h-fit lg:sticky lg:top-24" data-testid="bill-cart">
          {/* Pending (to send) */}
          <div>
            <h3 className="font-heading text-lg">Pending to send ({pending.length})</h3>
            {pending.length === 0 ? (
              <div className="py-6 text-center text-sm text-brand-900/50">Add items from menu, then preview & send to kitchen.</div>
            ) : (
              <ul className="divide-y divide-earth-border">
                {pending.map((it) => (
                  <ItemRow key={it.id} it={it} onInc={() => changeQty(it.id, 1)} onDec={() => changeQty(it.id, -1)} onDel={() => deleteItem(it.id)} onEdit={() => setEditing({ item: it, newMenuItemId: it.menu_item_id, qty: it.quantity, notes: it.notes })} />
                ))}
              </ul>
            )}
            <Button disabled={pending.length === 0} className="mt-3 w-full h-11 bg-brand-500 hover:bg-brand-600 text-white" onClick={() => setPreviewOpen(true)} data-testid="bill-preview-btn">
              <Send className="w-4 h-4 mr-2" /> Preview & send KOT
            </Button>

            {/* Collect Payment — visible for captain under Preview & Send KOT */}
            <div className="mt-3 border-t border-earth-border pt-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[0.22em] text-brand-500">Payment</div>
                {paid ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 uppercase tracking-widest text-[10px] inline-flex items-center gap-1" data-testid="bill-payment-status-badge">
                    <Check className="w-3 h-3" /> Received · {bill.payment.method?.toUpperCase()}
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800 border-red-200 uppercase tracking-widest text-[10px] inline-flex items-center gap-1" data-testid="bill-payment-status-badge">
                    <X className="w-3 h-3" /> Pending
                  </Badge>
                )}
              </div>
              {paid ? (
                <div className="text-xs text-brand-900/60 mt-2" data-testid="bill-payment-info">
                  Collected by <b>{bill.payment.received_by_name}</b> <span className="uppercase tracking-widest text-[10px] text-brand-900/50">· {bill.payment.received_by_role || ""}</span>
                  <div className="text-[10px]">{bill.payment.received_at ? new Date(bill.payment.received_at).toLocaleTimeString() : ""}</div>
                </div>
              ) : (
                <Button
                  className="mt-2 w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => { setPayMethod("cash"); setPayAmount(bill.total); setPayOpen(true); }}
                  disabled={bill.total <= 0}
                  data-testid="bill-collect-payment-btn"
                >
                  <Wallet className="w-4 h-4 mr-2" /> Collect payment
                </Button>
              )}
            </div>
          </div>

          {/* Already sent batches */}
          <div className="border-t border-earth-border mt-5 pt-4">
            <h3 className="font-heading text-lg">Sent to kitchen ({sent.length})</h3>
            {sent.length === 0 ? (
              <div className="py-4 text-center text-xs text-brand-900/50">Nothing in the kitchen yet.</div>
            ) : (
              bill.kot_batches.map((b) => {
                const batchItems = sent.filter((i) => i.kot_batch === b.number);
                if (!batchItems.length) return null;
                return (
                  <div key={b.number} className="mt-3 border border-earth-border rounded-lg p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="uppercase tracking-widest text-brand-500">KOT #{b.number}</span>
                      <span className="text-brand-900/50">{new Date(b.sent_at).toLocaleTimeString()}</span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {batchItems.map((it) => (
                        <li key={it.id} className="flex items-center justify-between text-sm gap-2">
                          <span className="flex-1 truncate">
                            <b>{it.quantity}×</b> {it.name}
                            {it.notes && <span className="text-[11px] text-brand-900/50 ml-1">({it.notes})</span>}
                          </span>
                          <Badge className={`text-[9px] uppercase ${STATUS_COLOR[it.chef_status]}`}>{it.chef_status}</Badge>
                          {it.chef_status === "pending" && (
                            <button onClick={() => deleteItem(it.id)} title="Cancel item" className="text-red-500/70 hover:text-red-500">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => window.open(`/print/kot/${id}?batch=${b.number}`, "_blank")} className="mt-2 text-xs text-brand-500 hover:underline inline-flex items-center gap-1" data-testid={`bill-print-batch-${b.number}`}>
                      <Printer className="w-3 h-3" /> Reprint KOT
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Totals */}
          <div className="border-t border-earth-border mt-5 pt-4 space-y-1 text-sm">
            <Row label="Subtotal" value={money(bill.subtotal)} />
            <Row label={`CGST @ ${bill.cgst_rate}%`} value={money(bill.cgst)} />
            <Row label={`SGST @ ${bill.sgst_rate}%`} value={money(bill.sgst)} />
            <div className="flex items-center justify-between pt-2 border-t border-earth-border mt-2">
              <span className="font-heading text-lg">Grand Total</span>
              <span className="font-heading text-xl text-brand-500" data-testid="bill-grand-total">{money(bill.total)}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent data-testid="bill-preview-dialog" className="max-w-lg">
          <DialogHeader><DialogTitle className="font-heading">Preview KOT before sending</DialogTitle></DialogHeader>
          <div className="text-xs text-brand-900/60 mb-2">Table {bill.table_name} · {new Date().toLocaleTimeString()}</div>
          <ul className="divide-y divide-earth-border max-h-[50vh] overflow-auto">
            {pending.map((it) => (
              <li key={it.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{it.quantity}× {it.name}</div>
                    <div className="text-[11px] text-brand-500 uppercase tracking-widest">{it.department}</div>
                    {it.notes && <div className="text-xs text-brand-900/60 mt-0.5 italic">Note: {it.notes}</div>}
                  </div>
                  <div className="text-sm font-semibold">{money(it.price * it.quantity)}</div>
                </div>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Back to edit</Button>
            <Button onClick={sendKot} className="bg-brand-500 hover:bg-brand-600 text-white" data-testid="bill-confirm-send-btn">
              <Send className="w-4 h-4 mr-2" /> Confirm & Send to Kitchen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent data-testid="bill-edit-dialog" className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Edit item · swap / qty / notes</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-brand-900/60">Swap with</label>
                <select
                  value={editing.newMenuItemId}
                  onChange={(e) => setEditing({ ...editing, newMenuItemId: e.target.value })}
                  className="mt-1 w-full h-10 rounded-md border border-earth-border bg-white px-3 text-sm"
                  data-testid="bill-edit-swap-select"
                >
                  {menu.filter((m) => m.is_available).map((m) => (
                    <option key={m.id} value={m.id}>{m.name} — ₹{m.price}</option>
                  ))}
                </select>
                <p className="text-[11px] text-brand-900/50 mt-1">Use this if the item is sold out and customer agrees to replace.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-brand-900/60">Quantity</label>
                  <Input type="number" min={1} value={editing.qty} onChange={(e) => setEditing({ ...editing, qty: Number(e.target.value) })} data-testid="bill-edit-qty" />
                </div>
                <div>
                  <label className="text-xs text-brand-900/60">Notes</label>
                  <Input value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} data-testid="bill-edit-notes" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} className="bg-brand-500 hover:bg-brand-600 text-white" data-testid="bill-edit-save-btn">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent data-testid="bill-pay-dialog" className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Collect payment · Bill #{bill.bill_number}</DialogTitle></DialogHeader>
          <div>
            <div className="text-sm text-brand-900/70">Table {bill.table_name} · {bill.customer_name || "Walk-in"}{bill.customer_mobile ? ` · ${bill.customer_mobile}` : ""}</div>
            <div className="font-heading text-4xl text-brand-500 mt-2">{money(bill.total)}</div>
            <div className="grid grid-cols-3 gap-2 mt-5">
              {PAY_METHODS.map((m) => (
                <button key={m.id} onClick={() => setPayMethod(m.id)} className={`rounded-xl border p-3 text-center transition-all ${payMethod === m.id ? "border-brand-500 bg-brand-50 text-brand-900" : "border-earth-border hover:border-brand-300"}`} data-testid={`bill-pay-method-${m.id}`}>
                  <m.icon className="w-5 h-5 mx-auto" />
                  <div className="mt-1 text-xs font-medium uppercase tracking-widest">{m.label}</div>
                </button>
              ))}
            </div>
            <div className="mt-4">
              <label className="text-xs text-brand-900/60">Amount received</label>
              <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="mt-1 h-11" data-testid="bill-pay-amount" />
            </div>
            <p className="text-[11px] text-brand-900/60 mt-3">
              Marking as received will close this bill. It will move to the cashier's <b>Completed</b> tab instantly.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={collectPayment} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="bill-pay-confirm-btn">
              Mark as received
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function ItemRow({ it, onInc, onDec, onDel, onEdit }) {
  return (
    <li className="py-2 flex items-center gap-2" data-testid={`bill-pending-${it.id}`}>
      <div className="flex-1">
        <div className="text-sm font-medium leading-tight">{it.name}</div>
        <div className="text-[11px] text-brand-500 uppercase tracking-widest">{it.department}</div>
        {it.notes && <div className="text-xs text-brand-900/60 italic mt-0.5">Note: {it.notes}</div>}
      </div>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="outline" className="h-7 w-7" onClick={onDec}><Minus className="w-3 h-3" /></Button>
        <span className="w-6 text-center text-sm font-semibold">{it.quantity}</span>
        <Button size="icon" variant="outline" className="h-7 w-7" onClick={onInc}><Plus className="w-3 h-3" /></Button>
      </div>
      <Button size="icon" variant="outline" className="h-7 w-7" onClick={onEdit} title="Edit/Swap"><Pencil className="w-3.5 h-3.5" /></Button>
      <Button size="icon" variant="outline" className="h-7 w-7" onClick={onDel}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
    </li>
  );
}
