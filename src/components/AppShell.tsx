import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { WardBardLogo } from './WardBardLogo';
import { TabBar } from './TabBar';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="px-4 py-3 border-b border-border flex items-center justify-between">
        <button onClick={() => navigate('/')} className="flex items-center">
          <WardBardLogo size="sm" />
        </button>
      </header>
      <TabBar />
      <main className="flex-1 flex flex-col min-h-0">{children}</main>
    </div>
  );
}
