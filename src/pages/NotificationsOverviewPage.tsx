import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { PageTabBar, type PageTab } from '../components/common/PageTabBar';
import { getAuthHeaders } from '../utils/auth';

const API = '/backend';

function useNotificationTabs() {
  const { t } = useSettings();
  const tabs: PageTab[] = [
    {
      key: 'overview', to: '/notifications', label: t.notifications.overview,
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    },
    {
      key: 'pending', to: '/notifications/pending', label: t.notifications.pending,
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      key: 'sms', to: '/notifications/sms', label: t.notifications.smsLog,
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
    },
    {
      key: 'email', to: '/notifications/email', label: t.notifications.emailLog,
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    },
  ];
  return tabs;
}

export { useNotificationTabs };

export function NotificationsOverviewPage() {
  const { t } = useSettings();
  const tabs = useNotificationTabs();
  const [smsCount, setSmsCount] = useState(0);
  const [emailCount, setEmailCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [smsRes, emailRes, pendingRes] = await Promise.all([
          fetch(`${API}/sms/history?limit=1`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${API}/email/history?limit=1`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${API}/notifications/pending`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        if (smsRes) setSmsCount(smsRes.total || 0);
        if (emailRes) setEmailCount(emailRes.total || 0);
        if (pendingRes) setPendingCount(pendingRes.appointments?.length || 0);
      } catch { /* ignore */ }
    })();
  }, []);

  const cards = [
    {
      key: 'pending',
      to: '/notifications/pending',
      title: t.notifications.pending,
      description: t.notifications.pendingDesc,
      count: pendingCount,
      icon: (
        <svg className="w-8 h-8 text-dental-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      key: 'sms',
      to: '/notifications/sms',
      title: t.notifications.smsLog,
      description: t.sms.overviewDesc,
      count: smsCount,
      icon: (
        <svg className="w-8 h-8 text-dental-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
    },
    {
      key: 'email',
      to: '/notifications/email',
      title: t.notifications.emailLog,
      description: t.email.overviewDesc,
      count: emailCount,
      icon: (
        <svg className="w-8 h-8 text-dental-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-theme-primary">{t.notifications.title}</h1>
        <p className="text-sm text-theme-tertiary mt-1">{t.notifications.overviewDesc}</p>
      </div>

      <PageTabBar tabs={tabs} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link key={card.key} to={card.to} className="block">
            <Card className="hover:shadow-md transition-shadow h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  {card.icon}
                  <div>
                    <h3 className="font-semibold text-theme-primary">{card.title}</h3>
                    <p className="text-xs text-theme-tertiary">{card.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-dental-600">{card.count}</div>
                <div className="text-xs text-theme-muted">{card.key === 'pending' ? t.notifications.tomorrowAppointments : t.email.totalSent}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
