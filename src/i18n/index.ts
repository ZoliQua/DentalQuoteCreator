import { hu, TranslationKeys } from './hu';
import { en } from './en';
import { de } from './de';

export const translations: Record<'hu' | 'en' | 'de', TranslationKeys> = {
  hu,
  en,
  de,
};

export type { TranslationKeys };
