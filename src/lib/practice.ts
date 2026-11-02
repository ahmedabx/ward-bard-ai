// Practice — shared types and helpers for the merged Qbank Maker + My Patient feature.
import { SPECIALTIES, Specialty } from '@/contexts/ModeContext';

export type PracticeFormat = 'questions' | 'cases';
export type ExamKey = 'step1' | 'step2ck' | 'mbbs_fcps';
export type PracticeDifficulty = 'easy' | 'mixed' | 'hard';
export type PracticeMode = 'preclinical' | 'clinical';

export const QUESTION_COUNTS = [5, 10, 20, 40] as const;
export const CASE_COUNTS = [1, 2, 3] as const;

export const EXAMS: { key: ExamKey; label: string }[] = [
  { key: 'step1', label: 'Step 1' },
  { key: 'step2ck', label: 'Step 2 CK' },
  { key: 'mbbs_fcps', label: 'MBBS/FCPS' },
];

export const DIFFICULTIES: { key: PracticeDifficulty; label: string }[] = [
  { key: 'easy', label: 'Easy' },
  { key: 'mixed', label: 'Mixed' },
  { key: 'hard', label: 'Hard' },
];

/** Case-stage names shown for a 5-point case; other lengths fall back to generic labels. */
export const STAGE_NAMES = ['History', 'Exam', 'Investigations', 'Diagnosis', 'Management'];

// ---------- Topic row ----------
export interface TopicRow {
  id: string;
  exam: string;
  mode: string;
  system: string;
  name: string;
  parent_id: string | null;
  case_eligible: boolean;
  sort_order: number;
}

/** Maps a seeded system name to the specialty key the case generator accepts. */
export const SYSTEM_TO_SPECIALTY: Record<string, Specialty> = Object.fromEntries(
  SPECIALTIES.filter(s => s.value !== 'all').map(s => [s.label, s.value]),
) as Record<string, Specialty>;

// ---------- Item payloads ----------
export interface MCQOption { label: string; text: string; }
export interface MCQ {
  stem: string;
  options: MCQOption[];
  answer: string;
  explanation?: string;
}

export interface Vitals { hr: number; sbp: number; dbp: number; rr: number; spo2: number; temp: number; }
export interface CaseOption { text: string; vitals_delta: Partial<Vitals>; outcome_score: number; feedback: string; }
export interface DecisionPoint { question: string; options: CaseOption[]; }
export interface CasePayload {
  case_id?: string;
  chief_complaint: string;
  specialty?: string;
  specialty_label?: string;
  starting_vitals: Vitals;
  decision_points: DecisionPoint[];
  stabilize_threshold: number;
  critical_threshold: number;
}

export interface PracticeItemRow {
  id: string;
  session_id: string;
  user_id: string;
  topic_id: string | null;
  item_type: string;
  payload: unknown;
  user_answer: string | null;
  is_correct: boolean | null;
  time_spent_ms: number | null;
  sort_order: number;
  created_at: string;
}

export interface PracticeSessionRow {
  id: string;
  user_id: string;
  format: PracticeFormat;
  exam: string | null;
  mode: PracticeMode;
  topic_ids: string[];
  custom_topic: string | null;
  difficulty: string;
  item_count: number;
  status: string;
  score: number | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  progress?: unknown;
}

/** Per-case play state persisted in session.progress for resume. */
export interface CasePlayState {
  vitals: Vitals;
  score: number;
  pointIndex: number;
  log: CaseLogEntry[];
  outcome?: 'stable' | 'critical' | null;
}
export interface CaseLogEntry {
  question: string;
  choice: string;
  feedback: string;
  score: number;
  vitals: Vitals;
}
export interface SessionProgress {
  qIndex?: number;
  caseIndex?: number;
  cases?: Record<string, CasePlayState>;
}

export const VITAL_RANGES: Record<keyof Vitals, [number, number]> = {
  hr: [20, 220], sbp: [40, 260], dbp: [20, 160],
  rr: [4, 60], spo2: [50, 100], temp: [32, 43],
};

export function applyDelta(v: Vitals, d: Partial<Vitals>): Vitals {
  const out = {} as Vitals;
  for (const k of Object.keys(VITAL_RANGES) as (keyof Vitals)[]) {
    const [min, max] = VITAL_RANGES[k];
    const next = (v[k] ?? 0) + (d?.[k] ?? 0);
    out[k] = Math.min(max, Math.max(min, Math.round(next * 10) / 10));
  }
  return out;
}

export function statusFor(score: number, c: { stabilize_threshold: number; critical_threshold: number }): 'stable' | 'deteriorating' | 'critical' {
  if (score >= Math.ceil(c.stabilize_threshold / 2)) return 'stable';
  if (score <= Math.ceil(c.critical_threshold / 2)) return 'critical';
  return 'deteriorating';
}

/**
 * Splits item_count across the selected topics so every topic contributes at
 * least one item when possible. Returns one share per topic (in order).
 */
export function distributeCounts(total: number, topicCount: number): number[] {
  if (topicCount <= 0) return [];
  const base = Math.floor(total / topicCount);
  const shares = new Array(topicCount).fill(Math.max(1, base));
  let assigned = shares.reduce((a, b) => a + b, 0);
  // Trim the largest shares (keeping >=1) until we fit the total.
  while (assigned > total) {
    let maxIdx = 0;
    for (let i = 1; i < shares.length; i++) if (shares[i] > shares[maxIdx]) maxIdx = i;
    if (shares[maxIdx] <= 1) break;
    shares[maxIdx] -= 1;
    assigned -= 1;
  }
  // Still over (more topics than items): keep the first `total` topics at 1 each.
  if (assigned > total) {
    return shares.slice(0, total).map(() => 1);
  }
  // Hand out the remainder to the earliest topics.
  let i = 0;
  while (assigned < total) {
    shares[i % shares.length] += 1;
    assigned += 1;
    i += 1;
  }
  return shares;
}

export function stageLabel(index: number, totalPoints: number): string {
  if (totalPoints === STAGE_NAMES.length) return STAGE_NAMES[index] ?? `Checkpoint ${index + 1}`;
  return `Checkpoint ${index + 1}`;
}

export function parseProgress(raw: unknown): SessionProgress {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as SessionProgress;
  return {};
}

export function extractJson<T>(text: string): T {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const slice = start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice) as T;
}
