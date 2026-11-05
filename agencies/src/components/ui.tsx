import { useState } from 'react';
import type { ReactNode } from 'react';

// ── Formatting (India time and number grouping throughout) ───────────────────

export const coins = (n: number) => n.toLocaleString('en-IN');
export const inr = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const IST = 'Asia/Kolkata';
export const dateOnly = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { timeZone: IST, day: '2-digit', month: 'short', year: 'numeric' });
export const timeOnly = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { timeZone: IST, hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const dateTime = (iso: string) => `${dateOnly(iso)}, ${timeOnly(iso)}`;

/** Today's date in India as YYYY-MM-DD. */
export function istToday() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ── Building blocks ──────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, action, children, className = '' }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-2xl border border-gray-100 shadow-sm min-w-0 ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
          {title && <h2 className="font-bold text-gray-900">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone = 'default' }: { label: string; value: string | number; hint?: string; tone?: 'default' | 'purple' | 'amber' | 'green' }) {
  const tones = { default: 'text-gray-900', purple: 'text-purple-700', amber: 'text-amber-600', green: 'text-green-600' };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 min-w-0">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className={`text-xl font-black mt-1 truncate ${tones[tone]}`}>{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-50 text-green-700', approved: 'bg-green-50 text-green-700', verified: 'bg-green-50 text-green-700',
  success: 'bg-green-50 text-green-700', resolved: 'bg-green-50 text-green-700', ended: 'bg-gray-100 text-gray-600',
  pending: 'bg-amber-50 text-amber-700', submitted: 'bg-blue-50 text-blue-700', open: 'bg-blue-50 text-blue-700',
  suspended: 'bg-red-50 text-red-600', rejected: 'bg-red-50 text-red-600', inactive: 'bg-gray-100 text-gray-600',
};

export function Badge({ status }: { status: string }) {
  const style = STATUS_STYLES[status.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize whitespace-nowrap ${style}`}>{status}</span>;
}

export function Empty({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 text-center py-8">{text}</p>;
}

export function Loading() {
  return <p className="text-sm text-gray-400 text-center py-12">Loading…</p>;
}

export function ErrorNote({ text }: { text: string }) {
  return <p className="text-sm font-medium text-red-600 bg-red-50 rounded-xl px-4 py-3">{text}</p>;
}

export type Column<T> = { header: string; align?: 'right'; render: (row: T) => ReactNode };

/** Scrolls inside itself on small screens, never the whole page. */
export function Table<T>({ columns, rows, rowKey, empty }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; empty: string }) {
  if (rows.length === 0) return <Empty text={empty} />;
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
            {columns.map(c => (
              <th key={c.header} className={`pb-2 pr-4 font-semibold whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={rowKey(row)} className="border-b border-gray-50 last:border-0">
              {columns.map(c => (
                <td key={c.header} className={`py-2.5 pr-4 text-gray-700 whitespace-nowrap ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** App links can't open from a browser, so they're copied to share. */
export function CopyLink({ value, label = 'Copy link' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API needs https; older fallback for plain http deployments
      const area = document.createElement('textarea');
      area.value = value;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="text-xs font-semibold text-purple-600 hover:text-purple-800">
      {copied ? 'Copied ✓' : label}
    </button>
  );
}

export const buttonPrimary = 'px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold text-sm shadow-md shadow-purple-200 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed';
export const buttonSecondary = 'px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50';
export const input = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none';

// ── Date filter ──────────────────────────────────────────────────────────────

export type Range = { from: string; to: string; preset: 'today' | 'month' | 'custom' };

export const monthRange = (): Range => {
  const today = istToday();
  return { from: `${today.slice(0, 7)}-01`, to: today, preset: 'month' };
};

export function DateFilter({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const presets: [Range['preset'], string][] = [['today', 'Daily'], ['month', 'Monthly'], ['custom', 'Custom']];
  const pick = (preset: Range['preset']) => {
    if (preset === 'today') { const t = istToday(); onChange({ from: t, to: t, preset }); }
    else if (preset === 'month') onChange(monthRange());
    else onChange({ ...value, preset });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex bg-gray-100 rounded-xl p-1">
        {presets.map(([key, label]) => (
          <button
            key={key}
            onClick={() => pick(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${value.preset === key ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>
      {value.preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input type="date" value={value.from} max={value.to} onChange={e => onChange({ ...value, from: e.target.value })} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" value={value.to} min={value.from} max={istToday()} onChange={e => onChange({ ...value, to: e.target.value })} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
        </div>
      )}
    </div>
  );
}
