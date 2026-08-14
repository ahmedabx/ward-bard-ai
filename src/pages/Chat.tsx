import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { ChatMessageBubble } from '@/components/ChatMessageBubble';
import { ChatInput } from '@/components/ChatInput';
import { UsageBadge } from '@/components/UsageBadge';
import { useDailyUsage } from '@/hooks/use-daily-usage';
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

const DAILY_QUERY_LIMIT = 7;

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chat = useChatContext();
  const { currentSession, sendMessage, isLoading } = chat;
  const { mode, setMode, specialty, setSpecialty } = useStudyMode();

  const { remaining, limit, limitReached, consume } = useDailyUsage('assistant', DAILY_QUERY_LIMIT);

  const send = useCallback(
    (text: string) => {
      if (limitReached || isLoading) return;
      consume(1);
      sendMessage(text, mode, specialty);
    },
    [limitReached, isLoading, consume, sendMessage, mode, specialty],
  );

  const initialQuery = searchParams.get('q') || '';

  useEffect(() => {
    if (initialQuery && !currentSession) {
      send(initialQuery);
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

  const SUGGESTIONS = [
    'Management of septic shock',
    'Interpret this ABG: pH 7.28, pCO₂ 58',
    'DKA vs HHS — key differences',
    'First-line therapy in new AF',
  ];

  const composer = (
    <div>
      <div className="px-4 md:px-6 pt-3 flex justify-center">
        <div className="chat-column flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 rounded-md px-3 md:px-2.5 h-8 md:h-7 text-[12px] md:text-[11px] font-medium text-foreground transition-colors hover:bg-foreground/[0.05]"
                style={{ border: HAIRLINE, background: 'transparent' }}
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
                className="flex items-center gap-1.5 rounded-md px-3 md:px-2.5 h-8 md:h-7 text-[12px] md:text-[11px] font-medium text-foreground transition-colors hover:bg-foreground/[0.05]"
                style={{ border: HAIRLINE, background: 'transparent' }}
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
          <span className="hidden sm:inline text-[10.5px] text-muted-foreground/70">Applies to this chat</span>
        </div>
      </div>

      <ChatInput
        onSend={send}
        isLoading={isLoading}
        autoFocus
        disabled={limitReached}
        disabledMessage="You've used all 7 queries for today. Come back tomorrow for more."
      />
    </div>
  );

  return (
    <AppLayout
      inputBar={composer}
      topbarRight={<UsageBadge label="Queries remaining:" remaining={remaining} limit={limit} />}
    >

      <div className="px-4 md:px-6 py-6 md:py-10">
        <div className="chat-column">
          {messages.length === 0 && !isLoading && (
            <div className="animate-fade-in py-14 md:py-24 text-center">
              <h1 className="font-serif-display text-[26px] md:text-[32px] text-foreground">
                {firstName ? `Hi there, Dr. ${firstName}` : 'Hi there, Doctor'}
              </h1>
              <p className="mt-2 text-[13.5px] text-muted-foreground">
                Ask anything — mechanisms, management, or guidelines.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={limitReached}
                    className="rounded-md px-3 min-h-[32px] text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    style={{ border: HAIRLINE }}
                  >
                    {s}
                  </button>
                ))}

              </div>
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
            <div className="mb-10 space-y-2.5" aria-label="Generating response">
              <div className="h-2.5 rounded-full bg-foreground/[0.07] evidence-pulse w-2/3" />
              <div className="h-2.5 rounded-full bg-foreground/[0.07] evidence-pulse w-full" style={{ animationDelay: '120ms' }} />
              <div className="h-2.5 rounded-full bg-foreground/[0.07] evidence-pulse w-5/6" style={{ animationDelay: '240ms' }} />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </AppLayout>
  );
}

