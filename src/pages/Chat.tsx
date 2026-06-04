import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { ChatMessageBubble } from '@/components/ChatMessageBubble';
import { ChatInput } from '@/components/ChatInput';
import { useChatContext } from '@/contexts/ChatContext';

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chat = useChatContext();
  const { currentSession, sendMessage, isLoading } = chat;

  const initialQuery = searchParams.get('q') || '';

  useEffect(() => {
    if (initialQuery && !currentSession) {
      sendMessage(initialQuery);
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
  const isEmpty = messages.length === 0;

  return (
    <AppLayout inputBar={<ChatInput onSend={sendMessage} isLoading={isLoading} />}>
      <div className="px-4 py-6">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto pt-10">
            <WardBardLogo size="lg" showText />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-12 w-full">
              {SUGGESTIONS.map((sq, i) => (
                <motion.button
                  key={i}
                  onClick={() => sendMessage(sq.text)}
                  className="text-left p-4 rounded-xl bg-card/40 border border-white/[0.06] hover:border-primary/30 hover:bg-primary/[0.04] transition-colors duration-150"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                >
                  <p
                    className="text-primary font-semibold mb-1.5"
                    style={{ fontSize: '9.5px', letterSpacing: '0.09em', textTransform: 'uppercase' }}
                  >
                    {sq.category}
                  </p>
                  <p className="text-sm text-foreground/90 leading-snug">{sq.text}</p>
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {messages.map((msg, i) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                onSave={msg.role === 'assistant' ? chat.saveNote : undefined}
                previousUserMessage={msg.role === 'assistant' ? messages[i - 1]?.content : undefined}
              />
            ))}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start mb-4">
                <div className="glass-card p-4 space-y-2 w-64">
                  <div className="h-3 bg-muted/50 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-muted/50 rounded animate-pulse w-full" />
                  <div className="h-3 bg-muted/50 rounded animate-pulse w-1/2" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
