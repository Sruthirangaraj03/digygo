import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { useCrmStore } from '@/store/crmStore';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const initFromApi = useCrmStore((s) => s.initFromApi);

  useEffect(() => { initFromApi(); }, []);

  return (
    <div className="h-[100dvh] flex w-full bg-[#faf8f6] overflow-hidden">
      {/* Sidebar — desktop only */}
      <div className="hidden md:flex">
        <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto flex flex-col min-h-0">
          {/* pb-16 on mobile reserves space for the bottom nav */}
          <div className="px-3 py-4 md:px-6 md:py-5 flex flex-col flex-1 min-h-0 pb-20 md:pb-5">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <MobileBottomNav />
    </div>
  );
}
