import jsPDF from 'jspdf';
import { toPdfText, formatPdfDate } from './pdfUtils';
import type { InvoiceRequestPayload } from '../../modules/invoicing/api';

function formatCurrencyPdf(amount: number): string {
  return Math.round(amount).toLocaleString('hu-HU') + ' Ft';
}

export function generateInvoicePreviewPdf(payload: InvoiceRequestPayload): void {
  const { seller, buyer, invoice, items } = payload;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  let yPos = margin;

  // --- Determine invoice title ---
  let title = 'SZÁMLA';
  if (invoice.elolegszamla) title = 'ELÖLEGSZÁMLA';
  if (invoice.vegszamla) title = 'VÉGSZÁMLA';

  // --- Helper: check page break ---
  const checkNewPage = (neededHeight: number): void => {
    if (yPos + neededHeight > pageHeight - 25) {
      doc.addPage();
      yPos = margin;
    }
  };

  // =========================================================
  // 1. HEADER
  // =========================================================
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(toPdfText(title), margin, yPos + 6);

  // Right side: seller name + email
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(toPdfText(seller.name), pageWidth - margin, yPos, { align: 'right' });
  if (seller.email) {
    doc.text(toPdfText(seller.email), pageWidth - margin, yPos + 5, { align: 'right' });
  }
  yPos += 14;

  // =========================================================
  // 2. METADATA (grey box)
  // =========================================================
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, yPos - 4, contentWidth, 22, 'F');

  doc.setFontSize(9);
  const metaX1 = margin + 3;
  const metaX2 = margin + contentWidth / 2;

  doc.setFont('helvetica', 'bold');
  doc.text('Számlaszám:', metaX1, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(toPdfText('ELÖNÉZET'), metaX1 + 28, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text(toPdfText('Fizetési mód:'), metaX2, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(toPdfText(invoice.paymentMethod), metaX2 + 28, yPos);

  yPos += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(toPdfText('Kiállítás:'), metaX1, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(formatPdfDate(invoice.issueDate), metaX1 + 28, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text(toPdfText('Teljesítés:'), metaX2, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(formatPdfDate(invoice.fulfillmentDate), metaX2 + 28, yPos);

  yPos += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(toPdfText('Fizetési határidö:'), metaX1, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(formatPdfDate(invoice.dueDate), metaX1 + 35, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text('Pénznem:', metaX2, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.currency, metaX2 + 28, yPos);

  yPos += 10;

  // =========================================================
  // 3. SELLER / BUYER two-column
  // =========================================================
  const colW = contentWidth / 2 - 2;
  const sellerX = margin;
  const buyerX = margin + contentWidth / 2 + 2;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(toPdfText('Eladó'), sellerX, yPos);
  doc.text(toPdfText('Vevö'), buyerX, yPos);
  yPos += 1;
  doc.setDrawColor(200);
  doc.line(sellerX, yPos, sellerX + colW, yPos);
  doc.line(buyerX, yPos, buyerX + colW, yPos);
  yPos += 5;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  // Seller details
  doc.text(toPdfText(seller.name), sellerX, yPos);
  if (seller.email) {
    yPos += 4;
    doc.text(toPdfText(seller.email), sellerX, yPos);
  }

  // Buyer details (reset yPos for buyer column)
  let buyerY = yPos - (seller.email ? 4 : 0);
  doc.text(toPdfText(buyer.name), buyerX, buyerY);
  buyerY += 4;
  const buyerAddr = [buyer.zip, buyer.city, buyer.address].filter(Boolean).join(', ');
  if (buyerAddr) {
    const addrLines = doc.splitTextToSize(toPdfText(buyerAddr), colW);
    doc.text(addrLines, buyerX, buyerY);
    buyerY += addrLines.length * 4;
  }
  if (buyer.email) {
    doc.text(toPdfText(buyer.email), buyerX, buyerY);
    buyerY += 4;
  }
  if (buyer.taxNumber) {
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText('Adószám: ') + buyer.taxNumber, buyerX, buyerY);
    doc.setFont('helvetica', 'normal');
    buyerY += 4;
  }

  yPos = Math.max(yPos + 4, buyerY) + 4;

  // =========================================================
  // 4. ITEMS TABLE
  // =========================================================
  checkNewPage(30);

  // Column positions
  const col = {
    num:      margin + 2,
    name:     margin + 10,
    unit:     margin + contentWidth * 0.42,
    qty:      margin + contentWidth * 0.50,
    netUnit:  margin + contentWidth * 0.60,
    vatPct:   margin + contentWidth * 0.70,
    net:      margin + contentWidth * 0.78,
    vat:      margin + contentWidth * 0.88,
    gross:    pageWidth - margin - 2,
  };

  // Table header
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, yPos - 4, contentWidth, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('#', col.num, yPos);
  doc.text(toPdfText('Megnevezés'), col.name, yPos);
  doc.text('Me.e.', col.unit, yPos);
  doc.text('Menny.', col.qty, yPos);
  doc.text(toPdfText('Nettó e.ár'), col.netUnit, yPos);
  doc.text(toPdfText('ÁFA%'), col.vatPct, yPos);
  doc.text(toPdfText('Nettó'), col.net, yPos);
  doc.text(toPdfText('ÁFA'), col.vat, yPos);
  doc.text(toPdfText('Bruttó'), col.gross, yPos, { align: 'right' });
  yPos += 5;

  // Table rows
  let totalNet = 0;
  let totalVat = 0;
  let totalGross = 0;

  items.forEach((item, idx) => {
    checkNewPage(10);

    // Alternating row background
    if (idx % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, yPos - 3.5, contentWidth, 6, 'F');
    }

    const lineNet = item.qty * item.unitPriceNet;
    const vatPct = typeof item.vatRate === 'number' ? item.vatRate : 0;
    const vatLabel = typeof item.vatRate === 'string' ? item.vatRate : `${item.vatRate}%`;
    const lineVat = typeof item.vatRate === 'string' ? 0 : (lineNet * vatPct) / 100;
    const lineGross = lineNet + lineVat;

    totalNet += lineNet;
    totalVat += lineVat;
    totalGross += lineGross;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${idx + 1}`, col.num, yPos);

    // Truncate name if too long
    const maxNameW = col.unit - col.name - 2;
    let nameText = toPdfText(item.name);
    if (doc.getTextWidth(nameText) > maxNameW) {
      while (doc.getTextWidth(nameText + '...') > maxNameW && nameText.length > 0) {
        nameText = nameText.slice(0, -1);
      }
      nameText += '...';
    }
    doc.text(nameText, col.name, yPos);

    doc.text(toPdfText(item.unit), col.unit, yPos);
    doc.text(`${item.qty}`, col.qty, yPos);
    doc.text(formatCurrencyPdf(item.unitPriceNet), col.netUnit, yPos);
    doc.text(toPdfText(vatLabel), col.vatPct, yPos);
    doc.text(formatCurrencyPdf(lineNet), col.net, yPos);
    doc.text(formatCurrencyPdf(lineVat), col.vat, yPos);
    doc.text(formatCurrencyPdf(lineGross), col.gross, yPos, { align: 'right' });

    yPos += 6;
  });

  // =========================================================
  // 5. TOTALS
  // =========================================================
  yPos += 4;
  checkNewPage(25);
  doc.setDrawColor(180);
  doc.line(margin + contentWidth * 0.55, yPos, pageWidth - margin, yPos);
  yPos += 6;

  const totalsLabelX = margin + contentWidth * 0.60;
  const totalsValueX = pageWidth - margin - 2;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(toPdfText('Nettó összesen:'), totalsLabelX, yPos);
  doc.text(formatCurrencyPdf(totalNet), totalsValueX, yPos, { align: 'right' });
  yPos += 5;

  doc.text(toPdfText('ÁFA összesen:'), totalsLabelX, yPos);
  doc.text(formatCurrencyPdf(totalVat), totalsValueX, yPos, { align: 'right' });
  yPos += 3;

  doc.setDrawColor(100);
  doc.line(totalsLabelX - 2, yPos, pageWidth - margin, yPos);
  yPos += 5;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(toPdfText('Bruttó összesen:'), totalsLabelX, yPos);
  doc.text(formatCurrencyPdf(totalGross), totalsValueX, yPos, { align: 'right' });

  // =========================================================
  // 6. COMMENT
  // =========================================================
  if (invoice.comment) {
    yPos += 12;
    checkNewPage(20);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText('Megjegyzés:'), margin, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    const commentLines = doc.splitTextToSize(toPdfText(invoice.comment), contentWidth);
    for (const line of commentLines) {
      checkNewPage(5);
      doc.text(line, margin, yPos);
      yPos += 4;
    }
  }

  // =========================================================
  // 7. WATERMARK on every page
  // =========================================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.saveGraphicsState();
    doc.setFontSize(60);
    doc.setTextColor(220, 220, 220);
    doc.setFont('helvetica', 'bold');

    // Rotate text 45° around page center
    const cx = pageWidth / 2;
    const cy = pageHeight / 2;
    const angle = -45 * (Math.PI / 180);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Apply rotation transformation matrix
    (doc as unknown as { internal: { write: (s: string) => void } }).internal.write(
      `q ${cos.toFixed(4)} ${sin.toFixed(4)} ${(-sin).toFixed(4)} ${cos.toFixed(4)} ${cx.toFixed(2)} ${(pageHeight - cy).toFixed(2)} cm`
    );
    doc.text(toPdfText('ELÖNÉZET'), 0, 0, { align: 'center', baseline: 'middle' });
    (doc as unknown as { internal: { write: (s: string) => void } }).internal.write('Q');

    doc.restoreGraphicsState();
  }

  // =========================================================
  // 8. PAGE NUMBERS
  // =========================================================
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text(`${i} / ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  // Open in new tab
  window.open(doc.output('bloburl').toString(), '_blank');
}
