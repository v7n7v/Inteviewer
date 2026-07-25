'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type AdminSavedView = 'command' | 'operations' | 'finance' | 'support';
export type AdminDensity = 'comfortable' | 'compact';

interface AdminUiPreferencesValue {
  savedView: AdminSavedView;
  density: AdminDensity;
  setSavedView: (view: AdminSavedView) => void;
  setDensity: (density: AdminDensity) => void;
}

interface StoredAdminUiPreferences {
  version: 1;
  savedView: AdminSavedView;
  density: AdminDensity;
}

const STORAGE_KEY = 'tc_admin_ui_v1';
const AdminUiPreferencesContext = createContext<AdminUiPreferencesValue | null>(null);

function isSavedView(value: unknown): value is AdminSavedView {
  return value === 'command' || value === 'operations' || value === 'finance' || value === 'support';
}

function isDensity(value: unknown): value is AdminDensity {
  return value === 'comfortable' || value === 'compact';
}

export function AdminUiPreferencesProvider({ children }: { children: ReactNode }) {
  const [savedView, setSavedViewState] = useState<AdminSavedView>('command');
  const [density, setDensityState] = useState<AdminDensity>('comfortable');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<StoredAdminUiPreferences>;
      if (parsed.version !== 1) return;
      if (isSavedView(parsed.savedView)) setSavedViewState(parsed.savedView);
      if (isDensity(parsed.density)) setDensityState(parsed.density);
    } catch {
      // UI preferences are optional and never block Admin.
    }
  }, []);

  const persist = useCallback((nextView: AdminSavedView, nextDensity: AdminDensity) => {
    try {
      const payload: StoredAdminUiPreferences = {
        version: 1,
        savedView: nextView,
        density: nextDensity,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // The selected preference still applies to this session.
    }
  }, []);

  const setSavedView = useCallback((nextView: AdminSavedView) => {
    setSavedViewState(nextView);
    persist(nextView, density);
  }, [density, persist]);

  const setDensity = useCallback((nextDensity: AdminDensity) => {
    setDensityState(nextDensity);
    persist(savedView, nextDensity);
  }, [persist, savedView]);

  const value = useMemo<AdminUiPreferencesValue>(() => ({
    savedView,
    density,
    setSavedView,
    setDensity,
  }), [density, savedView, setDensity, setSavedView]);

  return (
    <AdminUiPreferencesContext.Provider value={value}>
      {children}
    </AdminUiPreferencesContext.Provider>
  );
}

export function useAdminUiPreferences(): AdminUiPreferencesValue {
  const value = useContext(AdminUiPreferencesContext);
  if (!value) throw new Error('useAdminUiPreferences must be used within AdminUiPreferencesProvider.');
  return value;
}
