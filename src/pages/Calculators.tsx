import { useMemo, useState } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import {
  calculators,
  Calculator,
  CalcResult,
  SPECIALTIES,
  Specialty,
} from '@/lib/calculators';

type Filter = 'All' | Specialty;
const FILTERS: Filter[] = ['All', ...SPECIALTIES];

const RISK_STYLE: Record<
  CalcResult['risk'],
  { bg: string; border: string; text: string; label: string }
> = {
  low:      { bg: 'rgba(30,185,140,0.10)',  border: 'rgba(30,185,140,0.35)',  text: '#1eb98c', label: 'Low' },
  moderate: { bg: 'rgba(245,180,75,0.10)',  border: 'rgba(245,180,75,0.35)',  text: '#f5b44b', label: 'Moderate' },
  high:     { bg: 'rgba(235,90,90,0.10)',   border: 'rgba(235,90,90,0.35)',   text: '#eb5a5a', label: 'High' },
};

export default function Calculators() {
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string>(calculators[0].id);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return calculators.filter((c) => {
      if (filter !== 'All' && c.specialty !== filter) return false;
      if (q && !`${c.name} ${c.specialty} ${c.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [filter, query]);

  const active = calculators.find((c) => c.id === activeId) ?? filtered[0];

  return (
    <AppLayout>
      <div className="h-full flex min-h-0">
        {/* LEFT PANEL — search + filter + list */}
        <div
          className="w-[320px] flex-shrink-0 flex flex-col min-h-0"
          style={{ borderRight: '0.5px solid rgba(255,255,255,0.06)', background: '#0a0d12' }}
        >
          <div className="p-3 flex-shrink-0 space-y-3">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search calculators…"
                className="w-full bg-[#0f1117] text-foreground text-xs pl-8 pr-3 py-2 rounded-md outline-none focus:ring-1 focus:ring-[#1eb98c]/50"
                style={{ border: '0.5px solid rgba(255,255,255,0.08)' }}
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
              {FILTERS.map((f) => {
                const on = filter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="whitespace-nowrap text-[10.5px] px-2.5 py-1 rounded-full transition-colors"
                    style={{
                      background: on ? 'rgba(30,185,140,0.14)' : 'transparent',
                      color: on ? '#1eb98c' : 'rgba(255,255,255,0.55)',
                      border: `0.5px solid ${on ? 'rgba(30,185,140,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-3">No calculators match.</p>
            )}
            {filtered.map((c) => {
              const on = c.id === active?.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className="w-full text-left px-3 py-2.5 rounded-md transition-colors"
                  style={{
                    background: on ? 'rgba(30,185,140,0.08)' : 'transparent',
                    border: `0.5px solid ${on ? 'rgba(30,185,140,0.30)' : 'rgba(255,255,255,0.04)'}`,
                  }}
                  onMouseEnter={(e) => {
                    if (!on) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)';
                  }}
                  onMouseLeave={(e) => {
                    if (!on) (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[12.5px] font-medium truncate"
                        style={{ color: on ? '#1eb98c' : 'rgba(255,255,255,0.92)' }}
                      >
                        {c.name}
                      </p>
                      <p className="text-[10.5px] text-foreground/45 mt-0.5 line-clamp-2 leading-snug">
                        {c.description}
                      </p>
                    </div>
                    <span
                      className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        color: 'rgba(255,255,255,0.45)',
                        border: '0.5px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      {c.specialty.split('/')[0].slice(0, 5)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANEL — active calculator */}
        <div className="flex-1 overflow-y-auto min-w-0">
          {active && <CalculatorPanel key={active.id} calc={active} />}
        </div>
      </div>
    </AppLayout>
  );
}

function CalculatorPanel({ calc }: { calc: Calculator }) {
  const [values, setValues] = useState<Record<string, number | undefined>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CalcResult | null>(null);

  const setField = (id: string, v: number | undefined) => {
    setValues((prev) => ({ ...prev, [id]: v }));
    if (errors[id]) setErrors((e) => { const n = { ...e }; delete n[id]; return n; });
  };

  const reset = () => { setValues({}); setErrors({}); setResult(null); };

  const calculate = () => {
    const errs: Record<string, string> = {};
    const payload: Record<string, number> = {};
    for (const f of calc.fields) {
      const v = values[f.id];
      if (v === undefined || Number.isNaN(v)) {
        errs[f.id] = 'Required';
        continue;
      }
      if (f.type === 'number') {
        if (f.min !== undefined && v < f.min) errs[f.id] = `Min ${f.min}`;
        if (f.max !== undefined && v > f.max) errs[f.id] = `Max ${f.max}`;
      }
      payload[f.id] = v;
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setResult(calc.compute(payload));
  };

  // Group fields by section
  const sections = useMemo(() => {
    const groups: { name: string | null; fields: typeof calc.fields }[] = [];
    for (const f of calc.fields) {
      const key = f.section ?? null;
      const last = groups[groups.length - 1];
      if (last && last.name === key) last.fields.push(f);
      else groups.push({ name: key, fields: [f] });
    }
    return groups;
  }, [calc]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-6">
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded"
            style={{
              background: 'rgba(30,185,140,0.10)',
              color: '#1eb98c',
              border: '0.5px solid rgba(30,185,140,0.3)',
            }}
          >
            {calc.specialty}
          </span>
        </div>
        <h2 className="font-serif-display text-2xl text-foreground">{calc.name}</h2>
        <p className="text-sm text-foreground/55 mt-1">{calc.description}</p>
      </div>

      <div className="space-y-5">
        {sections.map((g, gi) => (
          <div key={gi} className="space-y-3">
            {g.name && (
              <p className="text-[10px] uppercase tracking-[0.12em] text-foreground/45 pt-1">
                {g.name}
              </p>
            )}
            {g.fields.map((f) => (
              <FieldRow
                key={f.id}
                field={f}
                value={values[f.id]}
                error={errors[f.id]}
                onChange={(v) => setField(f.id, v)}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-6">
        <button
          onClick={calculate}
          className="px-5 py-2 rounded-md text-sm font-medium transition-colors"
          style={{
            background: '#1eb98c',
            color: '#06231a',
          }}
        >
          Calculate
        </button>
        <button
          onClick={reset}
          className="px-3 py-2 rounded-md text-xs flex items-center gap-1.5 text-foreground/60 hover:text-foreground transition-colors"
          style={{ border: '0.5px solid rgba(255,255,255,0.10)' }}
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      {result && <ResultCard result={result} />}
    </div>
  );
}

function FieldRow({
  field, value, error, onChange,
}: {
  field: Calculator['fields'][number];
  value: number | undefined;
  error?: string;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-xs text-foreground/70">{field.label}</label>
        {error && <span className="text-[10px] text-[#eb5a5a]">{error}</span>}
      </div>
      {field.type === 'number' ? (
        <div className="relative">
          <input
            type="number"
            value={value ?? ''}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            placeholder={field.placeholder}
            onChange={(e) => {
              const t = e.target.value;
              onChange(t === '' ? undefined : Number(t));
            }}
            className="w-full bg-[#0a0d12] text-foreground text-sm px-3 py-2 rounded-md outline-none focus:ring-1 focus:ring-[#1eb98c]/50"
            style={{ border: `0.5px solid ${error ? 'rgba(235,90,90,0.5)' : 'rgba(255,255,255,0.10)'}` }}
          />
          {field.unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-foreground/40">
              {field.unit}
            </span>
          )}
        </div>
      ) : (
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          className="w-full bg-[#0a0d12] text-foreground text-sm px-3 py-2 rounded-md outline-none focus:ring-1 focus:ring-[#1eb98c]/50"
          style={{ border: `0.5px solid ${error ? 'rgba(235,90,90,0.5)' : 'rgba(255,255,255,0.10)'}` }}
        >
          <option value="" disabled>Select…</option>
          {field.options?.map((o, i) => (
            <option key={`${o.label}-${i}`} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </div>
  );
}

function ResultCard({ result }: { result: CalcResult }) {
  const s = RISK_STYLE[result.risk];
  return (
    <div
      className="mt-5 rounded-lg p-5"
      style={{ background: s.bg, border: `0.5px solid ${s.border}` }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-foreground/50 mb-1">Score</p>
          <p className="font-serif-display text-4xl" style={{ color: s.text }}>{result.score}</p>
        </div>
        <div className="text-right">
          <span
            className="inline-block text-[10px] uppercase tracking-wider px-2 py-1 rounded font-medium"
            style={{ background: 'rgba(0,0,0,0.25)', color: s.text, border: `0.5px solid ${s.border}` }}
          >
            {s.label} risk
          </span>
          <p className="text-sm text-foreground/85 mt-2">{result.category}</p>
        </div>
      </div>
      <p className="text-sm text-foreground/70 mt-3 leading-relaxed">{result.interpretation}</p>
    </div>
  );
}
