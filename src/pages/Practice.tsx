import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, Check, ChevronLeft, LoaderCircle, RotateCcw } from 'lucide-react';
import { AppLayout, RailHistory, RailItem } from '@/components/AppLayout';
import PracticeQuestion from '@/components/practice/PracticeQuestion';
import TopicPicker from '@/components/practice/TopicPicker';
import { useDailyUsage } from '@/hooks/use-daily-usage';
import { supabase } from '@/integrations/supabase/client';
import {
  CASE_COUNTS, DIFFICULTIES, EXAMS, QUESTION_COUNTS, QBANK_DIFFICULTY,
  SYSTEM_TO_SPECIALTY, applyDelta, buildQuestionPlan, deriveCasePlay,
  extractJson, formatDuration, formatSessionDate, groupCaseItems,
  parseCheckpointItem, parseMcqItem, qbankChunks, stageLabel,
  type PracticeFormat, type PracticeItemRow, type PracticeMode, type PracticeSessionRow,
  type ParsedCheckpoint,
} from '@/lib/practice';

const LINE = '0.5px solid hsl(var(--hairline) / var(--hairline-alpha))';
const FIELD = 'w-full min-h-11 rounded-md bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary';
const MODES: { value: PracticeMode; label: string }[] = [
  { value: 'preclinical', label: 'FIRA (Pre-Clinical)' },
  { value: 'clinical', label: 'KALIK (Clinical)' },
];
const CASE_LENGTHS = [1, 2] as const;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{children}</div>;
}

function ChoiceGroup<T extends string | number>({
  value, choices, onChange,
}: { value: T; choices: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <div className="flex flex-wrap gap-2">{choices.map(choice => (
    <button key={choice.value} type="button" onClick={() => onChange(choice.value)} aria-pressed={value === choice.value}
      className="min-h-11 rounded-md border px-3 text-[13px] transition-colors"
      style={{ borderColor: value === choice.value ? 'hsl(var(--primary) / .55)' : 'hsl(var(--hairline) / var(--hairline-alpha))', color: value === choice.value ? 'hsl(var(--primary))' : 'hsl(var(--foreground))', background: value === choice.value ? 'hsl(var(--primary) / .08)' : 'transparent' }}>
      {choice.label}
    </button>
  ))}</div>;
}

export function PracticeSetup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [format, setFormat] = useState<PracticeFormat>('questions');
  const [exam, setExam] = useState('step2ck');
  const [mode, setMode] = useState<PracticeMode>('clinical');
  const [difficulty, setDifficulty] = useState<'easy' | 'mixed' | 'hard'>('mixed');
  const [count, setCount] = useState<number>(5);
  const [topicIds, setTopicIds] = useState<Set<string>>(new Set());
  const [customTopic, setCustomTopic] = useState(params.get('topic') ?? '');
  const [customOpen, setCustomOpen] = useState(Boolean(params.get('topic')));
  const [history, setHistory] = useState<PracticeSessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const questionUsage = useDailyUsage('qbank', 40);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase.from('practice_sessions').select('*').order('created_at', { ascending: false }).limit(25);
    setHistory((data ?? []) as PracticeSessionRow[]);
  }, []);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const toggleTopic = (id: string) => setTopicIds(prev => {
    const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });
  const outOfQuestions = format === 'questions' && questionUsage.remaining < count;
  const canStart = (topicIds.size > 0 || customTopic.trim().length >= 2) && !(format === 'cases' && topicIds.size === 0) && !outOfQuestions && !starting;

  const start = async () => {
    if (!canStart) return;
    setStarting(true); setError(null);
    try {
      if (format === 'questions') questionUsage.consume(count);
      const { data, error: fnError } = await supabase.functions.invoke('practice-sessions', {
        body: { format, exam, mode, difficulty, item_count: count, topic_ids: [...topicIds], custom_topic: customTopic.trim() || null },
      });
      if (fnError) throw new Error(fnError.message || 'Could not start this practice session.');
      if (data?.error) throw new Error(data.error);
      const sessionId = data?.session?.id as string | undefined;
      if (!sessionId) throw new Error('The session could not be created. Please try again.');
      navigate(`/practice/session/${sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start this session.');
      setStarting(false);
    }
  };

  const sidebar = <RailHistory title="Practice history" action={<button onClick={() => navigate('/practice')} className="text-xs text-primary">+ New</button>}>
    {history.length === 0 ? <p className="px-2.5 py-2 text-[11px] text-muted-foreground/70">No sessions yet</p> : history.map(s => (
      <RailItem key={s.id} label={s.custom_topic || `${s.format === 'cases' ? 'Case round' : 'Questions'} · ${EXAMS.find(x => x.key === s.exam)?.label ?? s.exam}`} meta={`${s.status === 'completed' ? `Completed · ${s.score ?? 0}%` : s.status === 'error' ? 'Could not generate' : 'In progress'} · ${formatSessionDate(s.created_at)}`} active={false} onClick={() => navigate(s.status === 'completed' ? `/practice/results/${s.id}` : `/practice/session/${s.id}`)} />
    ))}
  </RailHistory>;

  return <AppLayout sidebarSection={sidebar}>
    <div className="px-4 py-6 md:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3"><BookOpen size={19} className="text-primary" /><div><h1 className="font-serif-display text-xl">Practice</h1><p className="mt-0.5 text-xs text-muted-foreground">Build a question set or work through a clinical case.</p></div></div>
        <div className="space-y-6">
          <section><FieldLabel>Format</FieldLabel><ChoiceGroup value={format} choices={[{ value: 'questions', label: 'Questions' }, { value: 'cases', label: 'Cases' }]} onChange={v => { setFormat(v); setTopicIds(new Set()); }} /></section>
          <section><FieldLabel>Exam</FieldLabel><ChoiceGroup value={exam} choices={EXAMS.map(x => ({ value: x.key, label: x.label }))} onChange={setExam} /></section>
          <section><FieldLabel>Mode</FieldLabel><ChoiceGroup value={mode} choices={MODES} onChange={setMode} /></section>
          {format === 'questions' && <section><FieldLabel>Difficulty</FieldLabel><ChoiceGroup value={difficulty} choices={DIFFICULTIES} onChange={setDifficulty} /></section>}
          <section><FieldLabel>{format === 'cases' ? 'Cases' : 'Questions'}</FieldLabel><ChoiceGroup value={count} choices={(format === 'cases' ? CASE_LENGTHS : QUESTION_COUNTS).map(n => ({ value: n, label: String(n) }))} onChange={setCount} /></section>
          <section><TopicPicker exam={exam} mode={mode} format={format} selectedIds={topicIds} onToggle={toggleTopic} customTopic={customTopic} setCustomTopic={setCustomTopic} customOpen={customOpen} setCustomOpen={setCustomOpen} /></section>
          {format === 'cases' && <p className="text-xs text-muted-foreground">Case sessions use eligible specialty topics. Daily case availability remains limited to two.</p>}
          {format === 'questions' && <p className="text-xs text-muted-foreground">Questions remaining today: {questionUsage.remaining}/40</p>}
          {outOfQuestions && <p className="text-sm text-muted-foreground">Daily question limit reached. Come back tomorrow for more.</p>}
          {format === 'cases' && topicIds.size === 0 && <p className="text-sm text-muted-foreground">Select an eligible topic to start a case session.</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <button type="button" disabled={!canStart} onClick={start} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
            {starting ? <><LoaderCircle size={15} className="animate-spin" /> Starting…</> : 'Start practice'}
          </button>
        </div>
      </div>
    </div>
  </AppLayout>;
}

function getPayload(row: PracticeItemRow): Record<string, unknown> {
  return row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) ? row.payload as Record<string, unknown> : {};
}

async function createItems(session: PracticeSessionRow, topicRows: { id: string; name: string; system: string }[]) {
  const topics = topicRows.map(t => ({ id: t.id, name: t.name }));
  if (session.custom_topic?.trim()) topics.push({ id: '', name: session.custom_topic.trim() });
  if (topics.length === 0) throw new Error('Select at least one topic.');
  const topicPlan = buildQuestionPlan(topics.map(t => ({ id: t.id || null, name: t.name })), session.item_count);
  const rows: Record<string, unknown>[] = [];
  if (session.format === 'questions') {
    let order = 0;
    for (const task of topicPlan) {
      for (const chunk of qbankChunks(task.share)) {
        const { data, error } = await supabase.functions.invoke('qbank-generator', { body: { topic: task.topicName, count: chunk.request, difficulty: QBANK_DIFFICULTY[session.difficulty as keyof typeof QBANK_DIFFICULTY] ?? 'medium', mode: session.mode } });
        if (error) throw new Error(error.message || 'Question generation failed.');
        if (data?.error) throw new Error(data.error);
        const parsed = extractJson<{ questions?: unknown[] }>(String(data?.content ?? ''));
        const questions = (parsed.questions ?? []).filter((q): q is Record<string, unknown> => !!q && typeof q === 'object' && typeof (q as Record<string, unknown>).stem === 'string').slice(0, chunk.keep);
        for (const question of questions) rows.push({ session_id: session.id, user_id: session.user_id, topic_id: task.topicId, item_type: 'mcq', payload: { ...question, topic_name: task.topicName }, sort_order: order++ });
      }
    }
  } else {
    for (let caseIndex = 0; caseIndex < session.item_count; caseIndex++) {
      const task = topicPlan[caseIndex % topicPlan.length];
      const chosen = topicRows.find(t => t.id === task.topicId);
      const specialty = chosen ? SYSTEM_TO_SPECIALTY[chosen.system] : undefined;
      if (!specialty) throw new Error(`“${chosen?.system ?? task.topicName}” cannot be used to generate a case. Choose an eligible specialty topic.`);
      const { data, error } = await supabase.functions.invoke('groq-patient', { body: { action: 'new_case', mode: session.mode, specialty } });
      if (error) throw new Error(error.message || 'Case generation failed.');
      if (data?.error) throw new Error(data.error);
      const generated = data?.case;
      if (!generated || !Array.isArray(generated.decision_points)) throw new Error('The generated case was incomplete. Please try again.');
      generated.decision_points.forEach((point: Record<string, unknown>, index: number) => {
        const payload = { question: point.question, options: point.options, presentation: generated.chief_complaint, specialty, topic_name: task.topicName, case_index: caseIndex, stage: index, starting_vitals: generated.starting_vitals, stabilize_threshold: generated.stabilize_threshold, critical_threshold: generated.critical_threshold, mode: session.mode };
        rows.push({ session_id: session.id, user_id: session.user_id, topic_id: task.topicId, item_type: 'case_checkpoint', payload, sort_order: rows.length });
      });
    }
  }
  if (!rows.length) throw new Error('No practice items were generated. Please try again.');
  const { error } = await supabase.from('practice_items').insert(rows as never);
  if (error) throw new Error('Could not save the generated practice items. Please try again.');
  const { error: updateError } = await supabase.from('practice_sessions').update({ status: 'in_progress' }).eq('id', session.id);
  if (updateError) throw new Error('Could not update the practice session. Please try again.');
}

export function PracticeSession() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<PracticeSessionRow | null>(null);
  const [items, setItems] = useState<PracticeItemRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const load = useCallback(async () => {
    const [{ data: s, error: se }, { data: list, error: ie }] = await Promise.all([
      supabase.from('practice_sessions').select('*').eq('id', id).single(),
      supabase.from('practice_items').select('*').eq('session_id', id).order('sort_order'),
    ]);
    if (se || !s) throw new Error('Practice session not found.');
    if (ie) throw new Error('Could not load this practice session.');
    setSession(s as PracticeSessionRow); setItems((list ?? []) as PracticeItemRow[]);
    return { session: s as PracticeSessionRow, items: (list ?? []) as PracticeItemRow[] };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await load();
        if (cancelled) return;
        if (result.items.length === 0 && result.session.status === 'generating' && !started.current) {
          started.current = true;
          let topicRows: { id: string; name: string; system: string }[] = [];
          if (result.session.topic_ids.length) {
            const { data } = await supabase.from('topics').select('id, name, system').in('id', result.session.topic_ids);
            topicRows = (data ?? []) as typeof topicRows;
          }
          await createItems(result.session, topicRows);
          await load();
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Could not load this session.';
        setError(message);
        if (id) await supabase.from('practice_sessions').update({ status: 'error' }).eq('id', id);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [id, load]);

  const mcqs = useMemo(() => items.map(parseMcqItem).filter((q): q is NonNullable<typeof q> => !!q), [items]);
  const checkpoints = useMemo(() => items.map(parseCheckpointItem).filter((q): q is ParsedCheckpoint => !!q), [items]);
  const groups = useMemo(() => groupCaseItems(checkpoints), [checkpoints]);
  const currentMcqIndex = Math.max(0, mcqs.findIndex(q => q.userAnswer === null));
  const currentMcq = mcqs[currentMcqIndex];
  const activeCaseIndex = groups.findIndex(g => !deriveCasePlay(g).finished);
  const activeCase = activeCaseIndex >= 0 ? groups[activeCaseIndex] : null;
  const activeCaseState = activeCase ? deriveCasePlay(activeCase) : null;
  const casePointIndex = activeCaseState?.answered ?? 0;
  const currentCheckpoint = activeCase?.checkpoints[casePointIndex];
  const caseSelectedIndex = currentCheckpoint ? currentCheckpoint.options.findIndex(o => o.text === selected) : -1;

  useEffect(() => {
    setSelected(null); setLocked(false);
  }, [currentMcq?.id, currentCheckpoint?.id]);

  const saveMcq = async (answer: string) => {
    if (!currentMcq) return;
    const row = items.find(x => x.id === currentMcq.id);
    if (!row) return;
    const { error: updateError } = await supabase.from('practice_items').update({ user_answer: answer, is_correct: answer === currentMcq.mcq.answer } as never).eq('id', row.id);
    if (updateError) { setError('Your answer could not be saved. Please retry.'); return; }
    setItems(prev => prev.map(x => x.id === row.id ? { ...x, user_answer: answer, is_correct: answer === currentMcq.mcq.answer } : x));
    setLocked(true);
  };

  const saveCheckpoint = async (advance: boolean) => {
    if (!activeCase || !currentCheckpoint || !selected) return;
    const choice = currentCheckpoint.options.find(o => o.text === selected);
    if (!choice) return;
    if (!locked) {
      const row = items.find(x => x.id === currentCheckpoint.id);
      if (!row) return;
      const { error: updateError } = await supabase.from('practice_items').update({ user_answer: choice.text, is_correct: choice.outcome_score > 0 } as never).eq('id', row.id);
      if (updateError) { setError('Your decision could not be saved. Please retry.'); return; }
      setItems(prev => prev.map(x => x.id === row.id ? { ...x, user_answer: choice.text, is_correct: choice.outcome_score > 0 } : x));
      setLocked(true); return;
    }
    if (!advance) return;
    const updatedPoints = activeCase.checkpoints.map(cp => cp.id === currentCheckpoint.id ? { ...cp, userAnswer: choice.text } : cp);
    const outcome = deriveCasePlay({ ...activeCase, checkpoints: updatedPoints }).outcome;
    if (outcome) {
      const first = activeCase.checkpoints[0];
      const row = items.find(x => x.id === first.id);
      if (row) {
        const payload = { ...getPayload(row), outcome };
        await supabase.from('practice_items').update({ payload: payload as never }).eq('id', first.id);
        setItems(prev => prev.map(x => x.id === first.id ? { ...x, payload } : x));
      }
    }
    setSelected(null); setLocked(false);
  };

  const goNextQuestion = async () => {
    if (!session) return;
    if (currentMcqIndex + 1 >= mcqs.length) {
      const score = Math.round((mcqs.filter(q => q.userAnswer === q.mcq.answer).length / Math.max(1, mcqs.length)) * 100);
      await supabase.from('practice_sessions').update({ status: 'completed', completed_at: new Date().toISOString(), score }).eq('id', session.id);
      navigate(`/practice/results/${session.id}`);
    } else {
      setSelected(null); setLocked(false);
    }
  };

  const finishCases = async () => {
    if (!session || activeCaseIndex !== -1) return;
    const score = Math.round((groups.filter(g => deriveCasePlay(g).outcome === 'stable').length / Math.max(1, groups.length)) * 100);
    await supabase.from('practice_sessions').update({ status: 'completed', completed_at: new Date().toISOString(), score }).eq('id', session.id);
    navigate(`/practice/results/${session.id}`);
  };

  useEffect(() => { if (session?.format === 'cases' && items.length && activeCaseIndex === -1) void finishCases(); }, [session?.format, items, activeCaseIndex]);

  const progressText = session?.format === 'questions' ? `${Math.min(currentMcqIndex + 1, mcqs.length)} / ${mcqs.length}` : `${Math.max(0, activeCaseIndex + 1)} / ${groups.length} cases`;
  const feedback = currentMcq && locked ? <div className="border-t pt-3 text-sm leading-relaxed text-muted-foreground" style={{ borderColor: 'hsl(var(--hairline) / var(--hairline-alpha))' }}>{currentMcq.mcq.explanation || 'Review the key distinction for this question.'}</div> : null;
  const checkpointFeedback = currentCheckpoint && locked ? <div className="border-t pt-3 text-sm leading-relaxed text-muted-foreground" style={{ borderColor: 'hsl(var(--hairline) / var(--hairline-alpha))' }}>{currentCheckpoint.options.find(o => o.text === selected)?.feedback}</div> : null;

  return <AppLayout>
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
      <button onClick={() => navigate('/practice')} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft size={15} /> Practice setup</button>
      {loading ? <div className="space-y-3" aria-label="Loading practice session">{[0, 1, 2].map(i => <div key={i} className="h-10 rounded-md" style={{ background: 'hsl(var(--primary) / .07)' }} />)}</div> : error ? <div className="space-y-4"><p role="alert" className="text-sm text-destructive">{error}</p><button onClick={() => navigate('/practice')} className="min-h-11 rounded-md border px-4 text-sm">Back to Practice</button></div> : session?.format === 'questions' && currentMcq ? <div className="space-y-5">
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'hsl(var(--hairline) / var(--hairline-alpha))' }}><div><p className="font-serif-display text-lg">Questions</p><p className="text-xs text-muted-foreground">{currentMcq.topicName || session.custom_topic || 'Practice'}</p></div><span className="text-xs text-muted-foreground">{progressText}</span></div>
        <PracticeQuestion variant="mcq" stem={currentMcq.mcq.stem} options={currentMcq.mcq.options.map(o => ({ key: o.label, text: o.text }))} correctKey={currentMcq.mcq.answer} selectedKey={locked ? currentMcq.userAnswer : selected} locked={locked || currentMcq.userAnswer !== null} onChoose={setSelected} onConfirm={() => void saveMcq(selected ?? '')} onNext={() => void goNextQuestion()} isLast={currentMcqIndex + 1 >= mcqs.length} feedback={feedback} />
      </div> : session?.format === 'cases' && activeCase && currentCheckpoint ? <div className="space-y-5">
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'hsl(var(--hairline) / var(--hairline-alpha))' }}><div><p className="font-serif-display text-lg">Case {activeCaseIndex + 1} of {groups.length}</p><p className="text-xs text-muted-foreground">{activeCase.specialty} · {activeCase.presentation}</p></div><span className="text-xs text-muted-foreground">{stageLabel(casePointIndex, activeCase.checkpoints.length)}</span></div>
        {activeCaseState && <div className="grid grid-cols-3 gap-2 border-y py-3 sm:grid-cols-5" style={{ borderColor: 'hsl(var(--hairline) / var(--hairline-alpha))' }}>{[['HR', activeCaseState.vitals.hr], ['BP', `${activeCaseState.vitals.sbp}/${activeCaseState.vitals.dbp}`], ['RR', activeCaseState.vitals.rr], ['SpO₂', `${activeCaseState.vitals.spo2}%`], ['Temp', `${activeCaseState.vitals.temp}°`]].map(([k, v]) => <div key={String(k)}><div className="text-[10px] uppercase text-muted-foreground">{k}</div><div className="text-sm tabular-nums">{v}</div></div>)}</div>}
        <PracticeQuestion variant="checkpoint" stem={currentCheckpoint.question} options={currentCheckpoint.options.map((o, i) => ({ key: String(i), text: o.text }))} selectedKey={locked ? String(Math.max(0, caseSelectedIndex)) : selected} locked={locked} onChoose={key => setSelected(currentCheckpoint.options[Number(key)]?.text ?? null)} onConfirm={() => void saveCheckpoint(false)} onNext={() => void saveCheckpoint(true)} confirmLabel="Submit decision" nextLabel="Continue case" isLast={casePointIndex + 1 >= activeCase.checkpoints.length} feedback={checkpointFeedback} />
      </div> : session?.status === 'completed' ? <div className="space-y-4"><p className="font-serif-display text-xl">Session complete</p><button onClick={() => navigate(`/practice/results/${session.id}`)} className="min-h-11 rounded-md bg-primary px-4 text-sm text-primary-foreground">View results</button></div> : <div className="space-y-4"><p className="font-serif-display text-xl">Preparing your practice session</p><p className="text-sm text-muted-foreground">Your session is saved as it is generated. You can return to it from Practice history.</p><LoaderCircle size={17} className="animate-spin text-primary" /></div>}
    </div>
  </AppLayout>;
}

export function PracticeResults() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<PracticeSessionRow | null>(null);
  const [items, setItems] = useState<PracticeItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [{ data: s }, { data: list }] = await Promise.all([
        supabase.from('practice_sessions').select('*').eq('id', id).single(),
        supabase.from('practice_items').select('*').eq('session_id', id).order('sort_order'),
      ]);
      if (!cancelled) { setSession((s ?? null) as PracticeSessionRow | null); setItems((list ?? []) as PracticeItemRow[]); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [id]);
  const questions = items.map(parseMcqItem).filter((q): q is NonNullable<typeof q> => !!q);
  const cases = groupCaseItems(items.map(parseCheckpointItem).filter((cp): cp is ParsedCheckpoint => !!cp));
  const duration = items.reduce((sum, row) => sum + (row.time_spent_ms ?? 0), 0);
  const total = session?.format === 'cases' ? cases.length : questions.length;
  const correct = session?.format === 'cases' ? cases.filter(g => deriveCasePlay(g).outcome === 'stable').length : questions.filter(q => q.isCorrect).length;

  return <AppLayout><div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
    {loading ? <div className="h-10 rounded-md" style={{ background: 'hsl(var(--primary) / .07)' }} /> : !session ? <p className="text-sm text-muted-foreground">Results not found.</p> : <>
      <button onClick={() => navigate('/practice')} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft size={15} /> Practice</button>
      <div className="border-b pb-5" style={{ borderColor: 'hsl(var(--hairline) / var(--hairline-alpha))' }}><p className="text-[11px] uppercase tracking-[0.12em] text-primary">Results</p><h1 className="mt-1 font-serif-display text-2xl">{session.custom_topic || (session.format === 'cases' ? 'Case practice' : 'Question practice')}</h1><p className="mt-1 text-xs text-muted-foreground">{EXAMS.find(x => x.key === session.exam)?.label ?? session.exam} · {session.mode === 'clinical' ? 'KALIK (Clinical)' : 'FIRA (Pre-Clinical)'} · {formatSessionDate(session.created_at)}</p></div>
      <div className="grid grid-cols-2 gap-4 border-b py-5" style={{ borderColor: 'hsl(var(--hairline) / var(--hairline-alpha))' }}><div><p className="text-xs text-muted-foreground">Score</p><p className="mt-1 font-serif-display text-3xl">{session.score ?? 0}%</p><p className="text-xs text-muted-foreground">{correct} of {total} {session.format === 'cases' ? 'cases stabilized' : 'correct'}</p></div><div><p className="text-xs text-muted-foreground">Time recorded</p><p className="mt-1 font-serif-display text-2xl">{formatDuration(duration)}</p></div></div>
      <div className="flex flex-wrap gap-3 py-5"><button onClick={() => navigate('/practice')} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm text-primary-foreground"><RotateCcw size={14} /> New practice</button><button onClick={() => navigate(`/practice/session/${id}`)} className="min-h-11 rounded-md border px-4 text-sm" style={{ borderColor: 'hsl(var(--hairline) / var(--hairline-alpha))' }}>Review session</button></div>
      {questions.length > 0 && <section className="space-y-4"><h2 className="font-serif-display text-lg">Question review</h2>{questions.map((q, i) => <details key={q.id} className="border-t py-3" style={{ borderColor: 'hsl(var(--hairline) / var(--hairline-alpha))' }}><summary className="cursor-pointer text-sm"><span className={q.isCorrect ? 'text-primary' : 'text-destructive'}>{q.isCorrect ? 'Correct' : 'Review'}</span><span className="ml-2 text-foreground">{q.mcq.stem}</span></summary><div className="mt-3 space-y-2 text-sm text-muted-foreground"><p>Your answer: {q.userAnswer || 'Not answered'} · Correct: {q.mcq.answer}</p>{q.mcq.explanation && <p>{q.mcq.explanation}</p>}</div></details>)}</section>}
      {cases.length > 0 && <section className="space-y-4"><h2 className="font-serif-display text-lg">Case review</h2>{cases.map((g, i) => <details key={g.key} className="border-t py-3" style={{ borderColor: 'hsl(var(--hairline) / var(--hairline-alpha))' }}><summary className="cursor-pointer text-sm">Case {i + 1} · {g.presentation} · {deriveCasePlay(g).outcome ?? 'In progress'}</summary><div className="mt-3 space-y-3">{g.checkpoints.map(cp => <div key={cp.id} className="text-sm"><p>{cp.question}</p><p className="text-muted-foreground">Your choice: {cp.userAnswer ?? 'Not answered'}</p>{cp.userAnswer && <p className="text-muted-foreground">{cp.options.find(o => o.text === cp.userAnswer)?.feedback}</p>}</div>)}</div></details>)}</section>}
      {!questions.length && !cases.length && <p className="text-sm text-muted-foreground">No saved practice items were found for this session.</p>}
    </>}
  </div></AppLayout>;
}