// Production sets VITE_API_URL. In development the API runs on port 5000 of
// whatever host the portal was opened from (localhost or this PC's LAN IP),
// so a changed Wi-Fi IP doesn't break it.
const API_ORIGIN = import.meta.env.VITE_API_URL ?? `${window.location.protocol}//${window.location.hostname}:5000`;
const BASE_URL = `${API_ORIGIN}/api`;

const TOKEN_ERROR_MSGS = ['invalid or expired token', 'invalid token', 'expired token', 'token expired', 'jwt expired', 'unauthorized'];

/** `network` = the server couldn't be reached at all (no reply). */
type Result<T> = { ok: true; data: T } | { ok: false; message: string; network?: true };

function isTokenError(status: number, message: string): boolean {
  if (status === 401) return true;
  return TOKEN_ERROR_MSGS.some(m => message.toLowerCase().includes(m));
}

// A 401 only means "session expired" when there is a session. Before sign-in
// it's a wrong phone/password, which the login form shows itself.
function hasSession() {
  return !!sessionStorage.getItem('agency_token');
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
    if (hasSession() && isTokenError(res.status, json.message || '')) {
      handleTokenError();
      return { ok: false, message: 'Session expired. Please log in again.' };
    }
    if (!res.ok || !json.success) {
      return { ok: false, message: json.message || 'Something went wrong.' };
    }
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, message: 'Network error. Check your connection.', network: true };
  }
}

/** A file the server only hands over with the session token (documents, Excel). */
async function fetchFile(path: string): Promise<Result<Blob>> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      if (hasSession() && isTokenError(res.status, json.message || '')) handleTokenError();
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
