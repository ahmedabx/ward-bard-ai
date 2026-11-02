import { useEffect, ReactNode } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';

const HAIRLINE = '0.5px solid hsl(var(--hairline) / var(--hairline-alpha))';

export interface QuestionOption {
  key: string;          // "A".."E" for MCQs, "0".."n" for case checkpoints
  text: string;
}

interface PracticeQuestionProps {
  variant: 'mcq' | 'checkpoint';
  stem: string;
  options: QuestionOption[];
  correctKey?: string | null;   // MCQ only: revealed after lock
  selectedKey: string | null;
  locked: boolean;
  onChoose: (key: string) => void;
  onConfirm: () => void;
  onNext: () => void;
  confirmLabel?: string;
  nextLabel?: string;
  isLast?: boolean;
  /** Explanation / feedback area rendered after the answer is locked. */
  feedback?: ReactNode;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * One MCQ component, two uses: Questions format (single vignette MCQs) and
 * stage checkpoints inside Cases. Flat rows, 0.5px hairline borders, teal
 * selection. Keyboard: 1–8 select, Enter confirms or advances.
 */
export default function PracticeQuestion({
  variant, stem, options, correctKey, selectedKey, locked,
  onChoose, onConfirm, onNext, confirmLabel = 'Confirm', nextLabel = 'Next',
  isLast = false, feedback,
}: PracticeQuestionProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const num = Number(e.key);
      if (!Number.isNaN(num) && num >= 1 && num <= options.length && !locked) {
        e.preventDefault();
        onChoose(options[num - 1].key);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!locked && selectedKey) onConfirm();
        else if (locked) onNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [options, locked, selectedKey, onChoose, onConfirm, onNext]);

  const showCorrect = locked && variant === 'mcq' && !!correctKey;

  return (
    <div className="space-y-4">
      <p className="text-[14px] leading-relaxed text-foreground/95 whitespace-pre-line px-0.5">{stem}</p>

      <div className="space-y-2">
        {options.map((opt, i) => {
          const isSelected = selectedKey === opt.key;
          const revealCorrect = showCorrect && correctKey === opt.key;
          const revealWrong = locked && isSelected && variant === 'mcq' && correctKey !== opt.key;
          const borderStyle = revealCorrect
            ? { border: '1px solid hsl(var(--primary) / 0.6)', background: 'hsl(var(--primary) / 0.08)' }
            : isSelected
            ? { border: '1px solid hsl(var(--primary) / 0.55)', background: 'transparent' }
            : undefined;
          return (
            <button
              key={opt.key}
              disabled={locked}
              onClick={() => onChoose(opt.key)}
              aria-pressed={isSelected}
              className={`w-full flex items-start gap-3 text-left min-h-[44px] px-3.5 py-2.5 rounded-lg text-[14px] transition-colors ${
                locked ? 'cursor-default' : 'hover:bg-foreground/[0.03]'
              }`}
              style={{
                border: borderStyle?.border ?? HAIRLINE,
                background: borderStyle?.background ?? 'transparent',
                ...(revealWrong ? { border: '1px solid hsl(var(--destructive) / 0.5)', background: 'hsl(var(--destructive) / 0.07)' } : {}),
              }}
            >
              <span
                className="text-[11px] font-semibold mt-0.5 w-4 shrink-0 text-muted-foreground"
                aria-hidden
              >
                {variant === 'mcq' ? opt.key : i + 1}
              </span>
              <span className="leading-snug text-foreground/90 flex-1">{opt.text}</span>
              {revealCorrect && <Check size={14} className="mt-0.5 shrink-0" style={{ color: 'hsl(var(--primary))' }} />}
              {revealWrong && <span className="text-[10px] text-destructive mt-1 shrink-0">Your answer</span>}
            </button>
          );
        })}
      </div>

      {locked && feedback}

      {!locked ? (
        <div className="sticky bottom-0 py-3 flex justify-end" style={{ background: 'hsl(var(--surface-main))', borderTop: HAIRLINE }}>
          <button
            disabled={!selectedKey}
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium disabled:opacity-30 hover:opacity-90 transition"
          >
            {confirmLabel}
          </button>
        </div>
      ) : (
        <div className="sticky bottom-0 py-3 flex justify-end" style={{ background: 'hsl(var(--surface-main))', borderTop: HAIRLINE }}>
          <button
            onClick={onNext}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90 transition"
          >
            {isLast ? 'Finish' : nextLabel}
          </button>
        </div>
      )}
    </div>
  );
}

/** Collapsed reveal row, e.g. "Why the others are wrong". */
export function CollapsedReveal({ title, children }: { title: string; children: ReactNode }) {
  let open = false;
  return (
    <details className="group rounded-lg" style={{ border: HAIRLINE }}>
      <summary
        className="flex items-center gap-2 px-3 py-2.5 min-h-[44px] cursor-pointer list-none text-[12.5px] text-muted-foreground hover:text-foreground transition-colors [&::-webkit-details-marker]:hidden"
      >
        <ChevronRight size={13} className="group-open:hidden" />
        <ChevronDown size={13} className="hidden group-open:block" />
        {title}
      </summary>
      <div className="px-3 pb-3 text-[13px] leading-relaxed text-foreground/85">{children}</div>
    </details>
  );
}
