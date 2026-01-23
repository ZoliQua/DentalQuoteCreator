import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { Settings } from '../types';
import { Button, Card, CardContent, CardHeader, Input, TextArea, Select } from '../components/common';

export function SettingsPage() {
  const { t, settings, updateSettings } = useSettings();
  const [formData, setFormData] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSave = () => {
    updateSettings(formData);
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

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.settings.title}</h1>
          <p className="text-gray-500 mt-1">Rendelő és PDF beállítások kezelése</p>
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
            helperText="Ez a szöveg jelenik meg a PDF láblécében"
          />
          <TextArea
            label={t.settings.warrantyText}
            value={formData.pdf.warrantyText}
            onChange={(e) => handlePdfChange('warrantyText', e.target.value)}
            rows={20}
            helperText="A garancia feltételek szövege (2. oldal)"
            className="font-mono text-sm"
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
            value={formData.language}
            onChange={(e) => setFormData({ ...formData, language: e.target.value as 'hu' | 'en' })}
            options={[
              { value: 'hu', label: t.settings.hungarian },
              { value: 'en', label: t.settings.english },
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
            helperText="Az árajánlatok alapértelmezett érvényességi ideje napokban"
          />
        </CardContent>
      </Card>
    </div>
  );
}
