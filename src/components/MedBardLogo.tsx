interface MedBardLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  tagline?: boolean;
}

export function MedBardMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="hsl(var(--primary))"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Stethoscope tubing */}
      <path d="M8 4v8a6 6 0 0 0 12 0V4" />
      {/* Earpieces */}
      <circle cx="8" cy="4" r="1.4" fill="hsl(var(--primary))" />
      <circle cx="20" cy="4" r="1.4" fill="hsl(var(--primary))" />
      {/* Cord to chestpiece */}
      <path d="M14 18v5a4 4 0 0 0 4 4h2" />
      {/* Chestpiece */}
      <circle cx="23" cy="25" r="3.5" />
    </svg>
  );
}

export function MedBardLogo({ size = 'md', showWordmark = true, tagline = false }: MedBardLogoProps) {
  const markPx = { sm: 20, md: 24, lg: 40 }[size];
  const wordSize = { sm: 'text-lg', md: 'text-xl', lg: 'text-4xl' }[size];

  return (
    <div className="flex items-center gap-2.5">
      <MedBardMark size={markPx} />
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span className={`font-serif-display ${wordSize} text-foreground`}>MedBard</span>
          {tagline && (
            <span className="text-[11px] text-muted-foreground mt-1.5 tracking-wide">
              Reliable For High Stakes.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
