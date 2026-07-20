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
  const { mode } = useStudyMode();

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

  return (
    <AppLayout inputBar={<ChatInput onSend={(t) => sendMessage(t, mode)} isLoading={isLoading} autoFocus />}>
      <div className="px-4 py-6">
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
      </div>
    </AppLayout>
  );
}
