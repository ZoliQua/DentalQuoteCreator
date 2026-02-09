import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { Card, CardContent, CardHeader, Button, Badge, ConfirmModal } from '../components/common';
import { getInvoice, saveInvoice } from '../modules/invoicing/storage';
import { stornoInvoice } from '../modules/invoicing/api';
import { formatCurrency, formatDate, formatDateTime } from '../utils';
import type { InvoiceRecord } from '../types/invoice';

export function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { t } = useSettings();
  const [invoice, setInvoice] = useState<InvoiceRecord | undefined>(() =>
    invoiceId ? getInvoice(invoiceId) : undefined
  );
  const [stornoConfirmOpen, setStornoConfirmOpen] = useState(false);
  const [stornoLoading, setStornoLoading] = useState(false);
  const [stornoError, setStornoError] = useState<string | null>(null);

  if (!invoice) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">{t.invoices.notFound}</h1>
        <Link to="/invoices" className="text-dental-600 hover:text-dental-700">
          {t.invoices.backToList}
        </Link>
      </div>
    );
  }

  const openPdf = (base64?: string) => {
    if (!base64) return;
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const statusLabel = (status: InvoiceRecord['status']) => {
    if (status === 'draft') return t.invoices.statusDraft;
    if (status === 'sent') return t.invoices.statusSent;
    if (status === 'storno') return t.invoices.statusStorno;
    return status;
  };

  const statusVariant = (status: InvoiceRecord['status']) => {
    if (status === 'draft') return 'warning' as const;
    if (status === 'sent') return 'success' as const;
    if (status === 'storno') return 'danger' as const;
    return 'default' as const;
  };

  const paymentLabel = (method: string) => {
    const m = method.toLowerCase();
    if (m === 'atutalas' || m === 'átutalás') return t.invoices.paymentTransfer;
    if (m === 'keszpenz' || m === 'készpénz') return t.invoices.paymentCash;
    if (m === 'bankkartya' || m === 'bankkártya') return t.invoices.paymentCard;
    return method;
  };

  const handleStorno = async () => {
    if (!invoice.szamlazzInvoiceNumber) return;
    setStornoLoading(true);
    setStornoError(null);
    try {
      const response = await stornoInvoice(invoice.szamlazzInvoiceNumber);
      if (response.mode === 'live' && !response.success) {
        throw new Error(response.message || t.invoices.errorGeneric);
      }
      const updated: InvoiceRecord = {
        ...invoice,
        status: 'storno',
        stornoInvoiceNumber: response.invoiceNumber || undefined,
        stornoPdfBase64: response.pdfBase64 || undefined,
      };
      saveInvoice(updated);
      setInvoice(updated);
      setStornoConfirmOpen(false);
    } catch (error) {
      setStornoError(error instanceof Error ? error.message : t.invoices.errorGeneric);
    } finally {
      setStornoLoading(false);
    }
  };

  const netTotal = invoice.items.reduce((sum, item) => sum + item.net, 0);
  const vatTotal = invoice.items.reduce((sum, item) => sum + item.vat, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link to="/invoices" className="hover:text-dental-600">
              {t.invoices.title}
            </Link>
            <span>/</span>
            <span>{invoice.szamlazzInvoiceNumber || invoice.id.slice(0, 8)}</span>
          </div>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {invoice.szamlazzInvoiceNumber || t.invoices.statusDraft}
            </h1>
            <Badge variant={statusVariant(invoice.status)}>
              {statusLabel(invoice.status)}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {invoice.pdfBase64 && (
            <Button onClick={() => openPdf(invoice.pdfBase64)}>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t.invoices.pdfDownload}
            </Button>
          )}
          {invoice.status === 'sent' && invoice.szamlazzInvoiceNumber && (
            <Button variant="danger" onClick={() => setStornoConfirmOpen(true)}>
              {t.invoices.storno}
            </Button>
          )}
          {invoice.stornoPdfBase64 && (
            <Button variant="secondary" onClick={() => openPdf(invoice.stornoPdfBase64)}>
              {t.invoices.stornoNumber} PDF
            </Button>
          )}
        </div>
      </div>

      {stornoError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {stornoError}
        </div>
      )}

      {invoice.stornoInvoiceNumber && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t.invoices.stornoNumber}: <span className="font-semibold">{invoice.stornoInvoiceNumber}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice data */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">{t.invoices.items}</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {invoice.items.map((item, idx) => (
                  <div
                    key={`${item.name}-${idx}`}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-gray-500">
                        {item.qty} {item.unit} &middot; {t.invoices.itemNetPrice}:{' '}
                        {formatCurrency(item.unitPriceNet, invoice.currency)} &middot; {t.invoices.itemVat}:{' '}
                        {item.vatRate}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(item.gross, invoice.currency)}</p>
                      <p className="text-xs text-gray-500">
                        {t.invoices.netTotal}: {formatCurrency(item.net, invoice.currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="mt-4 border-t pt-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t.invoices.netTotal}</span>
                  <span>{formatCurrency(netTotal, invoice.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t.invoices.vatTotal}</span>
                  <span>{formatCurrency(vatTotal, invoice.currency)}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t pt-2">
                  <span>{t.invoices.grossTotal}</span>
                  <span>{formatCurrency(invoice.totalGross, invoice.currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h3 className="font-semibold">{t.invoices.invoiceData}</h3>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t.invoices.invoiceNumber}</span>
                <span className="font-medium">{invoice.szamlazzInvoiceNumber || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t.invoices.status}</span>
                <Badge variant={statusVariant(invoice.status)}>
                  {statusLabel(invoice.status)}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t.invoices.createdAt}</span>
                <span>{formatDateTime(invoice.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t.invoices.fulfillmentDate}</span>
                <span>{formatDate(invoice.fulfillmentDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t.invoices.dueDate}</span>
                <span>{formatDate(invoice.dueDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t.invoices.paymentMethod}</span>
                <span>{paymentLabel(invoice.paymentMethod)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t.invoices.currency}</span>
                <span>{invoice.currency}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-semibold">{t.invoices.buyer}</h3>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{invoice.buyer.name}</p>
              {invoice.buyer.zip && invoice.buyer.city && (
                <p className="text-gray-500">
                  {invoice.buyer.zip} {invoice.buyer.city}
                </p>
              )}
              {invoice.buyer.address && <p className="text-gray-500">{invoice.buyer.address}</p>}
              {invoice.buyer.email && <p className="text-gray-500">{invoice.buyer.email}</p>}
              <p className="text-gray-500 text-xs mt-2">
                {t.invoices.patientName}: {invoice.patientName}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Storno Confirmation */}
      <ConfirmModal
        isOpen={stornoConfirmOpen}
        onClose={() => setStornoConfirmOpen(false)}
        onConfirm={handleStorno}
        title={t.invoices.storno}
        message={`${t.invoices.stornoConfirm}\n\n${t.invoices.stornoConfirmDetail}`}
        confirmText={stornoLoading ? t.invoices.stornoInProgress : t.invoices.storno}
        cancelText={t.common.cancel}
        variant="danger"
      />
    </div>
  );
}
