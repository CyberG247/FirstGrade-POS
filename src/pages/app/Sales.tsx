import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { formatNaira, formatDate } from "@/lib/format";
import { Receipt, Download, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { downloadReceiptPdf } from "@/lib/receipt";
import { useReceiptSettings } from "@/hooks/useReceiptSettings";
import { toast } from "sonner";

const Sales = () => {
  const { user } = useAuth();
  const { perms, businessOwnerId } = useRole();
  const { settings: receiptSettings } = useReceiptSettings();
  const [sales, setSales] = useState<any[]>([]);

  const load = () => {
    if (!businessOwnerId) return;
    supabase.from("sales").select("*").eq("user_id", businessOwnerId).order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setSales(data || []));
  };
  useEffect(() => { load(); }, [businessOwnerId]);

  const handleDownload = async (sale: any) => {
    const { data: items } = await supabase.from("sale_items").select("*").eq("sale_id", sale.id);
    downloadReceiptPdf({
      ...sale,
      items: items || [],
      cashier: user?.email || undefined,
      settings: receiptSettings,
    });
  };

  const handleRefund = async (sale: any) => {
    if (!confirm(`Refund sale ${sale.receipt_number}? This will mark it as refunded and restock items.`)) return;
    try {
      const { data: items } = await supabase.from("sale_items").select("*").eq("sale_id", sale.id);
      // restock
      for (const i of items || []) {
        if (!i.product_id) continue;
        const { data: prod } = await supabase.from("products").select("stock_quantity").eq("id", i.product_id).maybeSingle();
        if (prod) {
          await supabase.from("products").update({ stock_quantity: prod.stock_quantity + i.quantity }).eq("id", i.product_id);
          await supabase.from("stock_movements").insert({
            user_id: businessOwnerId, product_id: i.product_id,
            change: i.quantity, reason: "refund", reference_id: sale.id,
          });
        }
      }
      const { error } = await supabase.from("sales")
        .update({ status: "refunded", refunded_at: new Date().toISOString(), refunded_by: user?.id })
        .eq("id", sale.id);
      if (error) throw error;
      toast.success("Sale refunded");
      load();
    } catch (e: any) {
      toast.error(e.message || "Refund failed");
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Sales History</h1>
        <p className="text-muted-foreground text-sm mt-1">Last 200 transactions</p>
      </div>
      <div className="rounded-lg bg-card border shadow-card overflow-hidden">
        {sales.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No sales recorded yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Receipt</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Date</th>
                <th className="text-left px-4 py-3">Payment</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">VAT</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-secondary/40">
                  <td className="px-4 py-3 font-medium">{s.receipt_number}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{formatDate(s.created_at)}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{s.payment_method}</td>
                  <td className="px-4 py-3">
                    {s.status === "refunded"
                      ? <Badge variant="destructive">Refunded</Badge>
                      : <Badge variant="secondary">Paid</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell text-muted-foreground">{formatNaira(s.vat_amount)}</td>
                  <td className="px-4 py-3 text-right font-bold text-primary">{formatNaira(s.total)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" title="Download PDF" onClick={() => handleDownload(s)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    {perms.canRefund && s.status !== "refunded" && (
                      <Button size="icon" variant="ghost" title="Refund" onClick={() => handleRefund(s)}>
                        <Undo2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Sales;
