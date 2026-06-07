import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare, User, Calculator, Sun, Moon } from 'lucide-react';
import { BardIcon } from './BardIcon';
import { useChatContext } from '@/contexts/ChatContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AppLayoutProps {
  children: ReactNode;
  inputBar?: ReactNode;
}

const NAV = [
  { to: '/chat', label: 'My Assistant', Icon: MessageSquare, badge: false },
  { to: '/my-patient', label: 'My Patient', Icon: User, badge: true },
  { to: '/calculators', label: 'Calculators', Icon: Calculator, badge: false },
];

const HAIRLINE = '0.5px solid hsl(var(--hairline) / var(--hairline-alpha))';

export function AppLayout({ children, inputBar }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAssistant = location.pathname === '/chat' || location.pathname === '/';

  const active = NAV.find(n => n.to === location.pathname) ?? NAV[0];
  const ActiveIcon = active.Icon;

  const { sessions, currentSessionId, setCurrentSessionId, startNewChat } =
    useChatContext();
  const { theme, toggleTheme } = useTheme();

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className="h-screen flex overflow-hidden text-foreground"
        style={{ background: 'hsl(var(--surface-main))' }}
      >
        {/* Icon rail */}
        <aside
          className="w-14 flex-shrink-0 flex flex-col items-center py-3 gap-2"
          style={{
            background: 'hsl(var(--surface-rail))',
            borderRight: HAIRLINE,
          }}
        >
          <div className="mb-2">
            <BardIcon size={36} />
          </div>

          <nav className="flex flex-col items-center gap-1.5 flex-1">
            {NAV.map(({ to, label, Icon, badge }) => {
              const isActive =
                location.pathname === to ||
                (to === '/chat' && location.pathname === '/');
              return (
                <Tooltip key={to}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate(to)}
                      className="relative flex items-center justify-center transition-colors duration-150"
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 8,
                        background: isActive
                          ? 'hsl(var(--primary) / 0.14)'
                          : 'transparent',
                        color: isActive
                          ? 'hsl(var(--primary))'
                          : 'hsl(var(--muted-foreground))',
                      }}
                      aria-label={label}
                    >
                      <Icon size={18} strokeWidth={1.8} />
                      {badge && (
                        <span
                          className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                          style={{ background: 'hsl(var(--primary))' }}
                        />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    {label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {/* Theme toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center transition-colors duration-150 text-muted-foreground hover:text-foreground"
                style={{ width: 38, height: 38, borderRadius: 8 }}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </TooltipContent>
          </Tooltip>

          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold"
            style={{
              background: 'hsl(var(--primary) / 0.14)',
              color: 'hsl(var(--primary))',
              border: '0.5px solid hsl(var(--primary) / 0.3)',
            }}
          >
            AA
          </div>
        </aside>

        {/* Recents sidebar (only on My Assistant) */}
        <aside
          className="flex-shrink-0 overflow-hidden flex flex-col transition-[width] duration-200 ease-out"
          style={{
            width: isAssistant ? 196 : 0,
            background: 'hsl(var(--surface-sidebar))',
            borderRight: isAssistant ? HAIRLINE : 'none',
          }}
        >
          {isAssistant && (
            <>
              <div className="flex items-center justify-between px-3 h-11 flex-shrink-0">
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Recents
                </span>
                <button
                  onClick={startNewChat}
                  className="text-[10px] px-2 py-1 rounded-md border border-border text-foreground/70 hover:text-primary hover:border-primary/40 transition-colors"
                >
                  New
                </button>
              </div>
              <div style={{ borderTop: HAIRLINE }} />
              <div className="flex-1 overflow-y-auto px-2 py-2">
                {sessions.length === 0 && (
                  <p className="text-xs text-muted-foreground px-2 py-2">
                    No chats yet
                  </p>
                )}
                <div className="space-y-0.5">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setCurrentSessionId(s.id)}
                      className={`w-full text-left text-xs px-2.5 py-1.5 rounded-md truncate transition-colors duration-150 ${
                        s.id === currentSessionId
                          ? 'bg-foreground/[0.06] text-foreground'
                          : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
                      }`}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </aside>

        {/* Main */}
        <div
          className="flex-1 flex flex-col min-w-0"
          style={{ background: 'hsl(var(--surface-main))' }}
        >
          {/* Topbar */}
          <div
            className="flex items-center justify-between px-4 flex-shrink-0"
            style={{
              height: 44,
              borderBottom: HAIRLINE,
            }}
          >
            <div className="flex items-center gap-2">
              <ActiveIcon size={15} style={{ color: 'hsl(var(--primary))' }} />
              <span className="font-serif-display text-[15px] text-foreground">
                {active.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'hsl(var(--primary))' }}
              />
              <span
                className="text-foreground/50"
                style={{ fontSize: '10.5px' }}
              >
                Educational use only
              </span>
            </div>
          </div>

          {/* Content */}
          <main className="flex-1 overflow-y-auto min-h-0">{children}</main>

          {/* Input bar (only on My Assistant) */}
          {inputBar}
        </div>
      </div>
    </TooltipProvider>
  );
}
