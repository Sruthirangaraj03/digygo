import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

interface User {
  id: string;
  tenantId: string | null;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
}

interface AuthState {
  currentUser: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      token: null,
      isAuthenticated: false,

      login: async (email, password) => {
        try {
          const res = await api.post<{ token: string; user: User }>('/api/auth/login', { email, password });
          localStorage.setItem('digygo_token', res.token);
          set({ currentUser: res.user, token: res.token, isAuthenticated: true });
          return true;
        } catch {
          return false;
        }
      },

      logout: () => {
        localStorage.removeItem('digygo_token');
        set({ currentUser: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'digygo-auth',
      partialize: (s) => ({ currentUser: s.currentUser, token: s.token, isAuthenticated: s.isAuthenticated }),
    }
  )
);
