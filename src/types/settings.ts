export interface ClinicSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
}

export interface Doctor {
  id: string;
  name: string;
  stampNumber: string; // New: 6-digit stamp number
}

export interface PdfLangSettings {
  footerText: string;
  warrantyText: string;
}

export interface PdfSettings {
  hu: PdfLangSettings;
  en: PdfLangSettings;
  de: PdfLangSettings;
}

export interface QuoteSettings {
  prefix: string; // 4 characters, e.g., "ABCD"
  counter: number; // Current counter value
  deletedCount: number; // Count of deleted quotes
  perPage?: number;
  quoteLang: 'hu' | 'en' | 'de';
}

export type DateFormat =
  | 'YYYY-MM-DD HH:MM:SS'
  | 'YYYY/MM/DD HH:MM:SS'
  | 'YYYY.MM.DD HH:MM:SS'
  | 'DD.MM.YYYY HH:MM:SS'
  | 'DD/MM/YYYY HH:MM:SS'
  | 'MM.DD.YYYY HH:MM:SS'
  | 'MM/DD/YYYY HH:MM:SS';

export interface InvoiceSettings {
  invoiceType: 'paper' | 'electronic';
  defaultComment: string;
  defaultVatRate: 0 | 27 | 'TAM';
  defaultPaymentMethod: 'átutalás' | 'készpénz' | 'bankkártya';
}

export interface PatientSettings {
  defaultCountry: string;
  patientTypes: string[];
  perPage?: number;
}

export interface Settings {
  clinic: ClinicSettings;
  doctors: Doctor[];
  pdf: PdfSettings;
  quote: QuoteSettings; // New: quote numbering settings
  invoice: InvoiceSettings;
  patient: PatientSettings;
  language: 'hu' | 'en' | 'de';
  defaultValidityDays: number;
  dateFormat: DateFormat;
}
