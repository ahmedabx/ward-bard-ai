interface BardIconProps {
  size?: number;
  className?: string;
}

/**
 * Teardrop/flame with stethoscope base.
 * Stroke: #1eb98c on a rounded square tinted background.
 */
export function BardIcon({ size = 40, className = '' }: BardIconProps) {
  const radius = Math.round(size * 0.22);
  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        background: 'rgba(30, 185, 140, 0.14)',
        borderRadius: radius,
      }}
    >
      <svg
        width={Math.round(size * 0.62)}
        height={Math.round(size * 0.62)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#1eb98c"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Teardrop / flame */}
        <path d="M12 2.5c2.4 3 4.5 5.4 4.5 8.2a4.5 4.5 0 1 1-9 0c0-2.8 2.1-5.2 4.5-8.2z" />
        {/* Stethoscope tubing from base */}
        <path d="M9 15.2c-.6 1.8-1.7 3.4-3.4 3.8" opacity="0.85" />
        <path d="M15 15.2c.6 1.8 1.7 3.4 3.4 3.8" opacity="0.85" />
        {/* Bell */}
        <circle cx="18.6" cy="20" r="1.6" />
      </svg>
    </div>
  );
}
