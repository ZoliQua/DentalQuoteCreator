export interface GoogleCalendarSettings {
  isConnected: boolean;
  isEnabled: boolean;
  syncMode: 'push' | 'pull' | 'bidirectional';
  pollIntervalMin: number;
  lastSyncAt: string | null;
  chairCalendarMap: string; // JSON string
  hasCredentials: boolean;
  clientId: string;
  clientSecret: string; // masked with •••• from backend
  clientSecretSet: boolean;
  redirectUri: string;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor: string;
  accessRole: string;
}

export interface ChairCalendarMapping {
  chairId: string;
  chairNr: number;
  calendarId: string;
  calendarName: string;
}

export interface GoogleCalendarLogEntry {
  id: string;
  direction: 'push' | 'pull';
  action: 'create' | 'update' | 'delete' | 'import';
  appointmentId: string | null;
  googleEventId: string | null;
  chairId: string | null;
  calendarId: string | null;
  status: 'success' | 'error';
  errorMessage: string | null;
  details: string | null;
  createdAt: string;
}
