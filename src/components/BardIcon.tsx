interface BardIconProps {
  size?: number;
  className?: string;
}

/**
 * Teardrop/flame with stethoscope base.
 * Uses the design system primary color so it adapts to theme.
 */
export function BardIcon({ size = 40, className = '' }: BardIconProps) {
  const radius = Math.round(size * 0.22);
  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        background: 'hsl(var(--primary) / 0.16)',
        borderRadius: radius,
      }}
    >
      <svg
        width={Math.round(size * 0.62)}
        height={Math.round(size * 0.62)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2.5c2.4 3 4.5 5.4 4.5 8.2a4.5 4.5 0 1 1-9 0c0-2.8 2.1-5.2 4.5-8.2z" />
        <path d="M9 15.2c-.6 1.8-1.7 3.4-3.4 3.8" opacity="0.85" />
        <path d="M15 15.2c.6 1.8 1.7 3.4 3.4 3.8" opacity="0.85" />
        <circle cx="18.6" cy="20" r="1.6" />
      </svg>
    </div>
  );
}
