import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { usePortalBase } from '../components/PortalLayout';
import { Card, ErrorNote, Loading, PageHeader, buttonPrimary, buttonSecondary, coins, dateTime, input } from '../components/ui';

type Wallet = { balance: number; recharge_slabs: number[]; low_balance_threshold: number };
type VerifiedUser = { uid: string; handle: string | null; name: string | null };
type Receipt = { transaction_id: string; coins: number; created_at: string; balance: number; low_balance: boolean };

// One key per intended recharge: a retry after a network error, or a double
// click, reuses it and the server charges once. crypto.randomUUID needs https.
const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `rc-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function RechargeUserPage() {
  const base = usePortalBase();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [query, setQuery] = useState('');
  const [user, setUser] = useState<VerifiedUser | null>(null);
  const [slab, setSlab] = useState<number | null>(null);
  const [extra, setExtra] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const keyRef = useRef(newKey());

  useEffect(() => {
    api.get<Wallet>('/agency-portal/wallet').then(r => {
      if (r.ok) setWallet(r.data);
      else setError(r.message);
    });
  }, []);

  // Changing any detail makes it a different recharge, so a different key
  useEffect(() => { keyRef.current = newKey(); }, [user?.uid, slab, extra]);

  const extraCoins = Number(extra) || 0;
  const total = (slab ?? 0) + extraCoins;
  const insufficient = !!wallet && total > wallet.balance;
  const ready = !!user && !!slab && !insufficient && Number.isInteger(extraCoins) && extraCoins >= 0;

  const verify = async () => {
    setError('');
    setUser(null);
    if (!query.trim()) return;
    setBusy(true);
    const r = await api.get<VerifiedUser>(`/agency-portal/wallet/lookup?q=${encodeURIComponent(query.trim())}`);
    setBusy(false);
    if (r.ok) setUser(r.data);
    else setError(r.message);
  };

  const submit = async () => {
    if (!user || !slab) return;
    setBusy(true);
    setError('');
    const r = await api.post<Receipt>('/agency-portal/wallet/recharge', {
      uid: user.uid, slabCoins: slab, extraCoins, idempotencyKey: keyRef.current,
    });
    setBusy(false);
    setConfirming(false);
    if (r.ok) {
      setReceipt(r.data);
      setWallet(w => (w ? { ...w, balance: r.data.balance } : w));
    } else setError(r.message);
  };

  const reset = () => {
    setReceipt(null); setUser(null); setQuery(''); setSlab(null); setExtra(''); setError('');
    keyRef.current = newKey();
  };

  if (!wallet) return error ? <ErrorNote text={error} /> : <Loading />;

  if (receipt) {
    return (
      <>
        <PageHeader title="Recharge User" />
        <Card className="max-w-lg">
          <div className="text-center mb-5">
            <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 text-2xl flex items-center justify-center mx-auto mb-2">✓</div>
            <p className="text-lg font-black text-gray-900">Recharge successful</p>
          </div>
          <dl className="space-y-2 text-sm">
            <Row label="User" value={user?.name || user?.handle || '—'} />
            <Row label="Handle" value={user?.handle ?? '—'} />
            <Row label="Coins sent" value={coins(receipt.coins)} strong />
            <Row label="Wallet balance now" value={coins(receipt.balance)} />
            <Row label="Date & time" value={dateTime(receipt.created_at)} />
            <Row label="Transaction ID" value={receipt.transaction_id} />
          </dl>
          {receipt.low_balance && <div className="mt-4"><ErrorNote text="Your wallet balance is low." /></div>}
          <div className="flex flex-wrap gap-2 mt-5">
            <button onClick={reset} className={buttonPrimary}>New recharge</button>
            <Link to={`${base}/recharge-history`} className={buttonSecondary}>Recharge history</Link>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Recharge User" subtitle={`Wallet balance: ${coins(wallet.balance)} coins`} />

      <div className="max-w-2xl space-y-4">
        {error && <ErrorNote text={error} />}

        <Card title="1. Verify the user">
          <label className="text-sm font-medium text-gray-600 block mb-1">Profile link, UID or @handle</label>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setUser(null); }}
              onKeyDown={e => { if (e.key === 'Enter') verify(); }}
              placeholder="rara-live://user/… or @username"
              className={input}
            />
            <button onClick={verify} disabled={busy || !query.trim()} className={buttonSecondary}>Verify</button>
          </div>
          {user && (
            <div className="mt-3 rounded-xl bg-green-50 px-4 py-3">
              <p className="text-xs font-semibold text-green-700">Verified</p>
              <p className="font-bold text-gray-900">{user.handle ?? user.name}</p>
              {user.handle && user.name && <p className="text-sm text-gray-600">{user.name}</p>}
              <p className="text-xs text-gray-500 font-mono mt-0.5 break-all">UID: {user.uid}</p>
            </div>
          )}
        </Card>

        <Card title="2. Choose coins">
          <p className="text-sm font-medium text-gray-600 mb-2">Coin slab</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
            {wallet.recharge_slabs.map(s => (
              <button
                key={s}
                onClick={() => setSlab(s)}
                className={`px-2 py-2.5 rounded-xl border text-sm font-bold transition-colors ${
                  slab === s ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-700 hover:border-purple-300'
                }`}>
                {coins(s)}
              </button>
            ))}
          </div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Extra coins</label>
          <input
            value={extra}
            onChange={e => setExtra(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="0"
            className={`${input} sm:w-48`}
          />
          <div className="flex items-center justify-between mt-4 rounded-xl bg-gray-50 px-4 py-3">
            <span className="text-sm font-semibold text-gray-600">Total</span>
            <span className="text-xl font-black text-gray-900">{coins(total)}</span>
          </div>
          {insufficient && <div className="mt-3"><ErrorNote text="This is more than your wallet balance." /></div>}
        </Card>

        <button onClick={() => setConfirming(true)} disabled={!ready} className={`${buttonPrimary} w-full`}>
          Review recharge
        </button>
      </div>

      {confirming && user && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-black text-gray-900 mb-4">Confirm recharge</h2>
            <dl className="space-y-2 text-sm">
              <Row label="User" value={user.name || '—'} />
              <Row label="Handle" value={user.handle ?? '—'} />
              <Row label="Slab" value={coins(slab ?? 0)} />
              <Row label="Extra coins" value={coins(extraCoins)} />
              <Row label="Total" value={`${coins(total)} coins`} strong />
              <Row label="Wallet after recharge" value={coins(wallet.balance - total)} />
            </dl>
            <p className="text-xs text-gray-500 mt-3">Coins move straight away and can't be reversed from this portal.</p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setConfirming(false)} disabled={busy} className={`${buttonSecondary} flex-1`}>Cancel</button>
              <button onClick={submit} disabled={busy} className={`${buttonPrimary} flex-1`}>{busy ? 'Sending…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500 shrink-0">{label}</dt>
      <dd className={`text-right break-all min-w-0 ${strong ? 'font-black text-gray-900' : 'font-medium text-gray-800'}`}>{value}</dd>
    </div>
  );
}
