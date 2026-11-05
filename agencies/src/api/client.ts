const BASE_URL = `${import.meta.env.VITE_API_URL ?? 'http://192.168.0.8:5000'}/api`;

const TOKEN_ERROR_MSGS = ['invalid or expired token', 'invalid token', 'expired token', 'token expired', 'jwt expired', 'unauthorized'];

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function isTokenError(status: number, message: string): boolean {
  if (status === 401) return true;
  return TOKEN_ERROR_MSGS.some(m => message.toLowerCase().includes(m));
}

function handleTokenError() {
  const isPoc = sessionStorage.getItem('portal_role') === 'POC';
  const code = (JSON.parse(sessionStorage.getItem('agency_info') ?? 'null') as { agentCode?: string } | null)?.agentCode;
  sessionStorage.clear();
  window.location.href = isPoc ? '/poc/login' : code ? `/agency/${code}` : '/';
}

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('agency_token');
  // A POC works on one assigned agency at a time; the server checks the assignment
  const pocAgency = sessionStorage.getItem('poc_agency_id');
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(pocAgency ? { 'X-Agency-Id': pocAgency } : {}),
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<Result<T>> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
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

/** A file the server only hands over with the session token (documents, Excel). */
async function fetchFile(path: string): Promise<Result<Blob>> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      if (isTokenError(res.status, json.message || '')) handleTokenError();
      return { ok: false, message: json.message || 'Could not get the file.' };
    }
    return { ok: true, data: await res.blob() };
  } catch {
    return { ok: false, message: 'Network error. Check your connection.' };
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  async download(path: string, filename: string): Promise<Result<true>> {
    const file = await fetchFile(path);
    if (!file.ok) return file;
    const url = URL.createObjectURL(file.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return { ok: true, data: true };
  },

  /** Opens in a new tab — the tab is opened first so popup blockers allow it. */
  async openFile(path: string): Promise<Result<true>> {
    const tab = window.open('', '_blank');
    const file = await fetchFile(path);
    if (!file.ok) {
      tab?.close();
      return file;
    }
    const url = URL.createObjectURL(file.data);
    if (tab) tab.location.href = url;
    else window.location.href = url;
    return { ok: true, data: true };
  },
};
