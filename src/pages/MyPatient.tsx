import { AppShell } from '@/components/AppShell';
import { UserCircle } from 'lucide-react';

export default function MyPatient() {
  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto text-center pt-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-5">
            <UserCircle className="text-primary" size={28} />
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">My Patient</h1>
          <p className="text-muted-foreground">Coming soon.</p>
          <p className="text-sm text-muted-foreground/70 mt-2">
            Track and discuss your own patients with Ward Bard.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
