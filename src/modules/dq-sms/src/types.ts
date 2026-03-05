export interface SendSmsBody {
  to: string
  message: string
  patientId?: string
  patientName?: string
  context?: string
  isHungarian?: boolean
}

export interface SendTemplateSmsBody {
  to: string
  templateId: string
  variables: Record<string, string>
  patientId?: string
  patientName?: string
  context?: string
  isHungarian?: boolean
}

export interface SmsHistoryQuery {
  patientId?: string
  status?: string
  from?: string
  to?: string
  limit?: string
  offset?: string
}

export interface SmsTemplate {
  id: string
  name: string
  text: string
  variables: string[]
}

export interface TwilioWebhookBody {
  MessageSid: string
  MessageStatus: string
  ErrorCode?: string
  ErrorMessage?: string
  To?: string
  From?: string
}
