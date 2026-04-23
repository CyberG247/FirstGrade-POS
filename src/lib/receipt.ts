import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatNaira, formatDate } from "./format";

export interface ReceiptData {
  receipt_number: string;
  created_at: string;
  subtotal: number | string;
  vat_amount: number | string;
  discount: number | string;
  total: number | string;
  payment_method: string;
  items: Array<{ product_name: string; quantity: number; unit_price: number | string; line_total: number | string }>;
  business?: { name?: string | null; tin?: string | null; phone?: string | null; cac?: string | null };
  cashier?: string;
}

export const buildReceiptPdf = (r: ReceiptData) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(15, 23, 42); // navy
  doc.rect(0, 0, W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text(r.business?.name || "NaijaPOS", 15, 14);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("Official Tax Invoice / Receipt", 15, 21);
  doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text(r.receipt_number, W - 15, 14, { align: "right" });
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(formatDate(r.created_at), W - 15, 21, { align: "right" });

  // Business meta
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  let y = 36;
  if (r.business?.tin) { doc.text(`TIN: ${r.business.tin}`, 15, y); y += 5; }
  if (r.business?.cac) { doc.text(`CAC: ${r.business.cac}`, 15, y); y += 5; }
  if (r.business?.phone) { doc.text(`Tel: ${r.business.phone}`, 15, y); y += 5; }
  if (r.cashier) { doc.text(`Cashier: ${r.cashier}`, W - 15, 36, { align: "right" }); }

  // Items table
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
    doc.text(label, labelX, yy);
    doc.text(val, valueX, yy, { align: "right" });
  };
  row("Subtotal", formatNaira(r.subtotal), endY);
  row("VAT (7.5%)", formatNaira(r.vat_amount), endY + 6);
  if (Number(r.discount) > 0) row("Discount", `-${formatNaira(r.discount)}`, endY + 12);
  doc.setDrawColor(200);
  doc.line(labelX, endY + (Number(r.discount) > 0 ? 15 : 9), valueX, endY + (Number(r.discount) > 0 ? 15 : 9));
  row("TOTAL", formatNaira(r.total), endY + (Number(r.discount) > 0 ? 22 : 16), true);

  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(80);
  doc.text(`Payment Method: ${r.payment_method.toUpperCase()}`, 15, endY + 6);
  doc.text(`Status: ${"PAID"}`, 15, endY + 12);

  // Footer
  doc.setFontSize(8); doc.setTextColor(120);
  doc.text("Thank you for your patronage. Goods sold are not returnable except as per company policy.", W / 2, 280, { align: "center" });
  doc.text("Powered by NaijaPOS — FIRS-aligned VAT Receipt", W / 2, 285, { align: "center" });

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
