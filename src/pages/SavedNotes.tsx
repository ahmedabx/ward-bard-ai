import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { WardBardLogo } from '@/components/WardBardLogo';
import { ArrowLeft, Search, Trash2 } from 'lucide-react';
import { specialties, type Specialty } from '@/lib/specialties';
import { useState } from 'react';
import type { SavedNote } from '@/hooks/use-chat';

interface SavedNotesPageProps {
  notes: SavedNote[];
  onRemove: (id: string) => void;
}

// This will be used as a routed component receiving props via context
export default function SavedNotesPage() {
  const navigate = useNavigate();
  // In this session-based approach, notes would come from parent context
  // For now, showing the UI structure
  const [search, setSearch] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState<Specialty>('all');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3 flex items-center gap-4">
        <button onClick={() => navigate('/chat')} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors duration-150">
          <ArrowLeft size={20} />
        </button>
        <WardBardLogo size="sm" />
        <h1 className="font-heading font-semibold text-foreground">Saved Notes</h1>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary transition-all duration-150"
            />
          </div>
          <div className="flex gap-1.5">
            {specialties.map(s => (
              <button
                key={s.id}
                onClick={() => setFilterSpecialty(s.id)}
                className={`text-xs px-2.5 py-1.5 rounded-full transition-all duration-150 font-medium
                  ${filterSpecialty === s.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
              >
                {s.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Empty state */}
        <div className="text-center py-20">
          <p className="text-muted-foreground">No saved notes yet.</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Save responses from chat to review them here.</p>
        </div>
      </div>
    </div>
  );
}
