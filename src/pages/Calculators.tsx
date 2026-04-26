import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { calculators, Calculator } from '@/lib/calculators';

export default function Calculators() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">Calculators</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Validated clinical scores with AI-assisted interpretation.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {calculators.map((c) => (
              <CalcCard key={c.id} calc={c} open={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function CalcCard({ calc, open, onToggle }: { calc: Calculator; open: boolean; onToggle: () => void }) {
  return (
    <div className={`glass-card overflow-hidden ${open ? 'sm:col-span-2' : ''}`}>
      <button onClick={onToggle} className="w-full text-left p-4 hover:bg-card/40 transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading font-semibold text-foreground">{calc.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{calc.description}</p>
          </div>
          {open ? <ChevronUp size={16} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 border-t border-border/40">
              <CalcForm calc={calc} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CalcForm({ calc }: { calc: Calculator }) {
  const [values, setValues] = useState<Record<string, number | undefined>>({});
  const [score, setScore] = useState<number | null>(null);
  const [interpretation, setInterpretation] = useState<string>('');
  const [aiText, setAiText] = useState<string>('');
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');

  const allSet = calc.fields.every((f) => values[f.id] !== undefined);

  const calculate = async () => {
    const total = calc.fields.reduce((acc, f) => acc + (values[f.id] || 0), 0);
    setScore(total);
    const interp = calc.interpret(total);
    setInterpretation(interp);
    setAiState('loading');
    setAiText('');

    const components: Record<string, string> = {};
    calc.fields.forEach((f) => {
      const v = values[f.id];
      const opt = f.options.find((o) => o.value === v);
      components[f.label] = `${opt?.label ?? '—'} (${v})`;
    });

    try {
      const res = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: calc.name, score: total, interpretation: interp, components }),
      });
      if (!res.ok) {
        setAiState('error');
        return;
      }
      const data = await res.json();
      setAiText(data.interpretation || '');
      setAiState('done');
    } catch {
      setAiState('error');
    }
  };

  return (
    <div className="pt-4 space-y-4">
      <div className="space-y-3">
        {calc.fields.map((f) => (
          <div key={f.id}>
            <label className="text-xs text-muted-foreground block mb-1.5">{f.label}</label>
            <select
              value={values[f.id] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.id]: Number(e.target.value) }))}
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="" disabled>Select...</option>
              {f.options.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}{f.type === 'select' ? ` (${o.value})` : ''}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <button
        onClick={calculate}
        disabled={!allSet}
        className="w-full px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm disabled:opacity-50 hover:opacity-90 active:scale-[0.98]"
      >
        Calculate
      </button>

      {score !== null && (
        <div className="space-y-3">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Score</p>
            <p className="font-heading text-3xl font-bold text-primary mt-1">{score}</p>
            <p className="text-sm text-foreground mt-1">{interpretation}</p>
          </div>

          <div className="glass-card p-4 border border-primary/10">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Clinical interpretation</p>
            {aiState === 'loading' && (
              <p className="text-sm text-muted-foreground">Generating clinical interpretation...</p>
            )}
            {aiState === 'error' && (
              <p className="text-sm text-destructive">AI interpretation unavailable. The score and components above stand on their own.</p>
            )}
            {aiState === 'done' && (
              <div className="ward-bard-response prose prose-invert max-w-none text-[0.9rem] leading-[1.7]">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="text-muted-foreground mb-2">{children}</p>,
                    strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
                    ul: ({ children }) => <ul className="space-y-1 mb-2 pl-4 list-disc">{children}</ul>,
                    li: ({ children }) => <li className="text-muted-foreground">{children}</li>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-3 mb-1">{children}</h3>,
                  }}
                >{aiText}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
