export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'noShow';

export interface Appointment {
  appointmentId: string;
  patientId: string | null;
  chairIndex: number;
  startDateTime: string;
  endDateTime: string;
  title: string;
  description?: string;
  appointmentTypeId?: string;
  status: AppointmentStatus;
  color?: string;
  notes?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  createdByUserId?: string;
  googleEventId?: string;
  recurrenceRule?: string;
  recurrenceParentId?: string;
  isRecurrenceException?: boolean;
  patient?: { patientId: string; lastName: string; firstName: string };
  appointmentType?: AppointmentType;
}

export interface AppointmentType {
  typeId: string;
  nameHu: string;
  nameEn: string;
  nameDe: string;
  color: string;
  defaultDurationMin: number;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface AppointmentChair {
  chairId: string;
  chairNr: number;
  chairNameHu: string;
  chairNameEn: string;
  chairNameDe: string;
  isActive: boolean;
  updatedAt: string;
  createdBy?: string;
}

export interface CalendarSettings {
  slotInterval: number;
  slotIntervalOptions: number[];
  chairCount: number;
  chairNames: string[];
  showWeekends: boolean;
  defaultView: 'week' | 'day' | 'month';
  defaultDuration: number;
  workingHours: WorkingHoursDay[];
}

export interface WorkingHoursDay {
  dayOfWeek: number;
  isWorkday: boolean;
  startTime: string;
  endTime: string;
  breakStartTime?: string;
  breakEndTime?: string;
}
