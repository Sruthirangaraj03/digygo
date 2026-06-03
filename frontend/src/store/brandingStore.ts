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
  if (!hex) return;
  const hsl = hexToHsl(hex);
  const root = document.documentElement;
  root.style.setProperty('--primary', hsl);
  root.style.setProperty('--primary-dark', hsl);
  root.style.setProperty('--color-primary', hex);
}

const THEME_STYLE_ID = 'dg-tenant-theme';

// Inject a stylesheet that remaps the app's hardcoded hex colors to the tenant's theme.
// Safe + reversible: defaults are untouched, so existing tenants see no change until they pick colors.
function injectThemeOverrides(opts: { brandColor?: string | null; appBgColor?: string | null; accentColor?: string | null }): void {
  let el = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!el) { el = document.createElement('style'); el.id = THEME_STYLE_ID; document.head.appendChild(el); }

  const rules: string[] = [];
  const b = opts.brandColor;
  const bg = opts.appBgColor;
  const ac = opts.accentColor;

  // Brand color → remap the hardcoded orange shades (#c2410c / #ea580c / #f97316)
  if (b && b.toLowerCase() !== '#ea580c') {
    rules.push(`.bg-\\[\\#c2410c\\],.bg-\\[\\#ea580c\\],.bg-\\[\\#f97316\\]{background-color:${b}!important}`);
    rules.push(`.text-\\[\\#c2410c\\],.text-\\[\\#ea580c\\],.text-\\[\\#f97316\\]{color:${b}!important}`);
    rules.push(`.border-\\[\\#c2410c\\],.border-\\[\\#ea580c\\],.border-\\[\\#f97316\\]{border-color:${b}!important}`);
    // The orange gradient used on primary buttons (login, Add Lead etc.)
    rules.push(`[style*="linear-gradient(135deg, #c2410c"]{background:${b}!important}`);
  }

  // App background → remap the cream #faf8f6 page/card backgrounds
  if (bg && bg.toLowerCase() !== '#faf8f6') {
    rules.push(`.bg-\\[\\#faf8f6\\]{background-color:${bg}!important}`);
  }

  // Accent → remap the warm selected/hover beige (#f5ede3) and light primary tint (#fde8d8 / #fff7ed)
  if (ac) {
    rules.push(`.bg-\\[\\#f5ede3\\],.hover\\:bg-\\[\\#f5ede3\\]:hover,.bg-\\[\\#fde8d8\\],.bg-\\[\\#fff7ed\\]{background-color:${ac}!important}`);
  }

  el.textContent = rules.join('\n');
}

function clearThemeOverrides(): void {
  const el = document.getElementById(THEME_STYLE_ID);
  if (el) el.textContent = '';
}

function applyFavicon(url: string | null): void {
  if (!url) return;
  let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
}

function applyTitle(title: string | null): void {
  if (title) document.title = title;
}

export interface BrandingData {
  name?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  bannerUrl?: string | null;
  brandColor?: string | null;
  loginBgColor?: string | null;
  tabTitle?: string | null;
  appBgColor?: string | null;
  accentColor?: string | null;
}

interface BrandingState {
  isCustomDomain: boolean;
  branded: boolean;          // true if any custom branding (logo/name) is active
  tenantName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  bannerUrl: string | null;
  brandColor: string;
  loginBgColor: string | null;
  tabTitle: string | null;
  appBgColor: string | null;
  accentColor: string | null;
  loaded: boolean;
  fetchBranding: () => Promise<void>;          // pre-login: by custom domain
  applyTenantBranding: (d: BrandingData) => void; // post-login: by authed tenant
  resetBranding: () => void;                   // on logout
}

const DEFAULT_COLOR = '#c2410c';

export const useBrandingStore = create<BrandingState>((set) => ({
  isCustomDomain: false,
  branded: false,
  tenantName: null,
  logoUrl: null,
  faviconUrl: null,
  bannerUrl: null,
  brandColor: DEFAULT_COLOR,
  loginBgColor: null,
  tabTitle: null,
  appBgColor: null,
  accentColor: null,
  loaded: false,

  // Pre-login: fetch branding for the current custom domain (login page)
  fetchBranding: async () => {
    const hostname = window.location.hostname;
    const isCustom = hostname !== 'crm.digygo.in' && hostname !== 'localhost' && hostname !== '127.0.0.1';

    if (!isCustom) {
      set({ isCustomDomain: false, loaded: true });
      return;
    }

    try {
      const data = await api.get<BrandingData>(`/api/public/branding?domain=${hostname}`);
      const brandColor = data.brandColor ?? DEFAULT_COLOR;
      set({
        isCustomDomain: true,
        branded: true,
        tenantName: data.name ?? null,
        logoUrl: data.logoUrl ?? null,
        faviconUrl: data.faviconUrl ?? null,
        bannerUrl: data.bannerUrl ?? null,
        brandColor,
        loginBgColor: data.loginBgColor ?? null,
        tabTitle: data.tabTitle ?? null,
        appBgColor: data.appBgColor ?? null,
        accentColor: data.accentColor ?? null,
        loaded: true,
      });
      applyBrandColor(brandColor);
      applyFavicon(data.faviconUrl ?? null);
      applyTitle(data.tabTitle ?? null);
      injectThemeOverrides({ brandColor, appBgColor: data.appBgColor, accentColor: data.accentColor });
    } catch {
      set({ isCustomDomain: false, loaded: true });
    }
  },

  // Post-login: apply the authenticated tenant's branding (any domain)
  applyTenantBranding: (d: BrandingData) => {
    const brandColor = d.brandColor ?? DEFAULT_COLOR;
    const hasCustom = !!(d.logoUrl || d.tabTitle || (d.brandColor && d.brandColor !== DEFAULT_COLOR) || d.faviconUrl || d.appBgColor || d.accentColor);
    set({
      branded: hasCustom,
      tenantName: d.name ?? null,
      logoUrl: d.logoUrl ?? null,
      faviconUrl: d.faviconUrl ?? null,
      bannerUrl: d.bannerUrl ?? null,
      brandColor,
      loginBgColor: d.loginBgColor ?? null,
      tabTitle: d.tabTitle ?? null,
      appBgColor: d.appBgColor ?? null,
      accentColor: d.accentColor ?? null,
      loaded: true,
    });
    applyBrandColor(brandColor);
    applyFavicon(d.faviconUrl ?? null);
    applyTitle(d.tabTitle ?? null);
    injectThemeOverrides({ brandColor, appBgColor: d.appBgColor, accentColor: d.accentColor });
  },

  resetBranding: () => {
    const root = document.documentElement;
    root.style.removeProperty('--primary');
    root.style.removeProperty('--primary-dark');
    root.style.removeProperty('--color-primary');
    clearThemeOverrides();
    set({
      isCustomDomain: false, branded: false, tenantName: null, logoUrl: null,
      faviconUrl: null, bannerUrl: null, brandColor: DEFAULT_COLOR,
      loginBgColor: null, tabTitle: null, appBgColor: null, accentColor: null,
    });
  },
}));
