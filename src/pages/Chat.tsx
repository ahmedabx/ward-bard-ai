import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { ChatMessageBubble } from '@/components/ChatMessageBubble';
import { ChatInput } from '@/components/ChatInput';
import { useChatContext } from '@/contexts/ChatContext';
import { useStudyMode } from '@/contexts/ModeContext';

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chat = useChatContext();
  const { currentSession, sendMessage, isLoading } = chat;
  const { mode, setMode } = useStudyMode();

  const initialQuery = searchParams.get('q') || '';

  useEffect(() => {
    if (initialQuery && !currentSession) {
      sendMessage(initialQuery, mode);
      setSearchParams({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  useEffect(() => {
    const msgs = currentSession?.messages || [];
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg?.role === 'user') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentSession?.messages]);

  const messages = currentSession?.messages || [];

  const HAIRLINE = '0.5px solid hsl(var(--hairline) / var(--hairline-alpha))';

  const composer = (
    <div>
      <div className="px-4 md:px-5 pt-3 md:pt-4 flex justify-center">
        <div className="max-w-3xl w-full flex items-center gap-2">
          <div
            className="flex items-center rounded-md p-0.5"
            style={{ border: HAIRLINE, background: 'hsl(var(--surface-rail) / 0.5)' }}
            role="tablist"
            aria-label="Study mode"
          >
            {(['preclinical', 'clinical'] as const).map((m) => {
              const on = mode === m;
              return (
                <button
                  key={m}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setMode(m)}
                  className="px-3 md:px-2.5 h-7 md:h-6 rounded text-[12px] md:text-[11px] font-medium transition-colors"
                  style={{
                    background: on ? 'hsl(var(--primary) / 0.15)' : 'transparent',
                    color: on ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                  }}
                >
                  {m === 'preclinical' ? 'Preclinical' : 'Clinical'}
                </button>
              );
            })}
          </div>
          <span className="text-[10.5px] text-muted-foreground">Applies to this chat</span>
        </div>
      </div>
      <ChatInput onSend={(t) => sendMessage(t, mode)} isLoading={isLoading} autoFocus />
    </div>
  );

  return (
    <AppLayout inputBar={composer}>

      <div className="px-4 md:px-6 py-5 md:py-6">
        <div className="max-w-3xl mx-auto">
          {messages.map((msg, i) => {
            const isLast = i === messages.length - 1;
            return (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                onSave={msg.role === 'assistant' ? chat.saveNote : undefined}
                previousUserMessage={msg.role === 'assistant' ? messages[i - 1]?.content : undefined}
                isStreaming={msg.role === 'assistant' && isLast && isLoading}
              />
            );
          })}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start mb-5 md:mb-4">
              <div className="glass-card p-4 space-y-2 w-64 max-w-full">
                <div className="h-3 bg-muted/50 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-muted/50 rounded animate-pulse w-full" />
                <div className="h-3 bg-muted/50 rounded animate-pulse w-1/2" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </AppLayout>
  );
}
