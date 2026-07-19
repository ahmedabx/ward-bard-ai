import { AppLayout } from '@/components/AppLayout';
import { FileQuestion } from 'lucide-react';

export default function QbankMaker() {
  return (
    <AppLayout>
      <div className="h-full flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="inline-flex items-center justify-center mb-5" style={{
            width: 44, height: 44, borderRadius: 8,
            background: 'hsl(var(--primary) / 0.1)',
          }}>
            <FileQuestion size={20} style={{ color: 'hsl(var(--primary))' }} />
          </div>
          <h1 className="font-serif-display text-2xl text-foreground mb-2">Qbank Maker</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Topic-driven MCQ generator for exam preparation. This feature is being set up —
            the generation backend and question schema will be wired in the next phase.
          </p>
          <p className="mt-4 text-[11px] text-muted-foreground/70 uppercase tracking-wider">
            Coming next
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
