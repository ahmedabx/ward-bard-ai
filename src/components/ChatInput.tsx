import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, MessageSquare } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  initialValue?: string;
  autoFocus?: boolean;
}

export function ChatInput({ onSend, isLoading, initialValue, autoFocus }: ChatInputProps) {
  const [value, setValue] = useState(initialValue || '');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialValue) setValue(initialValue);
  }, [initialValue]);

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
    <div className="p-3 md:p-4">
      <div className="max-w-3xl mx-auto flex items-center gap-2 px-3 py-2 rounded-2xl bg-card/60 border border-white/[0.06]">
        <MessageSquare size={16} className="text-muted-foreground flex-shrink-0" />
        <textarea
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a clinical question..."
          rows={1}
          className="flex-1 bg-transparent text-foreground text-sm resize-none outline-none placeholder:text-muted-foreground py-1.5 max-h-24"
        />
        <motion.button
          onClick={handleSend}
          disabled={!value.trim() || isLoading}
          className="flex-shrink-0 p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-30 transition-all duration-150"
          whileTap={{ scale: 0.9 }}
          aria-label="Send"
        >
          <ArrowUp size={16} strokeWidth={2.5} />
        </motion.button>
      </div>
    </div>
  );
}
