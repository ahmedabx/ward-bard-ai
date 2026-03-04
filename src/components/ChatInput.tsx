import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { specialties, type Specialty } from '@/lib/specialties';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  activeSpecialty: Specialty;
  onSpecialtyClick?: () => void;
  initialValue?: string;
}

export function ChatInput({ onSend, isLoading, activeSpecialty, onSpecialtyClick, initialValue }: ChatInputProps) {
  const [value, setValue] = useState(initialValue || '');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const spec = specialties.find(s => s.id === activeSpecialty);

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
      <div className="glass-input flex items-end gap-2 p-2 pl-4 max-w-3xl mx-auto">
        {spec && (
          <button
            onClick={onSpecialtyClick}
            className="flex-shrink-0 text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-medium mb-1.5 transition-all duration-150 hover:bg-primary/25"
          >
            {spec.icon} {spec.label}
          </button>
        )}
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
          className="flex-shrink-0 p-2 rounded-full bg-primary text-primary-foreground disabled:opacity-30 transition-all duration-150"
          whileTap={{ scale: 0.9 }}
        >
          <Send size={16} />
        </motion.button>
      </div>
    </div>
  );
}
