import { create } from 'zustand';
import { api } from '@/lib/api';

// Convert hex color (#c2410c) to HSL string ("21 90% 48%") for CSS variables
function hexToHsl(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '21 90% 48%'; // fallback to DigyGo orange
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyBrandColor(hex: string): void {
  const hsl = hexToHsl(hex);
  const root = document.documentElement;
  root.style.setProperty('--primary', hsl);
  root.style.setProperty('--primary-dark', hsl); // same hue, sidebar uses this
  root.style.setProperty('--color-primary', hex); // raw hex for inline styles
}

interface BrandingState {
  isCustomDomain: boolean;
  tenantName: string | null;
  logoUrl: string | null;
  brandColor: string;
  replyToEmail: string | null;
  loaded: boolean;
  fetchBranding: () => Promise<void>;
}

export const useBrandingStore = create<BrandingState>((set) => ({
  isCustomDomain: false,
  tenantName: null,
  logoUrl: null,
  brandColor: '#c2410c',
  replyToEmail: null,
  loaded: false,

  fetchBranding: async () => {
    const hostname = window.location.hostname;
    const isCustom = hostname !== 'crm.digygo.in' && hostname !== 'localhost' && hostname !== '127.0.0.1';

    if (!isCustom) {
      set({ isCustomDomain: false, loaded: true });
      return;
    }

    try {
      const data = await api.get<{
        name: string;
        logoUrl: string | null;
        brandColor: string;
        replyToEmail: string | null;
      }>(`/api/public/branding?domain=${hostname}`);

      const brandColor = data.brandColor ?? '#c2410c';

      set({
        isCustomDomain: true,
        tenantName: data.name,
        logoUrl: data.logoUrl,
        brandColor,
        replyToEmail: data.replyToEmail,
        loaded: true,
      });

      // Apply brand color — updates all Tailwind primary classes via CSS variables
      applyBrandColor(brandColor);
    } catch {
      // 404 or network error — silently fall back to DigyGo defaults
      set({ isCustomDomain: false, loaded: true });
    }
  },
}));
