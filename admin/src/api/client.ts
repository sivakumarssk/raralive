const BASE_URL = `${import.meta.env.VITE_API_URL ?? 'http://192.168.0.8:5000'}/api`;

const TOKEN_ERROR_MSGS = ['invalid or expired token', 'invalid token', 'expired token', 'token expired', 'jwt expired', 'unauthorized'];

function isTokenError(status: number, message: string): boolean {
  if (status === 401) return true;
  return TOKEN_ERROR_MSGS.some(m => message.toLowerCase().includes(m));
}

function handleTokenError() {
  localStorage.removeItem('admin_token');
  window.location.href = '/login';
}

function getToken() {
  return localStorage.getItem('admin_token');
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
    const json = await res.json();
    if (isTokenError(res.status, json.message || '')) {
      handleTokenError();
      return { ok: false, message: 'Session expired. Please log in again.' };
    }
    if (!res.ok || !json.success) {
      return { ok: false, message: json.message || 'Something went wrong.' };
    }
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, message: 'Network error. Check your connection.' };
  }
}

async function uploadForm<T>(
  path: string,
  formData: FormData,
  method: 'POST' | 'PATCH' | 'PUT' = 'POST',
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const token = getToken();
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const json = await res.json();
    if (isTokenError(res.status, json.message || '')) {
      handleTokenError();
      return { ok: false, message: 'Session expired. Please log in again.' };
    }
    if (!res.ok || !json.success) {
      return { ok: false, message: json.message || 'Something went wrong.' };
    }
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, message: 'Network error. Check your connection.' };
  }
}

async function del<T>(path: string): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  return request<T>(path, { method: 'DELETE' });
}

export const api = {
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  get: <T>(path: string) =>
    request<T>(path, { method: 'GET' }),
  delete: <T>(path: string) =>
    del<T>(path),
  upload: <T>(path: string, formData: FormData) =>
    uploadForm<T>(path, formData, 'POST'),
  uploadPatch: <T>(path: string, formData: FormData) =>
    uploadForm<T>(path, formData, 'PATCH'),
};
