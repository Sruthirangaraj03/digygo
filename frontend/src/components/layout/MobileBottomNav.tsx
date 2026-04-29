import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Inbox, Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const bottomItems = [
  { label: 'Dashboard',  icon: LayoutDashboard,   path: '/dashboard' },
  { label: 'Leads',      icon: Users,              path: '/lead-management' },
  { label: 'Inbox',      icon: Inbox,              path: '/inbox' },
  { label: 'Settings',   icon: Settings,           path: '/settings' },
];

export function MobileBottomNav() {
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-black/[0.07] safe-area-pb"
      style={{ boxShadow: '0 -1px 0 rgba(0,0,0,0.04), 0 -4px 16px rgba(0,0,0,0.06)' }}>
      <div className="flex items-stretch h-16">
        {bottomItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link key={item.path} to={item.path}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-1 transition-colors relative',
                active ? 'text-primary' : 'text-[#9a8878]'
              )}>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-primary" />
              )}
              <item.icon className={cn('w-5 h-5 transition-all', active && 'scale-110')} />
              <span className={cn('text-[10px] leading-none font-medium', active && 'font-semibold')}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
