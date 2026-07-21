import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ShieldCheck, ShieldAlert, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { assessConfidence, type RawSource, type ConfidenceLevel } from '@/lib/confidence';

interface Props {
  query: string;
  answer: string;
  isStreaming?: boolean;
}

async function searchPubMed(query: string): Promise<RawSource[]> {
  const { data, error } = await supabase.functions.invoke('pubmed-search', {
    body: { query },
  });
  if (error || !data?.results) return [];
  return data.results as RawSource[];
}

const levelStyles: Record<ConfidenceLevel, { color: string; Icon: typeof Shield }> = {
  high:     { color: 'text-primary/80',              Icon: ShieldCheck },
  moderate: { color: 'text-muted-foreground',        Icon: Shield },
  low:      { color: 'text-muted-foreground/70',     Icon: ShieldAlert },
};

export function AssistantConfidence({ query, answer, isStreaming }: Props) {
  const [sources, setSources] = useState<RawSource[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    searchPubMed(query)
      .then((r) => { if (!cancelled) setSources(r); })
      .catch(() => { if (!cancelled) setSources([]); })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [query]);

  const assessment = useMemo(
    () => assessConfidence(query, answer, sources),
    [query, answer, sources],
  );

  // Wait until streaming stops and retrieval resolves before rendering
  // anything — a flickering confidence tag would be worse than none.
  if (isStreaming || !ready || answer.trim().length < 20) return null;

  const { level, label, relevantSources } = assessment;
  const { color, Icon } = levelStyles[level];
  const hasCitations = relevantSources.length > 0;

  return (
    <div className="mt-4 pt-3 border-t border-border/30">
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider ${color}`}>
          <Icon size={11} strokeWidth={2} />
          {label}
        </span>

        {hasCitations && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 hover:text-foreground transition-colors duration-150"
          >
            {open ? 'Hide citations' : `View citations (${relevantSources.length})`}
            <ChevronDown
              size={11}
              className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && hasCitations && (
          <motion.ul
            key="citations"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-3 space-y-2 pl-1 overflow-hidden"
          >
            {relevantSources.map((r) => (
              <li key={r.pmid} className="text-muted-foreground/90 leading-relaxed flex gap-2">
                <span className="text-primary/60 mt-0.5 shrink-0 text-[10px]">•</span>
                <span className="flex-1">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] text-foreground/90 hover:text-primary transition-colors duration-150 underline-offset-2 hover:underline"
                  >
                    {r.title}
                  </a>
                  <span className="block text-[10px] text-muted-foreground/70 mt-0.5">
                    {r.authorLine}
                    {r.journal && <> · <span className="italic">{r.journal}</span></>}
                    {r.year && <> · {r.year}</>}
                    <span className="ml-1 text-muted-foreground/50">· PubMed</span>
                  </span>
                </span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
