import { NavLink } from 'react-router-dom';
import { MessageCircle, UserCircle, Brain, Calculator } from 'lucide-react';

const tabs = [
  { to: '/chat', label: 'My Assistant', icon: MessageCircle },
  { to: '/my-patient', label: 'My Patient', icon: UserCircle, badge: 'New' },
  { to: '/pimp-me', label: 'Pimp Me', icon: Brain },
  { to: '/calculators', label: 'Calculators', icon: Calculator },
];

export function TabBar() {
  return (
    <nav className="bg-background border-b border-white/5">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-3 sm:px-5">
        <div className="flex items-center gap-1">
          {tabs.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative flex items-center gap-2 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={15} />
                  <span>{label}</span>
                  {badge && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold tracking-wide bg-primary/15 text-primary border border-primary/25">
                      {badge}
                    </span>
                  )}
                  {isActive && (
                    <span
                      className="absolute left-2 right-2 -bottom-px h-[2px] bg-primary rounded-full"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="hidden sm:flex items-center gap-1.5 pr-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="text-foreground/50" style={{ fontSize: '10.5px' }}>
            Educational use only
          </span>
        </div>
      </div>
    </nav>
  );
}
