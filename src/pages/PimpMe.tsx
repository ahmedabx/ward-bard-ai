import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Stethoscope, Send, Flag, RotateCcw } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { supabase } from '@/integrations/supabase/client';

type Level = 'Student' | 'Intern' | 'Resident';
type Score = 'correct' | 'partial' | 'incorrect';

interface Turn {
  question: string;
  answer?: string;
  feedback?: string;
  score?: Score | null;
}

const SPECIALTIES = [
  'Internal Medicine', 'Surgery', 'Pediatrics', 'Obstetrics & Gynecology',
  'Emergency Medicine', 'Cardiology', 'Neurology', 'Psychiatry',
];
const LEVELS: Level[] = ['Student', 'Intern', 'Resident'];

export default function PimpMe() {
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [specialty, setSpecialty] = useState(SPECIALTIES[0]);
  const [level, setLevel] = useState<Level>('Student');

  const [turns, setTurns] = useState<Turn[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const round = turns.length;
  const goodScores = turns.filter((t) => t.score === 'correct' || t.score === 'partial').length;
  const totalAnswered = turns.filter((t) => t.score).length;

  const buildHistory = () => {
    const h: { role: 'user' | 'assistant'; content: string }[] = [];
    turns.forEach((t) => {
      h.push({ role: 'assistant', content: t.question });
      if (t.answer) h.push({ role: 'user', content: t.answer });
      if (t.feedback) h.push({ role: 'assistant', content: t.feedback });
    });
    return h;
  };

  const callApi = async (mode: 'new_question' | 'evaluate', answer?: string) => {
    const { data, error } = await supabase.functions.invoke('pimp-me', {
      body: { mode, specialty, level, history: buildHistory(), answer },
    });
    if (error) throw new Error(error.message || 'Request failed');
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as { content: string; score: Score | null };
  };

  const startRound = async () => {
    setStarted(true);
    setEnded(false);
    setTurns([]);
    setError(null);
    setLoading(true);
    try {
      const res = await callApi('new_question');
      setTurns([{ question: res.content }]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!currentAnswer.trim() || loading) return;
    const answer = currentAnswer.trim();
    setCurrentAnswer('');
    setLoading(true);
    setError(null);
    // attach answer to current open turn
    setTurns((prev) => {
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], answer };
      return next;
    });
    try {
      const res = await callApi('evaluate', answer);
      setTurns((prev) => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], feedback: res.content, score: res.score };
        // Extract follow-up as next question
        const followMatch = res.content.match(/\*\*➡️\s*Follow-up\*\*\s*([\s\S]*?)(?:\n\n|$|⚠️)/);
        const nextQ = followMatch ? followMatch[1].trim().replace(/⚠️.*$/s, '').trim() : '';
        if (nextQ) next.push({ question: nextQ });
        return next;
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const endRound = () => setEnded(true);
  const reset = () => { setStarted(false); setEnded(false); setTurns([]); setCurrentAnswer(''); setError(null); };

  const currentTurn = turns[turns.length - 1];
  const awaitingAnswer = currentTurn && !currentTurn.answer;

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto px-4 py-6 bg-gradient-to-b from-background to-amber-950/5">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Stethoscope size={20} className="text-amber-400" />
              <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Pimp Me</h1>
            </div>
            {started && !ended && (
              <span className="text-xs font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">
                Round {Math.max(round, 1)} · {goodScores}/{totalAnswered}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Consultant-style ward round questioning. Direct, exacting, no hints.
          </p>

          {/* Setup */}
          {!started && (
            <div className="rounded-xl border border-amber-500/20 bg-card/60 p-5 md:p-6 space-y-5">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Specialty</label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTIES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSpecialty(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                        specialty === s
                          ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Difficulty</label>
                <div className="flex gap-2">
                  {LEVELS.map((l) => (
                    <button
                      key={l}
                      onClick={() => setLevel(l)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-all ${
                        level === l
                          ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={startRound}
                disabled={loading}
                className="w-full py-3 rounded-lg bg-amber-500 text-amber-950 font-semibold hover:bg-amber-400 active:scale-[0.99] transition-all disabled:opacity-50"
              >
                {loading ? 'Starting round...' : 'Start Round'}
              </button>
            </div>
          )}

          {/* Session */}
          {started && !ended && (
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {turns.map((t, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    <div className="rounded-xl border border-amber-500/20 bg-card/70 p-4 md:p-5">
                      <p className="text-[10px] uppercase tracking-wider text-amber-400/80 mb-1.5">
                        Consultant · Q{i + 1}
                      </p>
                      <p className="text-foreground text-[0.95rem] leading-relaxed">{t.question}</p>
                    </div>
                    {t.answer && (
                      <div className="rounded-xl border border-border bg-card/40 p-4 md:p-5 ml-6">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">You</p>
                        <p className="text-foreground/90 text-sm whitespace-pre-wrap">{t.answer}</p>
                      </div>
                    )}
                    {t.feedback && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4 md:p-5">
                        <div className="ward-bard-response prose prose-invert max-w-none text-[0.9rem] leading-[1.7]">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="text-muted-foreground mb-2.5">{children}</p>,
                              strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
                              ul: ({ children }) => <ul className="space-y-1 mb-2.5 pl-4 list-disc">{children}</ul>,
                              li: ({ children }) => <li className="text-muted-foreground">{children}</li>,
                            }}
                          >
                            {t.feedback}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {awaitingAnswer && (
                <div className="sticky bottom-0 pt-2">
                  <div className="rounded-xl border border-amber-500/30 bg-background/95 backdrop-blur p-3 flex gap-2 items-end">
                    <textarea
                      value={currentAnswer}
                      onChange={(e) => setCurrentAnswer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          submitAnswer();
                        }
                      }}
                      placeholder="Your answer..."
                      rows={2}
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none"
                      disabled={loading}
                    />
                    <button
                      onClick={submitAnswer}
                      disabled={loading || !currentAnswer.trim()}
                      className="p-2.5 rounded-lg bg-amber-500 text-amber-950 disabled:opacity-40 hover:bg-amber-400 transition-all"
                      aria-label="Submit answer"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              )}

              {loading && !awaitingAnswer && (
                <div className="rounded-xl border border-amber-500/20 bg-card/40 p-4 animate-pulse">
                  <div className="h-3 bg-muted/40 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted/40 rounded w-1/2" />
                </div>
              )}

              <button
                onClick={endRound}
                className="w-full mt-2 py-2.5 rounded-lg border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 text-sm font-medium flex items-center justify-center gap-2"
              >
                <Flag size={14} /> End Round
              </button>
            </div>
          )}

          {/* Summary */}
          {ended && (
            <div className="rounded-xl border border-amber-500/30 bg-card/70 p-6 text-center space-y-4">
              <Stethoscope size={32} className="mx-auto text-amber-400" />
              <h2 className="font-heading text-xl font-bold text-foreground">Round Complete</h2>
              <p className="text-3xl font-mono text-amber-300">
                {goodScores}<span className="text-muted-foreground/60">/{totalAnswered}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {specialty} · {level} · {turns.length} questions asked
              </p>
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 text-amber-950 font-semibold hover:bg-amber-400"
              >
                <RotateCcw size={14} /> New Round
              </button>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground/60 italic text-center pt-6">
            ⚠️ Educational only — always consult a healthcare provider.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
