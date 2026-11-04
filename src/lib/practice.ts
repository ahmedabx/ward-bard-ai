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

// ---------- Parsed item shapes (tolerant of legacy backfill payloads) ----------

export interface ParsedMCQ {
  id: string;
  topicId: string | null;
  topicName: string | null;
  mcq: MCQ;
  userAnswer: string | null;
  isCorrect: boolean | null;
  timeSpentMs: number | null;
}

export function parseMcqItem(row: PracticeItemRow): ParsedMCQ | null {
  const p = (row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
    ? row.payload : null) as Record<string, unknown> | null;
  if (!p || typeof p.stem !== 'string' || !Array.isArray(p.options)) return null;
  const options = (p.options as unknown[])
    .map(o => (o && typeof o === 'object' ? (o as Record<string, unknown>) : null))
    .filter((o): o is Record<string, unknown> => !!o && typeof o.label === 'string' && typeof o.text === 'string')
    .map(o => ({ label: o.label as string, text: o.text as string }));
  if (options.length < 2 || typeof p.answer !== 'string') return null;
  return {
    id: row.id,
    topicId: row.topic_id,
    topicName: typeof p.topic_name === 'string' ? (p.topic_name as string) : null,
    mcq: {
      stem: p.stem,
      options,
      answer: p.answer as string,
      explanation: typeof p.explanation === 'string' ? (p.explanation as string) : undefined,
    },
    userAnswer: row.user_answer,
    isCorrect: row.is_correct,
    timeSpentMs: row.time_spent_ms,
  };
}

export interface ParsedCheckpoint {
  id: string;
  topicId: string | null;
  topicName: string | null;
  caseIndex: number;
  presentation: string;
  specialty: string | null;
  question: string;
  options: CaseOption[];
  startingVitals: Vitals;
  stabilize: number;
  critical: number;
  mode: PracticeMode;
  userAnswer: string | null;
  isCorrect: boolean | null;
  timeSpentMs: number | null;
  outcome: string | null;
  raw: Record<string, unknown>;
}

function zeroFillVitals(v: unknown): Vitals {
  const o = (v && typeof v === 'object' && !Array.isArray(v) ? v : {}) as Record<string, unknown>;
  const out = {} as Vitals;
  for (const k of Object.keys(VITAL_RANGES) as (keyof Vitals)[]) {
    const n = Number(o[k]);
    out[k] = Number.isFinite(n) ? n : 0;
  }
  return out;
}

export function parseCheckpointItem(row: PracticeItemRow): ParsedCheckpoint | null {
  const p = (row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
    ? row.payload : null) as Record<string, unknown> | null;
  if (!p || typeof p.question !== 'string' || !Array.isArray(p.options)) return null;
  const options = (p.options as unknown[])
    .map(o => (o && typeof o === 'object' ? (o as Record<string, unknown>) : null))
    .filter((o): o is Record<string, unknown> => !!o && typeof o.text === 'string' && (o.text as string).length > 0)
    .map(o => ({
      text: o.text as string,
      vitals_delta: (o.vitals_delta && typeof o.vitals_delta === 'object' ? o.vitals_delta : {}) as Partial<Vitals>,
      outcome_score: typeof o.outcome_score === 'number' ? Math.max(-1, Math.min(1, Math.round(o.outcome_score))) : 0,
      feedback: typeof o.feedback === 'string' ? (o.feedback as string) : '',
    }));
  if (options.length < 2) return null;
  const caseIndex = typeof p.case_index === 'number' ? (p.case_index as number)
    : typeof p.stage === 'number' ? (p.stage as number) : 0;
  return {
    id: row.id,
    topicId: row.topic_id,
    topicName: typeof p.topic_name === 'string' ? (p.topic_name as string) : null,
    caseIndex,
    presentation: typeof p.presentation === 'string' ? (p.presentation as string) : '',
    specialty: typeof p.specialty === 'string' ? (p.specialty as string) : null,
    question: p.question as string,
    options,
    startingVitals: zeroFillVitals(p.starting_vitals),
    stabilize: typeof p.stabilize_threshold === 'number' ? (p.stabilize_threshold as number) : 5,
    critical: typeof p.critical_threshold === 'number' ? (p.critical_threshold as number) : -5,
    mode: p.mode === 'preclinical' ? 'preclinical' : 'clinical',
    userAnswer: row.user_answer,
    isCorrect: row.is_correct,
    timeSpentMs: row.time_spent_ms,
    outcome: typeof p.outcome === 'string' ? (p.outcome as string) : null,
    raw: p,
  };
}

// ---------- Case grouping ----------

export interface CaseGroup {
  key: string;
  presentation: string;
  specialty: string | null;
  topicName: string | null;
  topicId: string | null;
  mode: PracticeMode;
  startingVitals: Vitals;
  stabilize: number;
  critical: number;
  checkpoints: ParsedCheckpoint[];
  firstItemId: string;
}

/**
 * Groups consecutive case_checkpoint rows (sorted by sort_order) into cases by
 * matching presentation. Tolerates the legacy backfill shape, which repeats the
 * case-level fields on every checkpoint row.
 */
export function groupCaseItems(items: ParsedCheckpoint[]): CaseGroup[] {
  const groups: CaseGroup[] = [];
  for (const cp of items) {
    const last = groups[groups.length - 1];
    if (
      last && last.presentation === cp.presentation &&
      last.startingVitals.hr === cp.startingVitals.hr &&
      last.startingVitals.sbp === cp.startingVitals.sbp &&
      last.checkpoints.length < 12
    ) {
      last.checkpoints.push(cp);
    } else {
      groups.push({
        key: cp.id,
        presentation: cp.presentation,
        specialty: cp.specialty,
        topicName: cp.topicName,
        topicId: cp.topicId,
        mode: cp.mode,
        startingVitals: cp.startingVitals,
        stabilize: cp.stabilize,
        critical: cp.critical,
        checkpoints: [cp],
        firstItemId: cp.id,
      });
    }
  }
  return groups;
}

export interface CaseLogEntry {
  question: string;
  choice: string;
  feedback: string;
  score: number;
  vitals: Vitals;
}

export interface CaseDerived {
  vitals: Vitals;
  score: number;
  answered: number;
  log: CaseLogEntry[];
  outcome: 'stable' | 'critical' | null;
  finished: boolean;
}

/** Rebuilds live play state from the answers stored on the checkpoint rows. */
export function deriveCasePlay(g: CaseGroup): CaseDerived {
  let vitals = g.startingVitals;
  let score = 0;
  const log: CaseLogEntry[] = [];
  for (const cp of g.checkpoints) {
    if (!cp.userAnswer) break;
    const opt = cp.options.find(o => o.text === cp.userAnswer);
    if (!opt) break;
    vitals = applyDelta(vitals, opt.vitals_delta);
    score += opt.outcome_score;
    log.push({ question: cp.question, choice: cp.userAnswer, feedback: opt.feedback, score: opt.outcome_score, vitals });
  }
  const answered = log.length;
  let outcome: 'stable' | 'critical' | null =
    g.checkpoints[0]?.outcome === 'stable' || g.checkpoints[0]?.outcome === 'critical'
      ? (g.checkpoints[0].outcome as 'stable' | 'critical')
      : null;
  if (!outcome) {
    if (score >= g.stabilize) outcome = 'stable';
    else if (score <= g.critical) outcome = 'critical';
    else if (answered >= g.checkpoints.length) {
      const distStable = Math.abs(g.stabilize - score);
      const distCritical = Math.abs(score - g.critical);
      outcome = distStable <= distCritical ? 'stable' : 'critical';
    }
  }
  return { vitals, score, answered, log, outcome, finished: outcome !== null };
}

// ---------- Vitals & scoring ----------

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

// ---------- Generation planning ----------

export interface GenTask {
  topicId: string | null;
  topicName: string;
  share: number;
}

/** Splits item_count across topics (and the custom topic) so each gets at least one item. */
export function buildQuestionPlan(topicNames: { id: string | null; name: string }[], total: number): GenTask[] {
  const shares = distributeCounts(total, topicNames.length);
  return topicNames.map((t, i) => ({ topicId: t.id, topicName: t.name, share: shares[i] }));
}

/**
 * The existing qbank-generator accepts 3–10 questions per call. Split a topic's
 * share into calls; tiny shares still request 3 and keep only what is needed.
 */
export function qbankChunks(share: number): { request: number; keep: number }[] {
  const out: { request: number; keep: number }[] = [];
  let left = share;
  while (left > 0) {
    const keep = Math.min(10, left);
    out.push({ request: Math.max(3, keep), keep });
    left -= keep;
  }
  return out;
}

/** Session difficulty uses mixed; the generator only knows easy/medium/hard. */
export const QBANK_DIFFICULTY: Record<PracticeDifficulty, 'easy' | 'medium' | 'hard'> = {
  easy: 'easy',
  mixed: 'medium',
  hard: 'hard',
};

// ---------- Misc helpers ----------

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

export interface SessionProgress {
  qIndex?: number;
  caseIndex?: number;
  cases?: Record<string, CasePlayState>;
}

export interface CasePlayState {
  vitals: Vitals;
  score: number;
  pointIndex: number;
  log: CaseLogEntry[];
  outcome?: 'stable' | 'critical' | null;
}

export function extractJson<T>(text: string): T {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const slice = start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice) as T;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
