import { motion } from 'framer-motion';

interface WardBardLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function WardBardLogo({ size = 'md', showText = true }: WardBardLogoProps) {
  const sizes = { sm: 28, md: 36, lg: 56 };
  const s = sizes[size];

  return (
    <div className="flex items-center gap-2.5">
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Stethoscope earpieces */}
        <circle cx="16" cy="36" r="5" stroke="hsl(var(--primary))" strokeWidth="2" fill="none" />
        <circle cx="16" cy="36" r="2" fill="hsl(var(--primary))" />
        {/* Quill/pen body merging with tube */}
        <path
          d="M24 6 L28 14 L26 16 L24 34 L22 34 L20 16 L18 14 Z"
          fill="hsl(var(--primary))"
          opacity="0.9"
        />
        {/* Quill feather detail */}
        <path
          d="M24 6 L32 10 L28 14 Z"
          fill="hsl(var(--primary))"
          opacity="0.6"
        />
        <path
          d="M24 6 L16 10 L18 14 Z"
          fill="hsl(var(--primary))"
          opacity="0.4"
        />
        {/* Tube curving to stethoscope */}
        <path
          d="M22 34 Q14 38 16 36"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          fill="none"
          opacity="0.7"
        />
      </svg>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`font-heading font-bold tracking-tight ${size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-lg' : 'text-sm'} text-foreground`}>
            Ward Bard
          </span>
          {size === 'lg' && (
            <span className="text-xs text-muted-foreground tracking-wide mt-0.5">
              Evidence at the Bedside
            </span>
          )}
        </div>
      )}
    </div>
  );
}
