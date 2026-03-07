import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useSettings } from '../../context/SettingsContext';
import { useSms } from '../../hooks/useSms';

interface SmsSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId?: string;
  patientName?: string;
  phoneNumber?: string;
  isHungarianPhone?: boolean;
  context?: string;
  preselectedTemplate?: string;
  templateVariables?: Record<string, string>;
}

export function SmsSendModal({
  isOpen, onClose, patientId, patientName, phoneNumber,
  isHungarianPhone = true, context, preselectedTemplate, templateVariables,
}: SmsSendModalProps) {
  const { t } = useSettings();
  const { sendSms, sendTemplateSms, fetchTemplates, templates } = useSms();

  const [mode, setMode] = useState<'freetext' | 'template'>(preselectedTemplate ? 'template' : 'freetext');
  const [message, setMessage] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(preselectedTemplate || '');
  const [variables, setVariables] = useState<Record<string, string>>(templateVariables || {});
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      setResult(null);
      setMessage('');
      setMode(preselectedTemplate ? 'template' : 'freetext');
      setSelectedTemplateId(preselectedTemplate || '');
      setVariables(templateVariables || {});
    }
  }, [isOpen, fetchTemplates, preselectedTemplate, templateVariables]);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const getPreview = (): string => {
    if (mode === 'freetext') return message;
    if (!selectedTemplate) return '';
    let text = selectedTemplate.text;
    for (const [key, val] of Object.entries(variables)) {
      text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || `[${key}]`);
    }
    return text;
  };

  const preview = getPreview();

  const handleSend = async () => {
    if (!phoneNumber) return;
    setSending(true);
    setResult(null);
    try {
      let res;
      if (mode === 'freetext') {
        res = await sendSms({
          to: phoneNumber,
          message,
          patientId, patientName, context,
          isHungarian: isHungarianPhone,
        });
      } else {
        res = await sendTemplateSms({
          to: phoneNumber,
          templateId: selectedTemplateId,
          variables,
          patientId, patientName, context,
          isHungarian: isHungarianPhone,
        });
      }
      if (res.success) {
        setResult({ success: true, message: t.sms.sendSuccess });
        setTimeout(() => onClose(), 1500);
      } else {
        setResult({ success: false, message: res.error || t.sms.sendError });
      }
    } catch {
      setResult({ success: false, message: t.sms.sendError });
    } finally {
      setSending(false);
    }
  };

  const canSend = phoneNumber && (mode === 'freetext' ? message.trim().length > 0 : selectedTemplateId && selectedTemplate);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.sms.send} size="lg">
      <div className="space-y-4">
        {/* Recipient */}
        <div>
          <label className="block text-sm font-medium text-theme-secondary mb-1">{t.sms.recipient}</label>
          <div className="text-sm text-theme-primary">
            {patientName && <span className="font-medium">{patientName} — </span>}
            <span className="font-mono">{phoneNumber || t.sms.noPhoneNumber}</span>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 border-b border-theme-primary pb-2">
          <button
            onClick={() => setMode('freetext')}
            className={`px-3 py-1.5 text-sm rounded-t ${mode === 'freetext' ? 'bg-dental-100 dark:bg-dental-900/30 text-dental-700 dark:text-dental-300 font-medium' : 'text-theme-secondary hover:text-theme-primary'}`}
          >
            {t.sms.sendFreeText}
          </button>
          <button
            onClick={() => setMode('template')}
            className={`px-3 py-1.5 text-sm rounded-t ${mode === 'template' ? 'bg-dental-100 dark:bg-dental-900/30 text-dental-700 dark:text-dental-300 font-medium' : 'text-theme-secondary hover:text-theme-primary'}`}
          >
            {t.sms.sendTemplate}
          </button>
        </div>

        {/* Free text mode */}
        {mode === 'freetext' && (
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">{t.sms.message}</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={1600}
              className="w-full px-3 py-2 border border-theme-secondary rounded-lg text-sm bg-theme-primary text-theme-primary focus:ring-2 focus:ring-dental-500 focus:border-dental-500"
            />
            <div className="text-xs text-theme-muted text-right mt-1">{t.sms.characterCount}: {message.length}/1600</div>
          </div>
        )}

        {/* Template mode */}
        {mode === 'template' && (
          <>
            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-1">{t.sms.templateSelect}</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => {
                  setSelectedTemplateId(e.target.value);
                  const tmpl = templates.find(t => t.id === e.target.value);
                  if (tmpl) {
                    const newVars: Record<string, string> = {};
                    for (const v of tmpl.variables) {
                      newVars[v] = variables[v] || templateVariables?.[v] || '';
                    }
                    setVariables(newVars);
                  }
                }}
                className="w-full px-3 py-2 border border-theme-secondary rounded-lg text-sm bg-theme-primary text-theme-primary"
              >
                <option value="">{t.sms.templateSelect}...</option>
                {templates.map(tmpl => (
                  <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
                ))}
              </select>
            </div>

            {selectedTemplate && (
              <div className="space-y-3">
                {selectedTemplate.variables.map(v => (
                  <Input
                    key={v}
                    label={v}
                    value={variables[v] || ''}
                    onChange={(e) => setVariables(prev => ({ ...prev, [v]: e.target.value }))}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Preview */}
        {preview && (
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">{t.sms.messagePreview}</label>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-theme-primary border border-theme-secondary">
              {preview}
            </div>
            <div className="text-xs text-theme-muted text-right mt-1">{t.sms.characterCount}: {preview.length}</div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`p-3 rounded-lg text-sm ${result.success ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
            {result.message}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button onClick={handleSend} disabled={!canSend || sending}>
            {sending ? '...' : t.sms.send}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
