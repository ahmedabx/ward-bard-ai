import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, RotateCcw, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useStudyMode } from '@/contexts/ModeContext';

// ---------- Types ----------
interface PatientCase {
  name: string;
  age: number;
  sex: string;
  chief_complaint: string;
  history: string;
  specialty: string;
}
interface Option { text: string; correct: boolean; }
interface StepRecord {
  label: string;
  question: string;
  options: Option[];
  chosen: Option | null;
  feedback: string;
}

const STEPS: { key: string; label: string; question: string }[] = [
  { key: 'history',        label: 'History',        question: 'What additional history would you prioritize?' },
  { key: 'examination',    label: 'Examination',    question: 'Which examination findings would you focus on?' },
  { key: 'investigations', label: 'Investigations', question: 'Which investigations would you order first?' },
  { key: 'diagnosis',      label: 'Diagnosis',      question: 'What is your working diagnosis?' },
  { key: 'management',     label: 'Management',     question: 'What is your first-line management?' },
];

// ---------- Edge function bridge ----------
async function callPatientFn(body: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.functions.invoke('groq-patient', { body });
  if (error) throw new Error(error.message || 'Request failed');
  if (data?.error) throw new Error(data.error);
  return (data?.content as string) ?? '';
}

function extractJson<T>(text: string): T {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const slice = start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice) as T;
}

// ---------- Page ----------
export default function MyPatient() {
  const { mode } = useStudyMode();
  const [patient, setPatient] = useState<PatientCase | null>(null);
  const [loadingCase, setLoadingCase] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [started, setStarted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [records, setRecords] = useState<StepRecord[]>([]);
  const [currentOptions, setCurrentOptions] = useState<Option[] | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [chosenOption, setChosenOption] = useState<Option | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [finished, setFinished] = useState(false);

  const generateCase = useCallback(async () => {
    setLoadingCase(true);
    setError(null);
    setPatient(null);
    setStarted(false);
    setStepIndex(0);
    setRecords([]);
    setCurrentOptions(null);
    setSelectedIdx(null);
    setFeedback(null);
    setChosenOption(null);
    setFinished(false);
    try {
      const raw = await callPatientFn({ action: 'new_case', mode });
      setPatient(extractJson<PatientCase>(raw));
    } catch (e: any) {
      setError(e?.message || 'Failed to generate case');
    } finally {
      setLoadingCase(false);
    }
  }, []);

  useEffect(() => { generateCase(); }, [generateCase]);

  const loadOptions = useCallback(async (idx: number) => {
    if (!patient) return;
    setLoadingOptions(true);
    setSelectedIdx(null);
    setFeedback(null);
    setChosenOption(null);
    setCurrentOptions(null);
    try {
      const step = STEPS[idx];
      const raw = await callPatientFn({
        action: 'options',
        patient,
        stepKey: step.key,
        stepQuestion: step.question,
      });
      const parsed = extractJson<{ options: Option[] }>(raw);
      const opts = (parsed.options || []).slice(0, 4);
      setCurrentOptions(opts);
    } catch (e: any) {
      setError(e?.message || 'Failed to generate options');
    } finally {
      setLoadingOptions(false);
    }
  }, [patient]);

  useEffect(() => {
    if (started && !finished) loadOptions(stepIndex);
  }, [started, stepIndex, finished, loadOptions]);

  const handleConfirm = async () => {
    if (selectedIdx === null || !currentOptions || !patient) return;
    const choice = currentOptions[selectedIdx];
    setChosenOption(choice);
    setLoadingFeedback(true);
    try {
      const fb = await callPatientFn({
        action: 'feedback',
        patient,
        stepKey: STEPS[stepIndex].key,
        stepQuestion: STEPS[stepIndex].question,
        choiceText: choice.text,
        correct: choice.correct,
      });
      setFeedback(fb.trim());
    } catch (e: any) {
      setFeedback('Could not load feedback.');
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleNext = () => {
    if (!chosenOption || !currentOptions) return;
    const record: StepRecord = {
      label: STEPS[stepIndex].label,
      question: STEPS[stepIndex].question,
      options: currentOptions,
      chosen: chosenOption,
      feedback: feedback || '',
    };
    const nextRecords = [...records, record];
    setRecords(nextRecords);
    if (stepIndex + 1 >= STEPS.length) {
      setFinished(true);
    } else {
      setStepIndex(stepIndex + 1);
    }
  };

  // ---------- Render ----------
  return (
    <AppLayout>
      <div className="px-4 py-6">
        <div className="max-w-2xl mx-auto">

          {error && (
            <div className="mb-4 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-center justify-between">
              <span>{error}</span>
              <button onClick={generateCase} className="underline">Retry</button>
            </div>
          )}

          {loadingCase && <CaseSkeleton />}

          {!loadingCase && patient && !started && !finished && (
            <PatientCard patient={patient} onStart={() => setStarted(true)} onNew={generateCase} />
          )}

          {!loadingCase && patient && started && !finished && (
            <StepView
              patient={patient}
              stepIndex={stepIndex}
              options={currentOptions}
              loadingOptions={loadingOptions}
              selectedIdx={selectedIdx}
              setSelectedIdx={setSelectedIdx}
              feedback={feedback}
              chosenOption={chosenOption}
              loadingFeedback={loadingFeedback}
              onConfirm={handleConfirm}
              onNext={handleNext}
            />
          )}

          {finished && patient && (
            <Summary patient={patient} records={records} onNew={generateCase} />
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// ---------- Subcomponents ----------
function CaseSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-card/40 p-5 space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin" /> Generating a new patient case…
      </div>
      <div className="h-4 bg-white/[0.05] rounded w-1/2 animate-pulse" />
      <div className="h-3 bg-white/[0.05] rounded w-1/3 animate-pulse" />
      <div className="h-3 bg-white/[0.05] rounded w-full animate-pulse" />
      <div className="h-3 bg-white/[0.05] rounded w-5/6 animate-pulse" />
    </div>
  );
}

function PatientCard({ patient, onStart, onNew }: { patient: PatientCase; onStart: () => void; onNew: () => void; }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/[0.06] bg-card/40 p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-serif-display text-2xl text-foreground leading-tight">{patient.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {patient.age} y/o · {patient.sex}
          </p>
        </div>
        <span className="px-2 py-1 rounded-md text-[10px] font-semibold tracking-wide uppercase bg-primary/15 text-primary border border-primary/25">
          {patient.specialty}
        </span>
      </div>

      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-[0.12em] text-primary mb-1">Chief complaint</p>
        <p className="text-sm text-foreground/90">{patient.chief_complaint}</p>
      </div>

      <div className="mb-5">
        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1">History</p>
        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{patient.history}</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onStart}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
        >
          Start case
        </button>
        <button
          onClick={onNew}
          className="px-3 py-2 rounded-lg border border-white/10 text-muted-foreground text-sm hover:text-foreground hover:border-white/20 transition flex items-center gap-1.5"
        >
          <RotateCcw size={13} /> New case
        </button>
      </div>
    </motion.div>
  );
}

function StepView(props: {
  patient: PatientCase;
  stepIndex: number;
  options: Option[] | null;
  loadingOptions: boolean;
  selectedIdx: number | null;
  setSelectedIdx: (i: number) => void;
  feedback: string | null;
  chosenOption: Option | null;
  loadingFeedback: boolean;
  onConfirm: () => void;
  onNext: () => void;
}) {
  const { patient, stepIndex, options, loadingOptions, selectedIdx, setSelectedIdx,
          feedback, chosenOption, loadingFeedback, onConfirm, onNext } = props;
  const step = STEPS[stepIndex];
  const locked = chosenOption !== null;

  return (
    <div className="space-y-4">
      {/* Mini patient strip */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-white/[0.06] bg-card/40">
        <div className="min-w-0">
          <p className="text-sm text-foreground truncate">{patient.name} · {patient.age}{patient.sex?.[0]?.toUpperCase()}</p>
          <p className="text-xs text-muted-foreground truncate">{patient.chief_complaint}</p>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-primary border border-primary/25 bg-primary/10 px-2 py-1 rounded-md">
          Step {stepIndex + 1}/{STEPS.length} · {step.label}
        </span>
      </div>

      {/* Question */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] text-primary mb-1">{step.label}</p>
        <h3 className="font-serif-display text-xl text-foreground leading-snug">{step.question}</h3>
      </div>

      {/* Options */}
      {loadingOptions && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Loading options…
        </div>
      )}

      {options && (
        <div className="space-y-2">
          {options.map((opt, i) => {
            const isSelected = selectedIdx === i;
            const showResult = locked && isSelected;
            const showCorrect = locked && opt.correct;
            return (
              <button
                key={i}
                disabled={locked}
                onClick={() => setSelectedIdx(i)}
                className={`w-full text-left p-3 rounded-xl border text-sm transition-colors duration-150 ${
                  showCorrect
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground'
                    : showResult && !opt.correct
                    ? 'border-red-500/40 bg-red-500/10 text-foreground'
                    : isSelected
                    ? 'border-primary/50 bg-primary/10 text-foreground'
                    : 'border-white/[0.07] bg-card/30 text-foreground/85 hover:border-primary/30 hover:bg-primary/[0.04]'
                }`}
              >
                {opt.text}
              </button>
            );
          })}
        </div>
      )}

      {/* Confirm */}
      {options && !locked && (
        <button
          disabled={selectedIdx === null}
          onClick={onConfirm}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-30 hover:opacity-90 transition"
        >
          Confirm
        </button>
      )}

      {/* Feedback */}
      <AnimatePresence>
        {(loadingFeedback || feedback) && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3 rounded-xl border text-sm ${
              loadingFeedback
                ? 'border-white/[0.06] bg-card/40 text-muted-foreground'
                : chosenOption?.correct
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-100'
                : 'border-red-500/30 bg-red-500/5 text-red-100'
            }`}
          >
            {loadingFeedback ? (
              <span className="flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Evaluating…</span>
            ) : (
              <div className="flex items-start gap-2">
                {chosenOption?.correct
                  ? <CheckCircle2 size={15} className="mt-0.5 text-emerald-400 flex-shrink-0" />
                  : <XCircle size={15} className="mt-0.5 text-red-400 flex-shrink-0" />}
                <p className="leading-relaxed">{feedback}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {feedback && !loadingFeedback && (
        <button
          onClick={onNext}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
        >
          {stepIndex + 1 === STEPS.length ? 'See summary' : 'Next step'} <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

function Summary({ patient, records, onNew }: { patient: PatientCase; records: StepRecord[]; onNew: () => void; }) {
  const correctCount = records.filter(r => r.chosen?.correct).length;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/[0.06] bg-card/40 p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-primary">Case summary</p>
            <h2 className="font-serif-display text-2xl text-foreground">{patient.name}</h2>
          </div>
          <span className="px-2 py-1 rounded-md text-[10px] font-semibold tracking-wide uppercase bg-primary/15 text-primary border border-primary/25">
            {patient.specialty}
          </span>
        </div>
        <p className="text-3xl font-serif-display text-foreground mt-2">
          {correctCount}<span className="text-muted-foreground text-xl">/{records.length}</span>
        </p>
        <p className="text-xs text-muted-foreground">correct</p>
      </div>

      <div className="space-y-2">
        {records.map((r, i) => (
          <div key={i} className="p-3 rounded-xl border border-white/[0.06] bg-card/30">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{i + 1}. {r.label}</p>
              {r.chosen?.correct
                ? <CheckCircle2 size={14} className="text-emerald-400" />
                : <XCircle size={14} className="text-red-400" />}
            </div>
            <p className="text-sm text-foreground/90">{r.chosen?.text}</p>
            {r.feedback && <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{r.feedback}</p>}
          </div>
        ))}
      </div>

      <button
        onClick={onNew}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
      >
        <RotateCcw size={14} /> New case
      </button>
    </div>
  );
}
