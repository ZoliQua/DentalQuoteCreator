import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout';
import { useAuth } from './context/AuthContext';
import { DashboardPage } from './pages/DashboardPage';
import { PatientsPage } from './pages/PatientsPage';
import { PatientDetailPage } from './pages/PatientDetailPage';
import { QuotesPage } from './pages/QuotesPage';
import { QuoteEditorPage } from './pages/QuoteEditorPage';
import { CatalogPage } from './pages/CatalogPage';
import { SettingsPage } from './pages/SettingsPage';
import { DataManagementPage } from './pages/DataManagementPage';
import { OdontogramLabPage } from './pages/OdontogramLabPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { InvoiceDetailPage } from './pages/InvoiceDetailPage';
import { LoginPage } from './pages/LoginPage';
import { AdminPage } from './pages/AdminPage';

function App() {
  const { isAuthenticated, hasPermission } = useAuth();

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
        <Route path="/patients/:patientId/quotes/new" element={<QuoteEditorPage />} />
        <Route path="/patients/:patientId/quotes/:quoteId" element={<QuoteEditorPage />} />
        <Route path="/quotes" element={<QuotesPage />} />
        <Route path="/quotes/deleted" element={<QuotesPage showDeleted />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/invoices/:invoiceId" element={<InvoiceDetailPage />} />
        <Route path="/data" element={<DataManagementPage />} />
        <Route path="/odontogram-lab" element={<OdontogramLabPage />} />
        <Route
          path="/admin"
          element={canOpenAdmin ? <AdminPage /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
