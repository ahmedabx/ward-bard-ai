import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { WardBardLogo } from '@/components/WardBardLogo';
import { ArrowLeft, Search } from 'lucide-react';
import { useState } from 'react';

export default function SavedNotesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

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
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary transition-all duration-150"
            />
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
