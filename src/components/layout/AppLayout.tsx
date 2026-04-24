import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Package, Users, Receipt, LogOut, Building2, ShieldCheck, Settings as SettingsIcon, Store } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useBranches } from "@/hooks/useBranches";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect } from "react";

export const AppLayout = () => {
  const { user, loading, signOut } = useAuth();
  const { role, perms } = useRole();
  const { branches, multiBranchEnabled, activeBranchId, setActiveBranchId } = useBranches();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const nav = [
    { to: "/app", icon: LayoutDashboard, label: "Dashboard", end: true, show: true },
    { to: "/app/pos", icon: ShoppingCart, label: "POS Terminal", show: perms.canUsePOS },
    { to: "/app/products", icon: Package, label: "Inventory", show: true },
    { to: "/app/customers", icon: Users, label: "Customers", show: true },
    { to: "/app/sales", icon: Receipt, label: "Sales History", show: true },
    { to: "/app/branches", icon: Store, label: "Branches", show: perms.canManageStaff },
    { to: "/app/staff", icon: ShieldCheck, label: "Staff & Roles", show: perms.canManageStaff },
    { to: "/app/settings", icon: SettingsIcon, label: "Receipt Settings", show: perms.canManageStaff },
  ].filter((n) => n.show);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col border-r bg-card">
        <div className="h-16 flex items-center gap-2 px-6 border-b">
          <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-bold text-primary leading-tight">NaijaPOS</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Enterprise Suite</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-smooth ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground hover:bg-secondary"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t">
          {multiBranchEnabled && branches.length > 0 && (
            <div className="px-1 pb-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 px-2">Active branch</div>
              <Select value={activeBranchId ?? ""} onValueChange={(v) => setActiveBranchId(v || null)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select branch…" /></SelectTrigger>
                <SelectContent>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="px-3 py-2 text-xs text-muted-foreground truncate flex items-center justify-between gap-2">
            <span className="truncate">{user.email}</span>
            {role && <Badge variant="secondary" className="capitalize text-[10px]">{role}</Badge>}
          </div>
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};