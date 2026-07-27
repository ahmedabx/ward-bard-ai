import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, RotateCcw, CheckCircle2, XCircle, MinusCircle, ArrowRight,
  Stethoscope, ChevronDown, ChevronRight, Activity,
} from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useStudyMode, SPECIALTIES, Specialty } from '@/contexts/ModeContext';

// ---------- Types ----------
const VITAL_KEYS = ['hr', 'sbp', 'dbp', 'rr', 'spo2', 'temp'] as const;
type VitalKey = typeof VITAL_KEYS[number];
type Vitals = Record<VitalKey, number>;

interface CaseOption {
  text: string;
  vitals_delta: Vitals;
  outcome_score: number;
  feedback: string;
}
interface DecisionPoint {
  question: string;
  options: CaseOption[];
}
interface SimCase {
  id: string;
  chief_complaint: string;
  specialty: string;
  starting_vitals: Vitals;
  decision_points: DecisionPoint[];
  stabilize_threshold: number;
  critical_threshold: number;
}
interface LogEntry {
  question: string;
  choice: string;
  feedback: string;
  score: number;
  vitals: Vitals;
}

const CASE_SPECIALTIES = SPECIALTIES.filter(s => s.value !== 'all');
const DAILY_LIMIT = 2;

const VITAL_RANGES: Record<VitalKey, [number, number]> = {
  hr: [20, 220], sbp: [40, 260], dbp: [20, 160],
  rr: [4, 60], spo2: [50, 100], temp: [32, 43],
};

function applyDelta(v: Vitals, d: Vitals): Vitals {
  const out = {} as Vitals;
  for (const k of VITAL_KEYS) {
    const [min, max] = VITAL_RANGES[k];
    const next = (v[k] ?? 0) + (d?.[k] ?? 0);
    out[k] = Math.min(max, Math.max(min, Math.round(next * 10) / 10));
  }
  return out;
}

type Status = 'stable' | 'deteriorating' | 'critical';
function statusFor(score: number, c: SimCase): Status {
  if (score >= Math.ceil(c.stabilize_threshold / 2)) return 'stable';
  if (score <= Math.ceil(c.critical_threshold / 2)) return 'critical';
  return 'deteriorating';
}
const STATUS_STYLE: Record<Status, { label: string; cls: string }> = {
  stable: { label: 'Stable', cls: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
  deteriorating: { label: 'Deteriorating', cls: 'text-amber-300 border-amber-500/30 bg-amber-500/10' },
  critical: { label: 'Critical', cls: 'text-red-300 border-red-500/30 bg-red-500/10' },
};

// ---------- Edge function bridge ----------
async function callPatientFn(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('groq-patient', { body });
  if (error) {
    let message = error.message || 'Request failed';
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        const payload = await ctx.json();
        if (payload?.error) message = payload.error;
      }
    } catch { /* ignore */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// ---------- Page ----------
export default function MyPatient() {
  const { mode } = useStudyMode();
  const [simCase, setSimCase] = useState<SimCase | null>(null);
  const [loadingCase, setLoadingCase] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);
  const [used, setUsed] = useState<number | null>(null);
  const [limit, setLimit] = useState<number>(DAILY_LIMIT);
  const [confirmExit, setConfirmExit] = useState(false);

  const [vitals, setVitals] = useState<Vitals | null>(null);
  const [lastDelta, setLastDelta] = useState<Vitals | null>(null);
  const [score, setScore] = useState(0);
  const [pointIndex, setPointIndex] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [answered, setAnswered] = useState<CaseOption | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [outcome, setOutcome] = useState<'stable' | 'critical' | null>(null);

  // Fetch today's quota on entry (no case is generated automatically).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await callPatientFn({ action: 'quota' });
        if (cancelled) return;
        setUsed(res.used ?? 0);
        setLimit(res.limit ?? DAILY_LIMIT);
      } catch {
        if (!cancelled) setUsed(0);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const resetCaseState = () => {
    setSimCase(null);
    setVitals(null);
    setLastDelta(null);
    setScore(0);
    setPointIndex(0);
    setSelectedIdx(null);
    setAnswered(null);
    setLog([]);
    setOutcome(null);
    setConfirmExit(false);
  };

  const generateCase = useCallback(async (specialty: Specialty) => {
    setLoadingCase(true);
    setError(null);
    resetCaseState();
    try {
      const res = await callPatientFn({ action: 'new_case', mode, specialty });
      const c = res.case as SimCase;
      setSimCase(c);
      setVitals(c.starting_vitals);
      if (typeof res.used === 'number') setUsed(res.used);
      if (typeof res.limit === 'number') setLimit(res.limit);
    } catch (e: any) {
      setError(e?.message || 'Failed to generate case');
      try {
        const q = await callPatientFn({ action: 'quota' });
        setUsed(q.used ?? used ?? 0);
        setLimit(q.limit ?? DAILY_LIMIT);
      } catch { /* ignore */ }
    } finally {
      setLoadingCase(false);
    }
  }, [mode, used]);

  const endCase = useCallback(async (result: 'stable' | 'critical', finalScore: number) => {
    setOutcome(result);
    if (!simCase) return;
    try {
      await supabase
        .from('patient_cases')
        .update({ outcome: result, final_score: finalScore, completed_at: new Date().toISOString() })
        .eq('id', simCase.id);
    } catch { /* non-blocking */ }
  }, [simCase]);

  const handleConfirm = () => {
    if (selectedIdx === null || !simCase || !vitals || answered) return;
    const option = simCase.decision_points[pointIndex].options[selectedIdx];
    const nextVitals = applyDelta(vitals, option.vitals_delta);
    const nextScore = score + option.outcome_score;
    setVitals(nextVitals);
    setLastDelta(option.vitals_delta);
    setScore(nextScore);
    setAnswered(option);
    setLog(prev => [...prev, {
      question: simCase.decision_points[pointIndex].question,
      choice: option.text,
      feedback: option.feedback,
      score: option.outcome_score,
      vitals: nextVitals,
    }]);
  };

  const handleNext = () => {
    if (!simCase) return;
    // Threshold check after each answer.
    if (score >= simCase.stabilize_threshold) return void endCase('stable', score);
    if (score <= simCase.critical_threshold) return void endCase('critical', score);

    if (pointIndex + 1 >= simCase.decision_points.length) {
      // Exhausted: default to whichever threshold the score is closer to.
      const distStable = Math.abs(simCase.stabilize_threshold - score);
      const distCritical = Math.abs(score - simCase.critical_threshold);
      return void endCase(distStable <= distCritical ? 'stable' : 'critical', score);
    }
    setPointIndex(pointIndex + 1);
    setSelectedIdx(null);
    setAnswered(null);
    setLastDelta(null);
  };

  const hasActiveCase = !!simCase && !outcome;
  const remaining = used === null ? null : Math.max(0, limit - used);
  const limitReached = remaining === 0;

  return (
    <AppLayout>
      <div className="px-4 md:px-6 py-5 md:py-6">
        <div className="max-w-2xl mx-auto">

          {error && (
            <div className="mb-5 md:mb-4 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive">
              {error}
            </div>
          )}

          {loadingCase && <CaseSkeleton />}

          {!loadingCase && !simCase && (
            <SpecialtyPicker
              selected={selectedSpecialty}
              onSelect={setSelectedSpecialty}
              onStart={() => selectedSpecialty && generateCase(selectedSpecialty)}
              remaining={remaining}
              limit={limit}
              limitReached={limitReached}
            />
          )}

          {!loadingCase && simCase && vitals && !outcome && (
            <div className="space-y-5 md:space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Activity size={15} className="text-primary" />
                  <p className="text-[10px] uppercase tracking-[0.12em] text-primary">{simCase.specialty}</p>
                </div>
                <h2 className="font-serif-display text-xl md:text-2xl text-foreground leading-snug">
                  {simCase.chief_complaint}
                </h2>
              </div>

              <VitalsBar vitals={vitals} delta={lastDelta} status={statusFor(score, simCase)} />

              <DecisionView
                point={simCase.decision_points[pointIndex]}
                selectedIdx={selectedIdx}
                setSelectedIdx={setSelectedIdx}
                answered={answered}
                onConfirm={handleConfirm}
                onNext={handleNext}
                isLast={pointIndex + 1 >= simCase.decision_points.length}
              />

              <ActionLog entries={log} />

              <button
                onClick={() => setConfirmExit(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition"
              >
                Exit case
              </button>
            </div>
          )}

          {simCase && outcome && vitals && (
            <Debrief
              simCase={simCase}
              outcome={outcome}
              score={score}
              vitals={vitals}
              log={log}
              remaining={remaining}
              onNew={resetCaseState}
            />
          )}

          {confirmExit && hasActiveCase && (
            <div className="mt-4 p-4 rounded-xl border border-white/10 bg-card/60">
              <p className="text-sm text-foreground mb-1">Exit this case?</p>
              <p className="text-xs text-muted-foreground mb-3">
                Your progress will be lost. This case has already used one of today's
                {' '}{limit} generations — exiting won't give it back.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={resetCaseState}
                  className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
                  style={{ minHeight: 44 }}
                >
                  Exit case
                </button>
                <button
                  onClick={() => setConfirmExit(false)}
                  className="px-3 py-2 rounded-lg border border-white/10 text-muted-foreground text-sm hover:text-foreground transition"
                  style={{ minHeight: 44 }}
                >
                  Keep going
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// ---------- Vitals ----------
function VitalsBar({ vitals, delta, status }: { vitals: Vitals; delta: Vitals | null; status: Status }) {
  const st = STATUS_STYLE[status];
  const items: { label: string; value: string; change: number }[] = [
    { label: 'HR', value: `${Math.round(vitals.hr)}`, change: delta?.hr ?? 0 },
    { label: 'BP', value: `${Math.round(vitals.sbp)}/${Math.round(vitals.dbp)}`, change: delta?.sbp ?? 0 },
    { label: 'RR', value: `${Math.round(vitals.rr)}`, change: delta?.rr ?? 0 },
    { label: 'SpO₂', value: `${Math.round(vitals.spo2)}%`, change: delta?.spo2 ?? 0 },
    { label: 'Temp', value: `${vitals.temp.toFixed(1)}°`, change: delta?.temp ?? 0 },
  ];
  return (
    <div className="rounded-xl border border-white/[0.06] bg-card/40 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Vitals</p>
        <span className={`px-2 py-1 rounded-md border text-[10px] font-semibold uppercase tracking-wide ${st.cls}`}>
          {st.label}
        </span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {items.map(it => (
          <div key={it.label} className="rounded-lg bg-white/[0.03] px-2 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.label}</p>
            <motion.p
              key={it.value}
              initial={{ opacity: 0.4, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-base font-medium text-foreground tabular-nums"
            >
              {it.value}
            </motion.p>
            {it.change !== 0 && (
              <p className={`text-[10px] tabular-nums ${it.change > 0 ? 'text-amber-300' : 'text-sky-300'}`}>
                {it.change > 0 ? '+' : ''}{it.change}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Decision ----------
function DecisionView({
  point, selectedIdx, setSelectedIdx, answered, onConfirm, onNext, isLast,
}: {
  point: DecisionPoint;
  selectedIdx: number | null;
  setSelectedIdx: (i: number) => void;
  answered: CaseOption | null;
  onConfirm: () => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const locked = answered !== null;
  return (
    <div className="space-y-4 md:space-y-3">
      <h3 className="font-serif-display text-lg md:text-xl text-foreground leading-snug">
        {point.question}
      </h3>

      <div className="space-y-3 md:space-y-2">
        {point.options.map((opt, i) => {
          const isSelected = selectedIdx === i;
          const reveal = locked && isSelected;
          return (
            <button
              key={i}
              disabled={locked}
              onClick={() => setSelectedIdx(i)}
              className={`w-full text-left p-4 md:p-3 rounded-xl border text-base md:text-sm leading-relaxed transition-colors duration-150 ${
                reveal && opt.outcome_score > 0
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground'
                  : reveal && opt.outcome_score < 0
                  ? 'border-red-500/40 bg-red-500/10 text-foreground'
                  : reveal
                  ? 'border-amber-500/40 bg-amber-500/10 text-foreground'
                  : isSelected
                  ? 'border-primary/50 bg-primary/10 text-foreground'
                  : 'border-white/[0.07] bg-card/30 text-foreground/85 hover:border-primary/30 hover:bg-primary/[0.04] disabled:opacity-50'
              }`}
              style={{ minHeight: 52 }}
            >
              {opt.text}
            </button>
          );
        })}
      </div>

      {!locked && (
        <button
          disabled={selectedIdx === null}
          onClick={onConfirm}
          className="w-full md:w-auto px-4 py-3 md:py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-30 hover:opacity-90 transition"
          style={{ minHeight: 44 }}
        >
          Confirm
        </button>
      )}

      <AnimatePresence>
        {answered && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3 rounded-xl border text-sm flex items-start gap-2 ${
              answered.outcome_score > 0
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-100'
                : answered.outcome_score < 0
                ? 'border-red-500/30 bg-red-500/5 text-red-100'
                : 'border-amber-500/30 bg-amber-500/5 text-amber-100'
            }`}
          >
            <ScoreIcon score={answered.outcome_score} />
            <p className="leading-relaxed">{answered.feedback}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {answered && (
        <button
          onClick={onNext}
          className="w-full md:w-auto justify-center md:justify-start flex items-center gap-1.5 px-4 py-3 md:py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
          style={{ minHeight: 44 }}
        >
          {isLast ? 'See debrief' : 'Continue'} <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

function ScoreIcon({ score }: { score: number }) {
  if (score > 0) return <CheckCircle2 size={15} className="mt-0.5 text-emerald-400 flex-shrink-0" />;
  if (score < 0) return <XCircle size={15} className="mt-0.5 text-red-400 flex-shrink-0" />;
  return <MinusCircle size={15} className="mt-0.5 text-amber-400 flex-shrink-0" />;
}

// ---------- Action log ----------
function ActionLog({ entries, defaultOpen = false }: { entries: LogEntry[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!entries.length) return null;
  return (
    <div className="rounded-xl border border-white/[0.06] bg-card/30">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 py-3 text-left text-xs text-muted-foreground hover:text-foreground transition"
        style={{ minHeight: 44 }}
      >
        <span className="uppercase tracking-[0.12em]">Action log ({entries.length})</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {entries.map((e, i) => (
            <div key={i} className="rounded-lg bg-white/[0.02] p-3">
              <div className="flex items-start gap-2">
                <ScoreIcon score={e.score} />
                <div className="min-w-0">
                  <p className="text-sm text-foreground/90">{e.choice}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{e.feedback}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1 tabular-nums">
                    HR {Math.round(e.vitals.hr)} · BP {Math.round(e.vitals.sbp)}/{Math.round(e.vitals.dbp)} · RR {Math.round(e.vitals.rr)} · SpO₂ {Math.round(e.vitals.spo2)}% · {e.vitals.temp.toFixed(1)}°
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Debrief ----------
function Debrief({
  simCase, outcome, score, vitals, log, remaining, onNew,
}: {
  simCase: SimCase;
  outcome: 'stable' | 'critical';
  score: number;
  vitals: Vitals;
  log: LogEntry[];
  remaining: number | null;
  onNew: () => void;
}) {
  const helped = log.filter(e => e.score > 0).length;
  const hurt = log.filter(e => e.score < 0).length;
  const neutral = log.length - helped - hurt;
  const st = STATUS_STYLE[outcome === 'stable' ? 'stable' : 'critical'];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/[0.06] bg-card/40 p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-primary">Debrief</p>
            <h2 className="font-serif-display text-xl text-foreground leading-snug mt-1">
              {simCase.chief_complaint}
            </h2>
          </div>
          <span className={`px-2 py-1 rounded-md border text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${st.cls}`}>
            {outcome === 'stable' ? 'Stabilised' : 'Critical'}
          </span>
        </div>

        <p className="text-3xl font-serif-display text-foreground mt-3 tabular-nums">
          {score > 0 ? `+${score}` : score}
          <span className="text-muted-foreground text-base"> net score</span>
        </p>
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
          <span className="text-emerald-300">{helped} helped</span>
          <span className="text-red-300">{hurt} harmed</span>
          <span className="text-amber-300">{neutral} neutral</span>
        </div>
      </div>

      <VitalsBar vitals={vitals} delta={null} status={outcome === 'stable' ? 'stable' : 'critical'} />

      <ActionLog entries={log} defaultOpen />

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        For exam preparation and study only — not medical advice.
      </p>

      {remaining === 0 ? (
        <p className="text-sm text-muted-foreground">
          You've used both cases for today — come back tomorrow.
        </p>
      ) : (
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
          style={{ minHeight: 44 }}
        >
          <RotateCcw size={14} /> New case
        </button>
      )}
    </div>
  );
}

// ---------- Picker / skeleton ----------
function SpecialtyPicker({
  selected, onSelect, onStart, remaining, limit, limitReached,
}: {
  selected: Specialty | null;
  onSelect: (s: Specialty) => void;
  onStart: () => void;
  remaining: number | null;
  limit: number;
  limitReached: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center gap-2 mb-1">
        <Stethoscope size={16} className="text-primary" />
        <p className="text-[10px] uppercase tracking-[0.12em] text-primary">New case</p>
      </div>
      <h2 className="font-serif-display text-2xl text-foreground leading-tight mb-1">
        Choose a specialty
      </h2>
      <p className="text-sm text-muted-foreground mb-5">
        {remaining === null
          ? 'Checking today\'s allowance…'
          : limitReached
          ? "You've used both cases for today — come back tomorrow."
          : `${remaining} of ${limit} cases left today.`}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {CASE_SPECIALTIES.map(s => (
          <button
            key={s.value}
            disabled={limitReached}
            onClick={() => onSelect(s.value)}
            className={`text-left px-4 py-3 rounded-xl border text-sm transition-colors duration-150 disabled:opacity-40 ${
              selected === s.value
                ? 'border-primary/50 bg-primary/10 text-foreground'
                : 'border-white/[0.07] bg-card/30 text-foreground/85 hover:border-primary/30 hover:bg-primary/[0.04]'
            }`}
            style={{ minHeight: 48 }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <button
        disabled={!selected || limitReached}
        onClick={onStart}
        className="w-full md:w-auto px-4 py-3 md:py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-30 hover:opacity-90 transition"
        style={{ minHeight: 44 }}
      >
        Generate case
      </button>

      <p className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
        For exam preparation and study only — not medical advice.
      </p>
    </motion.div>
  );
}

function CaseSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-card/40 p-5 space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin" /> Building your patient…
      </div>
      <div className="h-4 bg-white/[0.05] rounded w-1/2 animate-pulse" />
      <div className="h-3 bg-white/[0.05] rounded w-1/3 animate-pulse" />
      <div className="h-3 bg-white/[0.05] rounded w-full animate-pulse" />
      <div className="h-3 bg-white/[0.05] rounded w-5/6 animate-pulse" />
    </div>
  );
}
