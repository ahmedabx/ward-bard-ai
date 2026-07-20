import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type StudyMode = 'preclinical' | 'clinical';

interface ModeContextValue {
  mode: StudyMode;
  setMode: (m: StudyMode) => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);
const STORAGE_KEY = 'medbard.studyMode';

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<StudyMode>(() => {
    if (typeof window === 'undefined') return 'clinical';
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'preclinical' || stored === 'clinical' ? stored : 'clinical';
  });

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, mode); } catch { /* ignore */ }
  }, [mode]);

  return (
    <ModeContext.Provider value={{ mode, setMode: setModeState }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useStudyMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useStudyMode must be used within ModeProvider');
  return ctx;
}
