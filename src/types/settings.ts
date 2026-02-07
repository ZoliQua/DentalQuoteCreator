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

export interface PdfSettings {
  footerText: string;
  warrantyText: string;
}

export interface QuoteSettings {
  prefix: string; // 4 characters, e.g., "ABCD"
  counter: number; // Current counter value
  deletedCount: number; // Count of deleted quotes
}

export interface Settings {
  clinic: ClinicSettings;
  doctors: Doctor[];
  pdf: PdfSettings;
  quote: QuoteSettings; // New: quote numbering settings
  language: 'hu' | 'en' | 'de';
  defaultValidityDays: number;
}
