import { ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare, User, Calculator, FileQuestion, LogOut, Settings, Menu, X } from 'lucide-react';
import type { User as SupaUser } from '@supabase/supabase-js';
import { MedBardMark } from './MedBardLogo';
import { useChatContext } from '@/contexts/ChatContext';

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


  const [user, setUser] = useState<SupaUser | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

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
        {/* Mobile drawer backdrop */}
        {drawerOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
        )}

        {/* Left rail — hidden on mobile, drawer on toggle */}
        <aside
          className={`${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0 fixed md:static z-50 md:z-auto top-0 left-0 h-full w-[260px] md:w-[220px] flex-shrink-0 flex flex-col transition-transform duration-200 ease-out`}
          style={{ background: 'hsl(var(--surface-rail))', borderRight: HAIRLINE }}
        >
          {/* Brand */}
          <div className="px-4 h-14 flex items-center justify-between gap-2.5 flex-shrink-0" style={{ borderBottom: HAIRLINE }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <MedBardMark size={20} />
              <span className="font-serif-display text-[17px] text-foreground leading-none">MedBard</span>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="md:hidden p-1.5 -mr-1 rounded-md text-muted-foreground hover:text-foreground"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
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
                  className="w-full flex items-center gap-3 md:gap-2.5 min-h-[44px] md:h-9 px-3 md:px-2.5 rounded-md text-[14px] md:text-[13px] transition-colors"
                  style={{
                    background: isActive ? 'hsl(var(--primary) / 0.12)' : 'transparent',
                    color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    borderLeft: isActive
                      ? '2px solid hsl(var(--primary))'
                      : '2px solid transparent',
                    paddingLeft: isActive ? 10 : 12,
                  }}
                >
                  <Icon size={17} strokeWidth={1.75} />
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
                      className="w-full text-left text-[13px] md:text-[12px] px-3 md:px-2.5 py-2.5 md:py-1.5 rounded-md truncate transition-colors"
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
            className="flex flex-col md:flex-row md:items-center md:justify-between px-4 md:px-5 flex-shrink-0"
            style={{ borderBottom: HAIRLINE }}
          >
            <div className="flex items-center justify-between md:justify-start gap-2 h-12 md:h-12 w-full md:w-auto">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="md:hidden -ml-1 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
                  aria-label="Open menu"
                >
                  <Menu size={18} />
                </button>
                <ActiveIcon size={14} style={{ color: 'hsl(var(--muted-foreground))' }} />
                <span className="font-serif-display text-[15px] text-foreground truncate">{active.label}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 pb-2 md:pb-0 md:py-0 w-full md:w-auto justify-between md:justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="hidden md:inline text-[10.5px] text-muted-foreground cursor-default">
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
