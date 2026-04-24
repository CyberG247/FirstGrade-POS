import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatNaira, formatDate } from "./format";
import JsBarcode from "jsbarcode";

export type ReceiptTemplate = "thermal" | "branded";
export type PaperSize = "a4" | "receipt";

export interface ReceiptData {
  receipt_number: string;
  created_at: string;
  subtotal: number | string;
  vat_amount: number | string;
  discount: number | string;
  total: number | string;
  payment_method: string;
  items: Array<{ product_name: string; quantity: number; unit_price: number | string; line_total: number | string }>;
  business?: { name?: string | null; tin?: string | null; phone?: string | null; cac?: string | null; address?: string | null };
  cashier?: string;
  amount_tendered?: number | string;
  change?: number | string;
  approval_code?: string;
  settings?: {
    template?: ReceiptTemplate;
    paper_size?: PaperSize;
    store_address?: string | null;
    footer_note?: string | null;
    show_barcode?: boolean;
  };
}

const naira = (v: number | string) =>
  `N${Number(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// -----------------------------------------------------------------------------
// Barcode QA: re-render CODE128 at the *final* PDF dimensions and flag issues.
// -----------------------------------------------------------------------------
export interface BarcodeQAResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  dataUrl: string | null;
  pixelWidth: number;
  pixelHeight: number;
  minBarPx: number;
}

const MM_PER_INCH = 25.4;
const PRINT_DPI = 300;
const mmToPx = (mm: number) => Math.round((mm / MM_PER_INCH) * PRINT_DPI);

export const qaBarcode = (
  value: string,
  widthMm: number,
  heightMm: number,
): BarcodeQAResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const pixelWidth = mmToPx(widthMm);
  const pixelHeight = mmToPx(heightMm);

  if (!value || !value.trim()) {
    errors.push("Empty barcode value");
    return { ok: false, errors, warnings, dataUrl: null, pixelWidth, pixelHeight, minBarPx: 0 };
  }

  // Approx CODE128 modules: 11 per char + 35 (start, checksum, stop)
  const modules = value.length * 11 + 35;
  // Reserve ~10 modules quiet zone on each side
  const idealNarrowMm = widthMm / (modules + 20);
  const idealNarrowPx = mmToPx(idealNarrowMm);
  const barWidthPx = Math.max(1, Math.floor(pixelWidth / (modules + 20)));

  if (idealNarrowPx < 1) {
    errors.push(
      `Barcode too dense for ${widthMm.toFixed(1)}mm: each bar would render below 1px at ${PRINT_DPI}dpi (data length: ${value.length})`,
    );
  } else if (idealNarrowPx < 2) {
    warnings.push(
      `Narrow bars under 2px at ${PRINT_DPI}dpi — may not scan reliably on thermal printers.`,
    );
  }

  let dataUrl: string | null = null;
  try {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, value, {
      format: "CODE128",
      displayValue: false,
      margin: 0,
      width: barWidthPx,
      height: pixelHeight,
    });
    const c = canvas as HTMLCanvasElement;
    if (!c.width || !c.height) errors.push("Barcode canvas rendered with zero dimensions");
    dataUrl = c.toDataURL("image/png");
  } catch (e: any) {
    errors.push(`JsBarcode failed: ${e?.message || String(e)}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    dataUrl,
    pixelWidth,
    pixelHeight,
    minBarPx: barWidthPx,
  };
};

const renderBarcodeForPdf = (value: string, widthMm: number, heightMm: number) => {
  const qa = qaBarcode(value, widthMm, heightMm);
  return { dataUrl: qa.dataUrl, qa };
};

// -----------------------------------------------------------------------------
// Layout 1: Thermal cash-receipt (centered narrow column on A4 OR 80mm roll)
// -----------------------------------------------------------------------------
const buildThermalReceipt = (r: ReceiptData) => {
  const isReceiptRoll = r.settings?.paper_size === "receipt";
  const paperW = isReceiptRoll ? 80 : 210;
  const colW = isReceiptRoll ? 72 : 90;

  const doc = isReceiptRoll
    ? new jsPDF({ unit: "mm", format: [paperW, 297] })
    : new jsPDF({ unit: "mm", format: "a4" });

  const W = doc.internal.pageSize.getWidth();
  const left = (W - colW) / 2;
  const right = left + colW;
  const cx = W / 2;

  const dotted = (y: number) => {
    doc.setFont("courier", "normal"); doc.setFontSize(9); doc.setTextColor(60);
    doc.text("* ".repeat(Math.floor(colW / 2.2)), cx, y, { align: "center" });
  };
  const lineRow = (label: string, value: string, y: number, opts: { bold?: boolean; size?: number } = {}) => {
    doc.setFont("courier", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 10);
    doc.setTextColor(20);
    doc.text(label, left, y);
    doc.text(value, right, y, { align: "right" });
  };

  let y = isReceiptRoll ? 10 : 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(isReceiptRoll ? 14 : 20);
  doc.setTextColor(10);
  doc.text((r.business?.name || "SHOP NAME").toUpperCase(), cx, y, { align: "center" });
  y += isReceiptRoll ? 5 : 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8); doc.setTextColor(60);
  const address = r.settings?.store_address || r.business?.address;
  if (address) {
    const lines = doc.splitTextToSize(address, colW);
    doc.text(lines, cx, y, { align: "center" });
    y += 4 * lines.length;
  }
  if (r.business?.phone) { doc.text(`Tel: ${r.business.phone}`, cx, y, { align: "center" }); y += 4; }
  if (r.business?.tin) { doc.text(`TIN: ${r.business.tin}`, cx, y, { align: "center" }); y += 4; }

  y += 2; dotted(y); y += 5;
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(10);
  doc.text("CASH RECEIPT", cx, y, { align: "center" }); y += 4;
  dotted(y); y += 6;

  doc.setFont("courier", "normal"); doc.setFontSize(8); doc.setTextColor(60);
  doc.text(`Receipt: ${r.receipt_number}`, left, y);
  doc.text(formatDate(r.created_at), right, y, { align: "right" });
  y += 4;
  if (r.cashier) { doc.text(`Cashier: ${r.cashier}`, left, y); y += 4; }

  y += 1;
  doc.setFont("courier", "bold"); doc.setFontSize(9); doc.setTextColor(10);
  doc.text("Description", left, y); doc.text("Price", right, y, { align: "right" });
  y += 4;

  doc.setFont("courier", "normal"); doc.setFontSize(9);
  r.items.forEach((it) => {
    const name = `${it.product_name}${it.quantity > 1 ? ` x${it.quantity}` : ""}`;
    const wrapped = doc.splitTextToSize(name, colW - 28);
    doc.text(wrapped, left, y);
    doc.text(naira(it.line_total), right, y, { align: "right" });
    y += 4 * wrapped.length;
  });

  y += 1; dotted(y); y += 6;
  if (Number(r.subtotal) > 0) { lineRow("Subtotal", naira(r.subtotal), y); y += 5; }
  if (Number(r.discount) > 0) { lineRow("Discount", `-${naira(r.discount)}`, y); y += 5; }
  if (Number(r.vat_amount) > 0) { lineRow("VAT (7.5%)", naira(r.vat_amount), y); y += 5; }
  y += 1; lineRow("Total", naira(r.total), y, { bold: true, size: 12 }); y += 6;

  const method = r.payment_method.toUpperCase();
  if (method === "CASH" && r.amount_tendered != null) {
    lineRow("Cash", naira(r.amount_tendered), y); y += 5;
    if (r.change != null) { lineRow("Change", naira(r.change), y); y += 5; }
  } else {
    lineRow(method, naira(r.total), y); y += 5;
  }

  y += 2; dotted(y); y += 5;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(10);
  doc.text("THANK YOU!", cx, y, { align: "center" }); y += 6;

  if (r.settings?.show_barcode !== false) {
    const bw = Math.min(60, colW - 10);
    const bh = 12;
    const { dataUrl, qa } = renderBarcodeForPdf(r.receipt_number, bw, bh);
    if (dataUrl) {
      doc.addImage(dataUrl, "PNG", cx - bw / 2, y, bw, bh);
      y += bh + 3;
      doc.setFont("courier", "normal"); doc.setFontSize(7); doc.setTextColor(80);
      doc.text(r.receipt_number, cx, y, { align: "center" });
      y += 4;
    }
    if (qa.warnings.length) console.warn("[receipt] barcode QA warnings:", qa.warnings);
    if (qa.errors.length) console.error("[receipt] barcode QA errors:", qa.errors);
  }

  if (r.settings?.footer_note) {
    doc.setFontSize(7); doc.setTextColor(120); doc.setFont("helvetica", "italic");
    const lines = doc.splitTextToSize(r.settings.footer_note, colW);
    doc.text(lines, cx, y + 2, { align: "center" });
  }

  if (!isReceiptRoll) {
    doc.setFontSize(7); doc.setTextColor(140); doc.setFont("helvetica", "normal");
    doc.text("Powered by NaijaPOS — FIRS-aligned VAT Receipt", cx, 285, { align: "center" });
  }

  return doc;
};

// -----------------------------------------------------------------------------
// Layout 2: Branded full-page invoice (navy header, table, totals block)
// -----------------------------------------------------------------------------
const buildBrandedReceipt = (r: ReceiptData) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20); doc.setFont("helvetica", "bold");
  doc.text(r.business?.name || "NaijaPOS", 15, 16);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("Official Tax Invoice / Receipt", 15, 24);

  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text(r.receipt_number, W - 15, 16, { align: "right" });
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(formatDate(r.created_at), W - 15, 22, { align: "right" });

  doc.setFillColor(220, 38, 38);
  doc.rect(0, 32, W, 2, "F");

  doc.setTextColor(60); doc.setFontSize(9);
  let y = 42;
  const address = r.settings?.store_address || r.business?.address;
  if (address) { doc.text(address, 15, y); y += 5; }
  if (r.business?.tin) { doc.text(`TIN: ${r.business.tin}`, 15, y); y += 5; }
  if (r.business?.cac) { doc.text(`CAC: ${r.business.cac}`, 15, y); y += 5; }
  if (r.business?.phone) { doc.text(`Tel: ${r.business.phone}`, 15, y); y += 5; }
  if (r.cashier) doc.text(`Cashier: ${r.cashier}`, W - 15, 42, { align: "right" });

  autoTable(doc, {
    startY: y + 4,
    head: [["#", "Item", "Qty", "Unit Price", "Line Total"]],
    body: r.items.map((i, idx) => [
      String(idx + 1),
      i.product_name,
      String(i.quantity),
      formatNaira(i.unit_price),
      formatNaira(i.line_total),
    ]),
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 12 },
      2: { halign: "right", cellWidth: 18 },
      3: { halign: "right", cellWidth: 35 },
      4: { halign: "right", cellWidth: 35 },
    },
    margin: { left: 15, right: 15 },
  });

  const endY = (doc as any).lastAutoTable.finalY + 6;
  const labelX = W - 75; const valueX = W - 15;
  const row = (label: string, val: string, yy: number, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 12 : 10);
    doc.setTextColor(bold ? 15 : 60, bold ? 23 : 60, bold ? 42 : 60);
    doc.text(label, labelX, yy);
    doc.text(val, valueX, yy, { align: "right" });
  };
  row("Subtotal", formatNaira(r.subtotal), endY);
  row("VAT (7.5%)", formatNaira(r.vat_amount), endY + 6);
  let yy = endY + 12;
  if (Number(r.discount) > 0) { row("Discount", `-${formatNaira(r.discount)}`, yy); yy += 6; }
  doc.setDrawColor(200);
  doc.line(labelX, yy, valueX, yy);
  row("TOTAL", formatNaira(r.total), yy + 6, true);

  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(80);
  doc.text(`Payment Method: ${r.payment_method.toUpperCase()}`, 15, endY + 6);
  doc.text(`Status: PAID`, 15, endY + 12);

  let bottomY = yy + 18;
  if (r.settings?.show_barcode !== false) {
    const bw = 70, bh = 16;
    const { dataUrl, qa } = renderBarcodeForPdf(r.receipt_number, bw, bh);
    if (dataUrl) {
      doc.addImage(dataUrl, "PNG", 15, bottomY, bw, bh);
      doc.setFontSize(8); doc.setTextColor(80); doc.setFont("courier", "normal");
      doc.text(r.receipt_number, 15 + bw / 2, bottomY + bh + 4, { align: "center" });
    }
    if (qa.warnings.length) console.warn("[receipt] barcode QA warnings:", qa.warnings);
    if (qa.errors.length) console.error("[receipt] barcode QA errors:", qa.errors);
  }

  doc.setFontSize(8); doc.setTextColor(120); doc.setFont("helvetica", "normal");
  const footer = r.settings?.footer_note || "Thank you for your patronage. Goods sold are not returnable except as per company policy.";
  doc.text(footer, W / 2, 280, { align: "center" });
  doc.text("Powered by NaijaPOS — FIRS-aligned VAT Receipt", W / 2, 285, { align: "center" });

  return doc;
};

export const buildReceiptPdf = (r: ReceiptData) => {
  const template = r.settings?.template ?? "thermal";
  return template === "branded" ? buildBrandedReceipt(r) : buildThermalReceipt(r);
};

export const downloadReceiptPdf = (r: ReceiptData) => {
  const doc = buildReceiptPdf(r);
  doc.save(`${r.receipt_number}.pdf`);
};

export const printReceiptPdf = (r: ReceiptData) => {
  const doc = buildReceiptPdf(r);
  doc.autoPrint();
  const url = doc.output("bloburl");
  window.open(url as any, "_blank");
};
