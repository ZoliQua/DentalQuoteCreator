import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useQuotes } from '../hooks';
import { Settings, Doctor } from '../types';
import { Button, Card, CardContent, CardHeader, Input, TextArea, Select, ConfirmModal } from '../components/common';

export function SettingsPage() {
  const {
    t,
    settings,
    updateSettings,
    appLanguage,
    setAppLanguage,
    odontogramNumbering,
    setOdontogramNumbering,
  } = useSettings();
  const { getQuoteStatistics } = useQuotes();
  const [formData, setFormData] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);
  const [resetCounterConfirm, setResetCounterConfirm] = useState(false);

  const quoteStats = getQuoteStatistics();

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSave = () => {
    updateSettings({ ...formData, language: appLanguage });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleClinicChange = (field: keyof Settings['clinic'], value: string) => {
    setFormData({
      ...formData,
      clinic: {
        ...formData.clinic,
        [field]: value,
      },
    });
  };

  const handlePdfChange = (field: keyof Settings['pdf'], value: string) => {
    setFormData({
      ...formData,
      pdf: {
        ...formData.pdf,
        [field]: value,
      },
    });
  };

  const handleDoctorChange = (doctorId: string, field: 'name' | 'stampNumber', value: string) => {
    setFormData({
      ...formData,
      doctors: formData.doctors.map((doc) =>
        doc.id === doctorId ? { ...doc, [field]: value } : doc
      ),
    });
  };

  const handleAddDoctor = () => {
    const newDoctor: Doctor = {
      id: `doc-${Date.now()}`,
      name: '',
      stampNumber: '',
    };
    setFormData({
      ...formData,
      doctors: [...formData.doctors, newDoctor],
    });
  };

  const handleRemoveDoctor = (doctorId: string) => {
    if (formData.doctors.length <= 1) return;
    setFormData({
      ...formData,
      doctors: formData.doctors.filter((doc) => doc.id !== doctorId),
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.settings.title}</h1>
          <p className="text-gray-500 mt-1">{t.settings.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-green-600 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {t.settings.saved}
            </span>
          )}
          <Button onClick={handleSave}>{t.common.save}</Button>
        </div>
      </div>

      {/* Clinic Settings */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t.settings.clinicSettings}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label={t.settings.clinicName}
            value={formData.clinic.name}
            onChange={(e) => handleClinicChange('name', e.target.value)}
          />
          <Input
            label={t.settings.clinicAddress}
            value={formData.clinic.address}
            onChange={(e) => handleClinicChange('address', e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t.settings.clinicPhone}
              value={formData.clinic.phone}
              onChange={(e) => handleClinicChange('phone', e.target.value)}
            />
            <Input
              label={t.settings.clinicEmail}
              type="email"
              value={formData.clinic.email}
              onChange={(e) => handleClinicChange('email', e.target.value)}
            />
          </div>
          <Input
            label={t.settings.clinicWebsite}
            value={formData.clinic.website}
            onChange={(e) => handleClinicChange('website', e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Doctors Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t.settings.doctorsSettings}</h2>
            <Button variant="secondary" onClick={handleAddDoctor}>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t.settings.addDoctor}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.doctors.map((doctor, index) => (
            <div key={doctor.id} className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  label={`${t.settings.doctorName} ${index + 1}`}
                  value={doctor.name}
                  onChange={(e) => handleDoctorChange(doctor.id, 'name', e.target.value)}
                  placeholder={t.settings.doctorNamePlaceholder}
                />
              </div>
              <div className="w-32">
                <Input
                  label={t.settings.doctorStampNumber}
                  value={doctor.stampNumber || ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    handleDoctorChange(doctor.id, 'stampNumber', value);
                  }}
                  placeholder="123456"
                  maxLength={6}
                />
              </div>
              {formData.doctors.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveDoctor(doctor.id)}
                  className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg mb-1"
                  title={t.settings.removeDoctor}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* PDF Settings */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t.settings.pdfSettings}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <TextArea
            label={t.settings.footerText}
            value={formData.pdf.footerText}
            onChange={(e) => handlePdfChange('footerText', e.target.value)}
            rows={3}
            helperText={t.settings.footerTextHelp}
          />
          <TextArea
            label={t.settings.warrantyText}
            value={formData.pdf.warrantyText}
            onChange={(e) => handlePdfChange('warrantyText', e.target.value)}
            rows={20}
            helperText={t.settings.warrantyTextHelp}
            className="font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* Quote Settings */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t.settings.quoteSettings}</h2>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Prefix and Counter */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label={t.settings.quotePrefix}
                value={formData.quote.prefix}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
                  setFormData({
                    ...formData,
                    quote: { ...formData.quote, prefix: value },
                  });
                }}
                maxLength={4}
                placeholder="ABCD"
                helperText={t.settings.quotePrefixHelp}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.settings.quoteCounter}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900">{formData.quote.counter}</span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setResetCounterConfirm(true)}
                >
                  {t.settings.resetCounter}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">{t.settings.quoteCounterHelp}</p>
            </div>
          </div>

          {/* Statistics */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">{t.settings.quoteStatistics}</h3>
            <div className="grid grid-cols-2 gap-6">
              {/* Stats List */}
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-gray-600">{t.settings.statTotal}</span>
                  <span className="font-semibold">{quoteStats.total}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-yellow-600">{t.quotes.statusDraft}</span>
                  <span className="font-semibold">{quoteStats.draft}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-blue-600">{t.settings.statClosedPending}</span>
                  <span className="font-semibold">{quoteStats.closedPending}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-indigo-600">{t.settings.statAccepted}</span>
                  <span className="font-semibold">{quoteStats.acceptedInProgress}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-green-600">{t.settings.statStarted}</span>
                  <span className="font-semibold">{quoteStats.started}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-gray-600">{t.settings.statCompleted}</span>
                  <span className="font-semibold">{quoteStats.completed}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-red-600">{t.settings.statRejected}</span>
                  <span className="font-semibold">{quoteStats.rejected}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-400">{t.settings.statDeleted}</span>
                  <span className="font-semibold text-gray-400">{quoteStats.deleted}</span>
                </div>
              </div>

              {/* Pie Chart */}
              <div className="flex items-center justify-center">
                <div className="relative w-40 h-40">
                  {quoteStats.total > 0 ? (
                    <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                      {(() => {
                        const total = quoteStats.draft + quoteStats.closedPending + quoteStats.acceptedInProgress +
                                     quoteStats.started + quoteStats.completed + quoteStats.rejected;
                        if (total === 0) return <circle cx="50" cy="50" r="40" fill="#e5e7eb" />;

                        let currentAngle = 0;
                        const segments = [
                          { value: quoteStats.draft, color: '#fbbf24' },
                          { value: quoteStats.closedPending, color: '#3b82f6' },
                          { value: quoteStats.acceptedInProgress, color: '#6366f1' },
                          { value: quoteStats.started, color: '#22c55e' },
                          { value: quoteStats.completed, color: '#9ca3af' },
                          { value: quoteStats.rejected, color: '#ef4444' },
                        ].filter(s => s.value > 0);

                        return segments.map((segment, idx) => {
                          const percentage = (segment.value / total) * 100;
                          const strokeDasharray = `${percentage * 2.51327} ${251.327 - percentage * 2.51327}`;
                          const strokeDashoffset = -currentAngle * 2.51327;
                          currentAngle += percentage;

                          return (
                            <circle
                              key={idx}
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke={segment.color}
                              strokeWidth="20"
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                            />
                          );
                        });
                      })()}
                    </svg>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      {t.settings.noQuotesYet}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t.settings.generalSettings}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            label={t.settings.language}
            value={appLanguage}
            onChange={(e) => setAppLanguage(e.target.value as 'hu' | 'en' | 'de')}
            options={[
              { value: 'hu', label: t.settings.hungarian },
              { value: 'en', label: t.settings.english },
              { value: 'de', label: t.settings.german },
            ]}
          />
          <Input
            label={t.settings.defaultValidityDays}
            type="number"
            value={formData.defaultValidityDays}
            onChange={(e) =>
              setFormData({
                ...formData,
                defaultValidityDays: parseInt(e.target.value) || 60,
              })
            }
            min={1}
            max={365}
            helperText={t.settings.defaultValidityDaysHelp}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t.settings.odontogramSettings}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            label={t.settings.odontogramNumbering}
            value={odontogramNumbering}
            onChange={(e) =>
              setOdontogramNumbering(e.target.value as 'FDI' | 'UNIVERSAL' | 'PALMER')
            }
            options={[
              { value: 'FDI', label: t.settings.odontogramNumberingFdi },
              { value: 'UNIVERSAL', label: t.settings.odontogramNumberingUniversal },
              { value: 'PALMER', label: t.settings.odontogramNumberingPalmer },
            ]}
          />
        </CardContent>
      </Card>

      {/* Reset Counter Confirmation */}
      <ConfirmModal
        isOpen={resetCounterConfirm}
        onClose={() => setResetCounterConfirm(false)}
        onConfirm={() => {
          setFormData({
            ...formData,
            quote: { ...formData.quote, counter: 0 },
          });
          setResetCounterConfirm(false);
        }}
        title={t.common.confirm}
        message={t.settings.resetCounterConfirm}
        confirmText={t.settings.resetCounter}
        cancelText={t.common.cancel}
        variant="danger"
      />
    </div>
  );
}
