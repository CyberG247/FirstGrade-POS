import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { formatNaira } from "@/lib/format";
import { TrendingUp, ShoppingCart, Package, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Dashboard = () => {
  const { user } = useAuth();
  const { businessOwnerId } = useRole();
  const [stats, setStats] = useState({ todayRevenue: 0, todayCount: 0, products: 0, lowStock: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [businessName, setBusinessName] = useState("");

  useEffect(() => {
    if (!user || !businessOwnerId) return;
    (async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [{ data: salesToday }, { data: products }, { data: recentSales }, { data: profile }] = await Promise.all([
        supabase.from("sales").select("total").eq("user_id", businessOwnerId).gte("created_at", today.toISOString()),
        supabase.from("products").select("id, stock_quantity, low_stock_threshold").eq("user_id", businessOwnerId),
        supabase.from("sales").select("id, receipt_number, total, payment_method, created_at").eq("user_id", businessOwnerId).order("created_at", { ascending: false }).limit(5),
        supabase.from("profiles").select("business_name").eq("id", businessOwnerId).maybeSingle(),
      ]);

      setStats({
        todayRevenue: (salesToday || []).reduce((s, r: any) => s + Number(r.total), 0),
        todayCount: salesToday?.length || 0,
        products: products?.length || 0,
        lowStock: (products || []).filter((p: any) => p.stock_quantity <= p.low_stock_threshold).length,
      });
      setRecent(recentSales || []);
      setBusinessName(profile?.business_name || "");
    })();
  }, [user, businessOwnerId]);

  const cards = [
    { label: "Today's Revenue", value: formatNaira(stats.todayRevenue), icon: TrendingUp, accent: "text-success" },
    { label: "Sales Today", value: stats.todayCount, icon: ShoppingCart, accent: "text-primary" },
    { label: "Products", value: stats.products, icon: Package, accent: "text-primary" },
    { label: "Low Stock Items", value: stats.lowStock, icon: AlertTriangle, accent: "text-brand-red" },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">{businessName || "Your business"} · Today at a glance</p>
        </div>
        <Link to="/app/pos"><Button size="lg">Open POS Terminal</Button></Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="p-5 rounded-lg bg-card border shadow-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
              <Icon className={`h-4 w-4 ${accent}`} />
            </div>
            <div className="text-2xl font-bold text-foreground">{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-card border shadow-card">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Recent Sales</h2>
          <Link to="/app/sales" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        {recent.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">No sales yet. Open the POS terminal to record your first sale.</div>
        ) : (
          <div className="divide-y">
            {recent.map((s) => (
              <div key={s.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{s.receipt_number}</div>
                  <div className="text-xs text-muted-foreground capitalize">{s.payment_method} · {new Date(s.created_at).toLocaleString("en-NG")}</div>
                </div>
                <div className="font-semibold text-foreground">{formatNaira(s.total)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;