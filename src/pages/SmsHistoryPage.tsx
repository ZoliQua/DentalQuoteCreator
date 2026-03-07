import { useSettings } from '../context/SettingsContext';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { SmsHistoryTable } from '../components/sms/SmsHistoryTable';
import { useNotificationTabs } from './NotificationsOverviewPage';
import { PageTabBar } from '../components/common/PageTabBar';

export function SmsHistoryPage() {
  const { t } = useSettings();
  const tabs = useNotificationTabs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-theme-primary">{t.notifications.title}</h1>
        <p className="text-sm text-theme-tertiary mt-1">{t.sms.historyTitle}</p>
      </div>

      <PageTabBar tabs={tabs} />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-theme-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            {t.notifications.smsLog}
          </h2>
        </CardHeader>
        <CardContent>
          <SmsHistoryTable />
        </CardContent>
      </Card>
    </div>
  );
}
