import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { MedBardLogo } from '@/components/MedBardLogo';

const HAIRLINE = '0.5px solid hsl(var(--hairline) / var(--hairline-alpha))';

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: 'hsl(var(--surface-main))' }}>
      <header
        className="px-5 h-14 flex items-center gap-4"
        style={{ borderBottom: HAIRLINE }}
      >
        <button
          onClick={() => navigate('/chat')}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <MedBardLogo size="sm" />
      </header>

      <div className="max-w-2xl mx-auto px-6 py-14 space-y-8">
        <div>
          <h1 className="font-serif-display text-3xl text-foreground mb-2">About MedBard</h1>
          <p className="text-sm text-muted-foreground">Reliable For High Stakes.</p>
        </div>

        <section className="space-y-3">
          <h2 className="font-serif-display text-lg text-foreground">What MedBard is</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            MedBard is a focused medical education and exam-preparation product for USMLE Step 1,
            USMLE Step 2 CK, MBBS, and FCPS study. It is intended for learning, question practice,
            and case simulation — not for real-world patient-care decisions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif-display text-lg text-foreground">Team</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            MedBard is built by a fourth-year medical student (Founder & CEO) and a software engineer
            (CTO and co-founder).
          </p>
        </section>
      </div>
    </div>
  );
}
