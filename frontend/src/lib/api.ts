export const BASE = import.meta.env.VITE_API_URL ?? '';

// In-memory token — never written to localStorage
let _accessToken: string | null = null;
export const setAccessToken = (t: string | null) => { _accessToken = t; };
export const getAccessToken = () => _accessToken;

// Deduplicates concurrent 401 → refresh attempts into one request
let _refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then(async (r) => {
      if (!r.ok) return null;
      const { token } = await r.json();
      return token as string;
    })
    .catch(() => null)
    .finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}, _retry = true): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(_accessToken ? { Authorization: `Bearer ${_accessToken}` } : {}),
      ...(options.headers as Record<string, string> ?? {}),
    },
  });

  if (res.status === 401 && _retry) {
    const newToken = await tryRefresh();
    if (newToken) {
      _accessToken = newToken;
      import('@/store/authStore').then(({ useAuthStore }) => {
        useAuthStore.getState().setToken(newToken);
      });
      return request<T>(path, options, false);
    }
    // Only force logout if refresh definitively failed (returned null from a 401/403)
    // — not on network errors where null means "couldn't reach server"
    const refreshRes = await fetch(`${BASE}/api/auth/refresh`, { method: 'POST', credentials: 'include' }).catch(() => null);
    if (!refreshRes || refreshRes.status === 401 || refreshRes.status === 403) {
      import('@/store/authStore').then(({ useAuthStore }) => {
        useAuthStore.getState().logout();
      });
    }
    throw new Error('Session expired');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}

export const api = {
  get:    <T>(path: string)                  => request<T>(path),
  post:   <T>(path: string, body: unknown)   => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown)   => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown)   => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string)                  => request<T>(path, { method: 'DELETE' }),
};
