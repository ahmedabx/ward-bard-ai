import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

interface PubMedResult {
  pmid: string;
  title: string;
  authorLine: string;
  journal: string;
  year: string;
  url: string;
}

async function searchPubMed(query: string): Promise<PubMedResult[]> {
  const { data, error } = await supabase.functions.invoke('pubmed-search', {
    body: { query },
  });
  if (error || !data?.results) return [];
  return data.results as PubMedResult[];
}

export function PubMedEvidence({ query }: { query: string }) {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<PubMedResult[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchPubMed(query)
      .then((r) => { if (!cancelled) setResults(r); })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);

  if (loading) {
    return (
      <div className="mt-5">
        <h2 className="text-base font-semibold font-['Plus_Jakarta_Sans',sans-serif] text-foreground mb-2">
          Latest Evidence
        </h2>
        <div className="space-y-1.5">
          <div className="h-3 w-2/3 rounded bg-primary/10 animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-primary/10 animate-pulse" />
        </div>
      </div>
    );
  }

  if (results.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mt-5"
    >
      <h2 className="text-base font-semibold font-['Plus_Jakarta_Sans',sans-serif] text-foreground mb-2">
        Latest Evidence
        <span className="ml-2 text-[10px] font-normal text-muted-foreground/70 uppercase tracking-wider">
          PubMed
        </span>
      </h2>
      <ul className="space-y-2 pl-1">
        {results.map((r) => (
          <li key={r.pmid} className="text-muted-foreground leading-relaxed flex gap-2">
            <span className="text-primary mt-0.5 shrink-0">•</span>
            <span className="flex-1">
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[0.9rem] text-foreground hover:text-primary transition-colors duration-150 underline-offset-2 hover:underline"
              >
                {r.title}
              </a>
              <span className="block text-[11px] text-muted-foreground/80 mt-0.5">
                {r.authorLine}
                {r.journal && <> · <span className="italic">{r.journal}</span></>}
                {r.year && <> · {r.year}</>}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
