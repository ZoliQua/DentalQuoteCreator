import { useState, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useApp } from '../context/AppContext';
import { useCatalog } from '../hooks';
import { Button, Card, CardContent, CardHeader, ConfirmModal } from '../components/common';

export function DataManagementPage() {
  const { t } = useSettings();
  const { exportData, importData, refreshData } = useApp();
  const { exportCatalog, importCatalog, exportCatalogCSV, importCatalogCSV } = useCatalog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const catalogJsonInputRef = useRef<HTMLInputElement>(null);
  const catalogCsvInputRef = useRef<HTMLInputElement>(null);

  const [importConfirm, setImportConfirm] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<string | null>(null);
  const [pendingCatalogImport, setPendingCatalogImport] = useState<{ format: 'json' | 'csv'; data: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    const data = exportData();
    downloadFile(data, `dental_quote_backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json');

    setMessage({ type: 'success', text: 'Adatok sikeresen exportálva!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCatalogExportJson = () => {
    const data = exportCatalog();
    downloadFile(
      data,
      `dental_catalog_${new Date().toISOString().split('T')[0]}.json`,
      'application/json'
    );
    setMessage({ type: 'success', text: t.dataManagement.catalogOnly.exportSuccess });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCatalogExportCsv = () => {
    const data = exportCatalogCSV();
    downloadFile(
      data,
      `dental_catalog_${new Date().toISOString().split('T')[0]}.csv`,
      'text/csv;charset=utf-8;'
    );
    setMessage({ type: 'success', text: t.dataManagement.catalogOnly.exportSuccess });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setPendingImportData(content);
      setImportConfirm(true);
    };
    reader.readAsText(file);

    // Reset input
    event.target.value = '';
  };

  const handleCatalogFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
    format: 'json' | 'csv'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setPendingCatalogImport({ format, data: content });
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleImportConfirm = () => {
    if (!pendingImportData) return;

    const success = importData(pendingImportData);
    if (success) {
      refreshData();
      setMessage({ type: 'success', text: t.dataManagement.importSuccess });
    } else {
      setMessage({ type: 'error', text: t.dataManagement.importError });
    }

    setPendingImportData(null);
    setImportConfirm(false);
    setTimeout(() => setMessage(null), 5000);
  };

  const handleCatalogImportConfirm = () => {
    if (!pendingCatalogImport) return;

    const success =
      pendingCatalogImport.format === 'json'
        ? importCatalog(pendingCatalogImport.data)
        : importCatalogCSV(pendingCatalogImport.data);

    if (success) {
      setMessage({ type: 'success', text: t.dataManagement.catalogOnly.importSuccess });
    } else {
      setMessage({ type: 'error', text: t.dataManagement.catalogOnly.importError });
    }

    setPendingCatalogImport(null);
    setTimeout(() => setMessage(null), 5000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.dataManagement.title}</h1>
        <p className="text-gray-500 mt-1">Adatok mentése és visszaállítása</p>
      </div>

      {/* Warning Banner */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex gap-3">
          <svg
            className="w-6 h-6 text-yellow-600 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-sm text-yellow-800">{t.dataManagement.localStorageWarning}</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
            {message.text}
          </div>
        </div>
      )}

      {/* Catalog-only Card */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t.dataManagement.catalogOnly.title}</h2>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">{t.dataManagement.catalogOnly.description}</p>
          <input
            ref={catalogJsonInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => handleCatalogFileSelect(event, 'json')}
          />
          <input
            ref={catalogCsvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => handleCatalogFileSelect(event, 'csv')}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-800">
                {t.dataManagement.catalogOnly.exportJson}
              </p>
              <p className="text-xs text-gray-500">
                {t.dataManagement.catalogOnly.exportJsonDescription}
              </p>
              <Button size="sm" onClick={handleCatalogExportJson}>
                {t.dataManagement.catalogOnly.exportJson}
              </Button>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-800">
                {t.dataManagement.catalogOnly.exportCsv}
              </p>
              <p className="text-xs text-gray-500">
                {t.dataManagement.catalogOnly.exportCsvDescription}
              </p>
              <Button size="sm" onClick={handleCatalogExportCsv}>
                {t.dataManagement.catalogOnly.exportCsv}
              </Button>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-800">
                {t.dataManagement.catalogOnly.importJson}
              </p>
              <p className="text-xs text-gray-500">
                {t.dataManagement.catalogOnly.importJsonDescription}
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => catalogJsonInputRef.current?.click()}
              >
                {t.dataManagement.catalogOnly.importJson}
              </Button>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-800">
                {t.dataManagement.catalogOnly.importCsv}
              </p>
              <p className="text-xs text-gray-500">
                {t.dataManagement.catalogOnly.importCsvDescription}
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => catalogCsvInputRef.current?.click()}
              >
                {t.dataManagement.catalogOnly.importCsv}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Card */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t.dataManagement.export}</h2>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">{t.dataManagement.exportDescription}</p>
          <Button onClick={handleExport}>
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {t.dataManagement.exportButton}
          </Button>
        </CardContent>
      </Card>

      {/* Import Card */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t.dataManagement.import}</h2>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">{t.dataManagement.importDescription}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button variant="secondary" onClick={handleImportClick}>
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            {t.dataManagement.importButton}
          </Button>
        </CardContent>
      </Card>

      {/* Storage Info */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Tárolási információ</h2>
        </CardHeader>
        <CardContent>
          <StorageInfo />
        </CardContent>
      </Card>

      {/* Import Confirmation */}
      <ConfirmModal
        isOpen={pendingCatalogImport !== null}
        onClose={() => setPendingCatalogImport(null)}
        onConfirm={handleCatalogImportConfirm}
        title={t.common.confirm}
        message={t.dataManagement.catalogOnly.importWarning}
        confirmText={
          pendingCatalogImport?.format === 'csv'
            ? t.dataManagement.catalogOnly.importCsv
            : t.dataManagement.catalogOnly.importJson
        }
        cancelText={t.common.cancel}
        variant="danger"
      />

      {/* Global Import Confirmation */}
      <ConfirmModal
        isOpen={importConfirm}
        onClose={() => {
          setImportConfirm(false);
          setPendingImportData(null);
        }}
        onConfirm={handleImportConfirm}
        title={t.common.confirm}
        message={t.dataManagement.importWarning}
        confirmText={t.dataManagement.importButton}
        cancelText={t.common.cancel}
        variant="danger"
      />
    </div>
  );
}

function StorageInfo() {
  const { patients, quotes, catalog } = useApp();

  const storageUsed = (() => {
    try {
      let total = 0;
      for (const key in localStorage) {
        if (key.startsWith('dental_quote_')) {
          total += localStorage.getItem(key)?.length || 0;
        }
      }
      return (total / 1024).toFixed(2);
    } catch {
      return '?';
    }
  })();

  return (
    <div className="space-y-3">
      <div className="flex justify-between py-2 border-b">
        <span className="text-gray-600">Páciensek száma</span>
        <span className="font-medium">{patients.length}</span>
      </div>
      <div className="flex justify-between py-2 border-b">
        <span className="text-gray-600">Árajánlatok száma</span>
        <span className="font-medium">{quotes.length}</span>
      </div>
      <div className="flex justify-between py-2 border-b">
        <span className="text-gray-600">Katalógus tételek</span>
        <span className="font-medium">{catalog.length}</span>
      </div>
      <div className="flex justify-between py-2">
        <span className="text-gray-600">Tárhely használat</span>
        <span className="font-medium">{storageUsed} KB</span>
      </div>
    </div>
  );
}
