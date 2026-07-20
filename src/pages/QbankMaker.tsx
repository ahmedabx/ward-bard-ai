import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, FileQuestion, RotateCcw, CheckCircle2, XCircle, ArrowRight, Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';

interface MCQOption { label: string; text: string; }
interface MCQ {
  stem: string;
  options: MCQOption[];
  answer: string;
  explanation: string;
}

type Difficulty = 'easy' | 'medium' | 'hard';
type Mode = 'preclinical' | 'clinical';

type Phase = 'setup' | 'quiz' | 'summary';

const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: 'easy', label: 'Easy' },
  { key: 'medium', label: 'Medium' },
  { key: 'hard', label: 'Hard' },
];

const MODES: { key: Mode; label: string; hint: string }[] = [
  { key: 'preclinical', label: 'Preclinical', hint: 'Basic sciences' },
  { key: 'clinical', label: 'Clinical', hint: 'Diagnosis & Mx' },
];

const SUGGESTED = [
  'Acute coronary syndrome',
  'DKA management',
  'Antihypertensives',
  'CN III palsy',
  'Bishop score & induction',
  'Beta-lactam mechanisms',
];

function extractJson<T>(text: string): T {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const slice = start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice) as T;
}

export default function QbankMaker() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [mode, setMode] = useState<Mode>('clinical');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<MCQ[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [locked, setLocked] = useState(false);

  const reset = () => {
    setPhase('setup');
    setQuestions([]);
    setQIndex(0);
    setAnswers([]);
    setLocked(false);
    setError(null);
  };

  const generate = async () => {
    const t = topic.trim();
    if (t.length < 2) { setError('Enter a topic.'); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('qbank-generator', {
        body: { topic: t, count, difficulty, mode },
      });
      if (fnErr) throw new Error(fnErr.message || 'Request failed');
      if (data?.error) throw new Error(data.error);
      const parsed = extractJson<{ questions: MCQ[] }>(data.content);
      const qs = (parsed.questions || []).filter(q => q.stem && Array.isArray(q.options) && q.options.length >= 4);
      if (qs.length === 0) throw new Error('Empty response — try again.');
      setQuestions(qs);
      setAnswers(new Array(qs.length).fill(null));
      setQIndex(0);
      setLocked(false);
      setPhase('quiz');
    } catch (e: any) {
      setError(e?.message || 'Failed to generate questions.');
    } finally {
      setLoading(false);
    }
  };

  const chooseOption = (label: string) => {
    if (locked) return;
    const next = [...answers];
    next[qIndex] = label;
    setAnswers(next);
  };

  const confirm = () => { if (answers[qIndex]) setLocked(true); };

  const nextQ = () => {
    if (qIndex + 1 >= questions.length) {
      setPhase('summary');
    } else {
      setQIndex(qIndex + 1);
      setLocked(false);
    }
  };

  return (
    <AppLayout>
      <div className="px-4 py-6">
        <div className="max-w-2xl mx-auto">
          {phase === 'setup' && (
            <SetupView
              topic={topic} setTopic={setTopic}
              count={count} setCount={setCount}
              difficulty={difficulty} setDifficulty={setDifficulty}
              mode={mode} setMode={setMode}
              loading={loading} error={error}
              onGenerate={generate}
            />
          )}

          {phase === 'quiz' && questions[qIndex] && (
            <QuizView
              q={questions[qIndex]}
              index={qIndex}
              total={questions.length}
              selected={answers[qIndex]}
              locked={locked}
              onChoose={chooseOption}
              onConfirm={confirm}
              onNext={nextQ}
            />
          )}

          {phase === 'summary' && (
            <SummaryView questions={questions} answers={answers} onReset={reset} />
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// ---------- Setup ----------
function SetupView(props: {
  topic: string; setTopic: (v: string) => void;
  count: number; setCount: (n: number) => void;
  difficulty: Difficulty; setDifficulty: (d: Difficulty) => void;
  mode: Mode; setMode: (m: Mode) => void;
  loading: boolean; error: string | null;
  onGenerate: () => void;
}) {
  const { topic, setTopic, count, setCount, difficulty, setDifficulty, mode, setMode, loading, error, onGenerate } = props;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: 'hsl(var(--primary) / 0.12)' }}>
          <FileQuestion size={16} style={{ color: 'hsl(var(--primary))' }} />
        </div>
        <div>
          <h1 className="font-serif-display text-xl text-foreground leading-tight">Qbank Maker</h1>
          <p className="text-[11px] text-muted-foreground">Generate exam-style MCQs on any topic.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-card/40 p-5 space-y-5">
        {/* Topic */}
        <div>
          <label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Topic</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Acute coronary syndrome"
            maxLength={200}
            className="mt-1.5 w-full bg-transparent border border-white/[0.08] focus:border-primary/50 focus:outline-none rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
            onKeyDown={(e) => { if (e.key === 'Enter' && !loading) onGenerate(); }}
            autoFocus
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTED.map(s => (
              <button
                key={s}
                onClick={() => setTopic(s)}
                className="text-[10.5px] px-2 py-1 rounded-md border border-white/[0.06] text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Mode */}
        <div>
          <label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Mode</label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {MODES.map(m => {
              const active = mode === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className="flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border text-left transition-colors"
                  style={{
                    background: active ? 'hsl(var(--primary) / 0.10)' : 'transparent',
                    borderColor: active ? 'hsl(var(--primary) / 0.4)' : 'hsl(var(--hairline) / var(--hairline-alpha))',
                    color: active ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                  }}
                >
                  <span className="text-[13px] font-medium">{m.label}</span>
                  <span className="text-[10.5px] text-muted-foreground">{m.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Difficulty + count */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Difficulty</label>
            <div className="mt-1.5 flex gap-1">
              {DIFFICULTIES.map(d => {
                const active = difficulty === d.key;
                return (
                  <button
                    key={d.key}
                    onClick={() => setDifficulty(d.key)}
                    className="flex-1 py-2 rounded-lg border text-[12px] font-medium transition-colors"
                    style={{
                      background: active ? 'hsl(var(--primary) / 0.10)' : 'transparent',
                      borderColor: active ? 'hsl(var(--primary) / 0.4)' : 'hsl(var(--hairline) / var(--hairline-alpha))',
                      color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Questions</label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="range" min={3} max={10} step={1}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-sm font-medium text-foreground w-6 text-right">{count}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive">
            {error}
          </div>
        )}

        <button
          disabled={loading || topic.trim().length < 2}
          onClick={onGenerate}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:opacity-90 transition"
        >
          {loading ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : <><Sparkles size={14} /> Generate quiz</>}
        </button>

        <p className="text-[10.5px] text-muted-foreground/80 text-center">
          For exam preparation and study only.
        </p>
      </div>
    </motion.div>
  );
}

// ---------- Quiz ----------
function QuizView(props: {
  q: MCQ;
  index: number; total: number;
  selected: string | null;
  locked: boolean;
  onChoose: (label: string) => void;
  onConfirm: () => void;
  onNext: () => void;
}) {
  const { q, index, total, selected, locked, onChoose, onConfirm, onNext } = props;
  const isLast = index + 1 === total;

  return (
    <motion.div key={index} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.12em] text-primary">Question {index + 1} / {total}</span>
        <div className="h-1 flex-1 mx-3 rounded-full bg-white/[0.05] overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-card/40 p-5">
        <p className="text-[14px] leading-relaxed text-foreground/95 whitespace-pre-line">{q.stem}</p>
      </div>

      <div className="space-y-2">
        {q.options.map(opt => {
          const isSelected = selected === opt.label;
          const showCorrect = locked && opt.label === q.answer;
          const showWrong = locked && isSelected && opt.label !== q.answer;
          return (
            <button
              key={opt.label}
              disabled={locked}
              onClick={() => onChoose(opt.label)}
              className={`w-full flex items-start gap-3 text-left p-3 rounded-xl border text-sm transition-colors ${
                showCorrect
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground'
                  : showWrong
                  ? 'border-red-500/40 bg-red-500/10 text-foreground'
                  : isSelected
                  ? 'border-primary/50 bg-primary/10 text-foreground'
                  : 'border-white/[0.07] bg-card/30 text-foreground/85 hover:border-primary/30 hover:bg-primary/[0.04]'
              }`}
            >
              <span className="text-[11px] font-semibold mt-0.5 w-4 flex-shrink-0 text-muted-foreground">{opt.label}</span>
              <span className="leading-snug">{opt.text}</span>
            </button>
          );
        })}
      </div>

      {!locked && (
        <button
          disabled={!selected}
          onClick={onConfirm}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-30 hover:opacity-90 transition"
        >
          Confirm
        </button>
      )}

      <AnimatePresence>
        {locked && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className={`p-3.5 rounded-xl border text-sm ${
              selected === q.answer
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-100'
                : 'border-red-500/30 bg-red-500/5 text-red-100'
            }`}
          >
            <div className="flex items-start gap-2 mb-1.5">
              {selected === q.answer
                ? <CheckCircle2 size={15} className="mt-0.5 text-emerald-400 flex-shrink-0" />
                : <XCircle size={15} className="mt-0.5 text-red-400 flex-shrink-0" />}
              <p className="text-[12px] font-semibold">
                {selected === q.answer ? 'Correct' : `Correct answer: ${q.answer}`}
              </p>
            </div>
            <p className="text-[13px] leading-relaxed text-foreground/90">{q.explanation}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {locked && (
        <button
          onClick={onNext}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
        >
          {isLast ? 'See summary' : 'Next question'} <ArrowRight size={14} />
        </button>
      )}

      <p className="text-[10.5px] text-muted-foreground/70 text-center pt-2">
        Educational only — always consult a healthcare provider.
      </p>
    </motion.div>
  );
}

// ---------- Summary ----------
function SummaryView({ questions, answers, onReset }: {
  questions: MCQ[]; answers: (string | null)[]; onReset: () => void;
}) {
  const correct = questions.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);
  const pct = Math.round((correct / questions.length) * 100);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="rounded-2xl border border-white/[0.06] bg-card/40 p-5">
        <p className="text-[10px] uppercase tracking-[0.12em] text-primary">Quiz complete</p>
        <p className="text-4xl font-serif-display text-foreground mt-1">
          {correct}<span className="text-muted-foreground text-2xl">/{questions.length}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{pct}% correct</p>
      </div>

      <div className="space-y-2">
        {questions.map((q, i) => {
          const isCorrect = answers[i] === q.answer;
          return (
            <div key={i} className="p-3 rounded-xl border border-white/[0.06] bg-card/30">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Q{i + 1}</p>
                {isCorrect
                  ? <CheckCircle2 size={14} className="text-emerald-400" />
                  : <XCircle size={14} className="text-red-400" />}
              </div>
              <p className="text-[13px] text-foreground/90 leading-snug mb-1.5 line-clamp-3">{q.stem}</p>
              <p className="text-[11.5px] text-muted-foreground">
                Your answer: <span className={isCorrect ? 'text-emerald-300' : 'text-red-300'}>{answers[i] ?? '—'}</span>
                {!isCorrect && <> · Correct: <span className="text-emerald-300">{q.answer}</span></>}
              </p>
            </div>
          );
        })}
      </div>

      <button
        onClick={onReset}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
      >
        <RotateCcw size={14} /> New quiz
      </button>
    </motion.div>
  );
}
