import { motion } from 'framer-motion';
import { WardBardLogo } from './WardBardLogo';
import type { ChatSession } from '@/hooks/use-chat';
import { Plus, X } from 'lucide-react';

interface ChatSidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onClose?: () => void;
}

export function ChatSidebar({
  sessions, currentSessionId, onSelectSession, onNewChat, onClose,
}: ChatSidebarProps) {
  return (
    <div className="h-full flex flex-col bg-card/80 backdrop-blur-xl border-r border-border">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-border">
        <WardBardLogo size="sm" />
        {onClose && (
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground transition-colors duration-150">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Recent Chats */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1">Recent</p>
        {sessions.length === 0 && (
          <p className="text-xs text-muted-foreground px-1">No chats yet</p>
        )}
        <div className="space-y-1">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => onSelectSession(s.id)}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg truncate transition-all duration-150
                ${s.id === currentSessionId
                  ? 'bg-primary/15 text-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* New Chat */}
      <div className="p-3 border-t border-border">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>
    </div>
  );
}
