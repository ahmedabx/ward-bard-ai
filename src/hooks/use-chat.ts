import { useState, useCallback, useEffect, useRef } from 'react';
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
  const [historyLoading, setHistoryLoading] = useState(true);
  const loadedSessions = useRef<Set<string>>(new Set());

  const currentSession = sessions.find(s => s.id === currentSessionId);

  // ---- Load persisted history ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { if (!cancelled) setHistoryLoading(false); return; }
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('id, title, created_at')
        .order('updated_at', { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (error) console.error('Failed to load chat history:', error.message);
      setSessions(
        (data || []).map(r => ({
          id: r.id,
          title: r.title,
          messages: [],
          createdAt: new Date(r.created_at),
        })),
      );
      setHistoryLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // ---- Lazy-load messages of the selected session ----
  const openSession = useCallback(async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    if (loadedSessions.current.has(sessionId)) return;
    loadedSessions.current.add(sessionId);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    if (error) { console.error('Failed to load messages:', error.message); return; }
    setSessions(prev => prev.map(s => s.id === sessionId ? {
      ...s,
      messages: (data || []).map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.created_at),
      })),
    } : s));
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    setCurrentSessionId(prev => (prev === sessionId ? null : prev));
    const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionId);
    if (error) console.error('Failed to delete chat:', error.message);
  }, []);

  const sendMessage = useCallback(async (
    content: string,
    mode?: import('@/contexts/ModeContext').StudyMode,
    specialty?: import('@/contexts/ModeContext').Specialty,
  ) => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;

    let sessionId = currentSessionId;
    if (!sessionId) {
      const title = content.slice(0, 50);
      if (userId) {
        const { data, error } = await supabase
          .from('chat_sessions')
          .insert({ user_id: userId, title })
          .select('id, created_at')
          .single();
        if (error) { console.error('Failed to create chat:', error.message); return; }
        sessionId = data.id;
        loadedSessions.current.add(sessionId);
        setSessions(prev => [{ id: data.id, title, messages: [], createdAt: new Date(data.created_at) }, ...prev]);
      } else {
        sessionId = uid();
        setSessions(prev => [{ id: sessionId!, title, messages: [], createdAt: new Date() }, ...prev]);
      }
      setCurrentSessionId(sessionId);
    }

    const userMsg: ChatMessage = { id: uid(), role: 'user', content, timestamp: new Date() };
    const assistantMsgId = uid();

    const priorMessages = sessions.find(s => s.id === sessionId)?.messages || [];

    setSessions(prev => prev.map(s => s.id === sessionId
      ? { ...s, messages: [...s.messages, userMsg, { id: assistantMsgId, role: 'assistant' as const, content: '', timestamp: new Date() }] }
      : s));

    setIsLoading(true);

    if (userId) {
      supabase.from('chat_messages')
        .insert({ session_id: sessionId, user_id: userId, role: 'user', content })
        .then(({ error }) => { if (error) console.error('Failed to save message:', error.message); });
    }

    let assistantContent = '';

    try {
      const allMessages = [...priorMessages, userMsg].map(m => ({ role: m.role, content: m.content }));

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ward-bard-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages, mode, specialty: specialty && specialty !== 'all' ? specialty : null }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`Request failed: ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
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
      assistantContent = assistantContent || '⚠️ Something went wrong. Please try again.';
      setSessions(prev => prev.map(s => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          messages: s.messages.map(m =>
            m.id === assistantMsgId ? { ...m, content: assistantContent } : m
          ),
        };
      }));
    } finally {
      setIsLoading(false);
      if (userId && assistantContent) {
        const { error } = await supabase
          .from('chat_messages')
          .insert({ session_id: sessionId, user_id: userId, role: 'assistant', content: assistantContent });
        if (error) console.error('Failed to save response:', error.message);
        await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);
      }
    }
  }, [currentSessionId, sessions]);

  const saveNote = useCallback((question: string, answer: string) => {
    setSavedNotes(prev => [{ id: uid(), question, answer, savedAt: new Date() }, ...prev]);
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
    setCurrentSessionId: openSession,
    deleteSession,
    historyLoading,
    sendMessage,
    isLoading,
    savedNotes,
    saveNote,
    removeNote,
    startNewChat,
  };
}
