import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronUp, Search, AlertTriangle } from 'lucide-react';
import { AppShell } from '@/components/AppShell';

interface Source {
  pmid: string;
  title: string;
  journal: string;
  year: string;
  firstAuthor: string;
  abstractText: string;
}

type Status = 'idle' | 'searching' | 'synthesizing' | 'done' | 'error';

export default function Literature() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setStatus('searching');
    setErrorMsg('');
    setSources([]);
    setSynthesis(null);
    try {
      const res = await fetch('/api/literature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      if (res.status === 429) {
        setStatus('error');
        setErrorMsg('Too many requests. Please try again shortly.');
        return;
      }
      if (!res.ok) {
        setStatus('error');
        setErrorMsg('Search failed. Try again.');
        return;
      }
      setStatus('synthesizing');
      const data = await res.json();
      if (data.message) {
        setStatus('error');
        setErrorMsg(data.message);
        return;
      }
      setSources(data.sources || []);
      setSynthesis(data.synthesis || null);
      setStatus('done');
    } catch {
      setStatus('error');
      setErrorMsg('Network error. Try again.');
    }
  };

  const renderSynthesis = (text: string) => {
    // Replace [PMID: 123] / PMID: 123 with clickable links
    return text.replace(/PMID:?\s*(\d+)/g, (_m, p) => `[PMID: ${p}](https://pubmed.ncbi.nlm.nih.gov/${p})`);
  };

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">Literature</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Search PubMed and get an AI synthesis of recent evidence.
          </p>

          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-2 mb-6">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter a clinical topic e.g. 'management of diabetic ketoacidosis'"
              className="flex-1 bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handleSearch}
              disabled={status === 'searching' || status === 'synthesizing'}
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm disabled:opacity-50 hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Search size={16} /> Search
            </button>
          </div>

          {/* Loading */}
          {(status === 'searching' || status === 'synthesizing') && (
            <div className="glass-card p-5 mb-4">
              <p className="text-sm text-muted-foreground">
                {status === 'searching' ? 'Searching PubMed...' : 'Synthesizing evidence...'}
              </p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="glass-card p-5 mb-4 border-destructive/30">
              <p className="text-sm text-destructive">{errorMsg}</p>
            </div>
          )}

          {/* Results */}
          {status === 'done' && (
            <div className="space-y-4">
              {/* Synthesis */}
              {synthesis ? (
                <div className="glass-card p-5 md:p-6 border border-primary/10">
                  <h2 className="font-heading text-base font-semibold text-foreground mb-3">
                    Evidence Synthesis
                  </h2>
                  <div className="ward-bard-response prose prose-invert max-w-none text-[0.9rem] leading-[1.8]">
                    <ReactMarkdown
                      components={{
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">
                            {children}
                          </a>
                        ),
                        p: ({ children }) => <p className="text-muted-foreground mb-3">{children}</p>,
                        strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
                        ul: ({ children }) => <ul className="space-y-1.5 mb-3 pl-4 list-disc">{children}</ul>,
                        li: ({ children }) => <li className="text-muted-foreground">{children}</li>,
                      }}
                    >
                      {renderSynthesis(synthesis)}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : sources.length > 0 ? (
                <div className="glass-card p-5 border-amber-500/30">
                  <p className="text-sm text-amber-300">
                    AI synthesis is unavailable. Showing raw sources below.
                  </p>
                </div>
              ) : null}

              {/* Amber notice */}
              {sources.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
                  <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-200/90">
                    Synthesis based on abstracts only. Full-text content not included. Cross-reference with local formulary and guidelines.
                  </p>
                </div>
              )}

              {/* Sources */}
              {sources.length > 0 && (
                <div className="glass-card overflow-hidden">
                  <button
                    onClick={() => setSourcesOpen((o) => !o)}
                    className="w-full flex items-center justify-between p-4 hover:bg-card/50 transition-colors"
                  >
                    <span className="font-heading text-sm font-semibold text-foreground">
                      Sources ({sources.length})
                    </span>
                    {sourcesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <AnimatePresence>
                    {sourcesOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 pt-0 space-y-3">
                          {sources.map((s) => (
                            <div key={s.pmid} className="rounded-lg border border-border/50 p-3 bg-card/30">
                              <a
                                href={`https://pubmed.ncbi.nlm.nih.gov/${s.pmid}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm font-medium text-foreground hover:text-primary"
                              >
                                {s.title}
                              </a>
                              <p className="text-xs text-muted-foreground mt-1">
                                {s.firstAuthor} et al. · {s.journal} · {s.year} · PMID {s.pmid}
                              </p>
                              <p className="text-xs text-muted-foreground/80 mt-2 line-clamp-3">
                                {s.abstractText}
                              </p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground/60 italic text-center pt-2">
                ⚠️ For educational purposes only. Verify with clinical judgment and local guidelines.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
