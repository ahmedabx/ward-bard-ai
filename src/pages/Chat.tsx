import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu } from 'lucide-react';
import { ChatSidebar } from '@/components/ChatSidebar';
import { ChatMessageBubble } from '@/components/ChatMessageBubble';
import { ChatInput } from '@/components/ChatInput';
import { WardBardLogo } from '@/components/WardBardLogo';
import { TabBar } from '@/components/TabBar';
import { useChat } from '@/hooks/use-chat';
import { useIsMobile } from '@/hooks/use-mobile';

const SUGGESTIONS = [
  { category: 'Pharmacology', text: 'First-line Rx for community-acquired pneumonia?' },
  { category: 'Scoring', text: 'Bishop score interpretation' },
  { category: 'Differential', text: 'Acute red eye differentials' },
  { category: 'Obstetrics', text: 'Stages of labour — when to intervene?' },
];

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chat = useChat();
  const { currentSession, sendMessage, isLoading } = chat;

  const initialQuery = searchParams.get('q') || '';

  useEffect(() => {
    if (initialQuery && !currentSession) {
      sendMessage(initialQuery);
      setSearchParams({});
    }
  }, [initialQuery]);

  // Auto-scroll only for user messages (not AI responses)
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
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className={`${isMobile ? 'absolute inset-y-0 left-0 z-50 w-72' : 'w-72 flex-shrink-0'}`}
            initial={{ x: -288 }}
            animate={{ x: 0 }}
            exit={{ x: -288 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <ChatSidebar
              sessions={chat.sessions}
              currentSessionId={chat.currentSessionId}
              onSelectSession={(id) => { chat.setCurrentSessionId(id); if (isMobile) setSidebarOpen(false); }}
              onNewChat={() => { chat.startNewChat(); if (isMobile) setSidebarOpen(false); }}
              onClose={isMobile ? () => setSidebarOpen(false) : undefined}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div className="absolute inset-0 z-40 bg-background/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors duration-150">
            <Menu size={20} />
          </button>
          {!sidebarOpen && <WardBardLogo size="sm" />}
        </div>

        {/* Tabs */}
        <TabBar />

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {isEmpty ? (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto">
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

        {/* Input */}
        <ChatInput onSend={sendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
}
