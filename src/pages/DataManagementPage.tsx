import { useState, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useApp } from '../context/AppContext';
import { Button, Card, CardContent, CardHeader, ConfirmModal } from '../components/common';

export function DataManagementPage() {
  const { t } = useSettings();
  const { exportData, importData, refreshData } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importConfirm, setImportConfirm] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dental_quote_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setMessage({ type: 'success', text: 'Adatok sikeresen exportálva!' });
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
