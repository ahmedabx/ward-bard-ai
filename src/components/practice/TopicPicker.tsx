import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, X, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { PracticeFormat, TopicRow } from '@/lib/practice';

const HAIRLINE = '0.5px solid hsl(var(--hairline) / var(--hairline-alpha))';

interface TopicPickerProps {
  exam: string;
  mode: string;
  format: PracticeFormat;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  customTopic: string;
  setCustomTopic: (v: string) => void;
  customOpen: boolean;
  setCustomOpen: (v: boolean) => void;
}

/** Hierarchical Exam > System > Topic > Subtopic picker with live search. */
export default function TopicPicker({
  exam, mode, format, selectedIds, onToggle,
  customTopic, setCustomTopic, customOpen, setCustomOpen,
}: TopicPickerProps) {
  const [topics, setTopics] = useState<TopicRow[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [openSystems, setOpenSystems] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setTopics(null);
    setLoadErr(null);
    (async () => {
      const { data, error } = await supabase
        .from('topics')
        .select('id, exam, mode, system, name, parent_id, case_eligible, sort_order')
        .eq('exam', exam)
        .eq('mode', mode)
        .order('sort_order');
      if (cancelled) return;
      if (error) { setLoadErr('Could not load topics. Pull down to retry.'); return; }
      setTopics((data || []) as TopicRow[]);
    })();
    return () => { cancelled = true; };
  }, [exam, mode]);

  const caseOnly = format === 'cases';

  // Systems in seed order; a system row is any row whose parent_id is null.
  const systems = useMemo(() => {
    if (!topics) return [];
    const sys = topics.filter(t => t.parent_id === null);
    const byParent = new Map<string, TopicRow[]>();
    for (const t of topics) {
      if (t.parent_id === null) continue;
      const list = byParent.get(t.parent_id) || [];
      list.push(t);
      byParent.set(t.parent_id, list);
    }
    return sys.map(s => ({ system: s, children: byParent.get(s.id) || [] }));
  }, [topics]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return systems;
    return systems
      .map(({ system, children }) => {
        const matchSys = system.name.toLowerCase().includes(q);
        const kids = children.filter(
          c => c.name.toLowerCase().includes(q) ||
            (c.parent_id !== system.id && children.some(p => p.id === c.parent_id && p.name.toLowerCase().includes(q))),
        );
        return matchSys ? { system, children } : { system, children: kids };
      })
      .filter(({ system, children }) =>
        system.name.toLowerCase().includes(q) || children.length > 0);
  }, [systems, q]);

  const visibleWhenSearching = q.length > 0;
  const effectiveOpen = visibleWhenSearching
    ? new Set(filtered.map(({ system }) => system.id))
    : openSystems;

  const toggleSystem = (id: string) => {
    setOpenSystems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loadErr) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <Label />
          <button onClick={() => setLoadErr(null)} className="text-[11px] text-primary">Retry</button>
        </div>
        <p className="text-[12px] text-muted-foreground mt-2">{loadErr}</p>
      </div>
    );
  }

  if (!topics) {
    return (
      <div>
        <Label />
        <div className="mt-2 space-y-2" aria-label="Loading topics">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-10 rounded-md animate-pulse" style={{ background: 'hsl(var(--primary) / 0.08)' }} />
          ))}
        </div>
      </div>
    );
  }

  const selectedCount = selectedIds.size;

  return (
    <div>
      <Label count={selectedCount} />
      <div className="mt-2 relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search topics"
          aria-label="Search topics"
          className="w-full bg-transparent rounded-lg pl-9 pr-3 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none transition-colors"
          style={{ border: HAIRLINE }}
        />
      </div>

      <div className="mt-2 rounded-lg overflow-hidden" style={{ border: HAIRLINE }}>
        {filtered.length === 0 && (
          <p className="px-3 py-3 text-[12px] text-muted-foreground">No topics match “{query}”.</p>
        )}
        {filtered.map(({ system, children }) => {
          const open = effectiveOpen.has(system.id);
          const sysSelected = children.filter(c => selectedIds.has(c.id)).length;
          return (
            <div key={system.id} style={{ borderBottom: HAIRLINE }}>
              <button
                onClick={() => toggleSystem(system.id)}
                aria-expanded={open}
                className="w-full flex items-center gap-2 px-3 min-h-[44px] text-left hover:bg-foreground/[0.04] transition-colors"
              >
                {open ? <ChevronDown size={15} className="text-muted-foreground shrink-0" /> : <ChevronRight size={15} className="text-muted-foreground shrink-0" />}
                <span className="text-[14px] font-medium text-foreground flex-1 truncate">{system.name}</span>
                {sysSelected > 0 && (
                  <span className="text-[10.5px] px-1.5 py-0.5 rounded" style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}>
                    {sysSelected}
                  </span>
                )}
              </button>
              {open && (
                <div className="pb-1">
                  {children.length === 0 && (
                    <p className="px-3 py-1.5 text-[11.5px] text-muted-foreground/70">No topics</p>
                  )}
                  {children.map(child => {
                    const isSub = child.parent_id !== system.id;
                    const disabled = caseOnly && !child.case_eligible;
                    const checked = selectedIds.has(child.id);
                    return (
                      <button
                        key={child.id}
                        disabled={disabled}
                        onClick={() => onToggle(child.id)}
                        aria-pressed={checked}
                        className={`w-full flex items-center gap-2.5 px-3 ${isSub ? 'pl-9' : 'pl-6'} min-h-[44px] text-left transition-colors ${
                          disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-foreground/[0.04]'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded shrink-0 flex items-center justify-center transition-colors"
                          style={{
                            border: checked ? '1px solid hsl(var(--primary))' : '0.5px solid hsl(var(--muted-foreground) / 0.6)',
                            background: checked ? 'hsl(var(--primary))' : 'transparent',
                          }}
                        >
                          {checked && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                              <path d="M1.5 5.5L4 8L8.5 2.5" stroke="hsl(var(--surface-main))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span className={`text-[13.5px] flex-1 truncate ${checked ? 'text-foreground' : 'text-foreground/80'}`}>{child.name}</span>
                        {disabled && <span className="text-[10.5px] text-muted-foreground shrink-0">Not available as a case</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Custom topic — collapsed by default */}
        <div>
          <button
            onClick={() => setCustomOpen(!customOpen)}
            aria-expanded={customOpen}
            className="w-full flex items-center gap-2 px-3 min-h-[44px] text-left hover:bg-foreground/[0.04] transition-colors"
          >
            {customOpen ? <ChevronDown size={15} className="text-muted-foreground shrink-0" /> : <Plus size={15} className="text-muted-foreground shrink-0" />}
            <span className="text-[14px] font-medium text-foreground flex-1">Custom topic</span>
          </button>
          {customOpen && (
            <div className="px-3 pb-3 pt-1">
              <input
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="e.g. Acute coronary syndrome"
                maxLength={200}
                aria-label="Custom topic"
                className="w-full bg-transparent rounded-lg px-3 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none transition-colors"
                style={{ border: HAIRLINE }}
              />
              {customTopic.trim().length > 0 && (
                <button
                  onClick={() => { setCustomTopic(''); setCustomOpen(false); }}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <X size={12} /> Clear custom topic
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Label({ count }: { count?: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Topics</span>
      {typeof count === 'number' && count > 0 && (
        <span className="text-[10.5px] text-muted-foreground">{count} selected</span>
      )}
    </div>
  );
}
