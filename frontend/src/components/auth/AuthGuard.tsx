import { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUser     = useAuthStore((s) => s.currentUser);
  const bootstrapFromRefresh = useAuthStore((s) => s.bootstrapFromRefresh);
  const [checking, setChecking] = useState(!isAuthenticated);
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) { setChecking(false); return; }
    bootstrapFromRefresh().finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#faf8f6]">
        <div className="w-8 h-8 border-4 border-[#ea580c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Super-admin-only routes — redirect everyone else to dashboard
  const isSuperAdminRoute = location.pathname.startsWith('/admin');
  if (isSuperAdminRoute && currentUser?.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
