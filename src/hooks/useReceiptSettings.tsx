import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "./useRole";
import { useBranches } from "./useBranches";

export type ReceiptTemplate = "thermal" | "branded";
export type PaperSize = "a4" | "receipt";

export interface ReceiptSettings {
  template: ReceiptTemplate;
  paper_size: PaperSize;
  store_address: string | null;
  footer_note: string | null;
  show_barcode: boolean;
}

export const DEFAULT_SETTINGS: ReceiptSettings = {
  template: "thermal",
  paper_size: "a4",
  store_address: null,
  footer_note: null,
  show_barcode: true,
};

const rowToSettings = (data: any | null): ReceiptSettings | null => data ? ({
  template: (data.template as ReceiptTemplate) ?? "thermal",
  paper_size: (data.paper_size as PaperSize) ?? "a4",
  store_address: data.store_address,
  footer_note: data.footer_note,
  show_barcode: data.show_barcode ?? true,
}) : null;

/**
 * Resolves receipt settings for the *active* branch, falling back to the
 * business default when no per-branch row exists. Used by POS / Sales when
 * actually generating receipts.
 */
export const useReceiptSettings = () => {
  const { businessOwnerId } = useRole();
  const { activeBranchId, multiBranchEnabled } = useBranches();
  const [settings, setSettings] = useState<ReceiptSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!businessOwnerId) return;
    setLoading(true);
    const branchId = multiBranchEnabled ? activeBranchId : null;
    const { data } = await supabase
      .from("receipt_settings")
      .select("template, paper_size, store_address, footer_note, show_barcode, branch_id")
      .eq("business_owner_id", businessOwnerId)
      .or(branchId ? `branch_id.eq.${branchId},branch_id.is.null` : `branch_id.is.null`);
    const rows = data || [];
    // Prefer branch-specific row, fall back to default (branch_id null).
    const branchRow = branchId ? rows.find((r: any) => r.branch_id === branchId) : null;
    const defaultRow = rows.find((r: any) => r.branch_id === null);
    setSettings(rowToSettings(branchRow) ?? rowToSettings(defaultRow) ?? DEFAULT_SETTINGS);
    setLoading(false);
  }, [businessOwnerId, activeBranchId, multiBranchEnabled]);

  useEffect(() => { load(); }, [load]);

  return { settings, loading, reload: load };
};

/**
 * Loads & saves a *specific* settings row (default or branch-scoped). Used by
 * the Settings page where the admin can pick which scope to edit.
 */
export const useReceiptSettingsFor = (branchId: string | null) => {
  const { businessOwnerId } = useRole();
  const [settings, setSettings] = useState<ReceiptSettings>(DEFAULT_SETTINGS);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!businessOwnerId) return;
    setLoading(true);
    let q = supabase
      .from("receipt_settings")
      .select("template, paper_size, store_address, footer_note, show_barcode")
      .eq("business_owner_id", businessOwnerId);
    q = branchId ? q.eq("branch_id", branchId) : q.is("branch_id", null);
    const { data } = await q.maybeSingle();
    const parsed = rowToSettings(data);
    setSettings(parsed ?? DEFAULT_SETTINGS);
    setExists(!!parsed);
    setLoading(false);
  }, [businessOwnerId, branchId]);

  useEffect(() => { load(); }, [load]);

  const save = async (next: ReceiptSettings) => {
    if (!businessOwnerId) return;
    // Find existing id (if any) so we update instead of duplicate.
    let q = supabase.from("receipt_settings").select("id").eq("business_owner_id", businessOwnerId);
    q = branchId ? q.eq("branch_id", branchId) : q.is("branch_id", null);
    const { data: existing } = await q.maybeSingle();
    const payload = { business_owner_id: businessOwnerId, branch_id: branchId, ...next };
    const { error } = existing
      ? await supabase.from("receipt_settings").update(payload).eq("id", existing.id)
      : await supabase.from("receipt_settings").insert(payload);
    if (!error) { setSettings(next); setExists(true); }
    return error;
  };

  const remove = async () => {
    if (!businessOwnerId || !branchId) return; // never delete the default
    const { error } = await supabase.from("receipt_settings")
      .delete()
      .eq("business_owner_id", businessOwnerId)
      .eq("branch_id", branchId);
    if (!error) { setSettings(DEFAULT_SETTINGS); setExists(false); }
    return error;
  };

  return { settings, exists, loading, save, remove, reload: load };
};