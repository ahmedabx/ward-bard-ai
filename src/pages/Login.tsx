import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { lovable } from '@/integrations/lovable';
import { MedBardLogo } from '@/components/MedBardLogo';
import { Loader2 } from 'lucide-react';

const HAIRLINE = '0.5px solid hsl(var(--hairline) / var(--hairline-alpha))';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [params] = useSearchParams();
  const nextParam = params.get('next');
  const nextPath = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError(result.error.message || 'Sign in failed. Please try again.');
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      // Session set — navigate to intended destination or chat.
      window.location.href = nextPath ?? '/chat';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed.');
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'hsl(var(--surface-main))' }}
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <MedBardLogo size="lg" showWordmark tagline />
        </div>

        <div
          className="rounded-lg p-6"
          style={{ background: 'hsl(var(--card))', border: HAIRLINE }}
        >
          <h1 className="font-serif-display text-2xl text-foreground mb-2">Sign in</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            MedBard is a medical exam-preparation and study product for USMLE Step 1, Step 2 CK,
            MBBS, and FCPS. Sign in with your Google account to continue.
          </p>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 h-10 px-4 rounded-md bg-foreground text-background text-sm font-medium disabled:opacity-60 transition-opacity"
            style={{ borderRadius: 8 }}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>
            )}
            Continue with Google
          </button>

          {error && (
            <p className="mt-4 text-xs text-destructive" role="alert">{error}</p>
          )}
        </div>

        <p className="mt-6 text-[11px] text-muted-foreground text-center leading-relaxed px-4">
          MedBard is intended for medical education and exam preparation. It is not a tool for
          real-world patient-care decisions.
        </p>
      </div>
    </div>
  );
}
