import { useEffect, useState } from 'react';
import { api } from '../../api/client';

type Status = 'open' | 'reviewed' | 'dismissed';
type Kind = 'messages' | 'users';

type MessageReport = {
  id: string;
  message_id: string | null;
  message_text: string;
  reason: string | null;
  status: Status;
  created_at: string;
  room_id: string | null;
  room_name: string | null;
  reporter_id: string | null;
  reporter_name: string | null;
  reporter_username: string | null;
  reporter_phone: string | null;
  author_id: string | null;
  author_name: string | null;
  author_username: string | null;
  author_phone: string | null;
};

type UserReport = {
  id: string;
  reason: string;
  note: string | null;
  status: Status;
  created_at: string;
  room_id: string | null;
  room_name: string | null;
  reporter_id: string | null;
  reporter_name: string | null;
  reporter_username: string | null;
  reporter_phone: string | null;
  reported_id: string | null;
  reported_name: string | null;
  reported_username: string | null;
  reported_phone: string | null;
};

const STATUS_LABEL: Record<Status, string> = { open: 'Open', reviewed: 'Reviewed', dismissed: 'Dismissed' };
const STATUS_STYLE: Record<Status, string> = {
  open: 'bg-amber-50 text-amber-600',
  reviewed: 'bg-green-50 text-green-600',
  dismissed: 'bg-gray-100 text-gray-500',
};

function person(name: string | null, username: string | null, phone: string | null) {
  const main = name || username || 'Unknown user';
  const handle = username && name ? ` (@${username})` : '';
  return `${main}${handle}${phone ? ` · ${phone}` : ''}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm text-gray-800 truncate">{children}</p>
    </div>
  );
}

export function ReportsPage() {
  const [kind, setKind] = useState<Kind>('messages');
  const [status, setStatus] = useState<Status | 'all'>('open');
  const [messages, setMessages] = useState<MessageReport[]>([]);
  const [users, setUsers] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = status === 'all' ? '' : `?status=${status}`;
    if (kind === 'messages') {
      api.get<MessageReport[]>(`/reports/admin/messages${q}`)
        .then(r => { if (r.ok) setMessages(r.data); })
        .finally(() => setLoading(false));
    } else {
      api.get<UserReport[]>(`/reports/admin/users${q}`)
        .then(r => { if (r.ok) setUsers(r.data); })
        .finally(() => setLoading(false));
    }
  }, [kind, status]);

  const setItemStatus = async (id: string, next: Status) => {
    const r = await api.patch<{ id: string; status: Status }>(`/reports/admin/${kind}/${id}/status`, { status: next });
    if (!r.ok) return;
    const keep = status === 'all' || status === next;
    if (kind === 'messages') {
      setMessages(prev => keep ? prev.map(i => i.id === id ? { ...i, status: next } : i) : prev.filter(i => i.id !== id));
    } else {
      setUsers(prev => keep ? prev.map(i => i.id === id ? { ...i, status: next } : i) : prev.filter(i => i.id !== id));
    }
  };

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
      active ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
    }`;

  const actions = (id: string, current: Status) => (
    <div className="flex gap-2 mt-3">
      {current !== 'reviewed' && (
        <button onClick={() => setItemStatus(id, 'reviewed')}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-600 hover:bg-green-100">
          Mark reviewed
        </button>
      )}
      {current !== 'dismissed' && (
        <button onClick={() => setItemStatus(id, 'dismissed')}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 text-gray-600 hover:bg-gray-100">
          Dismiss
        </button>
      )}
      {current !== 'open' && (
        <button onClick={() => setItemStatus(id, 'open')}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-600 hover:bg-amber-100">
          Reopen
        </button>
      )}
    </div>
  );

  const list = kind === 'messages' ? messages : users;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Messages and users reported from chat rooms</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setKind('messages')} className={chip(kind === 'messages')}>Message reports</button>
        <button onClick={() => setKind('users')} className={chip(kind === 'users')}>User reports</button>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        {(['open', 'reviewed', 'dismissed', 'all'] as const).map(s => (
          <button key={s} onClick={() => setStatus(s)} className={chip(status === s)}>
            {s === 'all' ? 'All' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <p className="text-gray-400 font-medium">No reports</p>
        </div>
      ) : kind === 'messages' ? (
        <div className="space-y-3">
          {messages.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2">
                {r.reason && <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-red-50 text-red-600">{r.reason}</span>}
                <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                <span className="text-xs text-gray-400 ml-auto">{new Date(r.created_at).toLocaleString()}</span>
              </div>

              <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Reported message</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{r.message_text}</p>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Message by">{person(r.author_name, r.author_username, r.author_phone)}</Field>
                <Field label="Reported by">{person(r.reporter_name, r.reporter_username, r.reporter_phone)}</Field>
                <Field label="Chatroom">{r.room_name ?? r.room_id ?? '—'}</Field>
              </div>

              {actions(r.id, r.status)}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {users.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-red-50 text-red-600">{r.reason}</span>
                <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                <span className="text-xs text-gray-400 ml-auto">{new Date(r.created_at).toLocaleString()}</span>
              </div>
              {r.note && <p className="mt-3 text-sm text-gray-800 whitespace-pre-wrap break-words">{r.note}</p>}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Reported user">{person(r.reported_name, r.reported_username, r.reported_phone)}</Field>
                <Field label="Reported by">{person(r.reporter_name, r.reporter_username, r.reporter_phone)}</Field>
                <Field label="Chatroom">{r.room_name ?? r.room_id ?? '—'}</Field>
              </div>
              {actions(r.id, r.status)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
