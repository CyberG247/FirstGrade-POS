import { useEffect, useState } from "react";
import { useReceiptSettings, ReceiptSettings, DEFAULT_SETTINGS } from "@/hooks/useReceiptSettings";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Receipt, Printer, Download, ShieldAlert, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadReceiptPdf, printReceiptPdf, qaBarcode, BarcodeQAResult } from "@/lib/receipt";

const Settings = () => {
  const { settings, loading, save } = useReceiptSettings();
  const { perms } = useRole();
  const { user } = useAuth();
  const [draft, setDraft] = useState<ReceiptSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [qa, setQa] = useState<BarcodeQAResult | null>(null);

  useEffect(() => { setDraft(settings); }, [settings]);

  // Re-run barcode QA whenever the paper / template choice changes,
  // because barcode dimensions differ per template.
  useEffect(() => {
    const sample = `RCP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-9999`;
    const colW = draft.paper_size === "receipt" ? 72 : (draft.template === "branded" ? 70 : 60);
    const widthMm = draft.template === "branded" ? 70 : Math.min(60, colW - 10);
    const heightMm = draft.template === "branded" ? 16 : 12;
    setQa(qaBarcode(sample, widthMm, heightMm));
  }, [draft.template, draft.paper_size]);

  if (!perms.canManageStaff) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="rounded-lg border bg-card p-8 text-center shadow-card">
          <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-semibold">Admin only</h2>
          <p className="text-sm text-muted-foreground mt-1">Receipt settings are managed by business admins.</p>
        </div>
      </div>
    );
  }

  const onSave = async () => {
    setSaving(true);
    const err = await save(draft);
    setSaving(false);
    if (err) toast.error(err.message); else toast.success("Receipt settings saved");
  };

  const sampleReceipt = () => ({
    receipt_number: "RCP-PREVIEW-0001",
    created_at: new Date().toISOString(),
    subtotal: 15000, vat_amount: 1125, discount: 0, total: 16125,
    payment_method: "cash",
    amount_tendered: 20000, change: 3875,
    items: [
      { product_name: "Indomie Noodles", quantity: 5, unit_price: 500, line_total: 2500 },
      { product_name: "Peak Milk Powder 400g", quantity: 2, unit_price: 3500, line_total: 7000 },
      { product_name: "Coca-Cola 50cl", quantity: 6, unit_price: 250, line_total: 1500 },
      { product_name: "Hollandia Yoghurt 1L", quantity: 2, unit_price: 2000, line_total: 4000 },
    ],
    business: { name: "Mama Ngozi Supermarket", phone: "+234 803 555 1234", tin: "12345678-0001" },
    cashier: user?.email || undefined,
    settings: draft,
  });

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary" /> Receipt Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Configure how receipts look and which paper size your store prints on.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Template</CardTitle>
            <CardDescription>Pick the visual style for printed and downloaded receipts.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={draft.template}
              onValueChange={(v) => setDraft({ ...draft, template: v as any })}
              className="grid grid-cols-2 gap-3"
            >
              <Label htmlFor="t-thermal" className={`border rounded-lg p-4 cursor-pointer transition-smooth ${draft.template === "thermal" ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "hover:bg-secondary/50"}`}>
                <div className="flex items-start gap-2">
                  <RadioGroupItem id="t-thermal" value="thermal" className="mt-1" />
                  <div>
                    <div className="font-semibold">Thermal Cash Receipt</div>
                    <div className="text-xs text-muted-foreground mt-1">Centered narrow column, dotted dividers, monospace items, barcode at bottom.</div>
                  </div>
                </div>
              </Label>
              <Label htmlFor="t-branded" className={`border rounded-lg p-4 cursor-pointer transition-smooth ${draft.template === "branded" ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "hover:bg-secondary/50"}`}>
                <div className="flex items-start gap-2">
                  <RadioGroupItem id="t-branded" value="branded" className="mt-1" />
                  <div>
                    <div className="font-semibold">Branded Tax Invoice</div>
                    <div className="text-xs text-muted-foreground mt-1">Full-page A4 with navy header, line-item table, VAT block, and CAC/TIN.</div>
                  </div>
                </div>
              </Label>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paper Size</CardTitle>
            <CardDescription>Choose your store's default paper. Branded template always prints on A4.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={draft.paper_size}
              onValueChange={(v) => setDraft({ ...draft, paper_size: v as any })}
              className="grid grid-cols-2 gap-3"
            >
              <Label htmlFor="p-a4" className={`border rounded-lg p-4 cursor-pointer transition-smooth ${draft.paper_size === "a4" ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "hover:bg-secondary/50"}`}>
                <div className="flex items-start gap-2">
                  <RadioGroupItem id="p-a4" value="a4" className="mt-1" />
                  <div>
                    <div className="font-semibold">A4 (210 × 297 mm)</div>
                    <div className="text-xs text-muted-foreground mt-1">Office laser/inkjet printers.</div>
                  </div>
                </div>
              </Label>
              <Label htmlFor="p-receipt" className={`border rounded-lg p-4 cursor-pointer transition-smooth ${draft.paper_size === "receipt" ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "hover:bg-secondary/50"} ${draft.template === "branded" ? "opacity-50 pointer-events-none" : ""}`}>
                <div className="flex items-start gap-2">
                  <RadioGroupItem id="p-receipt" value="receipt" className="mt-1" disabled={draft.template === "branded"} />
                  <div>
                    <div className="font-semibold">Receipt Roll (80 mm)</div>
                    <div className="text-xs text-muted-foreground mt-1">Thermal POS printers (Xprinter, Epson TM, etc.).</div>
                  </div>
                </div>
              </Label>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Store Details</CardTitle>
            <CardDescription>Shown at the top of every receipt for this store.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="addr">Store address</Label>
              <Textarea id="addr" rows={2} placeholder="12 Allen Avenue, Ikeja, Lagos"
                value={draft.store_address || ""} onChange={(e) => setDraft({ ...draft, store_address: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="footer">Footer note</Label>
              <Input id="footer" placeholder="Thank you for shopping with us!"
                value={draft.footer_note || ""} onChange={(e) => setDraft({ ...draft, footer_note: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="bc" className="font-medium">Show CODE128 barcode</Label>
                <p className="text-xs text-muted-foreground">Encodes the receipt number for quick scanning.</p>
              </div>
              <Switch id="bc" checked={draft.show_barcode} onCheckedChange={(v) => setDraft({ ...draft, show_barcode: v })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {qa?.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
              Barcode Print QA
            </CardTitle>
            <CardDescription>Re-renders CODE128 at the final PDF dimensions to flag scanning risks before printing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!qa ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Running QA…</div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded border p-2"><div className="text-muted-foreground">Render @300dpi</div><div className="font-mono">{qa.pixelWidth}×{qa.pixelHeight}px</div></div>
                  <div className="rounded border p-2"><div className="text-muted-foreground">Min bar</div><div className="font-mono">{qa.minBarPx}px</div></div>
                  <div className="rounded border p-2"><div className="text-muted-foreground">Status</div><div className={qa.ok ? "text-emerald-600 font-semibold" : "text-destructive font-semibold"}>{qa.ok ? "PASS" : "FAIL"}</div></div>
                </div>
                {qa.errors.map((e, i) => (
                  <div key={`e${i}`} className="text-destructive text-xs flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span>{e}</span>
                  </div>
                ))}
                {qa.warnings.map((w, i) => (
                  <div key={`w${i}`} className="text-amber-600 text-xs flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span>{w}</span>
                  </div>
                ))}
                {qa.dataUrl && (
                  <div className="rounded border bg-white p-3 flex items-center justify-center">
                    <img src={qa.dataUrl} alt="Barcode preview" className="max-h-16" />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => printReceiptPdf(sampleReceipt() as any)}>
            <Printer className="h-4 w-4 mr-1" /> Print sample
          </Button>
          <Button variant="outline" onClick={() => downloadReceiptPdf(sampleReceipt() as any)}>
            <Download className="h-4 w-4 mr-1" /> Download sample
          </Button>
        </div>
        <Button onClick={onSave} disabled={saving || loading} className="min-w-32">
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
};

export default Settings;