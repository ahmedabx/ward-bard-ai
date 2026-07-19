import { useState, useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  initialValue?: string;
  autoFocus?: boolean;
}

const HAIRLINE = '0.5px solid hsl(var(--hairline) / var(--hairline-alpha))';

export function ChatInput({ onSend, isLoading, initialValue, autoFocus }: ChatInputProps) {
  const [value, setValue] = useState(initialValue || '');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (initialValue) setValue(initialValue); }, [initialValue]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
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
    <div className="px-5 py-4">
      <div
        className="max-w-3xl mx-auto flex items-end gap-2 px-3 py-2.5 rounded-lg"
        style={{ background: 'hsl(var(--card))', border: HAIRLINE, borderRadius: 8 }}
      >
        <textarea
          ref={inputRef}
          autoFocus={autoFocus}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a medical education question…"
          rows={1}
          className="flex-1 bg-transparent text-foreground text-sm resize-none outline-none placeholder:text-muted-foreground py-1 max-h-32"
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || isLoading}
          className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-md disabled:opacity-30 transition-opacity"
          style={{
            background: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            borderRadius: 6,
          }}
          aria-label="Send message"
        >
          <ArrowUp size={14} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
