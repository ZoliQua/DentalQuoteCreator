export interface EmailLog {
  id: string;
  toEmail: string;
  fromEmail: string;
  subject: string;
  body: string;
  templateId?: string;
  status: string;
  patientId?: string;
  patientName?: string;
  context?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
}
