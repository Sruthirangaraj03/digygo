import { create } from 'zustand';
import { StaffMember, staff } from '@/data/mockData';

interface AuthState {
  currentUser: StaffMember | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  isAuthenticated: false,

  login: (email, _password) => {
    const user = staff.find((s) => s.email.toLowerCase() === email.toLowerCase());
    if (user) {
      set({ currentUser: user, isAuthenticated: true });
      return true;
    }
    // Accept any non-empty credentials and default to first admin
    if (email && _password) {
      set({ currentUser: staff[0], isAuthenticated: true });
      return true;
    }
    return false;
  },

  logout: () => set({ currentUser: null, isAuthenticated: false }),
}));
