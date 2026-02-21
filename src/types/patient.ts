export interface Patient {
  patientId: string;
  title?: string;
  lastName: string;
  firstName: string;
  sex: 'male' | 'female' | 'other';
  birthDate: string;
  birthPlace?: string;
  insuranceNum?: string;
  phone?: string;
  email?: string;
  country?: string;
  isForeignAddress?: boolean;
  zipCode?: string;
  city?: string;
  street?: string;
  patientType?: string;
  notes?: string;
  mothersName?: string;
  neakDocumentType?: number;
  patientVATName?: string;
  patientVATNumber?: string;
  patientDiscount?: number | null;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
}

export type PatientFormData = Omit<Patient, 'patientId' | 'createdAt' | 'updatedAt' | 'isArchived'>;
