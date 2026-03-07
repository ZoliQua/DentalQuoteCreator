import { useSettings } from '../context/SettingsContext';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { EmailHistoryTable } from '../components/email/EmailHistoryTable';
import { useNotificationTabs } from './NotificationsOverviewPage';
import { PageTabBar } from '../components/common/PageTabBar';

export function EmailHistoryPage() {
  const { t } = useSettings();
  const tabs = useNotificationTabs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-theme-primary">{t.notifications.title}</h1>
        <p className="text-sm text-theme-tertiary mt-1">{t.email.historyTitle}</p>
      </div>

      <PageTabBar tabs={tabs} />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-theme-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {t.notifications.emailLog}
          </h2>
        </CardHeader>
        <CardContent>
          <EmailHistoryTable />
        </CardContent>
      </Card>
    </div>
  );
}
