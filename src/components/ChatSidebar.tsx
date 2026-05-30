import { WardBardLogo } from './WardBardLogo';
import type { ChatSession } from '@/hooks/use-chat';
import { Plus, X, Settings } from 'lucide-react';

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
    <div className="h-full flex flex-col bg-sidebar border-r border-white/5">
      {/* Logo */}
      <div className="p-4 flex items-center justify-between border-b border-white/5">
        <WardBardLogo size="sm" />
        {onClose && (
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Recents */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="text-[10px] text-muted-foreground/70 uppercase tracking-[0.12em] mb-2 px-1">
          Recents
        </p>
        {sessions.length === 0 && (
          <p className="text-xs text-muted-foreground px-1">No chats yet</p>
        )}
        <div className="space-y-0.5">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => onSelectSession(s.id)}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg truncate transition-colors duration-150 ${
                s.id === currentSessionId
                  ? 'bg-white/5 text-foreground'
                  : 'text-muted-foreground hover:bg-white/[0.03] hover:text-foreground'
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Profile + New chat */}
      <div className="p-3 border-t border-white/5 space-y-2">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-xs font-semibold text-primary">
            AA
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground truncate">ahmed</p>
          </div>
          <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <Settings size={15} />
          </button>
        </div>
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-transparent border border-white/10 hover:border-primary/40 hover:text-primary text-foreground/80 rounded-lg text-sm font-medium transition-colors duration-150"
        >
          <Plus size={15} />
          New chat
        </button>
      </div>
    </div>
  );
}
