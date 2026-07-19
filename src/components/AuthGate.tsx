import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { MedBardMark } from './MedBardLogo';

interface AuthGateProps {
  children: ReactNode;
  /** If true, redirects to /chat when a session already exists (for /login). */
  invert?: boolean;
}

export function AuthGate({ children, invert }: AuthGateProps) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const location = useLocation();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(var(--surface-main))' }}>
        <div className="opacity-70 animate-pulse">
          <MedBardMark size={32} />
        </div>
      </div>
    );
  }

  if (invert && session) return <Navigate to="/chat" replace />;
  if (!invert && !session) {
    const next = location.pathname + location.search;
    return <Navigate to={`/login${next && next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} replace />;
  }
  return <>{children}</>;
}
