import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useSettings } from '../../context/SettingsContext';
import { useEmail } from '../../hooks/useEmail';

interface EmailSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId?: string;
  patientName?: string;
  emailAddress?: string;
  context?: string;
  preselectedTemplate?: string;
  templateVariables?: Record<string, string>;
}

export function EmailSendModal({
  isOpen, onClose, patientId, patientName, emailAddress,
  context, preselectedTemplate, templateVariables,
}: EmailSendModalProps) {
  const { t } = useSettings();
  const { sendEmail, sendTemplateEmail, fetchTemplates, templates } = useEmail();

  const [mode, setMode] = useState<'freetext' | 'template'>(preselectedTemplate ? 'template' : 'freetext');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(preselectedTemplate || '');
  const [variables, setVariables] = useState<Record<string, string>>(templateVariables || {});
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      setResult(null);
      setSubject('');
      setBody('');
      setMode(preselectedTemplate ? 'template' : 'freetext');
      setSelectedTemplateId(preselectedTemplate || '');
      setVariables(templateVariables || {});
    }
  }, [isOpen, fetchTemplates, preselectedTemplate, templateVariables]);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const getPreview = (): { subject: string; body: string } => {
    if (mode === 'freetext') return { subject, body };
    if (!selectedTemplate) return { subject: '', body: '' };
    let prevSubject = selectedTemplate.subject;
    let prevBody = selectedTemplate.body;
    for (const [key, val] of Object.entries(variables)) {
      prevSubject = prevSubject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || `[${key}]`);
      prevBody = prevBody.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || `[${key}]`);
    }
    return { subject: prevSubject, body: prevBody };
  };

  const preview = getPreview();

  const handleSend = async () => {
    if (!emailAddress) return;
    setSending(true);
    setResult(null);
    try {
      let res;
      if (mode === 'freetext') {
        res = await sendEmail({
          to: emailAddress, subject, body,
          patientId, patientName, context,
        });
      } else {
        res = await sendTemplateEmail({
          to: emailAddress,
          templateId: selectedTemplateId,
          variables,
          patientId, patientName, context,
        });
      }
      if (res.success) {
        setResult({ success: true, message: t.email.sendSuccess });
        setTimeout(() => onClose(), 1500);
      } else {
        setResult({ success: false, message: res.error || t.email.sendError });
      }
    } catch {
      setResult({ success: false, message: t.email.sendError });
    } finally {
      setSending(false);
    }
  };

  const canSend = emailAddress && (mode === 'freetext' ? (subject.trim().length > 0 && body.trim().length > 0) : (selectedTemplateId && selectedTemplate));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.email.send} size="lg">
      <div className="space-y-4">
        {/* Recipient */}
        <div>
          <label className="block text-sm font-medium text-theme-secondary mb-1">{t.email.recipient}</label>
          <div className="text-sm text-theme-primary">
            {patientName && <span className="font-medium">{patientName} — </span>}
            <span className="font-mono">{emailAddress || t.email.noEmail}</span>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 border-b border-theme-primary pb-2">
          <button
            onClick={() => setMode('freetext')}
            className={`px-3 py-1.5 text-sm rounded-t ${mode === 'freetext' ? 'bg-dental-100 dark:bg-dental-900/30 text-dental-700 dark:text-dental-300 font-medium' : 'text-theme-secondary hover:text-theme-primary'}`}
          >
            {t.email.sendFreeText}
          </button>
          <button
            onClick={() => setMode('template')}
            className={`px-3 py-1.5 text-sm rounded-t ${mode === 'template' ? 'bg-dental-100 dark:bg-dental-900/30 text-dental-700 dark:text-dental-300 font-medium' : 'text-theme-secondary hover:text-theme-primary'}`}
          >
            {t.email.sendTemplate}
          </button>
        </div>

        {/* Free text mode */}
        {mode === 'freetext' && (
          <div className="space-y-3">
            <Input label={t.email.subject} value={subject} onChange={(e) => setSubject(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-1">{t.email.body}</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-theme-secondary rounded-lg text-sm bg-theme-primary text-theme-primary focus:ring-2 focus:ring-dental-500 focus:border-dental-500"
              />
            </div>
          </div>
        )}

        {/* Template mode */}
        {mode === 'template' && (
          <>
            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-1">{t.email.templateSelect}</label>
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
                <option value="">{t.email.templateSelect}...</option>
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
        {(preview.subject || preview.body) && (
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">{t.email.preview}</label>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-theme-primary border border-theme-secondary space-y-2">
              {preview.subject && <div className="font-medium">{t.email.subject}: {preview.subject}</div>}
              <div className="whitespace-pre-wrap">{preview.body}</div>
            </div>
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
            {sending ? '...' : t.email.send}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
