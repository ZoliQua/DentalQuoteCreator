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

export function generateQuotePdf(quote: Quote, patient: Patient, settings: Settings, doctorName?: string): void {
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
      yPos += 4;
    }

    yPos += 2;

    // Doctor's name
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText(`Kezelőorvos:`), margin, yPos);
    const marginDoctorName = margin + 30;
    const yPosDoctorName = yPos;
    doc.text(toPdfText(doctorName || ''), marginDoctorName, yPosDoctorName);
    yPos += 4;


    // Right side - Quote info
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText('ÁRAJÁNLAT'), pageWidth - margin, margin, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(toPdfText(`Azonosító: ${formatQuoteId(quote.quoteId)}`), pageWidth - margin, margin + 7, {
      align: 'right',
    });
    doc.text(toPdfText(`Készült: ${formatPdfDate(quote.createdAt)}`), pageWidth - margin, margin + 12, {
      align: 'right',
    });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(toPdfText(`Érvényes: ${formatPdfDate(quote.validUntil)}`), pageWidth - margin, yPosDoctorName, {
      align: 'right',
    });

    yPos = Math.max(yPos, margin + 15) + 2;

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
  doc.text(toPdfText(formatPatientName(patient.lastName, patient.firstName, patient.title)), margin + 27, yPos);
  yPos += 5;

  if (patient.birthDate) {
    yPos -= 5;
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText('Születési dátum:'), margin + 80, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(toPdfText(formatPdfDate(patient.birthDate)), margin + 110, yPos);
    yPos += 5;
  }

  doc.setFont('helvetica', 'bold');
  doc.text(toPdfText('Lakóhely:'), margin, yPos);
  doc.setFont('helvetica', 'normal');
  const zipCity = [patient.zipCode, patient.city].filter(Boolean).join(', ');
  doc.text(toPdfText(zipCity), margin + 27, yPos);
  doc.setFont('helvetica', 'bold');
  doc.text(toPdfText('Cím:'), margin + 80, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(toPdfText(patient.street || ''), margin + 110, yPos);
  yPos += 5;

  // Show Contact Info if any
  const contactInfo = [patient.phone, patient.email].filter(Boolean).join(' | ');
  if (contactInfo) {
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText('Telefonszám:'), margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(toPdfText(patient.phone || ''), margin + 27, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText('E-mail cím:'), margin + 80, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(toPdfText(patient.email || ''), margin + 110, yPos);
    yPos += 5;
  }

  yPos += 8;

  // Calculate totals per session (needed later for summary)
  const sessionTotals: { [session: number]: number } = {};
  quote.items.forEach((item) => {
    const session = item.treatmentSession || 1;
    const lineTotal = calculateLineTotal(item);
    sessionTotals[session] = (sessionTotals[session] || 0) + lineTotal;
  });
  const sessionNumbers = Object.keys(sessionTotals).map(Number).sort((a, b) => a - b);
  const numberOfSessions = sessionNumbers.length;

  // Items table title
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(toPdfText('Kezelések tételek szerint'), margin, yPos);
  yPos += 6;

  // Items table
  const colWidths = {
    num: 7,
    name: 100,
    qty: 24,
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
  doc.text('Alk.', xPos, yPos);
  xPos += colWidths.num;
  doc.text(toPdfText('Megnevezés'), xPos, yPos);
  xPos += colWidths.name;

  // Egységár - jobbra igazítva
  doc.text(toPdfText('Egységár'), pageWidth - margin - 38, yPos, { align: 'right' });
  xPos += colWidths.unitPrice;
  doc.text(toPdfText('Mennyiség'), pageWidth - margin - 20, yPos, { align: 'right' });
  xPos += colWidths.qty;
  doc.text(toPdfText('Összesen'), pageWidth - margin - 2, yPos, { align: 'right' });

  yPos += 6;

  // Helper function to get treated area display text
  const getTreatedAreaText = (item: typeof quote.items[0]): string => {
    if (item.quoteUnit === 'alkalom') return 'Teljes szájüreg';
    if (item.quoteUnit === 'állcsont') {
      if (item.treatedArea === 'lower') return 'Alsó állcsont';
      if (item.treatedArea === 'upper') return 'Felső állcsont';
      if (item.treatedArea === 'both') return 'Alsó és Felső állcsont';
      return '';
    }
    if (item.quoteUnit === 'kvadráns') {
      if (item.treatedArea === 'q1') return '1-es kvadráns (jobb felül)';
      if (item.treatedArea === 'q2') return '2-es kvadráns (bal felül)';
      if (item.treatedArea === 'q3') return '3-as kvadráns (bal alul)';
      if (item.treatedArea === 'q4') return '4-es kvadráns (jobb alul)';
      return '';
    }
    // For 'db' and 'fog' - use treatedArea directly
    return item.treatedArea || '';
  };

  // Table rows (two lines per item)
  doc.setFont('helvetica', 'normal');
  quote.items.forEach((item, index) => {
    checkNewPage(14); // Two lines need more space

    const lineTotal = calculateLineTotal(item);
    const discountAmount = calculateLineDiscountAmount(item);

    // Alternate row background (taller for two lines)
    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, yPos - 4, contentWidth, 12, 'F');
    }

    // First line: #, Alk., Name, Unit Price, Qty (db), Total
    xPos = margin + 2;
    doc.text(`${index + 1}.`, xPos, yPos);
    xPos += colWidths.num;

    // Alk. oszlop - kezelés sorszáma
    doc.text(`${item.treatmentSession || 1}.`, xPos, yPos);
    xPos += colWidths.num;

    // Truncate name if too long
    let itemName = toPdfText(item.quoteName);
    if (item.toothNum) {
      itemName += ` (${item.toothNum})`;
    }
    if (doc.getTextWidth(itemName) > colWidths.name - 2) {
      while (doc.getTextWidth(itemName + '...') > colWidths.name - 2) {
        itemName = itemName.slice(0, -1);
      }
      itemName += '...';
    }
    doc.text(itemName, xPos, yPos);
    const nameXPos = xPos; // Save for second line
    xPos += colWidths.name;

    // Egységár - jobbra igazítva
    doc.text(formatCurrency(item.quoteUnitPriceGross).trim(), pageWidth - margin - 38, yPos, {
      align: 'right',
    });

    // Mennyiség - always "db"
    doc.text(toPdfText(`${item.quoteQty} db`), pageWidth - margin - 20, yPos, {
      align: 'right',
    });

    // Összesen
    doc.text(formatCurrency(lineTotal).replace('Ft', '').trim() + ' Ft', pageWidth - margin - 2, yPos, {
      align: 'right',
    });

    // Second line: Treated Area under name, Discount under price (if any)
    yPos += 4;
    doc.setFontSize(8);
    doc.setTextColor(100);

    // Treated area under name
    const treatedAreaText = getTreatedAreaText(item);
    if (treatedAreaText) {
      doc.text(toPdfText(treatedAreaText), nameXPos, yPos);
    }

    // Discount under total (if any)
    if (discountAmount > 0) {
      const discountText = item.quoteLineDiscountType === 'percent'
        ? `Kedv.: ${item.quoteLineDiscountValue}% : ${formatCurrency(discountAmount)}`
        : `Kedv.: ${formatCurrency(discountAmount)}`;
      doc.text(toPdfText(discountText), pageWidth - margin - 2, yPos, { align: 'right' });
    }

    doc.setFontSize(9);
    doc.setTextColor(0);
    yPos += 5;
  });

  // Sessions summary table (after items table)
  if (numberOfSessions > 0) {
    yPos += 8;
    checkNewPage(30 + numberOfSessions * 5);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText('Kezelések összefoglalója'), margin, yPos);
    yPos += 6;

    // Summary table header
    doc.setFontSize(9);
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 4, 140, 6, 'F');
    doc.text(toPdfText('Alkalom'), margin + 2, yPos);
    doc.text(toPdfText('Összeg'), margin + 120, yPos, { align: 'right' });
    yPos += 6;

    // Summary table rows
    doc.setFont('helvetica', 'normal');
    sessionNumbers.forEach((session) => {
      doc.text(toPdfText(`${session}. alkalom`), margin + 2, yPos);
      doc.text(formatCurrency(sessionTotals[session]), margin + 120, yPos, { align: 'right' });
      yPos += 6;
    });
  }

  // Totals section
  yPos += 6;
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
  doc.text(formatCurrency(totals.subtotal), pageWidth - margin - 2, yPos, { align: 'right' });
  yPos += 6;

  // Line discounts
  if (totals.lineDiscounts > 0) {
    doc.text(toPdfText('Kedvezmények:'), totalsX, yPos);
    doc.setTextColor(200, 0, 0);
    doc.text(`-${formatCurrency(totals.lineDiscounts)}`, pageWidth - margin - 2, yPos, {
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
    if (line.startsWith('••') || /^\d+\./.test(line.trim())) {
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setFont('helvetica', 'normal');
    }
    doc.text(line.replace(/••/g, '•'), margin, yPos);
    yPos += 5;
  });

  // Footer section
  yPos = pageHeight - 60;

  // Location and date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const city = settings.clinic.address
    .replace(/^\d{4}\s*/, '') // remove postal code at start
    .split(',')[0]
    .trim();
  doc.text(toPdfText(`Kelt: ${city}, ${formatPdfDate(quote.createdAt)}`), margin, yPos);
  yPos += 20;

  // Signature lines
  const sigLineWidth = 60;
  const sigY = yPos;

  // Patient signature
  doc.line(margin, sigY, margin + sigLineWidth, sigY);
  doc.setFontSize(9);
  doc.text(toPdfText(formatPatientName(patient.lastName, patient.firstName, patient.title)), margin + sigLineWidth / 2, sigY + 5, { align: 'center' });
  doc.text(toPdfText('Páciens'), margin + sigLineWidth / 2, sigY + 9, { align: 'center' });

  // Doctor signature
  doc.line(pageWidth - margin - sigLineWidth, sigY, pageWidth - margin, sigY);
  doc.text(toPdfText(doctorName || ''), pageWidth - margin - sigLineWidth / 2, sigY + 5, { align: 'center' });
  doc.text(toPdfText('Kezelőorvos'), pageWidth - margin - sigLineWidth / 2, sigY + 9, { align: 'center' });

  // Disclaimer footer
  yPos = pageHeight - 20;
  doc.setFontSize(8);
  doc.setTextColor(100);
  const disclaimerLines = doc.splitTextToSize(toPdfText(settings.pdf.footerText), contentWidth);
  doc.text(disclaimerLines, pageWidth / 2, yPos, { align: 'center' });

  // Save PDF
  const fileName = `arajanlat_${quote.quoteNumber}_${patient.lastName}_${patient.firstName}.pdf`;
  doc.save(fileName);
}
