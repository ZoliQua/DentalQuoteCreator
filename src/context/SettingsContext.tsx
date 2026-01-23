import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Settings } from '../types';
import { storage } from '../repositories';
import { translations, TranslationKeys } from '../i18n';

interface SettingsContextType {
  settings: Settings;
  updateSettings: (settings: Settings) => void;
  t: TranslationKeys;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => storage.getSettings());

  const updateSettings = useCallback((newSettings: Settings) => {
    storage.saveSettings(newSettings);
    setSettings(newSettings);
  }, []);

  // Listen for storage changes (for multi-tab support)
  useEffect(() => {
    const handleStorageChange = () => {
      setSettings(storage.getSettings());
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const t = translations[settings.language];

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, t }}>
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
