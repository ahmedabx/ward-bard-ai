import { MedBardMark } from './MedBardLogo';

interface BardIconProps {
  size?: number;
  className?: string;
}

/** Compatibility wrapper — renders the MedBard stethoscope mark. */
export function BardIcon({ size = 28, className = '' }: BardIconProps) {
  return (
    <div className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <MedBardMark size={Math.round(size * 0.8)} />
    </div>
  );
}
