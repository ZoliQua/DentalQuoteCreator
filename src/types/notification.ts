export interface PendingAppointment {
  appointmentId: string;
  startDateTime: string;
  endDateTime: string;
  title: string;
  description: string | null;
  status: string;
  patient: {
    patientId: string;
    lastName: string;
    firstName: string;
    phone: string | null;
    email: string | null;
  } | null;
  appointmentType: {
    nameHu: string;
    nameEn: string;
    nameDe: string;
    color: string;
  } | null;
  smsSent: boolean;
  emailSent: boolean;
  smsLogId: string | null;
  emailLogId: string | null;
}
