import React, { createContext, useContext, useState, useEffect } from 'react';

export type Settings = {
  editor: {
    fontSize: number;
    tabSize: number;
    wordWrap: boolean;
    lineNumbers: boolean;
    fontFamily: string;
  };
  terminal: {
    fontSize: number;
  };
  theme: {
    accentColor: string;
  };
  general: {
    autoSave: boolean;
    autoSaveInterval: number;
    confirmDelete: boolean;
  };
};

export const DEFAULT_SETTINGS: Settings = {
  editor: {
    fontSize: 14,
    tabSize: 2,
    wordWrap: false,
    lineNumbers: true,
    fontFamily: 'Cascadia Code',
  },
  terminal: {
    fontSize: 13,
  },
  theme: {
    accentColor: '#6aa3ff',
  },
  general: {
    autoSave: false,
    autoSaveInterval: 5,
    confirmDelete: true,
  },
};

const STORAGE_KEY = 'notes-app:settings';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return JSON.parse(raw) as Settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

type SettingsCtx = {
  settings: Settings;
  update: (patch: DeepPartial<Settings>) => void;
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

const Context = createContext<SettingsCtx>({ settings: DEFAULT_SETTINGS, update: () => {} });

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    applyTheme(settings);
  }, [settings]);

  const update = (patch: DeepPartial<Settings>) => {
    setSettings((prev) => deepMerge(prev, patch) as Settings);
  };

  return <Context.Provider value={{ settings, update }}>{children}</Context.Provider>;
}

export const useSettings = () => useContext(Context);

function applyTheme(s: Settings) {
  const root = document.documentElement;
  root.style.setProperty('--accent', s.theme.accentColor);
  root.style.setProperty('--accent-soft', hexToSoft(s.theme.accentColor));
}

function hexToSoft(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},0.18)`;
}

function deepMerge(base: any, patch: any): any {
  const result = { ...base };
  for (const key of Object.keys(patch)) {
    if (patch[key] !== null && typeof patch[key] === 'object' && !Array.isArray(patch[key])) {
      result[key] = deepMerge(base[key] ?? {}, patch[key]);
    } else {
      result[key] = patch[key];
    }
  }
  return result;
}
