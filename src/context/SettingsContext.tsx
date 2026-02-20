import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Settings } from '../types';
import { storage } from '../repositories';
import { translations, TranslationKeys } from '../i18n';
import {
  getOdontogramLanguage,
  getOdontogramNumbering,
  setOdontogramLanguage as persistOdontogramLanguage,
  setOdontogramNumbering as persistOdontogramNumbering,
  type OdontogramLanguage,
  type OdontogramNumberingSystem,
} from '../modules/odontogram/odontogramSettings';

interface SettingsContextType {
  settings: Settings;
  updateSettings: (settings: Settings) => void;
  refreshSettings: () => void;
  appLanguage: OdontogramLanguage;
  setAppLanguage: (language: OdontogramLanguage) => void;
  odontogramNumbering: OdontogramNumberingSystem;
  setOdontogramNumbering: (numbering: OdontogramNumberingSystem) => void;
  t: TranslationKeys;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => storage.getSettings());
  const [appLanguage, setAppLanguageState] = useState<OdontogramLanguage>(() =>
    getOdontogramLanguage()
  );
  const [odontogramNumbering, setOdontogramNumberingState] = useState<OdontogramNumberingSystem>(() =>
    getOdontogramNumbering()
  );

  const updateSettings = useCallback((newSettings: Settings) => {
    const syncedSettings = {
      ...newSettings,
      language: appLanguage,
    };
    storage.saveSettings(syncedSettings);
    setSettings(syncedSettings);
  }, [appLanguage]);

  const refreshSettings = useCallback(() => {
    setSettings(storage.getSettings());
  }, []);

  const setAppLanguage = useCallback((language: OdontogramLanguage) => {
    persistOdontogramLanguage(language);
    localStorage.setItem('dqc_app_language', language);
    setAppLanguageState(language);
    setSettings((current) => {
      const next = { ...current, language };
      storage.saveSettings(next);
      return next;
    });
  }, []);

  const setOdontogramNumbering = useCallback((numbering: OdontogramNumberingSystem) => {
    persistOdontogramNumbering(numbering);
    setOdontogramNumberingState(numbering);
  }, []);

  useEffect(() => {
    if (settings.language === appLanguage) return;
    const next = { ...settings, language: appLanguage };
    storage.saveSettings(next);
    setSettings(next);
  }, [appLanguage, settings]);

  // Listen for storage changes (for multi-tab support)
  useEffect(() => {
    const handleStorageChange = () => {
      setSettings(storage.getSettings());
      setAppLanguageState(getOdontogramLanguage());
      setOdontogramNumberingState(getOdontogramNumbering());
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const t = translations[appLanguage];

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        refreshSettings,
        appLanguage,
        setAppLanguage,
        odontogramNumbering,
        setOdontogramNumbering,
        t,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
