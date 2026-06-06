const BASE_URL = `${import.meta.env.VITE_API_URL ?? 'http://192.168.0.8:5000'}/api`;

function getToken() {
  return sessionStorage.getItem('agency_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const token = getToken();
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      ...options,
    });
    if (res.status === 401) {
      sessionStorage.removeItem('agency_token');
      window.location.href = '/';
      return { ok: false, message: 'Session expired. Please log in again.' };
    }
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { ok: false, message: json.message || 'Something went wrong.' };
    }
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, message: 'Network error. Check your connection.' };
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
};
