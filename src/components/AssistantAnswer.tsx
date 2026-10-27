import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { MessageSource } from '@/hooks/use-chat';

const HAIRLINE = '0.5px solid hsl(var(--hairline) / var(--hairline-alpha))';
const BODY_COLOR = '#e6e8ec';
const LABEL_COLOR = '#8b919c';

/** Section labels the model emits as bold standalone lines. */
const SECTION_LABELS = new Set([
  'core answer',
  'mechanism',
  'classic vignette clues',
  'look-alikes',
  'exam trap',
  'classic presentation',
  'next best step',
  'management',
]);

/** Turn bare `[1]` citation markers into markdown links pointing at the source rows. */
function linkifyCitations(text: string, anchorPrefix: string) {
  return text.replace(/(?<!\])\[(\d{1,2})\](?!\()/g, (_m, n) => `[\\[${n}\\]](#${anchorPrefix}-src-${n})`);
}

type Block = { kind: 'label'; text: string } | { kind: 'content'; text: string };

/**
 * Splits the answer into blocks: bold standalone section labels become label
 * blocks, everything else is a markdown content block.
 */
function parseBlocks(content: string): Block[] {
  return content
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .flatMap<Block>((b) => {
      const m = b.match(/^\*\*([^*]+?)\s*:?\*\*\s*([\s\S]*)$/);
      if (m && SECTION_LABELS.has(m[1].trim().toLowerCase())) {
        const blocks: Block[] = [{ kind: 'label', text: m[1].trim().replace(/:$/, '') }];
        const rest = m[2].trim();
        if (rest) blocks.push({ kind: 'content', text: rest });
        return blocks;
      }
      return [{ kind: 'content', text: b }];
    });
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div
      className="text-[12px] font-medium uppercase tracking-[0.06em] mt-7 mb-2 first:mt-0"
      style={{ color: LABEL_COLOR }}
    >
      {children}
    </div>
  );
}

interface CitationProps {
  n: number;
  label: string;
  source: MessageSource | undefined;
  anchorPrefix: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

/** Superscript-style inline citation numeral with a flat hover/click popover. */
function Citation({ n, label, source, anchorPrefix, open, onOpen, onClose }: CitationProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onDocPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // No source data for this number — fall back to scrolling to the sources list.
  if (!source) {
    return (
      <a
        href={`#${anchorPrefix}-src-${n}`}
        onClick={(e) => {
          e.preventDefault();
          const el = document.querySelector(`#${anchorPrefix}-src-${n}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
        className="citation-num"
        aria-label={`Source ${n}`}
      >
        {label}
      </a>
    );
  }

  const href = source.url || `https://pubmed.ncbi.nlm.nih.gov/${source.pmid}/`;

  return (
    <span
      ref={ref}
      className="relative inline-block"
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
    >
      <button
        type="button"
        onClick={onOpen}
        onFocus={onOpen}
        aria-label={`Source ${n}: ${source.title}`}
        aria-expanded={open}
        className="citation-num"
      >
        {label}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`Source ${n} details`}
          className="absolute left-1/2 -translate-x-1/2 top-full z-30 mt-2 w-64 p-3 text-left"
          style={{ background: 'hsl(var(--surface-rail))', border: HAIRLINE, borderRadius: 8 }}
        >
          <p className="text-[12.5px] leading-snug text-foreground/90">{source.title}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {[source.journal, source.year].filter(Boolean).join(' · ')}
          </p>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-[11px] text-primary hover:underline underline-offset-2"
          >
            View on PubMed
          </a>
        </div>
      )}
    </span>
  );
}

interface ContentProps {
  text: string;
  serif: boolean;
  sources: MessageSource[];
  anchorPrefix: string;
  openCit: number | null;
  setOpenCit: (n: number | null) => void;
}

function ContentBlock({ text, serif, sources, anchorPrefix, openCit, setOpenCit }: ContentProps) {
  const isExamVsPractice = text.startsWith('Exam vs practice');
  const md = linkifyCitations(text, anchorPrefix);

  const rendered = (
    <ReactMarkdown
      components={{
        p: ({ children }) => (
          <p
            className={
              serif
                ? 'mb-3 last:mb-0 font-serif-display text-[20px] leading-[1.4]'
                : 'mb-3 last:mb-0 leading-[1.7]'
            }
            style={{ color: BODY_COLOR }}
          >
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="mb-3 space-y-1.5 list-disc pl-5 marker:text-[#8b919c]/60">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 space-y-1.5 list-decimal pl-5 marker:text-[#8b919c]/60">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-[1.65]">{children}</li>,
        strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
        em: ({ children }) => <em className="text-foreground/80">{children}</em>,
        a: ({ children, href }) => {
          const m = typeof href === 'string' ? href.match(/-src-(\d+)$/) : null;
          if (m) {
            const n = Number(m[1]);
            return (
              <Citation
                n={n}
                label={String(children)}
                source={sources[n - 1]}
                anchorPrefix={anchorPrefix}
                open={openCit === n}
                onOpen={() => setOpenCit(n)}
                onClose={() => setOpenCit(null)}
              />
            );
          }
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary"
            >
              {children}
            </a>
          );
        },
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary/40 pl-4 my-3 text-muted-foreground">{children}</blockquote>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return (
              <code className={`block bg-card rounded-md p-3 my-3 text-[12.5px] font-mono overflow-x-auto ${className}`}>
                {children}
              </code>
            );
          }
          return (
            <code className="font-mono text-[13px] text-foreground bg-foreground/[0.06] px-1.5 py-0.5 rounded">
              {children}
            </code>
          );
        },
        hr: () => <hr className="border-0 my-6" style={{ borderTop: HAIRLINE }} />,
      }}
    >
      {md}
    </ReactMarkdown>
  );

  if (isExamVsPractice) {
    return (
      <div className="pl-3 mb-3" style={{ borderLeft: '0.5px solid hsl(var(--primary))' }}>
        {rendered}
      </div>
    );
  }
  return rendered;
}

interface AssistantAnswerProps {
  content: string;
  sources: MessageSource[];
  anchorPrefix: string;
}

export function AssistantAnswer({ content, sources, anchorPrefix }: AssistantAnswerProps) {
  const [openCit, setOpenCit] = useState<number | null>(null);
  const blocks = useMemo(() => parseBlocks(content), [content]);

  let prevLabel: string | null = null;

  return (
    <div className="max-w-none text-[15.5px] leading-[1.7]" style={{ color: BODY_COLOR }}>
      {blocks.map((b, i) => {
        if (b.kind === 'label') {
          prevLabel = b.text.toLowerCase();
          return <SectionLabel key={i}>{b.text}</SectionLabel>;
        }
        const serif = prevLabel === 'core answer';
        prevLabel = null;
        return (
          <ContentBlock
            key={i}
            text={b.text}
            serif={serif}
            sources={sources}
            anchorPrefix={anchorPrefix}
            openCit={openCit}
            setOpenCit={setOpenCit}
          />
        );
      })}
    </div>
  );
}
