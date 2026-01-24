import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout';
import { DashboardPage } from './pages/DashboardPage';
import { PatientsPage } from './pages/PatientsPage';
import { PatientDetailPage } from './pages/PatientDetailPage';
import { QuotesPage } from './pages/QuotesPage';
import { QuoteEditorPage } from './pages/QuoteEditorPage';
import { CatalogPage } from './pages/CatalogPage';
import { SettingsPage } from './pages/SettingsPage';
import { DataManagementPage } from './pages/DataManagementPage';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/patients/:patientId" element={<PatientDetailPage />} />
        <Route path="/patients/:patientId/quotes/new" element={<QuoteEditorPage />} />
        <Route path="/patients/:patientId/quotes/:quoteId" element={<QuoteEditorPage />} />
        <Route path="/quotes" element={<QuotesPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/data" element={<DataManagementPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
