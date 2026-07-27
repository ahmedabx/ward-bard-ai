import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { ChatMessageBubble } from '@/components/ChatMessageBubble';
import { ChatInput } from '@/components/ChatInput';
import { useChatContext } from '@/contexts/ChatContext';
import { useStudyMode, STUDY_MODES, SPECIALTIES } from '@/contexts/ModeContext';
import { ChevronDown, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chat = useChatContext();
  const { currentSession, sendMessage, isLoading } = chat;
  const { mode, setMode, specialty, setSpecialty } = useStudyMode();

  const initialQuery = searchParams.get('q') || '';

  useEffect(() => {
    if (initialQuery && !currentSession) {
      sendMessage(initialQuery, mode, specialty);
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

  const [firstName, setFirstName] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as Record<string, unknown> | undefined;
      const full =
        (meta?.given_name as string) ||
        (meta?.name as string) ||
        (meta?.full_name as string) ||
        '';
      const first = full.trim().split(/\s+/)[0];
      setFirstName(first && /^[A-Za-z'’-]+$/.test(first) ? first : null);
    });
  }, []);

  const HAIRLINE = '0.5px solid hsl(var(--hairline) / var(--hairline-alpha))';

  const activeMode = STUDY_MODES.find((m) => m.value === mode) ?? STUDY_MODES[1];
  const activeSpecialty = SPECIALTIES.find((s) => s.value === specialty) ?? SPECIALTIES[0];

  const composer = (
    <div>
      <div className="px-4 md:px-5 pt-3 md:pt-4 flex justify-center">
        <div className="max-w-3xl w-full flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 rounded-md px-3 md:px-2.5 h-8 md:h-7 text-[12px] md:text-[11px] font-medium text-foreground transition-colors hover:bg-muted/30"
                style={{ border: HAIRLINE, background: 'hsl(var(--surface-rail) / 0.5)' }}
                aria-label="Study mode"
              >
                {activeMode.label}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              {STUDY_MODES.map((m) => (
                <DropdownMenuItem
                  key={m.value}
                  onSelect={() => setMode(m.value)}
                  className="flex items-start justify-between gap-2"
                >
                  <span className="flex flex-col">
                    <span className="text-[13px]">{m.label}</span>
                    <span className="text-[11px] text-muted-foreground">{m.hint}</span>
                  </span>
                  {mode === m.value && <Check className="h-3.5 w-3.5 mt-1 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 rounded-md px-3 md:px-2.5 h-8 md:h-7 text-[12px] md:text-[11px] font-medium text-foreground transition-colors hover:bg-muted/30"
                style={{ border: HAIRLINE, background: 'hsl(var(--surface-rail) / 0.5)' }}
                aria-label="Specialty focus"
              >
                {activeSpecialty.label}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-52 max-h-72 overflow-y-auto">
              {SPECIALTIES.map((s) => (
                <DropdownMenuItem
                  key={s.value}
                  onSelect={() => setSpecialty(s.value)}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-[13px]">{s.label}</span>
                  {specialty === s.value && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="hidden sm:inline text-[10.5px] text-muted-foreground">Applies to this chat</span>
        </div>
      </div>

      <ChatInput onSend={(t) => sendMessage(t, mode, specialty)} isLoading={isLoading} autoFocus />

    </div>
  );

  return (
    <AppLayout inputBar={composer}>

      <div className="px-4 md:px-6 py-5 md:py-6">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 && !isLoading && (
            <div className="animate-fade-in py-16 md:py-24 text-center">
              <h1 className="font-serif-display text-2xl md:text-3xl text-foreground">
                {firstName ? `Hi there, Dr. ${firstName}` : 'Hi there, Doctor'}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Ask anything — mechanisms, management, or guidelines.
              </p>
            </div>
          )}
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
                <div className="h-3 bg-muted/50 rounded shimmer w-3/4" />
                <div className="h-3 bg-muted/50 rounded shimmer w-full" />
                <div className="h-3 bg-muted/50 rounded shimmer w-1/2" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </AppLayout>
  );
}
