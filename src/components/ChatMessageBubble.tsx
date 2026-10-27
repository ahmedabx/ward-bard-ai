import { motion } from 'framer-motion';
import { Copy, Bookmark, ThumbsUp, ThumbsDown, Check, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ChatMessage } from '@/hooks/use-chat';
import { AssistantAnswer } from '@/components/AssistantAnswer';
import { AssistantConfidence } from '@/components/AssistantConfidence';

const HAIRLINE = '0.5px solid hsl(var(--hairline) / var(--hairline-alpha))';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  onSave?: (question: string, answer: string) => void;
  previousUserMessage?: string;
  isStreaming?: boolean;
  /** Sends a follow-up question as the next user message. */
  onFollowUp?: (question: string) => void;
  /** Current study mode, passed to Qbank Maker as a query param. */
  mode?: string;
}

/** Flat follow-up rows + Qbank handoff shown under the sources. */
function FollowUps({
  followUps,
  qbankTopic,
  onFollowUp,
  mode,
}: {
  followUps: string[];
  qbankTopic?: string;
  onFollowUp?: (q: string) => void;
  mode?: string;
}) {
  const navigate = useNavigate();

  const quizMe = () => {
    if (!qbankTopic) return;
    const params = new URLSearchParams({ topic: qbankTopic });
    if (mode) params.set('mode', mode);
    navigate(`/qbank?${params.toString()}`);
  };

  return (
    <div className="mt-6 pt-4" style={{ borderTop: HAIRLINE }}>
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">Continue</span>
      <div className="mt-1">
        {followUps.map((q, i) => (
          <button
            key={q}
            type="button"
            onClick={() => onFollowUp?.(q)}
            className="group w-full flex items-center justify-between gap-3 py-2.5 min-h-[44px] text-left text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            style={i > 0 ? { borderTop: HAIRLINE } : undefined}
          >
            <span className="min-w-0">{q}</span>
            <ArrowRight
              size={13}
              aria-hidden
              className="shrink-0 text-muted-foreground/50 group-hover:text-primary transition-colors"
            />
          </button>
        ))}
      </div>
      {qbankTopic && (
        <button
          type="button"
          onClick={quizMe}
          className="mt-3 text-[12px] text-primary hover:underline underline-offset-2"
        >
          Quiz me on this
        </button>
      )}
    </div>
  );
}

export function ChatMessageBubble({
  message,
  onSave,
  previousUserMessage,
  isStreaming,
  onFollowUp,
  mode,
}: ChatMessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const isUser = message.role === 'user';
  const anchorPrefix = `m-${message.id}`;

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

  const followUps = !isStreaming ? message.meta?.follow_ups?.filter(Boolean) ?? [] : [];
  const qbankTopic = message.meta?.qbank_topic;

  return (
    <motion.div
      className="mb-10"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <AssistantAnswer
        content={message.content}
        sources={message.sources ?? []}
        anchorPrefix={anchorPrefix}
      />

      {previousUserMessage && message.content.length > 10 && (
        <AssistantConfidence
          query={previousUserMessage}
          answer={message.content}
          sources={message.sources ?? []}
          retrievalFailed={message.retrievalFailed}
          isStreaming={isStreaming}
          anchorPrefix={anchorPrefix}
        />
      )}

      {followUps.length > 0 && (
        <FollowUps followUps={followUps} qbankTopic={qbankTopic} onFollowUp={onFollowUp} mode={mode} />
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
