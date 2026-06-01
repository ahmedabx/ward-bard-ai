import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, ChevronDown, Loader2 } from 'lucide-react';

interface PubMedResult {
  pmid: string;
  title: string;
  authorLine: string;
  journal: string;
  year: string;
  url: string;
}

const FILLER_PATTERNS = [
  /\b(what|which|who|when|where|why|how)(\s+(is|are|was|were|do|does|did|can|could|should|would|will))?\b/gi,
  /\b(can you|could you|please|kindly|tell me|explain|describe|give me|show me|i (?:want|need|would like) to (?:know|understand|learn))\b/gi,
  /\b(about|regarding|concerning|in (?:terms|relation) of)\b/gi,
  /\b(a|an|the|of|for|to|in|on|with|by|from)\b/gi,
];

function cleanQuery(raw: string): string {
  let q = raw.toLowerCase().replace(/[?!.,;:'"`]/g, ' ');
  for (const p of FILLER_PATTERNS) q = q.replace(p, ' ');
  q = q.replace(/\s+/g, ' ').trim();
  return q.length < 3 ? raw.trim() : q;
}

async function searchPubMed(query: string): Promise<PubMedResult[]> {
  const term = encodeURIComponent(cleanQuery(query));
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${term}&retmax=3&sort=relevance&retmode=json`;
  const searchResp = await fetch(searchUrl);
  if (!searchResp.ok) return [];
  const searchData = await searchResp.json();
  const ids: string[] = searchData?.esearchresult?.idlist ?? [];
  if (!ids.length) return [];

  const sumUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
  const sumResp = await fetch(sumUrl);
  if (!sumResp.ok) return [];
  const sumData = await sumResp.json();
  const result = sumData?.result;
  if (!result) return [];

  return ids
    .map((pmid): PubMedResult | null => {
      const r = result[pmid];
      if (!r) return null;
      const authors = Array.isArray(r.authors) ? r.authors : [];
      const firstAuthor = authors[0]?.name || 'Unknown';
      const authorLine = authors.length > 1 ? `${firstAuthor} et al.` : firstAuthor;
      const pubdate: string = r.pubdate || '';
      const year = (pubdate.match(/\d{4}/) || [''])[0];
      return {
        pmid,
        title: r.title || 'Untitled',
        authorLine,
        journal: r.fulljournalname || r.source || '',
        year,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      };
    })
    .filter((x): x is PubMedResult => x !== null);
}

export function PubMedEvidence({ query }: { query: string }) {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<PubMedResult[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchPubMed(query)
      .then((r) => { if (!cancelled) setResults(r); })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);

  if (!loading && results.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/40 text-primary hover:bg-primary/10 transition-colors duration-150 disabled:opacity-70"
        style={{ fontSize: '11px' }}
      >
        {loading ? <Loader2 size={11} className="animate-spin" /> : <BookOpen size={11} />}
        <span>
          {loading ? 'Evidence' : `Evidence · ${results.length}`}
        </span>
        {!loading && (
          <ChevronDown
            size={11}
            className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && !loading && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <ul className="mt-2 space-y-1.5">
              {results.map((r) => (
                <li
                  key={r.pmid}
                  className="p-2.5 rounded-lg"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '0.5px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[13px] leading-snug text-foreground hover:text-primary transition-colors duration-150 line-clamp-2"
                  >
                    {r.title}
                  </a>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {r.authorLine}
                    {r.journal && <> · <span className="italic">{r.journal}</span></>}
                    {r.year && <> · {r.year}</>}
                  </p>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
