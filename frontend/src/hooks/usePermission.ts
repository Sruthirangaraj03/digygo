import { useAuthStore } from '@/store/authStore';

/**
 * Returns true if the current user has the given permission key.
 * admins and super_admins (permAll=true) are always granted.
 * For regular staff, checks the server-fetched permissions map.
 */
export function usePermission(permKey: string): boolean {
  return useAuthStore((s) => s.permAll || !!s.permissions[permKey]);
}

/**
 * Returns a checker function for multiple permission keys.
 * Avoids calling usePermission() in a loop (violates Rules of Hooks).
 */
export function usePermissions() {
  const permAll = useAuthStore((s) => s.permAll);
  const permissions = useAuthStore((s) => s.permissions);
  return (permKey: string): boolean => permAll || !!permissions[permKey];
}
