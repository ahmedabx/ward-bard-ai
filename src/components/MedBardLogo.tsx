interface MedBardLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  tagline?: boolean;
}

export function MedBardMark({ size = 24 }: { size?: number }) {
  return (
    <img
      src="/medbard-logo.svg"
      width={size}
      height={size}
      alt="MedBard logo"
      className="block shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

export function MedBardLogo({ size = 'md', showWordmark = true, tagline = false }: MedBardLogoProps) {
  const markPx = { sm: 24, md: 32, lg: 56 }[size];
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
