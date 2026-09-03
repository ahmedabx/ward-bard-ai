import { useEffect, useState } from 'react';

const STORAGE_KEY = 'medbard.onboardingSeen';

const STEPS = [
  {
    title: 'My Assistant',
    body: 'Ask clinical questions and get evidence-grounded answers. Switch between Preclinical and Clinical modes next to the input to match your level of training.',
  },
  {
    title: 'My Patient',
    body: 'Work through a simulated case from History and Exam to Investigations, Diagnosis, and Management. Choose your specialty and make decisions step by step.',
  },
  {
    title: 'Qbank Maker',
    body: 'Generate MCQ practice questions on any topic. Set the difficulty and review explanations as you go.',
  },
  {
    title: 'Calculators',
    body: 'Access 32+ clinical calculators grouped by specialty. Search or browse to find the score you need.',
  },
];

export function OnboardingTour() {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setStep(0);
  }, []);

  if (step === null) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setStep(null);
  };

  const last = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label={`Welcome to MedBard, step ${step + 1} of ${STEPS.length}`}
    >
      <div
        className="w-full max-w-[380px] rounded-lg p-5"
        style={{
          background: 'hsl(var(--surface-main))',
          border: '0.5px solid hsl(var(--hairline) / var(--hairline-alpha))',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-serif-display text-[19px] text-foreground leading-tight">
            {current.title}
          </h2>
          <button
            onClick={dismiss}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors min-h-[44px] md:min-h-0 px-2 -mr-2 -mt-1"
          >
            Skip
          </button>
        </div>

        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{current.body}</p>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className="h-1 w-4 rounded-full"
                style={{
                  background:
                    i === step ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.12)',
                }}
              />
            ))}
          </div>
          <button
            onClick={() => (last ? dismiss() : setStep(s => (s ?? 0) + 1))}
            className="h-9 px-4 rounded-md text-[13px] font-medium text-primary-foreground transition-transform active:scale-[0.97]"
            style={{ background: 'hsl(var(--primary))' }}
          >
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
