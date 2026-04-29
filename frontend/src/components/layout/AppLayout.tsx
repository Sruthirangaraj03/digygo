import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { useCrmStore } from '@/store/crmStore';
import { useAuthStore } from '@/store/authStore';
import { getSocket } from '@/lib/socket';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const initFromApi = useCrmStore((s) => s.initFromApi);
  const addNotification = useCrmStore((s) => s.addNotification);
  const { refreshPermissions, isImpersonating } = useAuthStore();
  const location = useLocation();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Real-time notification delivery
  useEffect(() => {
    const socket = getSocket();
    const handler = (n: any) => {
      addNotification({
        id:      n.id,
        type:    n.type ?? 'lead_created',
        message: n.title + (n.message ? `: ${n.message}` : ''),
        time:    n.created_at ?? new Date().toISOString(),
        read:    false,
        avatar:  '🔔',
      });
    };
    socket.on('notification:new', handler);
    return () => { socket.off('notification:new', handler); };
  }, [addNotification]);

  // Re-fetch data whenever the user navigates to a new page
  useEffect(() => {
    initFromApi();
    refreshPermissions();
  }, [location.pathname]);

  // Poll CRM data every 30 seconds; permissions are stable so only refresh every 5 min
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      initFromApi();
    }, 30_000);
    const permInterval = setInterval(() => {
      refreshPermissions();
    }, 5 * 60_000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      clearInterval(permInterval);
    };
  }, []);

  return (
    // pt-10 (40px) reserves space for the fixed ImpersonationBanner when active
    <div className={`h-[100dvh] flex w-full bg-[#faf8f6] overflow-hidden${isImpersonating ? ' pt-10' : ''}`}>
      {/* Sidebar — desktop only */}
      <div className="hidden md:flex">
        <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto flex flex-col min-h-0 border-t border-black/[0.06]">
          {/* pb-16 on mobile reserves space for the bottom nav */}
          <div className="px-3 py-4 md:px-6 md:py-5 flex flex-col flex-1 min-h-0 pb-20 md:pb-10">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <MobileBottomNav />
    </div>
  );
}
