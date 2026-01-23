export interface Patient {
  patientId: string;
  lastName: string;
  firstName: string;
  sex: 'male' | 'female' | 'other';
  birthDate: string;
  insuranceNum?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
}

export type PatientFormData = Omit<Patient, 'patientId' | 'createdAt' | 'updatedAt' | 'isArchived'>;
