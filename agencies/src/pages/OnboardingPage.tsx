import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Badge, Card, CopyLink, Empty, ErrorNote, Loading, PageHeader, Table, dateOnly, dateTime } from '../components/ui';

type Doc = { id: string; label: string; doc_type: string; status: string; note: string | null; created_at: string; reviewed_at: string | null };
type Onboarding = {
  profile: {
    agency_name: string; agent_code: string; owner: string; email: string; phone: string; address: string;
    status: string; services: string[]; onboarded_at: string; onboarded_by: string;
    aadhar: string; pan: string; bank_account: string; bank_ifsc: string | null; bank_holder: string | null; bank_name: string | null;
  };
  documents: Doc[];
  pocs: { full_name: string; assigned_at: string }[];
  history: { label: string; detail: string; at: string }[];
};

const SERVICE_NAMES: Record<string, string> = { chatroom: 'Audio Chat Room', live: 'Video Live', friend_zone: 'Friend Zone' };

export function OnboardingPage() {
  const [data, setData] = useState<Onboarding | null>(null);
  const [error, setError] = useState('');
  const [fileError, setFileError] = useState('');

  useEffect(() => {
    api.get<Onboarding>('/agency-portal/onboarding').then(r => {
      if (r.ok) setData(r.data);
      else setError(r.message);
    });
  }, []);

  if (error) return <ErrorNote text={error} />;
  if (!data) return <Loading />;

  const { profile } = data;
  const portalLink = `${window.location.origin}/agency/${profile.agent_code}`;

  const view = async (id: string) => {
    setFileError('');
    const r = await api.openFile(`/agency-portal/documents/${id}/file`);
    if (!r.ok) setFileError(r.message);
  };

  return (
    <>
      <PageHeader title="Onboarding & Documents" subtitle="Your agency profile and everything submitted to RaRa Live." />

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card title="Agency profile">
          <dl className="space-y-2 text-sm">
            <Row label="Agency Name" value={profile.agency_name} />
            <Row label="Agency ID" value={profile.agent_code} />
            <Row label="Owner Name" value={profile.owner} />
            <Row label="Email" value={profile.email} />
            <Row label="Phone" value={profile.phone} />
            <Row label="Address" value={profile.address} />
            <Row label="Services" value={profile.services.map(s => SERVICE_NAMES[s] ?? s).join(', ')} />
          </dl>
        </Card>

        <Card title="Submitted details">
          <dl className="space-y-2 text-sm">
            <Row label="Aadhaar" value={profile.aadhar} />
            <Row label="PAN" value={profile.pan} />
            <Row label="Bank Account" value={profile.bank_account} />
            <Row label="IFSC" value={profile.bank_ifsc ?? '—'} />
            <Row label="Account Holder" value={profile.bank_holder ?? '—'} />
            <Row label="Bank" value={profile.bank_name ?? '—'} />
          </dl>
          <p className="text-xs text-gray-400 mt-3">Numbers are partly hidden for your security.</p>
        </Card>
      </div>

      <Card title="Documents" className="mb-4">
        {fileError && <div className="mb-3"><ErrorNote text={fileError} /></div>}
        <Table
          rows={data.documents}
          rowKey={d => d.id}
          empty="No documents submitted"
          columns={[
            { header: 'Document', render: d => <span className="font-semibold text-gray-900">{d.label}</span> },
            { header: 'Status', render: d => <Badge status={d.status} /> },
            { header: 'Submitted', render: d => dateOnly(d.created_at) },
            { header: 'Reviewed', render: d => (d.reviewed_at ? dateOnly(d.reviewed_at) : '—') },
            { header: 'Note', render: d => d.note ?? '—' },
            { header: '', render: d => <button onClick={() => view(d.id)} className="text-xs font-semibold text-purple-600 hover:text-purple-800">View</button> },
          ]}
        />
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Onboarding history">
          {data.history.length === 0 ? <Empty text="No history yet" /> : (
            <ol className="space-y-3">
              {data.history.map(h => (
                <li key={`${h.at}-${h.label}`} className="flex gap-3">
                  <span className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{h.label}</p>
                    {h.detail && <p className="text-xs text-gray-500">{h.detail}</p>}
                    <p className="text-xs text-gray-400">{dateTime(h.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="Portal">
          <dl className="space-y-2 text-sm">
            <Row label="Onboarded" value={dateOnly(profile.onboarded_at)} />
            <Row label="Onboarded by" value={profile.onboarded_by} />
            <Row label="Assigned POC" value={data.pocs.map(p => p.full_name).join(', ') || 'None assigned'} />
          </dl>
          <p className="text-xs font-semibold text-gray-500 mt-4 mb-1">Agency Portal Link</p>
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-sm text-gray-700 truncate flex-1">{portalLink}</p>
            <CopyLink value={portalLink} />
          </div>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500 shrink-0">{label}</dt>
      <dd className="font-medium text-gray-900 text-right break-words min-w-0">{value}</dd>
    </div>
  );
}
