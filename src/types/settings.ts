export interface ClinicSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
}

export interface PdfSettings {
  footerText: string;
  warrantyText: string;
}

export interface Settings {
  clinic: ClinicSettings;
  pdf: PdfSettings;
  language: 'hu' | 'en';
  defaultValidityDays: number;
}
