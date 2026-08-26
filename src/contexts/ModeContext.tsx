import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type StudyMode = 'preclinical' | 'clinical';

export const STUDY_MODES: { value: StudyMode; label: string; hint: string }[] = [
  { value: 'preclinical', label: 'ZAYO (Pre-Clinical)', hint: 'Mechanistic, Step 1 style' },
  { value: 'clinical', label: 'KALIK (Clinical)', hint: 'Vignette-based, Step 2 CK style' },
];

export type Specialty =
  | 'all'
  | 'cardiology'
  | 'nephrology'
  | 'gi'
  | 'neuro'
  | 'respiratory'
  | 'obgyn'
  | 'emergency'
  | 'haematology'
  | 'endocrine'
  | 'infectious'
  | 'rheumatology'
  | 'oncology'
  | 'psychiatry'
  | 'paediatrics'
  | 'dermatology'
  | 'surgery';

export const SPECIALTIES: { value: Specialty; label: string }[] = [
  { value: 'all', label: 'All Specialties' },
  { value: 'cardiology', label: 'Cardiology' },
  { value: 'nephrology', label: 'Nephrology' },
  { value: 'gi', label: 'GI' },
  { value: 'neuro', label: 'Neuro' },
  { value: 'respiratory', label: 'Respiratory' },
  { value: 'obgyn', label: 'Obs/Gynae' },
  { value: 'emergency', label: 'Emergency/Sepsis' },
  { value: 'haematology', label: 'Haematology' },
  { value: 'endocrine', label: 'Endocrinology' },
  { value: 'infectious', label: 'Infectious Disease' },
  { value: 'rheumatology', label: 'Rheumatology' },
  { value: 'oncology', label: 'Oncology' },
  { value: 'psychiatry', label: 'Psychiatry' },
  { value: 'paediatrics', label: 'Paediatrics' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'surgery', label: 'Surgery' },
];

interface ModeContextValue {
  mode: StudyMode;
  setMode: (m: StudyMode) => void;
  specialty: Specialty;
  setSpecialty: (s: Specialty) => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);
const STORAGE_KEY = 'medbard.studyMode';
const SPECIALTY_KEY = 'medbard.specialty';

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<StudyMode>(() => {
    if (typeof window === 'undefined') return 'clinical';
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return STUDY_MODES.some((m) => m.value === stored) ? (stored as StudyMode) : 'clinical';
  });

  const [specialty, setSpecialtyState] = useState<Specialty>(() => {
    if (typeof window === 'undefined') return 'all';
    const stored = window.localStorage.getItem(SPECIALTY_KEY);
    return SPECIALTIES.some((s) => s.value === stored) ? (stored as Specialty) : 'all';
  });

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, mode); } catch { /* ignore */ }
  }, [mode]);

  useEffect(() => {
    try { window.localStorage.setItem(SPECIALTY_KEY, specialty); } catch { /* ignore */ }
  }, [specialty]);

  return (
    <ModeContext.Provider value={{ mode, setMode: setModeState, specialty, setSpecialty: setSpecialtyState }}>
      {children}
    </ModeContext.Provider>
  );
}


export function useStudyMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useStudyMode must be used within ModeProvider');
  return ctx;
}
