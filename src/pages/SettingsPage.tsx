import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useQuotes } from '../hooks';
import { Settings, Doctor, DateFormat } from '../types';
import { Button, Card, CardContent, CardHeader, Input, TextArea, Select, ConfirmModal } from '../components/common';
import { formatDateTimeWithPattern } from '../utils';

const DATE_FORMAT_OPTIONS: DateFormat[] = [
  'YYYY-MM-DD HH:MM:SS',
  'YYYY/MM/DD HH:MM:SS',
  'YYYY.MM.DD HH:MM:SS',
  'DD.MM.YYYY HH:MM:SS',
  'DD/MM/YYYY HH:MM:SS',
  'MM.DD.YYYY HH:MM:SS',
  'MM/DD/YYYY HH:MM:SS',
];

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
  const today = new Date();

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

  const handlePatientChange = (field: keyof Settings['patient'], value: string | string[]) => {
    setFormData({
      ...formData,
      patient: {
        ...formData.patient,
        [field]: value,
      },
    });
  };

  const handleInvoiceChange = (field: keyof Settings['invoice'], value: string | number) => {
    setFormData({
      ...formData,
      invoice: {
        ...formData.invoice,
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

          {/* Per Page */}
          <Select
            label={t.settings.quotesPerPageLabel}
            value={String(formData.quote.perPage || 50)}
            onChange={(e) =>
              setFormData({
                ...formData,
                quote: { ...formData.quote, perPage: Number(e.target.value) },
              })
            }
            options={[
              { value: '20', label: '20' },
              { value: '50', label: '50' },
              { value: '100', label: '100' },
            ]}
          />

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
                  <span className="text-blue-600">{t.settings.statClosed}</span>
                  <span className="font-semibold">{quoteStats.closed}</span>
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
                        const total = quoteStats.draft + quoteStats.closed +
                                     quoteStats.started + quoteStats.completed + quoteStats.rejected;
                        if (total === 0) return <circle cx="50" cy="50" r="40" fill="#e5e7eb" />;

                        let currentAngle = 0;
                        const segments = [
                          { value: quoteStats.draft, color: '#fbbf24' },
                          { value: quoteStats.closed, color: '#3b82f6' },
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

      {/* Invoice Settings */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t.settings.invoiceSettings}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            label={t.settings.invoiceType}
            value={formData.invoice.invoiceType}
            onChange={(e) => handleInvoiceChange('invoiceType', e.target.value)}
            options={[
              { value: 'paper', label: t.settings.invoiceTypePaper },
              { value: 'electronic', label: t.settings.invoiceTypeElectronic },
            ]}
          />
          <TextArea
            label={t.settings.invoiceComment}
            value={formData.invoice.defaultComment}
            onChange={(e) => handleInvoiceChange('defaultComment', e.target.value)}
            rows={3}
            helperText={t.settings.invoiceCommentHelp}
          />
          <Select
            label={t.settings.defaultVatRate}
            value={String(formData.invoice.defaultVatRate)}
            onChange={(e) => handleInvoiceChange('defaultVatRate', Number(e.target.value))}
            options={[
              { value: '0', label: '0%' },
              { value: '27', label: '27%' },
            ]}
          />
        </CardContent>
      </Card>

      {/* Patient Settings */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t.settings.patientSettings}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label={t.settings.defaultCountry}
            value={formData.patient.defaultCountry}
            onChange={(e) => handlePatientChange('defaultCountry', e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.settings.patientTypes}
            </label>
            <div className="space-y-2">
              {formData.patient.patientTypes.map((pt, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={pt}
                    onChange={(e) => {
                      const newTypes = [...formData.patient.patientTypes];
                      newTypes[index] = e.target.value;
                      setFormData({
                        ...formData,
                        patient: { ...formData.patient, patientTypes: newTypes },
                      });
                    }}
                  />
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => {
                      if (index === 0) return;
                      const newTypes = [...formData.patient.patientTypes];
                      const [item] = newTypes.splice(index, 1);
                      newTypes.unshift(item);
                      setFormData({
                        ...formData,
                        patient: { ...formData.patient, patientTypes: newTypes },
                      });
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      index === 0
                        ? 'text-amber-500 cursor-default'
                        : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'
                    }`}
                    title={index === 0 ? t.settings.defaultPatientType : t.settings.setDefaultPatientType}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill={index === 0 ? 'currentColor' : 'none'}>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                  {formData.patient.patientTypes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newTypes = formData.patient.patientTypes.filter((_, i) => i !== index);
                        setFormData({
                          ...formData,
                          patient: { ...formData.patient, patientTypes: newTypes },
                        });
                      }}
                      className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                      title={t.settings.removePatientType}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="secondary"
              className="mt-2"
              onClick={() => {
                setFormData({
                  ...formData,
                  patient: {
                    ...formData.patient,
                    patientTypes: [...formData.patient.patientTypes, ''],
                  },
                });
              }}
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t.settings.addPatientType}
            </Button>
          </div>

          {/* Per Page */}
          <Select
            label={t.settings.patientsPerPageLabel}
            value={String(formData.patient.perPage || 50)}
            onChange={(e) =>
              setFormData({
                ...formData,
                patient: { ...formData.patient, perPage: Number(e.target.value) },
              })
            }
            options={[
              { value: '20', label: '20' },
              { value: '50', label: '50' },
              { value: '100', label: '100' },
            ]}
          />
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
          <Select
            label={t.settings.dateFormat}
            value={formData.dateFormat}
            onChange={(e) =>
              setFormData({
                ...formData,
                dateFormat: e.target.value as DateFormat,
              })
            }
            options={DATE_FORMAT_OPTIONS.map((format) => ({
              value: format,
              label: `${formatDateTimeWithPattern(today, format)}`,
            }))}
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
