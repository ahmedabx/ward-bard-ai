import { useMemo } from 'react';
import { ShieldCheck, ShieldAlert, Shield, ExternalLink } from 'lucide-react';
import { assessConfidence, type RawSource, type ConfidenceLevel } from '@/lib/confidence';

interface Props {
  query: string;
  answer: string;
  /** Ranked sources returned with this answer; numbering matches inline [n] markers. */
  sources: RawSource[];
  retrievalFailed?: boolean;
  isStreaming?: boolean;
  /** Prefix used to build stable anchor ids so inline [n] chips can jump here. */
  anchorPrefix: string;
}

const levelStyles: Record<ConfidenceLevel, { color: string; Icon: typeof Shield }> = {
  high:     { color: 'text-primary/80',              Icon: ShieldCheck },
  moderate: { color: 'text-muted-foreground',        Icon: Shield },
  low:      { color: 'text-muted-foreground/70',     Icon: ShieldAlert },
};

const HAIRLINE = '0.5px solid hsl(var(--hairline) / var(--hairline-alpha))';

export function AssistantConfidence({
  query,
  answer,
  sources,
  retrievalFailed,
  isStreaming,
  anchorPrefix,
}: Props) {
  const assessment = useMemo(
    () => assessConfidence(query, answer, sources),
    [query, answer, sources],
  );

  if (isStreaming || answer.trim().length < 20) return null;

  const { level, label } = assessment;
  const { color, Icon } = levelStyles[level];
  // Render exactly the ranked sources sent with the answer, so the list numbering
  // matches the inline [n] markers the model wrote.
  const relevantSources = sources;
  const failed = Boolean(retrievalFailed);
  const hasCitations = relevantSources.length > 0;

  return (
    <div className="mt-6 pt-4" style={{ borderTop: HAIRLINE }}>
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] ${color}`}>
          <Icon size={11} strokeWidth={2} />
          {label}
        </span>
        {hasCitations && (
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
            {relevantSources.length} source{relevantSources.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {!hasCitations && (
        <p className="mt-2 text-[11.5px] text-muted-foreground/70 leading-relaxed">
          {failed
            ? 'Evidence lookup unavailable — this answer draws on general medical knowledge.'
            : 'No current guideline matched this query — this answer draws on general medical knowledge.'}
        </p>
      )}

      {hasCitations && (
        <ol className="mt-3 space-y-1.5" aria-label="Sources for this response">
          {relevantSources.map((r, i) => (
            <li key={r.pmid}>
              <a
                id={`${anchorPrefix}-src-${i + 1}`}
                href={r.url || `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Source ${i + 1}: ${r.title} on PubMed (opens in a new tab)`}
                className="source-card group flex gap-3 rounded-md px-3 py-2.5 min-h-[44px] items-start no-underline focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                style={{ border: HAIRLINE, borderLeft: '2px solid transparent' }}
              >
                <span className="mt-[1px] text-[10px] tabular-nums text-primary/80 shrink-0 w-4">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] leading-snug text-foreground/90 group-hover:text-foreground">
                    {r.title}
                  </span>
                  <span className="mt-1 block text-[10.5px] text-muted-foreground/70">
                    {r.journal && <span className="italic">{r.journal}</span>}
                    {r.journal && r.year ? ' · ' : ''}
                    {r.year}
                    <span className="ml-1 text-muted-foreground/50">· PubMed</span>
                  </span>
                </span>
                <ExternalLink
                  size={12}
                  aria-hidden
                  className="mt-0.5 shrink-0 text-muted-foreground/40 group-hover:text-primary"
                />
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
