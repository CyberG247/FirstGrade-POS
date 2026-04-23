import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Minus, Trash2, Search, ShoppingCart, Receipt as ReceiptIcon } from "lucide-react";
import { formatNaira, generateReceiptNumber, formatDate } from "@/lib/format";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Product {
  id: string; name: string; price: number; stock_quantity: number;
  vat_rate: number; barcode: string | null; sku: string | null; unit: string | null;
}
interface CartItem {
  product_id: string; name: string; price: number; vat_rate: number;
  quantity: number; max: number;
}

const POS = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discount, setDiscount] = useState("0");
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("products").select("*").eq("user_id", user.id).eq("is_active", true).order("name");
    setProducts((data || []) as Product[]);
  };
  useEffect(() => { load(); }, [user]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q) || (p.barcode || "").includes(q)
    );
  }, [products, search]);

  const addToCart = (p: Product) => {
    if (p.stock_quantity <= 0) return toast.error(`${p.name} is out of stock`);
    setCart((c) => {
      const existing = c.find((i) => i.product_id === p.id);
      if (existing) {
        if (existing.quantity >= p.stock_quantity) { toast.error("Not enough stock"); return c; }
        return c.map((i) => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...c, { product_id: p.id, name: p.name, price: Number(p.price), vat_rate: Number(p.vat_rate), quantity: 1, max: p.stock_quantity }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((c) => c.flatMap((i) => {
      if (i.product_id !== id) return [i];
      const next = i.quantity + delta;
      if (next <= 0) return [];
      if (next > i.max) { toast.error("Not enough stock"); return [i]; }
      return [{ ...i, quantity: next }];
    }));
  };
  const removeItem = (id: string) => setCart((c) => c.filter((i) => i.product_id !== id));

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const vatAmount = cart.reduce((s, i) => s + (i.price * i.quantity * i.vat_rate) / 100, 0);
  const discountNum = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal + vatAmount - discountNum);

  const checkout = async () => {
    if (!user || cart.length === 0) return;
    setProcessing(true);
    try {
      const receiptNumber = generateReceiptNumber();
      const { data: sale, error: saleErr } = await supabase
        .from("sales")
        .insert({
          user_id: user.id,
          receipt_number: receiptNumber,
          subtotal, vat_amount: vatAmount, discount: discountNum, total,
          payment_method: paymentMethod, status: "completed",
        })
        .select()
        .single();
      if (saleErr || !sale) throw saleErr || new Error("Sale failed");

      const items = cart.map((i) => ({
        sale_id: sale.id, user_id: user.id, product_id: i.product_id,
        product_name: i.name, quantity: i.quantity, unit_price: i.price,
        vat_rate: i.vat_rate, line_total: i.price * i.quantity,
      }));
      const { error: itemsErr } = await supabase.from("sale_items").insert(items);
      if (itemsErr) throw itemsErr;

      // Update stock & log movements
      for (const i of cart) {
        const prod = products.find((p) => p.id === i.product_id);
        if (!prod) continue;
        await supabase.from("products").update({ stock_quantity: prod.stock_quantity - i.quantity }).eq("id", i.product_id);
        await supabase.from("stock_movements").insert({
          user_id: user.id, product_id: i.product_id, change: -i.quantity,
          reason: "sale", reference_id: sale.id,
        });
      }

      setReceipt({ ...sale, items });
      setCart([]); setDiscount("0");
      toast.success(`Sale ${receiptNumber} completed`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Checkout failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen">
      {/* Product grid */}
      <div className="flex-1 p-4 md:p-6 overflow-auto bg-secondary/30">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-xl md:text-2xl font-bold flex-1">POS Terminal</h1>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search or scan barcode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 bg-card"
          />
        </div>
        {products.length === 0 ? (
          <div className="text-center text-muted-foreground py-16 text-sm">No products yet. Go to Inventory to add some.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.stock_quantity <= 0}
                className="text-left bg-card border rounded-lg p-3 shadow-card hover:shadow-elevated hover:border-primary transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-medium text-sm line-clamp-2 mb-1">{p.name}</div>
                <div className="text-primary font-bold">{formatNaira(p.price)}</div>
                <div className="text-xs text-muted-foreground mt-1">Stock: {p.stock_quantity}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart */}
      <aside className="w-full lg:w-[420px] bg-card border-l flex flex-col max-h-screen">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Current Sale</h2>
          <span className="ml-auto text-xs text-muted-foreground">{cart.length} item{cart.length !== 1 && "s"}</span>
        </div>

        <div className="flex-1 overflow-auto">
          {cart.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Cart is empty. Tap a product to add it.</div>
          ) : (
            <div className="divide-y">
              {cart.map((i) => (
                <div key={i.product_id} className="p-3 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{i.name}</div>
                    <div className="text-xs text-muted-foreground">{formatNaira(i.price)} × {i.quantity}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(i.product_id, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-7 text-center text-sm font-medium">{i.quantity}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(i.product_id, 1)}><Plus className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(i.product_id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-4 space-y-3">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatNaira(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span>{formatNaira(vatAmount)}</span></div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Discount</span>
              <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-8 w-24 text-right" />
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total</span><span className="text-primary">{formatNaira(total)}</span>
            </div>
          </div>

          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">💵 Cash</SelectItem>
              <SelectItem value="card">💳 Card (POS)</SelectItem>
              <SelectItem value="transfer">🏦 Bank Transfer</SelectItem>
              <SelectItem value="ussd">📱 USSD</SelectItem>
              <SelectItem value="wallet">👛 Wallet</SelectItem>
            </SelectContent>
          </Select>

          <Button className="w-full h-12 text-base" disabled={cart.length === 0 || processing} onClick={checkout}>
            {processing ? "Processing…" : `Charge ${formatNaira(total)}`}
          </Button>
        </div>
      </aside>

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ReceiptIcon className="h-5 w-5" /> Sale Receipt</DialogTitle>
          </DialogHeader>
          {receipt && (
            <div className="space-y-3 text-sm">
              <div className="text-center pb-3 border-b">
                <div className="font-bold text-base">{receipt.receipt_number}</div>
                <div className="text-xs text-muted-foreground">{formatDate(receipt.created_at)}</div>
              </div>
              <div className="space-y-1">
                {receipt.items.map((i: any, idx: number) => (
                  <div key={idx} className="flex justify-between">
                    <span>{i.product_name} × {i.quantity}</span>
                    <span>{formatNaira(i.line_total)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t space-y-1">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatNaira(receipt.subtotal)}</span></div>
                <div className="flex justify-between"><span>VAT (FIRS)</span><span>{formatNaira(receipt.vat_amount)}</span></div>
                {Number(receipt.discount) > 0 && <div className="flex justify-between"><span>Discount</span><span>−{formatNaira(receipt.discount)}</span></div>}
                <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total</span><span>{formatNaira(receipt.total)}</span></div>
                <div className="flex justify-between text-xs text-muted-foreground capitalize"><span>Payment</span><span>{receipt.payment_method}</span></div>
              </div>
              <Button className="w-full" onClick={() => setReceipt(null)}>New Sale</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POS;