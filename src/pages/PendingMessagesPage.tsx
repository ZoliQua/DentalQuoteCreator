import { useEffect, useState, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { useSms } from '../hooks/useSms';
import { useEmail } from '../hooks/useEmail';
import { SmsSendModal } from '../components/sms/SmsSendModal';
import { EmailSendModal } from '../components/email/EmailSendModal';
import { BulkSmsSendModal } from '../components/sms/BulkSmsSendModal';
import { BulkEmailSendModal } from '../components/email/BulkEmailSendModal';
import { useNotificationTabs } from './NotificationsOverviewPage';
import { PageTabBar } from '../components/common/PageTabBar';
import type { PendingAppointment } from '../types/notification';
import { getAuthHeaders } from '../utils/auth';

const API = '/backend';

interface DayData {
  date: string;
  appointments: PendingAppointment[];
  loading: boolean;
}

export function PendingMessagesPage() {
  const { t, settings } = useSettings();
  const { hasPermission } = useAuth();
  const tabs = useNotificationTabs();
  const { checkEnabled: checkSmsEnabled } = useSms();
  const { checkEnabled: checkEmailEnabled } = useEmail();

  const [days, setDays] = useState<DayData[]>([]);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [smsModal, setSmsModal] = useState<{ apt: PendingAppointment; date: string } | null>(null);
  const [emailModal, setEmailModal] = useState<{ apt: PendingAppointment; date: string } | null>(null);
  const [bulkSmsDate, setBulkSmsDate] = useState<string | null>(null);
  const [bulkEmailDate, setBulkEmailDate] = useState<string | null>(null);

  const getDates = useCallback(() => {
    const dates: string[] = [];
    for (let i = 1; i <= 8; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }, []);

  const fetchDay = useCallback(async (date: string): Promise<PendingAppointment[]> => {
    try {
      const res = await fetch(`${API}/notifications/pending?date=${date}`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return data.appointments || [];
    } catch {
      return [];
    }
  }, []);

  const loadAll = useCallback(async () => {
    const dates = getDates();
    setDays(dates.map(date => ({ date, appointments: [], loading: true })));

    const results = await Promise.all(dates.map(async (date) => {
      const appointments = await fetchDay(date);
      return { date, appointments, loading: false };
    }));
    setDays(results);
  }, [getDates, fetchDay]);

  useEffect(() => {
    loadAll();
    checkSmsEnabled().then(setSmsEnabled);
    checkEmailEnabled().then(setEmailEnabled);
  }, [loadAll, checkSmsEnabled, checkEmailEnabled]);

  const refreshDay = async (date: string) => {
    setDays(prev => prev.map(d => d.date === date ? { ...d, loading: true } : d));
    const appointments = await fetchDay(date);
    setDays(prev => prev.map(d => d.date === date ? { ...d, appointments, loading: false } : d));
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateHu = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default'; label: string }> = {
      scheduled: { variant: 'info', label: t.notifications.statusScheduled },
      confirmed: { variant: 'success', label: t.notifications.statusConfirmed },
      completed: { variant: 'default', label: t.notifications.statusCompleted },
      cancelled: { variant: 'danger', label: t.notifications.statusCancelled },
      noShow: { variant: 'warning', label: t.notifications.statusNoShow },
    };
    const entry = map[status] || { variant: 'default' as const, label: status };
    return <Badge variant={entry.variant}>{entry.label}</Badge>;
  };

  const canSendSms = hasPermission('sms.send') && smsEnabled;
  const canSendEmail = hasPermission('email.send') && emailEnabled;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-theme-primary">{t.notifications.title}</h1>
        <p className="text-sm text-theme-tertiary mt-1">{t.notifications.pendingDesc}</p>
      </div>

      <PageTabBar tabs={tabs} />

      {days.map((day) => (
        <Card key={day.date}>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 text-theme-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDateHu(day.date)}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-theme-muted">
                  {day.loading ? '...' : `${day.appointments.length} ${t.notifications.tomorrowAppointments}`}
                </span>
                {!day.loading && day.appointments.length > 0 && (
                  <>
                    {canSendSms && (
                      <Button size="sm" variant="secondary" onClick={() => setBulkSmsDate(day.date)} title="SMS">
                        <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        SMS
                      </Button>
                    )}
                    {canSendEmail && (
                      <Button size="sm" variant="secondary" onClick={() => setBulkEmailDate(day.date)} title="E-mail">
                        <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        E-mail
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {day.loading ? (
              <div className="text-center py-6 text-theme-muted">...</div>
            ) : day.appointments.length === 0 ? (
              <div className="text-center py-6 text-theme-muted text-sm">
                {t.notifications.noAppointments}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-theme-primary">
                  <thead className="bg-theme-tertiary">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-theme-tertiary uppercase">{t.notifications.appointmentTime}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-theme-tertiary uppercase">{t.notifications.patientName}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-theme-tertiary uppercase">{t.notifications.description}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-theme-tertiary uppercase">{t.notifications.confirmationStatus}</th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-theme-tertiary uppercase">SMS</th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-theme-tertiary uppercase">E-mail</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-theme-tertiary uppercase">{t.notifications.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-primary">
                    {day.appointments.map((apt) => (
                      <tr key={apt.appointmentId} className="hover:bg-theme-tertiary">
                        <td className="px-4 py-2.5 text-sm font-medium text-theme-primary whitespace-nowrap">
                          {formatTime(apt.startDateTime)}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-theme-primary">
                          {apt.patient ? `${apt.patient.lastName} ${apt.patient.firstName}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-theme-secondary max-w-xs truncate" title={apt.description || apt.title}>
                          {apt.description || apt.title}
                        </td>
                        <td className="px-4 py-2.5 text-sm">
                          {statusBadge(apt.status)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {apt.smsSent ? (
                            <svg className="w-5 h-5 text-green-500 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className="text-theme-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {apt.emailSent ? (
                            <svg className="w-5 h-5 text-green-500 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className="text-theme-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-sm">
                          <div className="flex gap-1.5">
                            {canSendSms && apt.patient?.phone && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setSmsModal({ apt, date: day.date })}
                                title="SMS"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                              </Button>
                            )}
                            {canSendEmail && apt.patient?.email && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setEmailModal({ apt, date: day.date })}
                                title="E-mail"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                              </Button>
                            )}
                            {!apt.patient?.phone && !apt.patient?.email && (
                              <span className="text-xs text-theme-muted">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* SMS Modal */}
      {smsModal && smsModal.apt.patient && (
        <SmsSendModal
          isOpen={!!smsModal}
          onClose={() => { const date = smsModal.date; setSmsModal(null); refreshDay(date); }}
          patientId={smsModal.apt.patient.patientId}
          patientName={`${smsModal.apt.patient.lastName} ${smsModal.apt.patient.firstName}`}
          phoneNumber={smsModal.apt.patient.phone || ''}
          context="appointment_reminder"
          preselectedTemplate="appointment_reminder"
          templateVariables={{
            patientName: `${smsModal.apt.patient.lastName} ${smsModal.apt.patient.firstName}`,
            appointmentDate: smsModal.date,
            appointmentTime: formatTime(smsModal.apt.startDateTime),
            clinicName: settings.clinic?.name || '',
          }}
        />
      )}

      {/* Email Modal */}
      {emailModal && emailModal.apt.patient && (
        <EmailSendModal
          isOpen={!!emailModal}
          onClose={() => { const date = emailModal.date; setEmailModal(null); refreshDay(date); }}
          patientId={emailModal.apt.patient.patientId}
          patientName={`${emailModal.apt.patient.lastName} ${emailModal.apt.patient.firstName}`}
          emailAddress={emailModal.apt.patient.email || ''}
          context="appointment_reminder"
          preselectedTemplate="appointment_reminder"
          templateVariables={{
            patientName: `${emailModal.apt.patient.lastName} ${emailModal.apt.patient.firstName}`,
            appointmentDate: emailModal.date,
            appointmentTime: formatTime(emailModal.apt.startDateTime),
            clinicName: settings.clinic?.name || '',
          }}
        />
      )}

      {/* Bulk SMS Modal */}
      {bulkSmsDate && (
        <BulkSmsSendModal
          isOpen={!!bulkSmsDate}
          onClose={() => { const date = bulkSmsDate; setBulkSmsDate(null); refreshDay(date); }}
          appointments={days.find(d => d.date === bulkSmsDate)?.appointments || []}
          date={bulkSmsDate}
          clinicName={settings.clinic?.name || ''}
        />
      )}

      {/* Bulk Email Modal */}
      {bulkEmailDate && (
        <BulkEmailSendModal
          isOpen={!!bulkEmailDate}
          onClose={() => { const date = bulkEmailDate; setBulkEmailDate(null); refreshDay(date); }}
          appointments={days.find(d => d.date === bulkEmailDate)?.appointments || []}
          date={bulkEmailDate}
          clinicName={settings.clinic?.name || ''}
        />
      )}
    </div>
  );
}
