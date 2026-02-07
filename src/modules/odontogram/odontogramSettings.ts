export type OdontogramLanguage = 'hu' | 'en' | 'de';
export type OdontogramNumberingSystem = 'FDI' | 'UNIVERSAL' | 'PALMER';

const LANGUAGE_KEY = 'settings:language';
const NUMBERING_KEY = 'settings:odontogram:numbering';

const DEFAULT_LANGUAGE: OdontogramLanguage = 'hu';
const DEFAULT_NUMBERING: OdontogramNumberingSystem = 'FDI';

const isLanguage = (value: string): value is OdontogramLanguage => {
  return value === 'hu' || value === 'en' || value === 'de';
};

const normalizeNumbering = (value: string): OdontogramNumberingSystem | null => {
  if (value === 'FDI' || value === 'UNIVERSAL' || value === 'PALMER') {
    return value;
  }
  if (value === 'Universal') return 'UNIVERSAL';
  if (value === 'Palmer') return 'PALMER';
  const normalized = value.toUpperCase();
  if (normalized === 'UNIVERSAL' || normalized === 'PALMER' || normalized === 'FDI') {
    return normalized;
  }
  return null;
};

export const getOdontogramLanguage = (): OdontogramLanguage => {
  const raw = localStorage.getItem(LANGUAGE_KEY);
  if (!raw || !isLanguage(raw)) {
    return DEFAULT_LANGUAGE;
  }
  return raw;
};

export const setOdontogramLanguage = (language: OdontogramLanguage): void => {
  localStorage.setItem(LANGUAGE_KEY, language);
};

export const getOdontogramNumbering = (): OdontogramNumberingSystem => {
  const raw = localStorage.getItem(NUMBERING_KEY);
  if (!raw) {
    return DEFAULT_NUMBERING;
  }
  const normalized = normalizeNumbering(raw);
  return normalized ?? DEFAULT_NUMBERING;
};

export const setOdontogramNumbering = (numbering: OdontogramNumberingSystem): void => {
  localStorage.setItem(NUMBERING_KEY, numbering);
};
