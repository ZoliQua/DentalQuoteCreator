import jsPDF from 'jspdf';
import { Quote, Patient, Settings } from '../../types';
import {
  formatCurrency,
  formatPatientName,
  calculateQuoteTotals,
  calculateLineTotal,
  calculateLineDiscountAmount,
} from '../../utils';
import { mergeQuoteItemsBySession, type MergedQuoteItem } from '../../utils/mergedQuoteItems';

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

export function generateQuotePdf(quote: Quote, patient: Patient, settings: Settings, doctorName?: string, odontogramImage?: string): void {
  const quoteLang: 'hu' | 'en' | 'de' = (quote as { quoteLang?: 'hu' | 'en' | 'de' }).quoteLang ?? (settings.quote as { quoteLang?: 'hu' | 'en' | 'de' }).quoteLang ?? 'hu';
  const pdfLangSettings = (settings.pdf as { hu?: { footerText: string; warrantyText: string }; en?: { footerText: string; warrantyText: string }; de?: { footerText: string; warrantyText: string }; footerText?: string; warrantyText?: string });
  // Support both old flat format and new per-language format
  const resolvedFooterText = pdfLangSettings[quoteLang]?.footerText ?? (pdfLangSettings as unknown as { footerText?: string }).footerText ?? '';
  const resolvedWarrantyText = pdfLangSettings[quoteLang]?.warrantyText ?? (pdfLangSettings as unknown as { warrantyText?: string }).warrantyText ?? '';

  // Localized PDF labels
  const pdfLabels = {
    hu: {
      title: 'ÁRAJÁNLAT', doctor: 'Kezelőorvos:', id: 'Azonosító:', created: 'Készült:', valid: 'Érvényes:',
      patient: 'Páciens:', birthDate: 'Születési dátum:', address: 'Lakóhely:', street: 'Cím:', phone: 'Telefonszám:', email: 'E-mail cím:',
      dentalStatus: 'Célzott fogászati státusz', itemsTitle: 'Kezelések tételek szerint',
      session: 'Alk.', name: 'Megnevezés', unitPrice: 'Egységár', qty: 'Mennyiség', total: 'Összesen',
      sessionSummary: 'Kezelések összefoglalója', sessionCol: 'Alkalom', amountCol: 'Összeg', sessionLabel: 'alkalom',
      subtotal: 'Részösszeg:', lineDiscounts: 'Kedvezmények:', globalDiscount: 'Globális kedvezmény:', grandTotal: 'FIZETENDÖ:',
      comment: 'Megjegyzés:', warranty: 'GARANCIÁLIS FELTÉTELEK', location: 'Kelt:', patientSig: 'Páciens', doctorSig: 'Kezelőorvos',
      unit: 'db', fullMouth: 'Teljes szájüreg', lowerJaw: 'Alsó állcsont', upperJaw: 'Felső állcsont', bothJaws: 'Alsó és Felső állcsont',
      q1: '1-es kvadráns (jobb felül)', q2: '2-es kvadráns (bal felül)', q3: '3-as kvadráns (bal alul)', q4: '4-es kvadráns (jobb alul)',
      discount: 'Kedv.', treatments: 'Kezelések',
    },
    en: {
      title: 'QUOTE', doctor: 'Doctor:', id: 'ID:', created: 'Date:', valid: 'Valid until:',
      patient: 'Patient:', birthDate: 'Date of birth:', address: 'City:', street: 'Address:', phone: 'Phone:', email: 'Email:',
      dentalStatus: 'Targeted dental status', itemsTitle: 'Treatment items',
      session: 'Ses.', name: 'Description', unitPrice: 'Unit price', qty: 'Quantity', total: 'Total',
      sessionSummary: 'Treatment summary', sessionCol: 'Session', amountCol: 'Amount', sessionLabel: 'session',
      subtotal: 'Subtotal:', lineDiscounts: 'Discounts:', globalDiscount: 'Global discount:', grandTotal: 'TOTAL:',
      comment: 'Comment:', warranty: 'WARRANTY CONDITIONS', location: 'Date:', patientSig: 'Patient', doctorSig: 'Doctor',
      unit: 'pcs', fullMouth: 'Full mouth', lowerJaw: 'Lower jaw', upperJaw: 'Upper jaw', bothJaws: 'Lower and Upper jaw',
      q1: 'Quadrant 1 (upper right)', q2: 'Quadrant 2 (upper left)', q3: 'Quadrant 3 (lower left)', q4: 'Quadrant 4 (lower right)',
      discount: 'Disc.', treatments: 'Treatments',
    },
    de: {
      title: 'KOSTENVORANSCHLAG', doctor: 'Behandelnder Arzt:', id: 'ID:', created: 'Datum:', valid: 'Gültig bis:',
      patient: 'Patient:', birthDate: 'Geburtsdatum:', address: 'Ort:', street: 'Adresse:', phone: 'Telefon:', email: 'E-Mail:',
      dentalStatus: 'Gezielter Zahnstatus', itemsTitle: 'Behandlungspositionen',
      session: 'Sitz.', name: 'Bezeichnung', unitPrice: 'Einzelpreis', qty: 'Menge', total: 'Gesamt',
      sessionSummary: 'Behandlungsübersicht', sessionCol: 'Sitzung', amountCol: 'Betrag', sessionLabel: 'Sitzung',
      subtotal: 'Zwischensumme:', lineDiscounts: 'Rabatte:', globalDiscount: 'Globalrabatt:', grandTotal: 'GESAMTBETRAG:',
      comment: 'Anmerkung:', warranty: 'GARANTIEBEDINGUNGEN', location: 'Datum:', patientSig: 'Patient', doctorSig: 'Behandelnder Arzt',
      unit: 'Stk', fullMouth: 'Gesamter Mund', lowerJaw: 'Unterkiefer', upperJaw: 'Oberkiefer', bothJaws: 'Unter- und Oberkiefer',
      q1: 'Quadrant 1 (oben rechts)', q2: 'Quadrant 2 (oben links)', q3: 'Quadrant 3 (unten links)', q4: 'Quadrant 4 (unten rechts)',
      discount: 'Rab.', treatments: 'Behandlungen',
    },
  }[quoteLang];

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
    doc.text(toPdfText(pdfLabels.doctor), margin, yPos);
    const marginDoctorName = margin + 30;
    const yPosDoctorName = yPos;
    doc.text(toPdfText(doctorName || ''), marginDoctorName, yPosDoctorName);
    yPos += 4;


    // Right side - Quote info
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText(pdfLabels.title), pageWidth - margin, margin, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(toPdfText(`${pdfLabels.id} ${quote.quoteNumber}`), pageWidth - margin, margin + 7, {
      align: 'right',
    });
    doc.text(toPdfText(`${pdfLabels.created} ${formatPdfDate(quote.createdAt)}`), pageWidth - margin, margin + 12, {
      align: 'right',
    });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(toPdfText(`${pdfLabels.valid} ${formatPdfDate(quote.validUntil)}`), pageWidth - margin, yPosDoctorName, {
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
  doc.text(toPdfText(pdfLabels.patient), margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(toPdfText(formatPatientName(patient.lastName, patient.firstName, patient.title)), margin + 27, yPos);
  yPos += 5;

  if (patient.birthDate) {
    yPos -= 5;
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText(pdfLabels.birthDate), margin + 80, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(toPdfText(formatPdfDate(patient.birthDate)), margin + 110, yPos);
    yPos += 5;
  }

  doc.setFont('helvetica', 'bold');
  doc.text(toPdfText(pdfLabels.address), margin, yPos);
  doc.setFont('helvetica', 'normal');
  const zipCity = [patient.zipCode, patient.city].filter(Boolean).join(', ');
  doc.text(toPdfText(zipCity), margin + 27, yPos);
  doc.setFont('helvetica', 'bold');
  doc.text(toPdfText(pdfLabels.street), margin + 80, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(toPdfText(patient.street || ''), margin + 110, yPos);
  yPos += 5;

  // Show Contact Info if any
  const contactInfo = [patient.phone, patient.email].filter(Boolean).join(' | ');
  if (contactInfo) {
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText(pdfLabels.phone), margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(toPdfText(patient.phone || ''), margin + 27, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText(pdfLabels.email), margin + 80, yPos);
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

  // Odontogram image (if provided)
  if (odontogramImage) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText(pdfLabels.dentalStatus), margin, yPos);
    yPos += 6;

    const imgProps = doc.getImageProperties(odontogramImage);
    const imgWidth = contentWidth * 0.75;
    const imgHeight = (imgProps.height / imgProps.width) * imgWidth;
    checkNewPage(imgHeight + 10);
    const imgX = margin + (contentWidth - imgWidth) / 2;
    doc.addImage(odontogramImage, 'PNG', imgX, yPos, imgWidth, imgHeight);
    yPos += imgHeight + 6;
  }

  // Merged items by session (mirrors visual editor order)
  const mergedBySession = mergeQuoteItemsBySession(quote.items);
  const allSessions = Array.from(mergedBySession.keys()).sort((a, b) => a - b);
  const isVisual = quote.quoteType === 'visual';

  // Column widths — visual quotes don't need the "Alk." column
  const colWidths = {
    num: 7,
    session: isVisual ? 0 : 7,
    name: isVisual ? 107 : 100,
    qty: 24,
    unitPrice: 30,
    discount: 20,
    total: 30,
  };

  // Helper: render table header row
  const renderTableHeader = () => {
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 4, contentWidth, 8, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    let x = margin + 2;
    doc.text('#', x, yPos);
    x += colWidths.num;
    if (!isVisual) {
      doc.text(toPdfText(pdfLabels.session), x, yPos);
      x += colWidths.session;
    }
    doc.text(toPdfText(pdfLabels.name), x, yPos);
    doc.text(toPdfText(pdfLabels.unitPrice), pageWidth - margin - 38, yPos, { align: 'right' });
    doc.text(toPdfText(pdfLabels.qty), pageWidth - margin - 20, yPos, { align: 'right' });
    doc.text(toPdfText(pdfLabels.total), pageWidth - margin - 2, yPos, { align: 'right' });
    yPos += 6;
  };

  // Helper: localized treated area text for a merged group
  const getMergedTreatedAreaText = (merged: MergedQuoteItem): string => {
    const items = merged.items;
    if (items.length === 0) return '';

    if (items[0].quoteUnit === 'alkalom') return pdfLabels.fullMouth;
    if (items[0].quoteUnit === 'állcsont') {
      const areas = items.map((item) => {
        if (item.treatedArea === 'upper') return pdfLabels.upperJaw;
        if (item.treatedArea === 'lower') return pdfLabels.lowerJaw;
        if (item.treatedArea === 'both') return pdfLabels.bothJaws;
        return item.treatedArea || '';
      });
      return [...new Set(areas)].join(', ');
    }
    if (items[0].quoteUnit === 'kvadráns') {
      const areas = items.map((item) => {
        if (item.treatedArea === 'q1') return pdfLabels.q1;
        if (item.treatedArea === 'q2') return pdfLabels.q2;
        if (item.treatedArea === 'q3') return pdfLabels.q3;
        if (item.treatedArea === 'q4') return pdfLabels.q4;
        return item.treatedArea || '';
      });
      return [...new Set(areas)].join(', ');
    }
    // Tooth-based: use the merged treatedAreaText (sorted tooth numbers)
    return merged.treatedAreaText;
  };

  // Helper: render one merged item row, returns the line total (after discount)
  const renderMergedRow = (merged: MergedQuoteItem, rowIndex: number, session?: number): number => {
    checkNewPage(14);

    let mergedTotal = 0;
    let mergedDiscount = 0;
    for (const item of merged.items) {
      mergedTotal += calculateLineTotal(item);
      mergedDiscount += calculateLineDiscountAmount(item);
    }

    if (rowIndex % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, yPos - 4, contentWidth, 12, 'F');
    }

    let xPos = margin + 2;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${rowIndex + 1}.`, xPos, yPos);
    xPos += colWidths.num;

    if (!isVisual && session !== undefined) {
      doc.text(`${session}.`, xPos, yPos);
      xPos += colWidths.session;
    }

    let itemName = toPdfText(merged.quoteName);
    if (doc.getTextWidth(itemName) > colWidths.name - 2) {
      while (doc.getTextWidth(itemName + '...') > colWidths.name - 2) {
        itemName = itemName.slice(0, -1);
      }
      itemName += '...';
    }
    doc.text(itemName, xPos, yPos);
    const nameXPos = xPos;

    doc.text(formatCurrency(merged.quoteUnitPriceGross).trim(), pageWidth - margin - 38, yPos, { align: 'right' });
    doc.text(toPdfText(`${merged.totalQty} ${pdfLabels.unit}`), pageWidth - margin - 20, yPos, { align: 'right' });
    doc.text(formatCurrency(mergedTotal).replace('Ft', '').trim() + ' Ft', pageWidth - margin - 2, yPos, { align: 'right' });

    yPos += 4;
    doc.setFontSize(8);
    doc.setTextColor(100);

    const treatedAreaText = getMergedTreatedAreaText(merged);
    if (treatedAreaText) {
      doc.text(toPdfText(treatedAreaText), nameXPos, yPos);
    }

    if (mergedDiscount > 0) {
      const first = merged.items[0];
      const discountText = first.quoteLineDiscountType === 'percent'
        ? `${pdfLabels.discount}: ${first.quoteLineDiscountValue}% : ${formatCurrency(mergedDiscount)}`
        : `${pdfLabels.discount}: ${formatCurrency(mergedDiscount)}`;
      doc.text(toPdfText(discountText), pageWidth - margin - 2, yPos, { align: 'right' });
    }

    doc.setFontSize(9);
    doc.setTextColor(0);
    yPos += 5;

    return mergedTotal;
  };

  if (isVisual) {
    // Visual quote: per-session tables with subtotals
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText(pdfLabels.treatments), margin, yPos);
    yPos += 6;

    for (const session of allSessions) {
      const sessionMerged = mergedBySession.get(session) || [];
      if (sessionMerged.length === 0) continue;

      checkNewPage(30);

      // Session subtitle (only if multiple sessions)
      if (numberOfSessions > 1) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(toPdfText(`${session}. ${pdfLabels.sessionLabel}`), margin, yPos);
        yPos += 6;
      }

      renderTableHeader();

      let sessionTotal = 0;
      for (let i = 0; i < sessionMerged.length; i++) {
        sessionTotal += renderMergedRow(sessionMerged[i], i);
      }

      // Session subtotal line
      if (numberOfSessions > 1) {
        yPos += 2;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(
          toPdfText(`${session}. ${pdfLabels.sessionLabel} ${pdfLabels.total.toLowerCase()}:`),
          pageWidth - margin - 60,
          yPos,
          { align: 'right' }
        );
        doc.text(
          formatCurrency(sessionTotal),
          pageWidth - margin - 2,
          yPos,
          { align: 'right' }
        );
        yPos += 8;
        doc.setFont('helvetica', 'normal');
      }
    }
    // No session summary for visual quotes
  } else {
    // Itemized quote: single table with session column + summary
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText(pdfLabels.itemsTitle), margin, yPos);
    yPos += 6;

    renderTableHeader();

    let globalIndex = 0;
    for (const session of allSessions) {
      const sessionMerged = mergedBySession.get(session) || [];
      for (const merged of sessionMerged) {
        renderMergedRow(merged, globalIndex, session);
        globalIndex++;
      }
    }

    // Sessions summary table (after items table)
    if (numberOfSessions > 0) {
      yPos += 8;
      checkNewPage(30 + numberOfSessions * 5);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(toPdfText(pdfLabels.sessionSummary), margin, yPos);
      yPos += 6;

      // Summary table header
      doc.setFontSize(9);
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPos - 4, 140, 6, 'F');
      doc.text(toPdfText(pdfLabels.sessionCol), margin + 2, yPos);
      doc.text(toPdfText(pdfLabels.amountCol), margin + 120, yPos, { align: 'right' });
      yPos += 6;

      // Summary table rows
      doc.setFont('helvetica', 'normal');
      sessionNumbers.forEach((session) => {
        doc.text(toPdfText(`${session}. ${pdfLabels.sessionLabel}`), margin + 2, yPos);
        doc.text(formatCurrency(sessionTotals[session]), margin + 120, yPos, { align: 'right' });
        yPos += 6;
      });
    }
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
  doc.text(toPdfText(pdfLabels.subtotal), totalsX, yPos);
  doc.text(formatCurrency(totals.subtotal), pageWidth - margin - 2, yPos, { align: 'right' });
  yPos += 6;

  // Line discounts
  if (totals.lineDiscounts > 0) {
    doc.text(toPdfText(pdfLabels.lineDiscounts), totalsX, yPos);
    doc.setTextColor(200, 0, 0);
    doc.text(`-${formatCurrency(totals.lineDiscounts)}`, pageWidth - margin - 2, yPos, {
      align: 'right',
    });
    doc.setTextColor(0, 0, 0);
    yPos += 6;
  }

  // Global discount
  if (totals.globalDiscount > 0) {
    doc.text(toPdfText(pdfLabels.globalDiscount), totalsX, yPos);
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
  doc.text(toPdfText(pdfLabels.grandTotal), totalsX, yPos);
  doc.text(formatCurrency(totals.total), pageWidth - margin, yPos, { align: 'right' });

  // Comment to patient
  if (quote.commentToPatient) {
    yPos += 15;
    checkNewPage(30);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(toPdfText(pdfLabels.comment), margin, yPos);
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
  doc.text(toPdfText(pdfLabels.warranty), pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Warranty text
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const warrantyLines = doc.splitTextToSize(toPdfText(resolvedWarrantyText), contentWidth);

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
  doc.text(toPdfText(`${pdfLabels.location} ${city}, ${formatPdfDate(quote.createdAt)}`), margin, yPos);
  yPos += 20;

  // Signature lines
  const sigLineWidth = 60;
  const sigY = yPos;

  // Patient signature
  doc.line(margin, sigY, margin + sigLineWidth, sigY);
  doc.setFontSize(9);
  doc.text(toPdfText(formatPatientName(patient.lastName, patient.firstName, patient.title)), margin + sigLineWidth / 2, sigY + 5, { align: 'center' });
  doc.text(toPdfText(pdfLabels.patientSig), margin + sigLineWidth / 2, sigY + 9, { align: 'center' });

  // Doctor signature
  doc.line(pageWidth - margin - sigLineWidth, sigY, pageWidth - margin, sigY);
  doc.text(toPdfText(doctorName || ''), pageWidth - margin - sigLineWidth / 2, sigY + 5, { align: 'center' });
  doc.text(toPdfText(pdfLabels.doctorSig), pageWidth - margin - sigLineWidth / 2, sigY + 9, { align: 'center' });

  // Disclaimer footer
  yPos = pageHeight - 20;
  doc.setFontSize(8);
  doc.setTextColor(100);
  const disclaimerLines = doc.splitTextToSize(toPdfText(resolvedFooterText), contentWidth);
  doc.text(disclaimerLines, pageWidth / 2, yPos, { align: 'center' });

  // Page numbers — centered at the bottom of every page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.setFont('helvetica', 'normal');
    doc.text(`${i} / ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }
  doc.setTextColor(0);

  // Save PDF
  const fileName = `arajanlat_${quote.quoteNumber}_${patient.lastName}_${patient.firstName}.pdf`;
  doc.save(fileName);
}
