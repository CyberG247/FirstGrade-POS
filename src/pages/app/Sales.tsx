import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatNaira, formatDate } from "@/lib/format";
import { Receipt } from "lucide-react";

const Sales = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("sales").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setSales(data || []));
  }, [user]);

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
                <th className="text-right px-4 py-3 hidden md:table-cell">VAT</th>
                <th className="text-right px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-secondary/40">
                  <td className="px-4 py-3 font-medium">{s.receipt_number}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{formatDate(s.created_at)}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{s.payment_method}</td>
                  <td className="px-4 py-3 text-right hidden md:table-cell text-muted-foreground">{formatNaira(s.vat_amount)}</td>
                  <td className="px-4 py-3 text-right font-bold text-primary">{formatNaira(s.total)}</td>
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