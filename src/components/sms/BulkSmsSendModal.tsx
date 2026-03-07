import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useSettings } from '../../context/SettingsContext';
import { useSms } from '../../hooks/useSms';
import type { PendingAppointment } from '../../types/notification';

interface BulkSmsSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: PendingAppointment[];
  date: string;
  clinicName: string;
}

export function BulkSmsSendModal({ isOpen, onClose, appointments, date, clinicName }: BulkSmsSendModalProps) {
  const { t } = useSettings();
  const { sendTemplateSms, fetchTemplates, templates } = useSms();

  const [selectedTemplateId, setSelectedTemplateId] = useState('appointment_reminder');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  // Only patients with phone numbers
  const recipients = appointments.filter(a => a.patient?.phone);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      setResult(null);
      setSelectedTemplateId('appointment_reminder');
    }
  }, [isOpen, fetchTemplates]);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const getPreview = (): string => {
    if (!selectedTemplate) return '';
    return selectedTemplate.text;
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  };

  const handleSend = async () => {
    if (!selectedTemplateId || recipients.length === 0) return;
    setSending(true);
    setResult(null);
    let success = 0;
    let failed = 0;

    for (const apt of recipients) {
      if (!apt.patient?.phone) continue;
      try {
        const res = await sendTemplateSms({
          to: apt.patient.phone,
          templateId: selectedTemplateId,
          variables: {
            patientName: `${apt.patient.lastName} ${apt.patient.firstName}`,
            appointmentDate: date,
            appointmentTime: formatTime(apt.startDateTime),
            clinicName,
          },
          patientId: apt.patient.patientId,
          patientName: `${apt.patient.lastName} ${apt.patient.firstName}`,
          context: 'appointment_reminder',
          isHungarian: true,
        });
        if (res.success) success++;
        else failed++;
      } catch {
        failed++;
      }
    }

    setResult({ success, failed });
    setSending(false);
    if (failed === 0) {
      setTimeout(() => onClose(), 2000);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`SMS — ${recipients.length} ${t.sms.recipient}`} size="lg">
      <div className="space-y-4">
        {/* Recipient list */}
        <div>
          <label className="block text-sm font-medium text-theme-secondary mb-1">{t.sms.recipient} ({recipients.length})</label>
          <div className="max-h-32 overflow-y-auto border border-theme-primary rounded-lg p-2 space-y-1">
            {recipients.map(apt => (
              <div key={apt.appointmentId} className="flex items-center justify-between text-sm">
                <span className="text-theme-primary">{apt.patient!.lastName} {apt.patient!.firstName}</span>
                <span className="text-theme-muted font-mono text-xs">{apt.patient!.phone}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Template selector */}
        <div>
          <label className="block text-sm font-medium text-theme-secondary mb-1">{t.sms.templateSelect}</label>
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full px-3 py-2 border border-theme-secondary rounded-lg text-sm bg-theme-primary text-theme-primary"
          >
            <option value="">{t.sms.templateSelect}...</option>
            {templates.map(tmpl => (
              <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
            ))}
          </select>
        </div>

        {/* Preview */}
        {selectedTemplate && (
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">{t.sms.messagePreview}</label>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-theme-primary border border-theme-secondary whitespace-pre-wrap">
              {getPreview()}
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`p-3 rounded-lg text-sm ${result.failed === 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'}`}>
            {result.success > 0 && <span>{result.success} {t.sms.sendSuccess} </span>}
            {result.failed > 0 && <span>{result.failed} {t.sms.sendError}</span>}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button onClick={handleSend} disabled={!selectedTemplateId || recipients.length === 0 || sending}>
            {sending ? '...' : `${t.sms.send} (${recipients.length})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
