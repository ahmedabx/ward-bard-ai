import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const stored = sessionStorage.getItem('medbard.postAuthPath');
    const next = stored && stored.startsWith('/') && !stored.startsWith('//') ? stored : '/chat';

    const finish = () => {
      sessionStorage.removeItem('medbard.postAuthPath');
      navigate(next, { replace: true });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled && session) finish();
    });

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error) {
        console.error('Auth callback error:', error);
        setError(error.message);
        return;
      }
      if (data.session) finish();
    })();

    const timeout = window.setTimeout(() => {
      if (!cancelled) navigate('/login', { replace: true });
    }, 8000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-3 px-6"
      style={{ background: 'hsl(var(--surface-main))' }}
    >
      <Loader2 size={20} className="animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {error ? error : 'Signing you in\u2026'}
      </p>
    </div>
  );
}
