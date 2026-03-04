import { motion } from 'framer-motion';
import { Copy, Bookmark, ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '@/hooks/use-chat';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  onSave?: (question: string, answer: string) => void;
  previousUserMessage?: string;
}

export function ChatMessageBubble({ message, onSave, previousUserMessage }: ChatMessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSave = () => {
    if (onSave && previousUserMessage) {
      onSave(previousUserMessage, message.content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  if (isUser) {
    return (
      <motion.div
        className="flex justify-end mb-3"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        <div className="max-w-[85%] md:max-w-[70%] px-4 py-2.5 bg-primary/20 border border-primary/20 rounded-2xl rounded-br-md">
          <p className="text-sm text-foreground">{message.content}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="flex justify-start mb-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="max-w-[90%] md:max-w-[80%]">
        <div className="glass-card p-4 border border-primary/10 relative group">
          <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>

          {/* Warning */}
          {message.content.length > 10 && (
            <p className="mt-3 text-[10px] text-muted-foreground/60 italic">
              ⚠️ Ward Bard is an educational tool. Not a substitute for expert clinical advice. We are not responsible for any malpractice.
            </p>
          )}

          {/* Actions */}
          {message.content.length > 10 && (
            <div className="flex items-center gap-1 mt-3 pt-2 border-t border-border/30">
              <button onClick={handleCopy} className="p-1.5 text-muted-foreground hover:text-foreground transition-all duration-150 hover:scale-110">
                {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
              </button>
              <button
                onClick={handleSave}
                className={`p-1.5 transition-all duration-150 hover:scale-110 ${saved ? 'text-yellow-400' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {saved ? <Check size={14} /> : <Bookmark size={14} />}
              </button>
              <button
                onClick={() => setFeedback('up')}
                className={`p-1.5 transition-all duration-150 hover:scale-110 ${feedback === 'up' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <ThumbsUp size={14} />
              </button>
              <button
                onClick={() => setFeedback('down')}
                className={`p-1.5 transition-all duration-150 hover:scale-110 ${feedback === 'down' ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <ThumbsDown size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
