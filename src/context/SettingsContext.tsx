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

export type ThemeMode = 'light' | 'dark' | 'system';

function applyThemeToDOM(theme: ThemeMode) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (settings: Settings) => void;
  refreshSettings: () => void;
  appLanguage: OdontogramLanguage;
  setAppLanguage: (language: OdontogramLanguage) => void;
  odontogramNumbering: OdontogramNumberingSystem;
  setOdontogramNumbering: (numbering: OdontogramNumberingSystem) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
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
  const [theme, setThemeState] = useState<ThemeMode>(() =>
    (localStorage.getItem('dqc_theme') as ThemeMode) || 'system'
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

  const setTheme = useCallback((newTheme: ThemeMode) => {
    localStorage.setItem('dqc_theme', newTheme);
    setThemeState(newTheme);
    // Brief transition for smooth theme switch
    document.documentElement.classList.add('theme-transition');
    applyThemeToDOM(newTheme);
    setTimeout(() => document.documentElement.classList.remove('theme-transition'), 200);
  }, []);

  useEffect(() => {
    if (settings.language === appLanguage) return;
    const next = { ...settings, language: appLanguage };
    storage.saveSettings(next);
    setSettings(next);
  }, [appLanguage, settings]);

  // Listen for system color-scheme changes (for 'system' mode)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if ((localStorage.getItem('dqc_theme') || 'system') === 'system') {
        applyThemeToDOM('system');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Listen for storage changes (for multi-tab support)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'dqc_theme') {
        const newTheme = (e.newValue as ThemeMode) || 'system';
        setThemeState(newTheme);
        applyThemeToDOM(newTheme);
      }
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
        theme,
        setTheme,
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
