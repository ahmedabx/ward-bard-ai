import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

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

async function fetchIds(term: string, withDate: boolean): Promise<string[]> {
  const dateParams = withDate
    ? `&datetype=pdat&mindate=2022/01/01&maxdate=2026/12/31`
    : '';
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(term)}&retmax=3&sort=pub+date${dateParams}&retmode=json`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = await resp.json();
  return data?.esearchresult?.idlist ?? [];
}

async function searchPubMed(query: string): Promise<PubMedResult[]> {
  const cleaned = cleanQuery(query);
  const attempts: Array<[string, boolean]> = [
    [`${cleaned} guidelines`, true],
    [`${cleaned} guideline`, false],
    [`${cleaned} review`, true],
    [cleaned, true],
    [cleaned, false],
  ];
  let ids: string[] = [];
  for (const [term, withDate] of attempts) {
    ids = await fetchIds(term, withDate);
    if (ids.length) break;
  }
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
