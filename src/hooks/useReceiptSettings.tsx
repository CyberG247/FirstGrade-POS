import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "./useRole";

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

export const useReceiptSettings = () => {
  const { businessOwnerId } = useRole();
  const [settings, setSettings] = useState<ReceiptSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!businessOwnerId) return;
    setLoading(true);
    const { data } = await supabase
      .from("receipt_settings")
      .select("template, paper_size, store_address, footer_note, show_barcode")
      .eq("business_owner_id", businessOwnerId)
      .maybeSingle();
    if (data) {
      setSettings({
        template: (data.template as ReceiptTemplate) ?? "thermal",
        paper_size: (data.paper_size as PaperSize) ?? "a4",
        store_address: data.store_address,
        footer_note: data.footer_note,
        show_barcode: data.show_barcode ?? true,
      });
    }
    setLoading(false);
  }, [businessOwnerId]);

  useEffect(() => { load(); }, [load]);

  const save = async (next: ReceiptSettings) => {
    if (!businessOwnerId) return;
    const { error } = await supabase
      .from("receipt_settings")
      .upsert({ business_owner_id: businessOwnerId, ...next }, { onConflict: "business_owner_id" });
    if (!error) setSettings(next);
    return error;
  };

  return { settings, loading, save, reload: load };
};