import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Badge, Card, Empty, ErrorNote, Loading, PageHeader, buttonPrimary, dateTime, input } from '../components/ui';

type Ticket = {
  id: string; subject: string; message: string; status: string;
  admin_reply: string | null; created_at: string; resolved_at: string | null;
};

const SUPPORT_EMAIL = 'tanushinfopvtltd@gmail.com';

export function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Ticket[]>('/agency-portal/support').then(r => {
      if (r.ok) setTickets(r.data);
      else setError(r.message);
    });
  }, []);

  const send = async () => {
    setSending(true);
    setError('');
    const r = await api.post<Ticket>('/agency-portal/support', { subject, message });
    setSending(false);
    if (r.ok) {
      setTickets(t => [r.data, ...(t ?? [])]);
      setSubject('');
      setMessage('');
    } else setError(r.message);
  };

  return (
    <>
      <PageHeader title="Support" subtitle={`Write to the RaRa Live team, or email ${SUPPORT_EMAIL}.`} />

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Card title="New request">
          {error && <div className="mb-3"><ErrorNote text={error} /></div>}
          <label className="text-sm font-medium text-gray-600 block mb-1">Subject</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={160} className={`${input} mb-3`} />
          <label className="text-sm font-medium text-gray-600 block mb-1">Message</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} maxLength={2000} className={`${input} mb-3`} />
          <button onClick={send} disabled={sending || !subject.trim() || !message.trim()} className={buttonPrimary}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </Card>

        <Card title="Your requests">
          {!tickets ? <Loading /> : tickets.length === 0 ? <Empty text="No requests yet" /> : (
            <ul className="space-y-3">
              {tickets.map(t => (
                <li key={t.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm text-gray-900 min-w-0 break-words">{t.subject}</p>
                    <Badge status={t.status} />
                  </div>
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap break-words">{t.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{dateTime(t.created_at)}</p>
                  {t.admin_reply && (
                    <div className="mt-2 rounded-lg bg-purple-50 px-3 py-2">
                      <p className="text-xs font-semibold text-purple-700">RaRa Live replied</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{t.admin_reply}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
