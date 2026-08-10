import { motion } from 'framer-motion';
import { Copy, Bookmark, ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '@/hooks/use-chat';
import { AssistantConfidence } from '@/components/AssistantConfidence';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  onSave?: (question: string, answer: string) => void;
  previousUserMessage?: string;
  isStreaming?: boolean;
}

/** Turn bare `[1]` citation markers into markdown links pointing at the source card. */
function linkifyCitations(text: string, anchorPrefix: string) {
  return text.replace(/(?<!\])\[(\d{1,2})\](?!\()/g, (_m, n) => `[\\[${n}\\]](#${anchorPrefix}-src-${n})`);
}

export function ChatMessageBubble({ message, onSave, previousUserMessage, isStreaming }: ChatMessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const isUser = message.role === 'user';
  const anchorPrefix = `m-${message.id}`;

  const body = useMemo(
    () => (isUser ? message.content : linkifyCitations(message.content, anchorPrefix)),
    [message.content, isUser, anchorPrefix],
  );

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
        className="flex justify-end mb-5"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        <div
          className="max-w-[88%] md:max-w-[75%] px-3.5 py-2.5 rounded-lg"
          style={{
            background: 'hsl(var(--foreground) / 0.05)',
            border: '0.5px solid hsl(var(--hairline) / var(--hairline-alpha))',
          }}
        >
          <p className="text-[15px] text-foreground leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="mb-10"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="ward-bard-response max-w-none text-[15px] leading-[1.7] text-foreground/85">
        <ReactMarkdown
          components={{
            h1: ({ children }) => <h1 className="text-[19px] font-semibold text-foreground mt-0 mb-3">{children}</h1>,
            h2: ({ children }) => <h2 className="text-[16px] font-semibold text-foreground mt-7 mb-2.5">{children}</h2>,
            h3: ({ children }) => <h3 className="text-[14px] font-semibold text-foreground/90 mt-5 mb-2 uppercase tracking-[0.06em]">{children}</h3>,
            p: ({ children }) => <p className="mb-4 last:mb-0 leading-[1.7]">{children}</p>,
            ul: ({ children }) => <ul className="space-y-1 mb-4">{children}</ul>,
            ol: ({ children }) => <ol className="space-y-1 mb-4 list-decimal pl-5">{children}</ol>,
            li: ({ children }) => <li className="leading-[1.65] marker:text-primary/60">{children}</li>,
            strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
            em: ({ children }) => <em className="text-foreground/80">{children}</em>,
            a: ({ children, href }) => {
              const isCitation = typeof href === 'string' && href.includes('-src-');
              if (isCitation) {
                return (
                  <a
                    href={href}
                    onClick={(e) => {
                      e.preventDefault();
                      const el = document.querySelector(href!);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      (el as HTMLElement | null)?.classList.add('source-flash');
                      setTimeout(() => (el as HTMLElement | null)?.classList.remove('source-flash'), 1200);
                    }}
                    className="citation-chip"
                  >
                    {children}
                  </a>
                );
              }
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary"
                >
                  {children}
                </a>
              );
            },
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-primary/40 pl-4 my-4 text-muted-foreground">{children}</blockquote>
            ),
            code: ({ children, className }) => {
              const isBlock = className?.includes('language-');
              if (isBlock) {
                return (
                  <code className={`block bg-card rounded-md p-3 my-4 text-[12.5px] font-mono overflow-x-auto ${className}`}>
                    {children}
                  </code>
                );
              }
              return (
                <code className="font-mono text-[13px] text-foreground bg-foreground/[0.06] px-1.5 py-0.5 rounded">
                  {children}
                </code>
              );
            },
            hr: () => <hr className="border-0 my-6" style={{ borderTop: '0.5px solid hsl(var(--hairline) / var(--hairline-alpha))' }} />,
          }}
        >{body}</ReactMarkdown>
      </div>

      {previousUserMessage && message.content.length > 10 && (
        <AssistantConfidence
          query={previousUserMessage}
          answer={message.content}
          isStreaming={isStreaming}
          anchorPrefix={anchorPrefix}
        />
      )}

      {message.content.length > 10 && (
        <p className="mt-3 text-[10px] text-muted-foreground/60">
          For medical education and exam preparation only. Not for real-world patient-care decisions.
        </p>
      )}

      {message.content.length > 10 && (
        <div className="flex items-center gap-0.5 mt-2">
          <button onClick={handleCopy} aria-label="Copy response" className="p-2 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.05]">
            {copied ? <Check size={15} className="text-primary" /> : <Copy size={15} />}
          </button>
          <button
            onClick={handleSave}
            aria-label="Save response"
            className={`p-2 rounded-md hover:bg-foreground/[0.05] ${saved ? 'text-primary' : 'text-muted-foreground/70 hover:text-foreground'}`}
          >
            {saved ? <Check size={15} /> : <Bookmark size={15} />}
          </button>
          <button
            onClick={() => setFeedback('up')}
            aria-label="Helpful"
            className={`p-2 rounded-md hover:bg-foreground/[0.05] ${feedback === 'up' ? 'text-primary' : 'text-muted-foreground/70 hover:text-foreground'}`}
          >
            <ThumbsUp size={15} />
          </button>
          <button
            onClick={() => setFeedback('down')}
            aria-label="Not helpful"
            className={`p-2 rounded-md hover:bg-foreground/[0.05] ${feedback === 'down' ? 'text-destructive' : 'text-muted-foreground/70 hover:text-foreground'}`}
          >
            <ThumbsDown size={15} />
          </button>
        </div>
      )}
    </motion.div>
  );
}
