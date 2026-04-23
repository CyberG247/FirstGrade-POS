import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type Role = "admin" | "manager" | "cashier";

export interface Permissions {
  canUsePOS: boolean;
  canEditInventory: boolean;
  canRefund: boolean;
  canManageStaff: boolean;
  canViewReports: boolean;
}

const PERMS: Record<Role, Permissions> = {
  admin:   { canUsePOS: true,  canEditInventory: true,  canRefund: true,  canManageStaff: true,  canViewReports: true },
  manager: { canUsePOS: true,  canEditInventory: true,  canRefund: true,  canManageStaff: false, canViewReports: true },
  cashier: { canUsePOS: true,  canEditInventory: false, canRefund: false, canManageStaff: false, canViewReports: false },
};

export const useRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [businessOwnerId, setBusinessOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setRole(null); setLoading(false); return; }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role, business_owner_id")
      .eq("user_id", user.id)
      .order("role")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setRole((data?.role as Role) ?? "admin");
        setBusinessOwnerId(data?.business_owner_id ?? user.id);
        setLoading(false);
      });
  }, [user]);

  const perms: Permissions = role ? PERMS[role] : PERMS.cashier;
  return { role, businessOwnerId, loading, perms };
};
