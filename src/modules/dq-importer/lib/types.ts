// === Patient Types ===

export interface FlexiRawFields {
  pt_name_firstname: string;
  pt_name_lastname: string;
  pt_name_title: string;
  pt_birth: string;
  pt_birthplace: string;
  pt_sex: string;
  pt_socialnumber: string;
  pt_mothername: string;
  pt_contact_email: string;
  pt_email: string;
  pt_address_zip: string;
  pt_address_city: string;
  pt_address_street: string;
  pt_address_country: string;
  pt_phone_countrycode: string;
  pt_phone_areacode: string;
  pt_phone_number: string;
  pt_description: string;
  pt_oep_id_document_type: string;
}

export interface PatientData {
  flexiId: string;
  lastName: string;
  firstName: string;
  title: string;
  birthDate: string | null;
  birthPlace: string;
  sex: 'male' | 'female' | 'other';
  insuranceNum: string;
  mothersName: string;
  email: string;
  phone: string;
  zipCode: string;
  city: string;
  street: string;
  country: string;
  neakDocumentType: number;
  patientType: string;
  notes: string;
  _rawFields: FlexiRawFields;
}

export interface DuplicateMatch {
  patientId: string;
  name: string;
  reason: 'taj' | 'name+birthDate';
}

export interface FetchedPatient extends PatientData {
  odontogram: OdontogramState | null;
  nonHealthyTeeth: string[];
  _status: 'ok' | 'error';
  _error?: string;
  _duplicates?: DuplicateMatch[];
}

// === Odontogram Types ===

export interface OdontogramGlobals {
  wisdomVisible: boolean;
  showBase: boolean;
  occlusalVisible: boolean;
  showHealthyPulp: boolean;
  edentulous: boolean;
}

export interface OdontogramToothState {
  toothSelection: string;
  pulpInflam: boolean;
  endoResection: boolean;
  mods: string[];
  endo: string;
  caries: string[];
  fillingMaterial: string;
  fillingSurfaces: string[];
  fissureSealing: boolean;
  contactMesial: boolean;
  contactDistal: boolean;
  bruxismWear: boolean;
  bruxismNeckWear: boolean;
  brokenMesial: boolean;
  brokenIncisal: boolean;
  brokenDistal: boolean;
  extractionWound: boolean;
  extractionPlan: boolean;
  parapulpalPin: boolean;
  bridgePillar: boolean;
  bridgeUnit: string;
  mobility: string;
  crownMaterial: string;
  crownReplace: boolean;
  crownNeeded: boolean;
  missingClosed: boolean;
}

export interface OdontogramState {
  version: string;
  globals: OdontogramGlobals;
  teeth: Record<string, OdontogramToothState>;
}

export interface StoredOdontogramPayload {
  version: number;
  updatedAt: string;
  state: OdontogramState;
}

// === API Types ===

export interface FetchPatientsRequest {
  ids: string[];
}

export interface FetchPatientsResponse {
  patients: FetchedPatient[];
}

export interface ImportPatientRequest {
  patient: Omit<PatientData, '_rawFields' | 'flexiId'>;
  odontogram: OdontogramState | null;
}

export interface ImportPatientResponse {
  success: boolean;
  patientId: string;
  patientName: string;
}

export interface ExportJsonData {
  exportedAt: string;
  version: string;
  patients: Array<{
    patient: Omit<PatientData, '_rawFields' | 'flexiId'>;
    odontogram: OdontogramState | null;
  }>;
}
