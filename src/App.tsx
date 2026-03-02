import { ReactNode, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout';
import { useAuth } from './context/AuthContext';
import { useSettings } from './context/SettingsContext';
import { getAuthHeaders } from './utils/auth';
import { DashboardPage } from './pages/DashboardPage';
import { PatientsPage } from './pages/PatientsPage';
import { PatientDetailPage } from './pages/PatientDetailPage';
import { QuotesPage } from './pages/QuotesPage';
import { QuoteEditorPage } from './pages/QuoteEditorPage';
import { CatalogPage } from './pages/CatalogPage';
import { PriceListsPage } from './pages/PriceListsPage';
import { PriceListCategoriesPage } from './pages/PriceListCategoriesPage';
import { SettingsPage } from './pages/SettingsPage';
import { DataManagementPage } from './pages/DataManagementPage';
import { OdontogramLabPage } from './pages/OdontogramLabPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { InvoiceDetailPage } from './pages/InvoiceDetailPage';
import { LoginPage } from './pages/LoginPage';
import { AdminPage } from './pages/AdminPage';
import { VisualQuoteEditorPage } from './pages/VisualQuoteEditorPage';
import { DatabaseBrowserPage } from './pages/DatabaseBrowserPage';
import { CatalogLayout } from './pages/CatalogLayout';
import { Card, CardContent } from './components/common';
import { FlexiImporterPage } from '@flexi-importer';
import { OdontogramHost } from './modules/odontogram/OdontogramHost';
import type { OdontogramState } from './modules/odontogram/types';

function FlexiOdontogramViewer({ initialState }: { initialState: unknown }) {
  return <OdontogramHost patientId="" mode="view" initialState={initialState as OdontogramState | null} onChange={() => {}} hidePanel />;
}

function NoPermissionPage() {
  const { t } = useSettings();
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
            <div className="text-red-400 mb-4">
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">{t.common.noPagePermission}</h3>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Guard({ permission, children }: { permission: string; children: ReactNode }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return <NoPermissionPage />;
  return <>{children}</>;
}

function App() {
  const { isAuthenticated, hasPermission } = useAuth();

  // Daily visitor beacon — logs once per calendar day minimum
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem('visitor-log-date') === today) return;
    fetch('/backend/visitor-log', {
      method: 'POST',
      headers: { ...getAuthHeaders() },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.id) sessionStorage.setItem('visitor-log-id', data.id);
      })
      .catch(() => {});
    localStorage.setItem('visitor-log-date', today);
  }, []);

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  const canOpenAdmin = hasPermission('admin.users.manage') || hasPermission('admin.permissions.manage');

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/patients/deleted" element={<PatientsPage showDeleted />} />
        <Route path="/patients/:patientId" element={<PatientDetailPage />} />
        <Route path="/patients/:patientId/quotes/new" element={<Guard permission="quotes.create"><QuoteEditorPage /></Guard>} />
        <Route path="/patients/:patientId/quotes/:quoteId" element={<Guard permission="quotes.view"><QuoteEditorPage /></Guard>} />
        <Route path="/patients/:patientId/visual-quotes/:quoteId" element={<Guard permission="quotes.view"><VisualQuoteEditorPage /></Guard>} />
        <Route path="/quotes" element={<Guard permission="quotes.view"><QuotesPage /></Guard>} />
        <Route path="/quotes/deleted" element={<Guard permission="quotes.view"><QuotesPage showDeleted /></Guard>} />
        <Route path="/catalog" element={<Guard permission="pricelist.view"><CatalogLayout /></Guard>} />
        <Route path="/catalog/items" element={<Guard permission="pricelist.view"><CatalogLayout section="items"><CatalogPage /></CatalogLayout></Guard>} />
        <Route path="/catalog/lists" element={<Guard permission="pricelist.view"><CatalogLayout section="lists"><PriceListsPage /></CatalogLayout></Guard>} />
        <Route path="/catalog/categories" element={<Guard permission="pricelist.view"><CatalogLayout section="categories"><PriceListCategoriesPage /></CatalogLayout></Guard>} />
        <Route path="/settings" element={<Guard permission="settings.view"><SettingsPage /></Guard>} />
        <Route path="/settings/general" element={<Guard permission="settings.view"><SettingsPage key="general" section="general" /></Guard>} />
        <Route path="/settings/clinic" element={<Guard permission="settings.view"><SettingsPage key="clinic" section="clinic" /></Guard>} />
        <Route path="/settings/patient" element={<Guard permission="settings.view"><SettingsPage key="patient" section="patient" /></Guard>} />
        <Route path="/settings/quotes" element={<Guard permission="settings.view"><SettingsPage key="quotes" section="quotes" /></Guard>} />
        <Route path="/settings/invoicing" element={<Guard permission="settings.view"><SettingsPage key="invoicing" section="invoicing" /></Guard>} />
        <Route path="/settings/neak" element={<Guard permission="settings.view"><SettingsPage key="neak" section="neak" /></Guard>} />
        <Route path="/invoices" element={<Guard permission="invoices.view"><InvoicesPage /></Guard>} />
        <Route path="/invoices/:invoiceId" element={<Guard permission="invoices.view.detail"><InvoiceDetailPage /></Guard>} />
        <Route path="/data" element={<Guard permission="data.view"><DataManagementPage key="overview" /></Guard>} />
        <Route path="/data/pricelist" element={<Guard permission="data.view"><DataManagementPage key="pricelist" section="pricelist" /></Guard>} />
        <Route path="/data/patients" element={<Guard permission="data.view"><DataManagementPage key="patients" section="patients" /></Guard>} />
        <Route path="/data/database" element={<Guard permission="data.view"><DataManagementPage key="database" section="database" /></Guard>} />
        <Route path="/data/storage" element={<Guard permission="data.view"><DataManagementPage key="storage" section="storage" /></Guard>} />
        <Route path="/data/usage" element={<Guard permission="data.view"><DataManagementPage key="usage" section="usage" /></Guard>} />
        <Route path="/data/browser" element={<Guard permission="data.browse"><DatabaseBrowserPage /></Guard>} />
        <Route path="/odontogram-lab" element={<Guard permission="lab.view"><OdontogramLabPage /></Guard>} />
        <Route path="/flexi-import" element={<Guard permission="lab.view"><FlexiImporterPage OdontogramViewer={FlexiOdontogramViewer} /></Guard>} />
        <Route
          path="/admin"
          element={canOpenAdmin ? <AdminPage /> : <NoPermissionPage />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
