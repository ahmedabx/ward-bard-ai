const HAIRLINE = '0.5px solid hsl(var(--hairline) / var(--hairline-alpha))';

interface UsageBadgeProps {
  label: string;
  remaining: number;
  limit: number;
  loading?: boolean;
}

export function UsageBadge({ label, remaining, limit, loading }: UsageBadgeProps) {
  if (loading) {
    return (
      <div
        className="h-[26px] w-[168px] rounded-lg"
        style={{ background: 'hsl(var(--primary) / 0.08)', borderRadius: 8 }}
        aria-hidden
      />
    );
  }

  const depleted = remaining <= 0;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 h-[26px] text-[11.5px] font-medium whitespace-nowrap"
      style={{
        borderRadius: 8,
        border: HAIRLINE,
        background: depleted ? 'transparent' : 'hsl(var(--primary) / 0.08)',
        color: depleted ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))',
      }}
      aria-live="polite"
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: depleted ? 'hsl(var(--muted-foreground) / 0.5)' : 'hsl(var(--primary))' }}
      />
      {label} {remaining}/{limit} today
    </span>
  );
}
