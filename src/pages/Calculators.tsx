import { useEffect, useMemo, useState } from 'react';
import { Search, RotateCcw, ChevronDown, ChevronLeft } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import {
  calculators,
  Calculator,
  CalcResult,
  SPECIALTIES,
  Specialty,
} from '@/lib/calculators';

const RISK_STYLE: Record<
  CalcResult['risk'],
  { bg: string; border: string; text: string; label: string }
> = {
  low:      { bg: 'hsl(var(--primary) / 0.10)',  border: 'hsl(var(--primary) / 0.35)',  text: 'hsl(var(--primary))', label: 'Low' },
  moderate: { bg: 'rgba(245,180,75,0.10)',  border: 'rgba(245,180,75,0.35)',  text: '#d99a2b', label: 'Moderate' },
  high:     { bg: 'rgba(235,90,90,0.10)',   border: 'rgba(235,90,90,0.35)',   text: '#d94a4a', label: 'High' },
};

const HAIRLINE = '0.5px solid hsl(var(--hairline) / var(--hairline-alpha))';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export default function Calculators() {
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Collapsed sections. Default: mobile all collapsed, desktop all expanded.
  const [collapsed, setCollapsed] = useState<Record<Specialty, boolean>>(() => {
    const initial = {} as Record<Specialty, boolean>;
    for (const s of SPECIALTIES) initial[s] = false;
    return initial;
  });
  // When mobile state resolves, sync defaults (only once per mode change).
  useEffect(() => {
    setCollapsed(() => {
      const next = {} as Record<Specialty, boolean>;
      for (const s of SPECIALTIES) next[s] = isMobile;
      return next;
    });
  }, [isMobile]);

  const q = query.trim().toLowerCase();

  const grouped = useMemo(() => {
    const map = new Map<Specialty, Calculator[]>();
    for (const s of SPECIALTIES) map.set(s, []);
    for (const c of calculators) {
      if (q && !`${c.name} ${c.specialty} ${c.description}`.toLowerCase().includes(q)) continue;
      map.get(c.specialty)?.push(c);
    }
    return map;
  }, [q]);

  // While searching, force-expand any section with a match.
  const effectiveCollapsed = useMemo(() => {
    if (!q) return collapsed;
    const next = { ...collapsed };
    for (const s of SPECIALTIES) if ((grouped.get(s)?.length ?? 0) > 0) next[s] = false;
    return next;
  }, [collapsed, grouped, q]);

  const active = activeId ? calculators.find((c) => c.id === activeId) ?? null : null;
  const totalMatches = Array.from(grouped.values()).reduce((n, list) => n + list.length, 0);

  const toggle = (s: Specialty) =>
    setCollapsed((prev) => ({ ...prev, [s]: !prev[s] }));

  // Mobile: show either list or detail. Desktop: side-by-side.
  const showList = !isMobile || !active;
  const showDetail = !isMobile || !!active;

  return (
    <AppLayout>
      <div className="h-full flex flex-col md:flex-row min-h-0">
        {/* LEFT — grouped list */}
        {showList && (
          <div
            className="w-full md:w-[340px] md:flex-shrink-0 flex flex-col min-h-0"
            style={{ borderRight: isMobile ? 'none' : HAIRLINE, background: 'hsl(var(--surface-sidebar))' }}
          >
            <div className="p-3 flex-shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground/40" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search calculators…"
                  className="w-full bg-background text-foreground text-sm md:text-xs pl-8 pr-3 py-2.5 md:py-2 rounded-md outline-none focus:ring-1 focus:ring-primary/50"
                  style={{ border: HAIRLINE }}
                />
              </div>
            </div>

            <div style={{ borderTop: HAIRLINE }} />

            <div className="flex-1 overflow-y-auto p-2">
              {totalMatches === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-6 text-center">
                  No calculators match "{query}".
                </p>
              )}

              {SPECIALTIES.map((s) => {
                const items = grouped.get(s) ?? [];
                if (items.length === 0) return null;
                const isCollapsed = effectiveCollapsed[s];
                return (
                  <div key={s} className="mb-1">
                    <button
                      onClick={() => toggle(s)}
                      className="w-full flex items-center justify-between gap-2 px-3 min-h-[44px] rounded-md hover:bg-foreground/[0.04] transition-colors"
                    >
                      <span
                        className="font-serif-display text-[15px] tracking-tight text-foreground/90 text-left"
                      >
                        {s}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-foreground/40 tabular-nums">
                          {items.length}
                        </span>
                        <ChevronDown
                          size={14}
                          className="text-foreground/50 transition-transform"
                          style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                        />
                      </span>
                    </button>

                    {!isCollapsed && (
                      <div className="mt-1 mb-2 space-y-1">
                        {items.map((c) => {
                          const on = c.id === activeId;
                          return (
                            <button
                              key={c.id}
                              onClick={() => setActiveId(c.id)}
                              className="w-full text-left px-3 py-3 md:py-2.5 rounded-md transition-colors"
                              style={{
                                background: on ? 'hsl(var(--primary) / 0.08)' : 'transparent',
                                border: `0.5px solid ${on ? 'hsl(var(--primary) / 0.30)' : 'hsl(var(--hairline) / var(--hairline-alpha))'}`,
                                minHeight: 44,
                              }}
                            >
                              <p
                                className="text-[13px] font-medium break-words"
                                style={{ color: on ? 'hsl(var(--primary))' : 'hsl(var(--foreground))' }}
                              >
                                {c.name}
                              </p>
                              <p className="text-[11px] text-foreground/50 mt-0.5 leading-snug break-words">
                                {c.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* RIGHT — active calculator */}
        {showDetail && (
          <div className="flex-1 overflow-y-auto min-w-0">
            {isMobile && active && (
              <button
                onClick={() => setActiveId(null)}
                className="flex items-center gap-1.5 text-sm text-foreground/70 hover:text-foreground px-4 py-3"
                style={{ borderBottom: HAIRLINE, minHeight: 44 }}
              >
                <ChevronLeft size={16} /> All calculators
              </button>
            )}
            {active ? (
              <CalculatorPanel key={active.id} calc={active} />
            ) : (
              <div className="hidden md:flex h-full items-center justify-center p-8">
                <p className="text-sm text-foreground/45 text-center max-w-xs">
                  Select a calculator to get started.
                </p>
              </div>
            )}
          </div>
        )}
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
              background: 'hsl(var(--primary) / 0.10)',
              color: 'hsl(var(--primary))',
              border: '0.5px solid hsl(var(--primary) / 0.3)',
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
          className="px-5 py-2 rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Calculate
        </button>
        <button
          onClick={reset}
          className="px-3 py-2 rounded-md text-xs flex items-center gap-1.5 text-foreground/60 hover:text-foreground transition-colors"
          style={{ border: HAIRLINE }}
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
        {error && <span className="text-[10px] text-destructive">{error}</span>}
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
            className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md outline-none focus:ring-1 focus:ring-primary/50"
            style={{ border: `0.5px solid ${error ? 'hsl(var(--destructive) / 0.5)' : 'hsl(var(--border))'}` }}
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
          className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md outline-none focus:ring-1 focus:ring-primary/50"
          style={{ border: `0.5px solid ${error ? 'hsl(var(--destructive) / 0.5)' : 'hsl(var(--border))'}` }}
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
            style={{ background: 'hsl(var(--foreground) / 0.06)', color: s.text, border: `0.5px solid ${s.border}` }}
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
