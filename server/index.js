import express from 'express';
import dotenv from 'dotenv';
import makeFetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';

dotenv.config({ path: 'server/.env' });

const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT || 5178);
const INVOICE_MODE = process.env.INVOICE_MODE || 'preview';
const SZAMLAZZ_ENDPOINT = 'https://www.szamlazz.hu/szamla/';
const AGENT_KEY = process.env.SZAMLAZZ_AGENT_KEY || '';

const cookieJar = new CookieJar();
const fetchWithCookies = makeFetchCookie(fetch, cookieJar);

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const toDateOnly = (value) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const normalizePaymentMethod = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'atutalas') return 'Átutalás';
  if (normalized === 'keszpenz') return 'Készpénz';
  if (normalized === 'bankkartya') return 'Bankkártya';
  return value || 'Átutalás';
};

const validateAndNormalizePayload = (input) => {
  const errors = [];
  if (!input || typeof input !== 'object') {
    return { errors: ['Hianyzo payload'] };
  }

  const seller = input.seller || {};
  const buyer = input.buyer || {};
  const invoice = input.invoice || {};
  const items = Array.isArray(input.items) ? input.items : [];

  if (!seller.name) errors.push('Elado neve kotelezo');
  if (!buyer.name) errors.push('Vevő neve kotelezo');
  if (items.length === 0) errors.push('Legalabb egy tetel kotelezo');

  const normalizedItems = items.map((item, index) => {
    const qty = Number(item.qty);
    const unitPriceNet = Number(item.unitPriceNet ?? item.unitPrice ?? 0);
    const vatRate = Number(item.vatRate ?? 27);

    if (!Number.isFinite(qty) || qty <= 0) {
      errors.push(`Tetel ${index + 1}: qty > 0 kotelezo`);
    }
    if (!Number.isFinite(unitPriceNet) || unitPriceNet < 0) {
      errors.push(`Tetel ${index + 1}: unitPriceNet >= 0 kotelezo`);
    }
    if (!Number.isFinite(vatRate) || vatRate < 0) {
      errors.push(`Tetel ${index + 1}: vatRate >= 0 kotelezo`);
    }

    const net = round(qty * unitPriceNet);
    const vat = round((net * vatRate) / 100);
    const gross = round(net + vat);

    if (round(net + vat) !== gross) {
      errors.push(`Tetel ${index + 1}: netto + afa = brutto hiba`);
    }

    return {
      name: item.name || `Tetel ${index + 1}`,
      unit: item.unit || 'db',
      qty,
      unitPriceNet,
      vatRate,
      net,
      vat,
      gross,
      comment: item.comment || '',
    };
  });

  const totals = normalizedItems.reduce(
    (acc, item) => {
      acc.net = round(acc.net + item.net);
      acc.vat = round(acc.vat + item.vat);
      acc.gross = round(acc.gross + item.gross);
      return acc;
    },
    { net: 0, vat: 0, gross: 0 }
  );

  return {
    errors,
    payload: {
      seller,
      buyer,
      invoice: {
        paymentMethod: normalizePaymentMethod(invoice.paymentMethod || 'atutalas'),
        fulfillmentDate: toDateOnly(invoice.fulfillmentDate),
        dueDate: toDateOnly(invoice.dueDate),
        issueDate: toDateOnly(invoice.issueDate),
        currency: invoice.currency || 'HUF',
        comment: invoice.comment || '',
        language: invoice.language || 'hu',
        eInvoice: Boolean(invoice.eInvoice),
      },
      items: normalizedItems,
      totals,
    },
  };
};

const buildInvoiceXml = ({ seller, buyer, invoice, items }) => {
  const tetelXml = items
    .map(
      (item) => `
      <tetel>
        <megnevezes>${escapeXml(item.name)}</megnevezes>
        <mennyiseg>${item.qty}</mennyiseg>
        <mennyisegiEgyseg>${escapeXml(item.unit)}</mennyisegiEgyseg>
        <nettoEgysegar>${item.unitPriceNet.toFixed(2)}</nettoEgysegar>
        <afakulcs>${item.vatRate}</afakulcs>
        <nettoErtek>${item.net.toFixed(2)}</nettoErtek>
        <afaErtek>${item.vat.toFixed(2)}</afaErtek>
        <bruttoErtek>${item.gross.toFixed(2)}</bruttoErtek>
        <megjegyzes>${escapeXml(item.comment)}</megjegyzes>
      </tetel>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(AGENT_KEY)}</szamlaagentkulcs>
    <eszamla>${invoice.eInvoice ? 'true' : 'false'}</eszamla>
    <szamlaLetoltes>true</szamlaLetoltes>
    <valaszVerzio>2</valaszVerzio>
    <aggregator></aggregator>
    <szamlaKulsoAzon></szamlaKulsoAzon>
  </beallitasok>
  <fejlec>
    <teljesitesDatum>${invoice.fulfillmentDate}</teljesitesDatum>
    <fizetesiHataridoDatum>${invoice.dueDate}</fizetesiHataridoDatum>
    <fizmod>${escapeXml(invoice.paymentMethod)}</fizmod>
    <penznem>${escapeXml(invoice.currency)}</penznem>
    <szamlaNyelve>${escapeXml(invoice.language || 'hu')}</szamlaNyelve>
    <megjegyzes>${escapeXml(invoice.comment)}</megjegyzes>
    <arfolyamBank></arfolyamBank>
    <arfolyam>0</arfolyam>
    <rendelesSzam></rendelesSzam>
    <dijbekeroSzamlaszam></dijbekeroSzamlaszam>
    <elolegszamla>false</elolegszamla>
    <vegszamla>false</vegszamla>
    <helyesbitoszamla>false</helyesbitoszamla>
    <helyesbitettSzamlaszam></helyesbitettSzamlaszam>
    <dijbekero>false</dijbekero>
  </fejlec>
  <elado>
    <bank>${escapeXml(seller.bank || '')}</bank>
    <bankszamlaszam>${escapeXml(seller.bankAccount || '')}</bankszamlaszam>
    <emailReplyto>${escapeXml(seller.email || '')}</emailReplyto>
    <emailTargy></emailTargy>
    <emailSzoveg></emailSzoveg>
  </elado>
  <vevo>
    <nev>${escapeXml(buyer.name)}</nev>
    <irsz>${escapeXml(buyer.zip || '')}</irsz>
    <telepules>${escapeXml(buyer.city || '')}</telepules>
    <cim>${escapeXml(buyer.address || '')}</cim>
    <email>${escapeXml(buyer.email || '')}</email>
    <sendEmail>false</sendEmail>
    <adoszam></adoszam>
    <postazasiNev></postazasiNev>
    <postazasiIrsz></postazasiIrsz>
    <postazasiTelepules></postazasiTelepules>
    <postazasiCim></postazasiCim>
    <azonosito></azonosito>
    <telefonszam></telefonszam>
    <megjegyzes></megjegyzes>
  </vevo>
  <fuvarlevel>
    <uticel></uticel>
    <futarSzolgalat></futarSzolgalat>
  </fuvarlevel>
  <tetelek>${tetelXml}
  </tetelek>
</xmlszamla>`;
};

const parseSzamlazzResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  const rawBuffer = Buffer.from(await response.arrayBuffer());

  // Check response headers first (always present regardless of response format)
  const headerInvoiceNumber = response.headers.get('szlahu_szamlaszam');
  const headerError = response.headers.get('szlahu_error');
  const headerErrorCode = response.headers.get('szlahu_error_code');

  const decodedInvoiceNumber = headerInvoiceNumber
    ? decodeURIComponent(headerInvoiceNumber.replace(/\+/g, ' '))
    : null;
  const decodedError = headerError
    ? decodeURIComponent(headerError.replace(/\+/g, ' '))
    : null;

  // If the response is a PDF binary, return it directly
  if (contentType.includes('application/pdf')) {
    return {
      success: true,
      pdfBase64: rawBuffer.toString('base64'),
      rawResponse: null,
      invoiceNumber: decodedInvoiceNumber,
      providerSuccess: true,
    };
  }

  const rawText = rawBuffer.toString('utf8');

  // Parse XML response (valaszVerzio=2 format)
  const sikeresTag = rawText.match(/<sikeres>\s*(true|false)\s*<\/sikeres>/i)?.[1]?.toLowerCase();
  const xmlSuccess = sikeresTag === 'true';

  // Extract invoice number from XML body
  const xmlInvoiceNumber = rawText.match(/<szamlaszam>([^<]+)<\/szamlaszam>/i)?.[1] || null;

  // Extract PDF from base64-encoded <pdf> tag (valaszVerzio=2)
  const pdfBase64Match = rawText.match(/<pdf>([^<]+)<\/pdf>/i);
  const pdfBase64 = pdfBase64Match?.[1] || null;

  // Extract error info - szamlazz.hu may use CDATA or plain text
  const hibauzenetMatch =
    rawText.match(/<hibauzenet><!\[CDATA\[([\s\S]*?)\]\]><\/hibauzenet>/i) ||
    rawText.match(/<hibauzenet>([^<]+)<\/hibauzenet>/i);
  const hibakodMatch =
    rawText.match(/<hibakod><!\[CDATA\[([\s\S]*?)\]\]><\/hibakod>/i) ||
    rawText.match(/<hibakod>([^<]+)<\/hibakod>/i);

  const hasSzamlazzErrorCode =
    Boolean(hibakodMatch?.[1]) && String(hibakodMatch[1]).trim() !== '0';
  const hasHeaderError =
    Boolean(headerErrorCode) && String(headerErrorCode).trim() !== '0';

  const providerSuccess =
    response.ok &&
    (sikeresTag ? xmlSuccess : !hasHeaderError) &&
    !hasSzamlazzErrorCode;

  const invoiceNumber = decodedInvoiceNumber || xmlInvoiceNumber || null;

  const message = providerSuccess
    ? undefined
    : decodedError ||
      [
        hibakodMatch?.[1] ? `Hibakod: ${hibakodMatch[1]}` : '',
        hibauzenetMatch?.[1] || 'Szamlazz.hu hiba',
      ]
        .filter(Boolean)
        .join(' - ');

  return {
    success: providerSuccess,
    invoiceNumber,
    pdfBase64,
    rawResponse: rawText,
    providerSuccess,
    message,
  };
};

app.post('/api/szamlazz/preview-invoice', (req, res) => {
  try {
    const { errors, payload } = validateAndNormalizePayload(req.body);
    if (errors.length > 0 || !payload) {
      return res.status(400).json({ success: false, message: 'Ervenytelen adatok', errors });
    }

    const xml = buildInvoiceXml(payload);
    return res.json({
      mode: 'preview',
      success: true,
      xml,
      totals: payload.totals,
    });
  } catch (error) {
    console.error('[szamlazz] preview-invoice unhandled error', error);
    return res.status(500).json({
      success: false,
      message: 'Szerver hiba a preview-invoice feldolgozas kozben.',
    });
  }
});

app.post('/api/szamlazz/create-invoice', async (req, res) => {
  try {
    const { errors, payload } = validateAndNormalizePayload(req.body);
    if (errors.length > 0 || !payload) {
      return res.status(400).json({ success: false, message: 'Ervenytelen adatok', errors });
    }

    const xml = buildInvoiceXml(payload);

    if (INVOICE_MODE !== 'live') {
      return res.json({
        mode: 'preview',
        success: true,
        xml,
        totals: payload.totals,
      });
    }

    if (!AGENT_KEY) {
      return res.status(500).json({ success: false, message: 'Hianyzik a SZAMLAZZ_AGENT_KEY' });
    }

    const form = new FormData();
    form.append(
      'action-xmlagentxmlfile',
      new Blob([xml], { type: 'application/xml' }),
      'invoice.xml'
    );

    const response = await fetchWithCookies(SZAMLAZZ_ENDPOINT, {
      method: 'POST',
      body: form,
    });

    const parsed = await parseSzamlazzResponse(response);
    return res.status(response.ok ? 200 : 502).json({
      mode: 'live',
      ...parsed,
    });
  } catch (error) {
    console.error('[szamlazz] create-invoice error', error);
    return res.status(502).json({
      mode: 'live',
      success: false,
      message: 'A szamla letrehozas szerver oldalon sikertelen.',
    });
  }
});

app.post('/api/szamlazz/storno-invoice', async (req, res) => {
  try {
    const { invoiceNumber } = req.body || {};
    if (!invoiceNumber) {
      return res.status(400).json({ success: false, message: 'Hianyzik a szamlaszam (invoiceNumber)' });
    }

    if (INVOICE_MODE !== 'live') {
      return res.json({
        mode: 'preview',
        success: true,
        message: 'Sztorno preview mod – nem kuldtuk el.',
      });
    }

    if (!AGENT_KEY) {
      return res.status(500).json({ success: false, message: 'Hianyzik a SZAMLAZZ_AGENT_KEY' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const stornoXml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlast xmlns="http://www.szamlazz.hu/xmlszamlast" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamlast https://www.szamlazz.hu/szamla/docs/xsds/agentst/xmlszamlast.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(AGENT_KEY)}</szamlaagentkulcs>
    <eszamla>false</eszamla>
    <szamlaLetoltes>true</szamlaLetoltes>
    <szamlaLetoltesPld>1</szamlaLetoltesPld>
    <szamlaKulsoAzon></szamlaKulsoAzon>
  </beallitasok>
  <fejlec>
    <szamlaszam>${escapeXml(invoiceNumber)}</szamlaszam>
    <keltDatum>${today}</keltDatum>
    <tipus>SS</tipus>
  </fejlec>
  <elado>
    <emailReplyto></emailReplyto>
    <emailTargy></emailTargy>
    <emailSzoveg></emailSzoveg>
  </elado>
  <vevo>
    <email></email>
  </vevo>
</xmlszamlast>`;

    const form = new FormData();
    form.append(
      'action-szamla_agent_st',
      new Blob([stornoXml], { type: 'application/xml' }),
      'storno.xml'
    );

    const response = await fetchWithCookies(SZAMLAZZ_ENDPOINT, {
      method: 'POST',
      body: form,
    });

    const parsed = await parseSzamlazzResponse(response);
    return res.status(response.ok ? 200 : 502).json({
      mode: 'live',
      ...parsed,
    });
  } catch (error) {
    console.error('[szamlazz] storno-invoice error', error);
    return res.status(502).json({
      mode: 'live',
      success: false,
      message: 'A sztorno szamla letrehozas szerver oldalon sikertelen.',
    });
  }
});

app.get('/api/szamlazz/health', (_req, res) => {
  res.json({ ok: true, mode: INVOICE_MODE });
});

app.use((err, _req, res, _next) => {
  console.error('[szamlazz] unhandled express error', err);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({
    success: false,
    message: 'Varatlan szerverhiba.',
  });
});

app.listen(PORT, () => {
  console.log(`[szamlazz-proxy] running on http://localhost:${PORT} (mode=${INVOICE_MODE})`);
});
