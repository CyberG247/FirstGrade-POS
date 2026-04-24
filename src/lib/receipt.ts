import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatNaira, formatDate } from "./format";
import JsBarcode from "jsbarcode";

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
}

const naira = (v: number | string) => `N${Number(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const generateBarcodeDataUrl = (value: string) => {
  try {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, value, {
      format: "CODE128",
      displayValue: false,
      margin: 0,
      height: 50,
      width: 2,
    });
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
};

export const buildReceiptPdf = (r: ReceiptData) => {
  // Thermal-style receipt on A4 (centered narrow column, like the reference)
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const colW = 90; // narrow receipt column
  const left = (W - colW) / 2;
  const right = left + colW;
  const cx = W / 2;

  const dotted = (y: number) => {
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60);
    const line = "* ".repeat(Math.floor(colW / 2.2));
    doc.text(line, cx, y, { align: "center" });
  };

  const lineRow = (label: string, value: string, y: number, opts: { bold?: boolean; size?: number } = {}) => {
    doc.setFont("courier", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 10);
    doc.setTextColor(20);
    doc.text(label, left, y);
    doc.text(value, right, y, { align: "right" });
  };

  let y = 18;

  // Shop name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(10);
  doc.text((r.business?.name || "SHOP NAME").toUpperCase(), cx, y, { align: "center" });
  y += 6;

  // Address & phone
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60);
  if (r.business?.address) { doc.text(`Address: ${r.business.address}`, cx, y, { align: "center" }); y += 4; }
  if (r.business?.phone) { doc.text(`Tel: ${r.business.phone}`, cx, y, { align: "center" }); y += 4; }
  if (r.business?.tin) { doc.text(`TIN: ${r.business.tin}`, cx, y, { align: "center" }); y += 4; }

  y += 2;
  dotted(y); y += 5;

  // CASH RECEIPT title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(10);
  doc.text("CASH RECEIPT", cx, y, { align: "center" });
  y += 4;
  dotted(y); y += 6;

  // Receipt meta
  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(`Receipt: ${r.receipt_number}`, left, y);
  doc.text(formatDate(r.created_at), right, y, { align: "right" });
  y += 4;
  if (r.cashier) { doc.text(`Cashier: ${r.cashier}`, left, y); y += 4; }

  y += 1;
  // Items header
  doc.setFont("courier", "bold");
  doc.setFontSize(10);
  doc.setTextColor(10);
  doc.text("Description", left, y);
  doc.text("Price", right, y, { align: "right" });
  y += 4;

  // Items
  doc.setFont("courier", "normal");
  doc.setFontSize(10);
  r.items.forEach((it) => {
    const qtyLabel = it.quantity > 1 ? ` x${it.quantity}` : "";
    const name = `${it.product_name}${qtyLabel}`;
    const wrapped = doc.splitTextToSize(name, colW - 30);
    doc.text(wrapped, left, y);
    doc.text(naira(it.line_total), right, y, { align: "right" });
    y += 4 * wrapped.length;
  });

  y += 1;
  dotted(y); y += 6;

  // Totals
  if (Number(r.subtotal) > 0) { lineRow("Subtotal", naira(r.subtotal), y); y += 5; }
  if (Number(r.discount) > 0) { lineRow("Discount", `-${naira(r.discount)}`, y); y += 5; }
  if (Number(r.vat_amount) > 0) { lineRow("VAT (7.5%)", naira(r.vat_amount), y); y += 5; }

  y += 1;
  lineRow("Total", naira(r.total), y, { bold: true, size: 13 });
  y += 6;

  // Payment
  const method = r.payment_method.toUpperCase();
  if (method === "CASH" && r.amount_tendered != null) {
    lineRow("Cash", naira(r.amount_tendered), y); y += 5;
    if (r.change != null) { lineRow("Change", naira(r.change), y); y += 5; }
  } else {
    lineRow(method, naira(r.total), y); y += 5;
  }

  y += 2;
  dotted(y); y += 5;

  // Card / approval
  if (method !== "CASH") {
    doc.setFont("courier", "normal"); doc.setFontSize(9); doc.setTextColor(60);
    doc.text(`Payment method`, left, y);
    doc.text(method, right, y, { align: "right" });
    y += 4;
    if (r.approval_code) {
      doc.text("Approval Code", left, y);
      doc.text(`#${r.approval_code}`, right, y, { align: "right" });
      y += 4;
    }
    y += 2;
  }

  // Thank you
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(10);
  doc.text("THANK YOU!", cx, y, { align: "center" });
  y += 6;

  // Barcode
  const barcode = generateBarcodeDataUrl(r.receipt_number);
  if (barcode) {
    const bw = 60, bh = 14;
    doc.addImage(barcode, "PNG", cx - bw / 2, y, bw, bh);
    y += bh + 4;
    doc.setFont("courier", "normal"); doc.setFontSize(8); doc.setTextColor(80);
    doc.text(r.receipt_number, cx, y, { align: "center" });
    y += 5;
  }

  // Footer
  doc.setFontSize(7); doc.setTextColor(140); doc.setFont("helvetica", "normal");
  doc.text("Powered by NaijaPOS — FIRS-aligned VAT Receipt", cx, 285, { align: "center" });

  return doc;
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
