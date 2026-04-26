import { AppShell } from '@/components/AppShell';
import { CalendarDays } from 'lucide-react';

export default function Daily() {
  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto text-center pt-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-5">
            <CalendarDays className="text-primary" size={28} />
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">Daily</h1>
          <p className="text-muted-foreground">Coming soon.</p>
          <p className="text-sm text-muted-foreground/70 mt-2">
            Daily clinical learning prompts will land here.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
