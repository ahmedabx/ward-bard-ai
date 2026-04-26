import { NavLink } from 'react-router-dom';
import { MessageSquare, BookOpen, Calculator, CalendarDays } from 'lucide-react';

const tabs = [
  { to: '/chat', label: 'Cases', icon: MessageSquare },
  { to: '/literature', label: 'Literature', icon: BookOpen },
  { to: '/calculators', label: 'Calculators', icon: Calculator },
  { to: '/daily', label: 'Daily', icon: CalendarDays },
];

export function TabBar() {
  return (
    <nav className="border-b border-border bg-card/40 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto flex items-center justify-around px-2">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 sm:px-5 py-2.5 text-xs sm:text-sm font-medium transition-all duration-150 border-b-2 flex-1 sm:flex-none ${
                isActive
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              }`
            }
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
