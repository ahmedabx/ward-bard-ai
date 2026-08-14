import { useState, useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  initialValue?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  disabledMessage?: string;
}

const HAIRLINE = '0.5px solid hsl(var(--hairline) / var(--hairline-alpha))';

export function ChatInput({ onSend, isLoading, initialValue, autoFocus, disabled, disabledMessage }: ChatInputProps) {
  const [value, setValue] = useState(initialValue || '');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (initialValue) setValue(initialValue); }, [initialValue]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading || disabled) return;
    onSend(trimmed);
    setValue('');
    inputRef.current?.focus();
  };


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="px-4 md:px-6 pt-2 pb-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      {disabled && disabledMessage && (
        <div className="chat-column mb-2 text-[12px] text-muted-foreground" role="status">
          {disabledMessage}
        </div>
      )}
      <div
        className="chat-column flex items-end gap-2 px-4 py-3 transition-[box-shadow,border-color,opacity] duration-150"
        style={{
          background: 'hsl(var(--card))',
          border: HAIRLINE,
          borderRadius: 8,
          boxShadow: focused && !disabled ? '0 0 0 1px hsl(var(--primary))' : 'none',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <textarea
          ref={inputRef}
          autoFocus={autoFocus && !disabled}
          value={value}
          disabled={disabled}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={disabled ? 'Daily limit reached' : 'Ask a medical education question…'}
          rows={1}
          className="flex-1 bg-transparent text-foreground text-base md:text-[15px] leading-6 resize-none outline-none placeholder:text-muted-foreground/55 py-1 max-h-40 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || isLoading || disabled}
          className="flex-shrink-0 flex items-center justify-center h-9 w-9 md:h-8 md:w-8 rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
          style={{
            background: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            borderRadius: 6,
          }}
          aria-label="Send message"
        >
          <ArrowUp size={16} strokeWidth={2.25} />
        </button>
      </div>

    </div>
  );
}
