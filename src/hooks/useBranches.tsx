import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "./useRole";
import { useAuth } from "./useAuth";

export interface Branch {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  is_active: boolean;
}

interface BranchCtx {
  branches: Branch[];
  multiBranchEnabled: boolean;
  activeBranchId: string | null;
  activeBranch: Branch | null;
  setActiveBranchId: (id: string | null) => Promise<void>;
  setMultiBranchEnabled: (v: boolean) => Promise<void>;
  reload: () => Promise<void>;
  loading: boolean;
}

const Ctx = createContext<BranchCtx | null>(null);

export const BranchProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { businessOwnerId } = useRole();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [multiBranchEnabled, setMBE] = useState(false);
  const [activeBranchId, setABI] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!businessOwnerId || !user) return;
    setLoading(true);
    const [{ data: brs }, { data: prof }, { data: roleRow }] = await Promise.all([
      supabase.from("branches").select("id,name,code,address,phone,is_active")
        .eq("business_owner_id", businessOwnerId).order("name"),
      supabase.from("profiles").select("multi_branch_enabled")
        .eq("id", businessOwnerId).maybeSingle(),
      supabase.from("user_roles").select("active_branch_id")
        .eq("user_id", user.id).maybeSingle(),
    ]);
    setBranches((brs || []) as Branch[]);
    setMBE(!!prof?.multi_branch_enabled);
    setABI(roleRow?.active_branch_id ?? null);
    setLoading(false);
  }, [businessOwnerId, user]);

  useEffect(() => { reload(); }, [reload]);

  const setActiveBranchId = async (id: string | null) => {
    if (!user) return;
    setABI(id);
    await supabase.from("user_roles").update({ active_branch_id: id }).eq("user_id", user.id);
  };

  const setMultiBranchEnabled = async (v: boolean) => {
    if (!businessOwnerId) return;
    setMBE(v);
    await supabase.from("profiles").update({ multi_branch_enabled: v }).eq("id", businessOwnerId);
  };

  const activeBranch = useMemo(
    () => branches.find(b => b.id === activeBranchId) || null,
    [branches, activeBranchId],
  );

  return (
    <Ctx.Provider value={{
      branches, multiBranchEnabled, activeBranchId, activeBranch,
      setActiveBranchId, setMultiBranchEnabled, reload, loading,
    }}>
      {children}
    </Ctx.Provider>
  );
};

export const useBranches = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBranches must be used inside BranchProvider");
  return ctx;
};