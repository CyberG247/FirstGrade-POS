import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, AlertTriangle, Package } from "lucide-react";
import { formatNaira } from "@/lib/format";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  cost: number;
  stock_quantity: number;
  low_stock_threshold: number;
  vat_rate: number;
  unit: string | null;
}

const empty = { name: "", sku: "", barcode: "", price: "0", cost: "0", stock_quantity: "0", low_stock_threshold: "5", vat_rate: "7.5", unit: "pcs" };

const Products = () => {
  const { user } = useAuth();
  const { perms, businessOwnerId } = useRole();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(empty);

  const load = async () => {
    if (!businessOwnerId) return;
    const { data } = await supabase.from("products").select("*").eq("user_id", businessOwnerId).order("created_at", { ascending: false });
    setProducts((data || []) as Product[]);
  };

  useEffect(() => { load(); }, [businessOwnerId]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku || "", barcode: p.barcode || "",
      price: String(p.price), cost: String(p.cost),
      stock_quantity: String(p.stock_quantity), low_stock_threshold: String(p.low_stock_threshold),
      vat_rate: String(p.vat_rate), unit: p.unit || "pcs",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!businessOwnerId || !form.name.trim()) { toast.error("Product name is required"); return; }
    if (!perms.canEditInventory) { toast.error("You don't have permission to edit inventory"); return; }
    const payload = {
      user_id: businessOwnerId,
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      stock_quantity: Number(form.stock_quantity) || 0,
      low_stock_threshold: Number(form.low_stock_threshold) || 0,
      vat_rate: Number(form.vat_rate) || 0,
      unit: form.unit.trim() || "pcs",
    };
    if (editing) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Product updated");
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Product added");
    }
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!perms.canEditInventory) return toast.error("You don't have permission to edit inventory");
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode || "").includes(search)
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your products and stock levels</p>
        </div>
        {perms.canEditInventory && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Add product</Button>}
      </div>

      <div className="mb-4">
        <Input placeholder="Search by name, SKU, or barcode…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
      </div>

      <div className="rounded-lg bg-card border shadow-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No products yet. Add your first product to start selling.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Product</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">SKU</th>
                <th className="text-right px-4 py-3">Price</th>
                <th className="text-right px-4 py-3">Stock</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">VAT</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p) => {
                const low = p.stock_quantity <= p.low_stock_threshold;
                return (
                  <tr key={p.id} className="hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.name}</div>
                      {p.barcode && <div className="text-xs text-muted-foreground">📊 {p.barcode}</div>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{p.sku || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatNaira(p.price)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center gap-1 ${low ? "text-brand-red font-semibold" : ""}`}>
                        {low && <AlertTriangle className="h-3 w-3" />}
                        {p.stock_quantity} {p.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell text-muted-foreground">{p.vat_rate}%</td>
                    <td className="px-4 py-3 text-right">
                      {perms.canEditInventory ? (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">View only</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "Add new product"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              <div><Label>Barcode</Label><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Price (₦) *</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div><Label>Cost (₦)</Label><Input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Stock</Label><Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} /></div>
              <div><Label>Low alert</Label><Input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} /></div>
              <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
            </div>
            <div><Label>VAT rate (%)</Label><Input type="number" step="0.1" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save changes" : "Add product"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;