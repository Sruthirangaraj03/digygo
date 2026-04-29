import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CompanyState {
  logoUrl: string | null;
  companyName: string;
  setLogo: (url: string | null) => void;
  setCompanyName: (name: string) => void;
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set) => ({
      logoUrl: null,
      companyName: 'DigyGo CRM',
      setLogo: (url) => set({ logoUrl: url }),
      setCompanyName: (name) => set({ companyName: name }),
    }),
    { name: 'digygo-company' }
  )
);
