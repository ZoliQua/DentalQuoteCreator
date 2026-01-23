import jsPDF from 'jspdf';
import { Quote, Patient, Settings } from '../../types';
import {
  formatCurrency,
  formatPatientName,
  formatQuoteId,
  calculateQuoteTotals,
  calculateLineTotal,
  calculateLineDiscountAmount,
} from '../../utils';

// Helper function to convert Hungarian special characters for PDF
// jsPDF's built-in fonts don't support ő and ű (double acute), so we replace them
function toPdfText(text: string): string {
  return text
    .replace(/ő/g, 'ö')
    .replace(/Ő/g, 'Ö')
    .replace(/ű/g, 'ü')
    .replace(/Ű/g, 'Ü');
}

// Format date as YYYY.MM.DD for PDF
function formatPdfDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

export function generateQuotePdf(quote: Quote, patient: Patient, settings: Settings): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  let yPos = margin;

  // Helper function to add a new page if needed
  const checkNewPage = (neededHeight: number): void => {
    if (yPos + neededHeight > pageHeight - 30) {
      doc.addPage();
      yPos = margin;
      addHeader();
    }
  };

  // Add header to each page
  const addHeader = (): void => {
    // Left side - Clinic info
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText(settings.clinic.name), margin, yPos);
    yPos += 5;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(toPdfText(settings.clinic.address), margin, yPos);
    yPos += 4;
    doc.text(toPdfText(`Tel: ${settings.clinic.phone}`), margin, yPos);
    yPos += 4;
    doc.text(toPdfText(`Email: ${settings.clinic.email}`), margin, yPos);
    yPos += 4;
    if (settings.clinic.website) {
      doc.text(toPdfText(settings.clinic.website), margin, yPos);
    }

    // Right side - Quote info
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText('ÁRAJÁNLAT'), pageWidth - margin, margin, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(toPdfText(`Azonosító: ${formatQuoteId(quote.quoteId)}`), pageWidth - margin, margin + 7, {
      align: 'right',
    });
    doc.text(toPdfText(`Dátum: ${formatPdfDate(quote.createdAt)}`), pageWidth - margin, margin + 12, {
      align: 'right',
    });
    doc.text(toPdfText(`Érvényes: ${formatPdfDate(quote.validUntil)}`), pageWidth - margin, margin + 17, {
      align: 'right',
    });

    yPos = Math.max(yPos, margin + 22) + 10;

    // Horizontal line
    doc.setDrawColor(200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
  };

  // Initial header
  addHeader();

  // Patient info block
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(toPdfText('Páciens:'), margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(toPdfText(formatPatientName(patient.lastName, patient.firstName)), margin + 18, yPos);
  yPos += 5;

  if (patient.birthDate) {
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText('Születési dátum:'), margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(toPdfText(formatPdfDate(patient.birthDate)), margin + 32, yPos);
    yPos += 5;
  }

  const contactInfo = [patient.phone, patient.email].filter(Boolean).join(' | ');
  if (contactInfo) {
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText('Elérhetöség:'), margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(toPdfText(contactInfo), margin + 25, yPos);
    yPos += 5;
  }

  yPos += 8;

  // Items table
  const colWidths = {
    num: 10,
    name: 65,
    qty: 25,
    unitPrice: 30,
    discount: 20,
    total: 30,
  };

  // Table header
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 4, contentWidth, 8, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  let xPos = margin + 2;
  doc.text('#', xPos, yPos);
  xPos += colWidths.num;
  doc.text(toPdfText('Megnevezés'), xPos, yPos);
  xPos += colWidths.name;
  doc.text(toPdfText('Mennyiség'), xPos, yPos);
  xPos += colWidths.qty;
  doc.text(toPdfText('Egységár'), xPos, yPos);
  xPos += colWidths.unitPrice;
  doc.text(toPdfText('Kedv.'), xPos, yPos);
  xPos += colWidths.discount;
  doc.text(toPdfText('Összesen'), xPos, yPos, { align: 'right' });

  yPos += 6;

  // Table rows
  doc.setFont('helvetica', 'normal');
  quote.items.forEach((item, index) => {
    checkNewPage(12);

    const lineTotal = calculateLineTotal(item);
    const discountAmount = calculateLineDiscountAmount(item);

    // Alternate row background
    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, yPos - 4, contentWidth, 8, 'F');
    }

    xPos = margin + 2;
    doc.text(`${index + 1}.`, xPos, yPos);
    xPos += colWidths.num;

    // Truncate name if too long
    let itemName = toPdfText(item.quoteName);
    if (item.toothNum) {
      itemName += ` (${item.toothNum})`;
    }
    if (doc.getTextWidth(itemName) > colWidths.name - 5) {
      while (doc.getTextWidth(itemName + '...') > colWidths.name - 5) {
        itemName = itemName.slice(0, -1);
      }
      itemName += '...';
    }
    doc.text(itemName, xPos, yPos);
    xPos += colWidths.name;

    doc.text(toPdfText(`${item.quoteQty} ${item.quoteUnit}`), xPos, yPos);
    xPos += colWidths.qty;

    doc.text(formatCurrency(item.quoteUnitPriceGross).replace('Ft', ''), xPos, yPos);
    xPos += colWidths.unitPrice;

    if (discountAmount > 0) {
      const discountText =
        item.quoteLineDiscountType === 'percent'
          ? `${item.quoteLineDiscountValue}%`
          : formatCurrency(discountAmount).replace('Ft', '');
      doc.text(discountText, xPos, yPos);
    } else {
      doc.text('-', xPos, yPos);
    }
    xPos += colWidths.discount;

    doc.text(formatCurrency(lineTotal).replace('Ft', '') + ' Ft', pageWidth - margin - 2, yPos, {
      align: 'right',
    });

    yPos += 7;
  });

  // Totals section
  yPos += 5;
  checkNewPage(40);

  doc.setDrawColor(200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  const totals = calculateQuoteTotals(quote);
  const totalsX = pageWidth - margin - 80;

  doc.setFontSize(10);

  // Subtotal
  doc.setFont('helvetica', 'normal');
  doc.text(toPdfText('Részösszeg:'), totalsX, yPos);
  doc.text(formatCurrency(totals.subtotal), pageWidth - margin, yPos, { align: 'right' });
  yPos += 6;

  // Line discounts
  if (totals.lineDiscounts > 0) {
    doc.text(toPdfText('Sor kedvezmények:'), totalsX, yPos);
    doc.setTextColor(200, 0, 0);
    doc.text(`-${formatCurrency(totals.lineDiscounts)}`, pageWidth - margin, yPos, {
      align: 'right',
    });
    doc.setTextColor(0, 0, 0);
    yPos += 6;
  }

  // Global discount
  if (totals.globalDiscount > 0) {
    doc.text(toPdfText('Globális kedvezmény:'), totalsX, yPos);
    doc.setTextColor(200, 0, 0);
    doc.text(`-${formatCurrency(totals.globalDiscount)}`, pageWidth - margin, yPos, {
      align: 'right',
    });
    doc.setTextColor(0, 0, 0);
    yPos += 6;
  }

  // Total
  yPos += 2;
  doc.setDrawColor(100);
  doc.line(totalsX - 5, yPos, pageWidth - margin, yPos);
  yPos += 6;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(toPdfText('FIZETENDÖ:'), totalsX, yPos);
  doc.text(formatCurrency(totals.total), pageWidth - margin, yPos, { align: 'right' });

  // Comment to patient
  if (quote.commentToPatient) {
    yPos += 15;
    checkNewPage(30);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText('Megjegyzés:'), margin, yPos);
    yPos += 5;

    doc.setFont('helvetica', 'normal');
    const commentLines = doc.splitTextToSize(toPdfText(quote.commentToPatient), contentWidth);
    doc.text(commentLines, margin, yPos);
    yPos += commentLines.length * 5;
  }

  // Page 2 - Warranty
  doc.addPage();
  yPos = margin;

  // Warranty title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(toPdfText('GARANCIÁLIS FELTÉTELEK'), pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Warranty text
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const warrantyLines = doc.splitTextToSize(toPdfText(settings.pdf.warrantyText), contentWidth);

  warrantyLines.forEach((line: string) => {
    checkNewPage(6);
    // Check for bullet points or numbered items
    if (line.startsWith('•') || /^\d+\./.test(line.trim())) {
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setFont('helvetica', 'normal');
    }
    doc.text(line, margin, yPos);
    yPos += 5;
  });

  // Footer section
  yPos = pageHeight - 60;

  // Location and date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const city = settings.clinic.address.split(',')[0] || 'Szombathely';
  doc.text(toPdfText(`Kelt: ${city}, ${formatPdfDate(quote.createdAt)}`), margin, yPos);
  yPos += 20;

  // Signature lines
  const sigLineWidth = 60;
  const sigY = yPos;

  // Patient signature
  doc.line(margin, sigY, margin + sigLineWidth, sigY);
  doc.setFontSize(9);
  doc.text(toPdfText('Páciens aláírása'), margin + sigLineWidth / 2, sigY + 5, { align: 'center' });

  // Doctor signature
  doc.line(pageWidth - margin - sigLineWidth, sigY, pageWidth - margin, sigY);
  doc.text(toPdfText('Kezelöorvos'), pageWidth - margin - sigLineWidth / 2, sigY + 5, { align: 'center' });

  // Disclaimer footer
  yPos = pageHeight - 20;
  doc.setFontSize(8);
  doc.setTextColor(100);
  const disclaimerLines = doc.splitTextToSize(toPdfText(settings.pdf.footerText), contentWidth);
  doc.text(disclaimerLines, pageWidth / 2, yPos, { align: 'center' });

  // Save PDF
  const fileName = `arajanlat_${formatQuoteId(quote.quoteId)}_${patient.lastName}_${patient.firstName}.pdf`;
  doc.save(fileName);
}
