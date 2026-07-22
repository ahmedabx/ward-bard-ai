import { ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare, User, Calculator, FileQuestion, LogOut, Settings, Menu, X } from 'lucide-react';
import type { User as SupaUser } from '@supabase/supabase-js';
import { MedBardMark } from './MedBardLogo';
import { useChatContext } from '@/contexts/ChatContext';
import { useStudyMode } from '@/contexts/ModeContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AppLayoutProps {
  children: ReactNode;
  inputBar?: ReactNode;
}

const NAV = [
  { to: '/chat', label: 'My Assistant', Icon: MessageSquare },
  { to: '/my-patient', label: 'My Patient', Icon: User },
  { to: '/qbank', label: 'Qbank Maker', Icon: FileQuestion },
  { to: '/calculators', label: 'Calculators', Icon: Calculator },
];

const HAIRLINE = '0.5px solid hsl(var(--hairline) / var(--hairline-alpha))';

function initialsOf(name?: string | null, email?: string | null) {
  const src = name || email || '';
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U';
}

export function AppLayout({ children, inputBar }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAssistant = location.pathname === '/chat' || location.pathname === '/';

  const active = NAV.find(n => n.to === location.pathname) ?? NAV[0];
  const ActiveIcon = active.Icon;

  const { sessions, currentSessionId, setCurrentSessionId, startNewChat } = useChatContext();
  const { mode, setMode } = useStudyMode();

  const [user, setUser] = useState<SupaUser | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const displayName = (user?.user_metadata?.full_name as string) || user?.email || '';
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className="h-screen flex overflow-hidden text-foreground"
        style={{ background: 'hsl(var(--surface-main))' }}
      >
        {/* Left rail — icon nav + brand */}
        <aside
          className="w-[220px] flex-shrink-0 flex flex-col"
          style={{ background: 'hsl(var(--surface-rail))', borderRight: HAIRLINE }}
        >
          {/* Brand */}
          <div className="px-4 h-14 flex items-center gap-2.5 flex-shrink-0" style={{ borderBottom: HAIRLINE }}>
            <MedBardMark size={20} />
            <span className="font-serif-display text-[17px] text-foreground leading-none">MedBard</span>
          </div>

          {/* Primary nav */}
          <nav className="px-2 pt-3 pb-2 space-y-0.5 flex-shrink-0">
            {NAV.map(({ to, label, Icon }) => {
              const isActive =
                location.pathname === to || (to === '/chat' && location.pathname === '/');
              return (
                <button
                  key={to}
                  onClick={() => navigate(to)}
                  className="w-full flex items-center gap-2.5 h-9 px-2.5 rounded-md text-[13px] transition-colors"
                  style={{
                    background: isActive ? 'hsl(var(--primary) / 0.12)' : 'transparent',
                    color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    borderLeft: isActive
                      ? '2px solid hsl(var(--primary))'
                      : '2px solid transparent',
                    paddingLeft: isActive ? 8 : 10,
                  }}
                >
                  <Icon size={15} strokeWidth={1.75} />
                  <span className="font-medium">{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Recents — only on My Assistant */}
          {isAssistant && (
            <div className="flex-1 flex flex-col min-h-0 mt-2" style={{ borderTop: HAIRLINE }}>
              <div className="flex items-center justify-between px-4 h-9 flex-shrink-0">
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Recent
                </span>
                <button
                  onClick={startNewChat}
                  className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
                >
                  + New
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-2">
                {sessions.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/70 px-2.5 py-1.5">No chats yet</p>
                )}
                <div className="space-y-0.5">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setCurrentSessionId(s.id)}
                      className="w-full text-left text-[12px] px-2.5 py-1.5 rounded-md truncate transition-colors"
                      style={{
                        background: s.id === currentSessionId ? 'hsl(var(--foreground) / 0.05)' : 'transparent',
                        color: s.id === currentSessionId ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                      }}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Spacer when not on assistant */}
          {!isAssistant && <div className="flex-1" />}

          {/* User area */}
          <div className="px-2 py-2 flex-shrink-0" style={{ borderTop: HAIRLINE }}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-full flex items-center gap-2.5 h-10 px-2 rounded-md hover:bg-foreground/[0.04] transition-colors text-left"
                  aria-label="Account menu"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
                      style={{
                        background: 'hsl(var(--primary) / 0.15)',
                        color: 'hsl(var(--primary))',
                      }}
                    >
                      {initialsOf(displayName, user?.email)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium text-foreground truncate leading-tight">
                      {displayName || 'Account'}
                    </div>
                    {user?.email && displayName !== user.email && (
                      <div className="text-[10px] text-muted-foreground truncate leading-tight">
                        {user.email}
                      </div>
                    )}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  {user?.email || 'Signed in'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="text-xs">
                  <Settings size={13} className="mr-2" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut} className="text-xs">
                  <LogOut size={13} className="mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0" style={{ background: 'hsl(var(--surface-main))' }}>
          {/* Topbar */}
          <div
            className="flex items-center justify-between px-5 flex-shrink-0"
            style={{ height: 48, borderBottom: HAIRLINE }}
          >
            <div className="flex items-center gap-2">
              <ActiveIcon size={14} style={{ color: 'hsl(var(--muted-foreground))' }} />
              <span className="font-serif-display text-[15px] text-foreground">{active.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="flex items-center rounded-md p-0.5"
                style={{ border: HAIRLINE, background: 'hsl(var(--surface-rail) / 0.5)' }}
                role="tablist"
                aria-label="Study mode"
              >
                {(['preclinical', 'clinical'] as const).map((m) => {
                  const on = mode === m;
                  return (
                    <button
                      key={m}
                      role="tab"
                      aria-selected={on}
                      onClick={() => setMode(m)}
                      className="px-2.5 h-6 rounded text-[11px] font-medium transition-colors"
                      style={{
                        background: on ? 'hsl(var(--primary) / 0.15)' : 'transparent',
                        color: on ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                      }}
                    >
                      {m === 'preclinical' ? 'Preclinical' : 'Clinical'}
                    </button>
                  );
                })}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[10.5px] text-muted-foreground cursor-default">
                    For exam preparation and study
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[260px]">
                  MedBard is intended for medical education and exam preparation. Not for real-world
                  patient-care decisions.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <main className="flex-1 overflow-y-auto min-h-0">{children}</main>

          {inputBar}
        </div>
      </div>
    </TooltipProvider>
  );
}
