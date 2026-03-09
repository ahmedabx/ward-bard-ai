import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
}

export interface SavedNote {
  id: string;
  question: string;
  answer: string;
  savedAt: Date;
}

let counter = 0;
const uid = () => `${Date.now()}_${++counter}`;

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  const sendMessage = useCallback(async (content: string) => {
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = uid();
      const session: ChatSession = {
        id: sessionId,
        title: content.slice(0, 50),
        messages: [],
        createdAt: new Date(),
      };
      setSessions(prev => [session, ...prev]);
      setCurrentSessionId(sessionId);
    }

    const userMsg: ChatMessage = { id: uid(), role: 'user', content, timestamp: new Date() };
    const assistantMsgId = uid();

    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      const updated = { ...s, messages: [...s.messages, userMsg] };
      if (s.title === 'New Chat') updated.title = content.slice(0, 50);
      return updated;
    }));

    setIsLoading(true);

    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      return { ...s, messages: [...s.messages, { id: assistantMsgId, role: 'assistant' as const, content: '', timestamp: new Date() }] };
    }));

    try {
      const currentMessages = sessions.find(s => s.id === sessionId)?.messages || [];
      const allMessages = [...currentMessages, userMsg].map(m => ({ role: m.role, content: m.content }));

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ward-bard-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`Request failed: ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantContent = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              const captured = assistantContent;
              setSessions(prev => prev.map(s => {
                if (s.id !== sessionId) return s;
                return {
                  ...s,
                  messages: s.messages.map(m =>
                    m.id === assistantMsgId ? { ...m, content: captured } : m
                  ),
                };
              }));
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      setSessions(prev => prev.map(s => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          messages: s.messages.map(m =>
            m.id === assistantMsgId ? { ...m, content: '⚠️ Something went wrong. Please try again.' } : m
          ),
        };
      }));
    } finally {
      setIsLoading(false);
    }
  }, [currentSessionId, sessions]);

  const saveNote = useCallback((question: string, answer: string) => {
    setSavedNotes(prev => [{
      id: uid(),
      question,
      answer,
      savedAt: new Date(),
    }, ...prev]);
  }, []);

  const removeNote = useCallback((id: string) => {
    setSavedNotes(prev => prev.filter(n => n.id !== id));
  }, []);

  const startNewChat = useCallback(() => {
    setCurrentSessionId(null);
  }, []);

  return {
    sessions,
    currentSession,
    currentSessionId,
    setCurrentSessionId,
    sendMessage,
    isLoading,
    savedNotes,
    saveNote,
    removeNote,
    startNewChat,
  };
}
