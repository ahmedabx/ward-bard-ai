import { BardIcon } from './BardIcon';

interface WardBardLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function WardBardLogo({ size = 'md', showText = true }: WardBardLogoProps) {
  const iconSizes = { sm: 32, md: 40, lg: 72 };
  const textSizes = { sm: 'text-base', md: 'text-xl', lg: 'text-5xl md:text-6xl' };

  return (
    <div className="flex items-center gap-3">
      <BardIcon size={iconSizes[size]} />
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className={`font-serif-display tracking-tight ${textSizes[size]} text-foreground`}>
            Ward Bard
          </span>
          {size === 'lg' && (
            <span className="text-sm text-muted-foreground tracking-wide mt-1">
              Evidence at the bedside
            </span>
          )}
        </div>
      )}
    </div>
  );
}
