export interface SmsLog {
  id: string;
  twilioSid?: string;
  toNumber: string;
  fromNumber: string;
  message: string;
  templateId?: string;
  status: string;
  patientId?: string;
  patientName?: string;
  context?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface SmsTemplate {
  id: string;
  name: string;
  text: string;
  variables: string[];
}
