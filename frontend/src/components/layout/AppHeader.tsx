import { useState } from 'react';
import { Bell, X, LogOut, Settings, User, Unplug } from 'lucide-react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useCrmStore } from '@/store/crmStore';
import { useAuthStore } from '@/store/authStore';
import { useCompanyStore } from '@/store/companyStore';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const sectionNavs: Record<string, { label: string; path: string }[]> = {
  '/lead-generation': [
    { label: 'Overview', path: '/lead-generation' },
    { label: 'Meta Forms', path: '/lead-generation/meta-forms' },
    { label: 'Custom Forms', path: '/lead-generation/custom-forms' },
  ],
  '/lead-management': [
    { label: 'Overview', path: '/lead-management' },
    { label: 'Pipeline', path: '/leads' },
    { label: 'Follow-ups', path: '/lead-management/followups' },
    { label: 'Contacts', path: '/lead-management/contacts' },
    { label: 'Contact Group', path: '/lead-management/contact-groups' },
  ],
  '/automation': [
    { label: 'Overview', path: '/automation' },
    { label: 'Workflows', path: '/automation/workflows' },
    { label: 'Templates', path: '/automation/templates' },
    { label: 'Pincode Routing', path: '/automation/pincode-routing' },
  ],
  '/calendar': [
    { label: 'Dashboard', path: '/calendar' },
    { label: 'Create / Edit', path: '/calendar?tab=create-edit' },
    { label: 'Appointments', path: '/calendar?tab=appointments' },
  ],
  '/fields': [
    { label: 'Standard Fields', path: '/fields' },
    { label: 'Additional Fields', path: '/fields?tab=additional' },
    { label: 'Values', path: '/fields?tab=values' },
  ],
  '/staff': [
    { label: 'Team', path: '/staff' },
    { label: 'Roles & Permissions', path: '/staff?tab=roles' },
    { label: 'Performance', path: '/staff?tab=performance' },
  ],
  '/settings': [
    { label: 'Overview', path: '/settings' },
    { label: 'Company Details', path: '/settings/company' },
    { label: 'Integrations', path: '/settings/integrations' },
    { label: 'Notifications', path: '/settings/notifications' },
  ],
};

// Pages that have a disconnect action — path → { label, endpoint, confirm }
const PAGE_DISCONNECT: Record<string, { label: string; endpoint: string; confirm: string }> = {
  '/lead-generation/meta-forms': {
    label: 'Disconnect Meta',
    endpoint: '/api/integrations/meta/disconnect',
    confirm: 'Disconnect Meta? All linked forms and leads sync will stop.',
  },
  '/lead-generation/whatsapp': {
    label: 'Disconnect WhatsApp',
    endpoint: '/api/integrations/waba/disconnect',
    confirm: 'Disconnect WhatsApp? The WABA integration will be removed.',
  },
};

const notifIconColors: Record<string, string> = {
  lead_created:   'bg-primary/10 text-primary',
  stage_changed:  'bg-purple-100 text-purple-600',
  new_message:    'bg-emerald-500/10 text-emerald-600',
  follow_up_due:  'bg-orange-500/10 text-orange-500',
  appointment:    'bg-teal-100 text-teal-600',
};

export function AppHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const { notifications, markAllNotificationsRead, markNotificationRead } = useCrmStore();
  const { currentUser, logout, isImpersonating } = useAuthStore();
  const { companyName } = useCompanyStore();
  const unreadCount = notifications.filter((n) => !n.read).length;

  const initials = currentUser
    ? `${currentUser.name.split(' ')[0][0]}${currentUser.name.split(' ')[1]?.[0] ?? ''}`
    : 'U';

  const roleLabel = currentUser?.role === 'super_admin'
    ? 'Super Admin'
    : currentUser?.role === 'owner'
      ? 'Owner'
      : 'Staff';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const pageDisconnect = PAGE_DISCONNECT[location.pathname] ?? null;
  const handleDisconnect = async () => {
    if (!pageDisconnect) return;
    if (!window.confirm(pageDisconnect.confirm)) return;
    setDisconnecting(true);
    try {
      await api.delete(pageDisconnect.endpoint);
      toast.success(`${pageDisconnect.label.replace('Disconnect ', '')} disconnected`);
      navigate(location.pathname); // reload same page to reflect state
      window.location.reload();
    } catch {
      toast.error('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const activeSection = Object.keys(sectionNavs).find((prefix) => {
    // exclude calendar edit page — let it show no sub-nav
    if (prefix === '/calendar' && location.pathname.startsWith('/calendar/edit')) return false;
    if (location.pathname === prefix || location.pathname.startsWith(prefix + '/')) return true;
    // also activate lead-management nav when on /leads
    if (prefix === '/lead-management' && location.pathname === '/leads') return true;
    return false;
  });
  const subNav = activeSection ? sectionNavs[activeSection] : null;

  const isTabActive = (path: string) => {
    const [p, q] = path.split('?');
    if (q) return location.pathname === p && location.search === `?${q}`;
    // for paths without query, only match if there's no search query either
    return location.pathname === p && !location.search;
  };

  return (
    <header className="bg-white border-b border-black/5 sticky top-0 z-30 shrink-0" style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.04)' }}>
      <div className="h-14 md:h-16 flex items-center px-4 md:px-6 gap-3 md:gap-5">

        {/* Mobile: logo mark */}
        <div className="md:hidden flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
            <img src="/digygo-logo.png" alt="DigyGo" className="w-full h-full object-contain" />
          </div>
          <span className="font-headline text-[15px] font-bold text-[#1c1410]">{companyName}</span>
        </div>

        {/* Tab nav — desktop only in full, scrollable on mobile */}
        <div className="flex-1 flex items-center overflow-x-auto scrollbar-hide">
          {subNav ? (
            <nav className="flex items-center h-14 md:h-16">
              {subNav.map((tab) => (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={cn(
                    'relative flex items-center h-full px-3 md:px-4 text-[12px] md:text-[13.5px] font-medium whitespace-nowrap transition-colors duration-150 select-none',
                    isTabActive(tab.path)
                      ? 'text-primary font-semibold'
                      : 'text-[#7a6b5c] hover:text-[#1c1410]'
                  )}
                >
                  {tab.label}
                  {isTabActive(tab.path) && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-primary" />
                  )}
                </Link>
              ))}
            </nav>
          ) : (
            <div />
          )}

          {/* Per-page Disconnect button */}
          {pageDisconnect && (
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-red-500 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Unplug className="w-3.5 h-3.5" />
              {disconnecting ? 'Disconnecting…' : pageDisconnect.label}
            </button>
          )}
        </div>

        {/* Right — bell + profile, always visible */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">

          {/* Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className={cn(
                'relative p-2 rounded-xl text-[#7a6b5c] hover:text-primary hover:bg-[#f5ede3] transition-colors',
                showNotifs && 'text-primary bg-[#f5ede3]'
              )}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification dropdown */}
            {showNotifs && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
                <div className="fixed md:absolute right-2 md:right-0 top-16 md:top-11 left-2 md:left-auto md:w-80 bg-white rounded-2xl z-50 overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.14)' }}>
                  <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-bold text-[#1c1410]">Notifications</p>
                      <p className="text-[11px] text-[#8a7c6e] mt-0.5">
                        {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllNotificationsRead()}
                          className="text-[10px] font-bold text-primary hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        onClick={() => setShowNotifs(false)}
                        className="p-1.5 rounded-lg hover:bg-[#f5ede3] text-[#7a6b5c] transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-black/5">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <div className="w-10 h-10 rounded-2xl bg-[#f5ede3] flex items-center justify-center">
                          <Bell size={20} className="text-[#c4b09e]" />
                        </div>
                        <p className="text-[13px] font-semibold text-[#8a7c6e]">No notifications</p>
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <button
                          key={n.id}
                          onClick={() => { markNotificationRead(n.id); setShowNotifs(false); }}
                          className={cn(
                            'w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#faf8f6] transition-colors text-left',
                            !n.read && 'bg-primary/[0.03]'
                          )}
                        >
                          <div className={cn(
                            'w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0',
                            notifIconColors[n.type] || 'bg-muted text-muted-foreground'
                          )}>
                            {n.avatar}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-[#1c1410] line-clamp-2">{n.message}</p>
                            <p className="text-[11px] text-[#8a7c6e] mt-0.5">
                              {formatDistanceToNow(new Date(n.time), { addSuffix: true })}
                            </p>
                          </div>
                          {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-black/8" />

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => { setShowProfile((v) => !v); setShowNotifs(false); }}
              className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-[#f5ede3] transition-colors"
            >
              <div className="hidden sm:block text-right">
                <p className="text-[13px] font-semibold text-[#1c1410] leading-tight">{currentUser?.name ?? 'User'}</p>
                <p className="text-[11px] text-[#7a6b5c] leading-tight mt-0.5">{roleLabel}</p>
              </div>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-primary/20 hover:ring-primary/40 transition-all shrink-0"
                style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)' }}
              >
                {initials}
              </div>
            </button>

            {/* Profile dropdown */}
            {showProfile && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfile(false)} />
                <div className="absolute right-0 top-12 z-50 w-56 bg-white rounded-2xl border border-black/5 overflow-hidden"
                  style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.14)' }}>

                  {/* User info */}
                  <div className="px-4 py-3.5 border-b border-black/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)' }}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-[#1c1410] truncate">{currentUser?.name}</p>
                        <p className="text-[11px] text-[#7a6b5c] truncate">{currentUser?.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="py-1.5">
                    <Link to="/settings/company" onClick={() => setShowProfile(false)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#1c1410] hover:bg-[#faf8f6] transition-colors">
                      <User className="w-4 h-4 text-[#7a6b5c]" /> Profile
                    </Link>
                    <Link to="/settings" onClick={() => setShowProfile(false)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#1c1410] hover:bg-[#faf8f6] transition-colors">
                      <Settings className="w-4 h-4 text-[#7a6b5c]" /> Settings
                    </Link>
                  </div>

                  <div className="border-t border-black/5 py-1.5">
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50 transition-colors font-medium">
                      <LogOut className="w-4 h-4" /> Log out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
