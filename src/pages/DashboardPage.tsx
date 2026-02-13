import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Card, CardContent } from '../components/common';
import { formatCurrency, formatDate } from '../utils';
import { usePatients } from '../hooks';
import { PatientFormModal } from './PatientsPage';
import { PatientFormData } from '../types';
import { checkJogviszony, saveCheck } from '../modules/neak';

export function DashboardPage() {
  const { t } = useSettings();
  const { hasPermission } = useAuth();
  const { patients, quotes } = useApp();
  const { createPatient } = usePatients();
  const navigate = useNavigate();
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);

  const activePatients = patients.filter((p) => !p.isArchived);
  const activeQuotes = quotes.filter((q) => !q.isDeleted);
  const draftQuotes = activeQuotes.filter((q) => q.quoteStatus === 'draft');
  const recentQuotes = [...activeQuotes]
    .sort((a, b) => new Date(b.lastStatusChangeAt).getTime() - new Date(a.lastStatusChangeAt).getTime())
    .slice(0, 5);
  const recentPatients = [...patients]
    .filter((p) => !p.isArchived)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  // Calculate total value of draft quotes
  const draftTotal = draftQuotes.reduce((sum, quote) => {
    const quoteTotal = quote.items.reduce((itemSum, item) => {
      return itemSum + item.quoteQty * item.quoteUnitPriceGross;
    }, 0);
    return sum + quoteTotal;
  }, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.nav.dashboard}</h1>
        <p className="text-gray-500 mt-1">{t.dashboard.subtitle}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-dental-100 rounded-lg">
                <svg
                  className="w-6 h-6 text-dental-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t.patients.title}</p>
                <p className="text-2xl font-bold text-gray-900">{activePatients.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <svg
                  className="w-6 h-6 text-yellow-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t.quotes.statusDraft}</p>
                <p className="text-2xl font-bold text-gray-900">{draftQuotes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t.dashboard.draftValue}</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(draftTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.dashboard.quickActions}</h2>
            <div className="space-y-3">
              {hasPermission('patients.create') && (
                <button
                  type="button"
                  onClick={() => setIsNewPatientOpen(true)}
                  className="flex w-full items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-dental-50 transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-dental-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                    />
                  </svg>
                  <span className="text-gray-700">{t.patients.newPatient}</span>
                </button>
              )}
              {hasPermission('catalog.view') && (
                <Link
                  to="/catalog"
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-dental-50 transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-dental-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  <span className="text-gray-700">{t.catalog.title}</span>
                </Link>
              )}
              <Link
                to="/data"
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-dental-50 transition-colors"
              >
                <svg
                  className="w-5 h-5 text-dental-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                <span className="text-gray-700">{t.dataManagement.exportButton}</span>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Recent Patients */}
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{t.dashboard.recentPatients}</h2>
              <Link to="/patients" className="text-sm text-dental-600 hover:text-dental-700">
                {t.dashboard.viewAll}
              </Link>
            </div>
            {recentPatients.length > 0 ? (
              <div className="space-y-3">
                {recentPatients.map((patient) => (
                  <Link
                    key={patient.patientId}
                    to={`/patients/${patient.patientId}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-dental-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {patient.lastName} {patient.firstName}
                      </p>
                      <p className="text-sm text-gray-500">{formatDate(patient.birthDate)}</p>
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">{t.patients.noPatients}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Quotes */}
      {recentQuotes.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.dashboard.recentQuotes}</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-3 font-medium">{t.quotes.quoteId}</th>
                    <th className="pb-3 font-medium">{t.quotes.patient}</th>
                    <th className="pb-3 font-medium">{t.quotes.status}</th>
                    <th className="pb-3 font-medium">{t.quotes.createdAt}</th>
                    <th className="pb-3 font-medium text-right">{t.quotes.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentQuotes.map((quote) => {
                    const patient = patients.find((p) => p.patientId === quote.patientId);
                    const total = quote.items.reduce(
                      (sum, item) => sum + item.quoteQty * item.quoteUnitPriceGross,
                      0
                    );
                    return (
                      <tr key={quote.quoteId} className="border-b last:border-0">
                        <td className="py-3">
                          <Link
                            to={`/patients/${quote.patientId}/quotes/${quote.quoteId}`}
                            className="text-dental-600 hover:text-dental-700 font-medium"
                          >
                            AJ-{quote.quoteId.slice(-8).toUpperCase()}
                          </Link>
                        </td>
                        <td className="py-3">
                          {patient
                            ? `${patient.lastName} ${patient.firstName}`
                            : t.dashboard.unknownPatient}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              quote.quoteStatus === 'draft'
                                ? 'bg-yellow-100 text-yellow-800'
                                : quote.quoteStatus === 'completed'
                                ? 'bg-gray-100 text-gray-600'
                                : quote.quoteStatus === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {quote.quoteStatus === 'draft' ? t.quotes.statusDraft :
                             quote.quoteStatus === 'closed' ? t.quotes.statusClosed :
                             quote.quoteStatus === 'rejected' ? t.quotes.statusRejected :
                             quote.quoteStatus === 'started' ? t.quotes.statusStarted :
                             t.quotes.statusCompleted}
                          </span>
                        </td>
                        <td className="py-3 text-gray-500">{formatDate(quote.createdAt)}</td>
                        <td className="py-3 text-right font-medium">{formatCurrency(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <PatientFormModal
        isOpen={isNewPatientOpen}
        onClose={() => setIsNewPatientOpen(false)}
        onSubmit={(data: PatientFormData) => {
          const newPatient = createPatient(data);
          setIsNewPatientOpen(false);
          // Fire-and-forget NEAK auto-check
          const tajDigits = data.insuranceNum?.replace(/-/g, '') || '';
          if (data.patientType?.toLowerCase().includes('neak') && tajDigits.length === 9 && newPatient) {
            const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            checkJogviszony(tajDigits, date).then(result => {
              saveCheck({ id: nanoid(), patientId: newPatient.patientId, taj: tajDigits, checkedAt: new Date().toISOString(), date, result });
            }).catch(() => {});
          }
          if (newPatient) {
            navigate(`/patients/${newPatient.patientId}`);
          }
        }}
        title={t.patients.newPatient}
      />
    </div>
  );
}
