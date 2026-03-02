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
  patientVATAddress?: string;
  patientDiscount?: number | null;
  isHungarianPhone?: boolean;
  treatmentArchive?: string;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
}

export type PatientFormData = Omit<Patient, 'patientId' | 'createdAt' | 'updatedAt' | 'isArchived'>;

export interface Country {
  countryId: number;
  countryNameHu: string;
  countryNameEn: string;
  countryNameDe: string;
}
