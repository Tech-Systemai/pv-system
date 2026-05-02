'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

const EXPENSE_CATEGORIES = ['Payroll', 'Operations', 'Marketing', 'Software', 'Rent', 'Equipment', 'Travel', 'Other'];

type ManualEntry = {
  id?: string;
  category: string;
  description: string;
  amount: number;
  entry_type: 'income' | 'expense';
  created_at: string;
};

export default function FinanceClient({
  revenue,
  payrollExpenses,
  manualEntries: initialManual,
}: {
  revenue: any[];
  payrollExpenses: any[];
  manualEntries: any[];
}) {
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>(initialManual);
  const [tab, setTab] = useState<'overview' | 'revenue' | 'payroll' | 'manual'>('overview');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ category: 'Operations', description: '', amount: '', entry_type: 'expense' as 'income' | 'expense' });

  const totalRevenue = revenue.filter(r => r.type === 'Sale').reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalPayroll = payrollExpenses.reduce((s, p) => s + Number(p.net_pay || 0), 0);
  const totalManualExpenses = manualEntries.filter(e => e.entry_type === 'expense').reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalManualIncome = manualEntries.filter(e => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalExpenses = totalPayroll + totalManualExpenses;
  const netProfit = totalRevenue + totalManualIncome - totalExpenses;

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount),
      entry_type: form.entry_type,
    };
    const { data } = await dbOp('finance_entries', 'insert', payload);
    if (data?.[0]) setManualEntries(prev => [data[0], ...prev]);
    setShowAdd(false);
    setForm({ category: 'Operations', description: '', amount: '', entry_type: 'expense' });
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    await dbOp('finance_entries', 'delete', undefined, { id });
    setManualEntries(prev => prev.filter(e => e.id !== id));
  };

  const exportCSV = () => {
    const rows: string[] = ['Type,Category,Description,Amount,Date'];
    revenue.filter(r => r.type === 'Sale').forEach(r =>
      rows.push(`Income,Sales,Sale Entry,${r.amount},${new Date(r.created_at).toLocaleDateString()}`)
    );
    payrollExpenses.forEach(p =>
      rows.push(`Expense,Payroll,Net Pay ${p.period},$${p.net_pay},${new Date(p.created_at).toLocaleDateString()}`)
    );
    manualEntries.forEach(e =>
      rows.push(`${e.entry_type === 'income' ? 'Income' : 'Expense'},${e.category},${e.description},$${e.amount},${new Date(e.created_at).toLocaleDateString()}`)
    );
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const TAB_STYLE = (active: boolean) => ({
    padding: '7px 16px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    background: active ? '#4f46e5' : 'transparent',
    color: active ? '#fff' : '#6b7689',
    border: 'none',
  } as const);

  return (
    <div>
      <div className="pn-h" style={{ marginBottom: '20px' }}>
        <div className="pn-t">Finance Overview</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="pv-btn pv-btn-sec" onClick={exportCSV}>↓ Export CSV</button>
          <button className="pv-btn pv-btn-pri" onClick={() => setShowAdd(true)}>+ Log Entry</button>
        </div>
      </div>

      {/* KPI row */}
      <div className="stat-grid" style={{ marginBottom: '20px' }}>
        <div className="stat">
          <div className="stat-h"><div className="s-ico gn">$</div></div>
          <div className="s-l">Total Revenue</div>
          <div className="s-v gn">${(totalRevenue + totalManualIncome).toLocaleString()}</div>
          <div style={{ fontSize: '10px', color: '#6b7689', marginTop: '2px' }}>{revenue.filter(r => r.type === 'Sale').length} sales + {manualEntries.filter(e => e.entry_type === 'income').length} manual</div>
        </div>
        <div className="stat">
          <div className="stat-h"><div className="s-ico rd">↓</div></div>
          <div className="s-l">Total Expenses</div>
          <div className="s-v rd">${totalExpenses.toLocaleString()}</div>
          <div style={{ fontSize: '10px', color: '#6b7689', marginTop: '2px' }}>Payroll: ${totalPayroll.toLocaleString()} + Other: ${totalManualExpenses.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="stat-h"><div className="s-ico" style={{ background: netProfit >= 0 ? '#ecfdf5' : '#fee2e2', color: netProfit >= 0 ? '#047857' : '#dc2626' }}>≈</div></div>
          <div className="s-l">Net Profit</div>
          <div className="s-v" style={{ color: netProfit >= 0 ? '#047857' : '#dc2626' }}>${netProfit.toLocaleString()}</div>
          <div style={{ fontSize: '10px', color: '#6b7689', marginTop: '2px' }}>
            Margin: {totalRevenue + totalManualIncome > 0 ? Math.round((netProfit / (totalRevenue + totalManualIncome)) * 100) : 0}%
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#f5f6f8', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
        {(['overview', 'revenue', 'payroll', 'manual'] as const).map(t => (
          <button key={t} style={TAB_STYLE(tab === t)} onClick={() => setTab(t)}>
            {t === 'overview' ? 'Overview' : t === 'revenue' ? `Revenue (${revenue.filter(r => r.type === 'Sale').length})` : t === 'payroll' ? `Payroll (${payrollExpenses.length})` : `Manual (${manualEntries.length})`}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="two" style={{ gap: '20px', alignItems: 'flex-start' }}>
          <div className="pn">
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '14px' }}>Revenue Sources</div>
            {[
              { label: 'Sales Commission', amount: totalRevenue, color: '#10b981' },
              { label: 'Manual Income', amount: totalManualIncome, color: '#4f46e5' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f0f2f5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: row.color }} />
                  <span style={{ fontSize: '13px' }}>{row.label}</span>
                </div>
                <span style={{ fontWeight: 700, color: row.color }}>${row.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="pn">
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '14px' }}>Expense Breakdown</div>
            {[
              { label: 'Payroll', amount: totalPayroll, color: '#ef4444' },
              ...EXPENSE_CATEGORIES.map(cat => ({
                label: cat,
                amount: manualEntries.filter(e => e.entry_type === 'expense' && e.category === cat).reduce((s, e) => s + Number(e.amount), 0),
                color: '#f59e0b',
              })).filter(c => c.amount > 0),
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f0f2f5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: row.color }} />
                  <span style={{ fontSize: '13px' }}>{row.label}</span>
                </div>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>${row.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue tab */}
      {tab === 'revenue' && (
        <div className="pn">
          {revenue.filter(r => r.type === 'Sale').length === 0 && <div className="empty">No sales recorded yet.</div>}
          {revenue.filter(r => r.type === 'Sale').map((r, i) => (
            <div key={i} className="r-cd">
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#047857', fontSize: '14px' }}>$</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Sale — {r.profiles?.name ?? '—'}</div>
                <div style={{ fontSize: '11px', color: '#6b7689' }}>{new Date(r.created_at).toLocaleDateString()}</div>
              </div>
              <span style={{ fontWeight: 700, color: '#047857' }}>${Number(r.amount).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Payroll tab */}
      {tab === 'payroll' && (
        <div className="pn">
          {payrollExpenses.length === 0 && <div className="empty">No payroll records yet.</div>}
          {payrollExpenses.map((p, i) => (
            <div key={i} className="r-cd">
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', fontSize: '14px' }}>↓</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Payroll — {p.profiles?.name ?? 'Employee'}</div>
                <div style={{ fontSize: '11px', color: '#6b7689' }}>{p.period} · Base: ${Number(p.base_salary).toLocaleString()} − Deductions: ${Number(p.deductions).toLocaleString()}</div>
              </div>
              <span style={{ fontWeight: 700, color: '#dc2626' }}>${Number(p.net_pay).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Manual entries tab */}
      {tab === 'manual' && (
        <div className="pn">
          {manualEntries.length === 0 && <div className="empty">No manual entries yet. Use "Log Entry" to add one.</div>}
          {manualEntries.map(e => (
            <div key={e.id} className="r-cd">
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: e.entry_type === 'income' ? '#ecfdf5' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: e.entry_type === 'income' ? '#047857' : '#b45309', fontSize: '13px' }}>
                {e.entry_type === 'income' ? '+' : '−'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{e.category} — {e.description || '—'}</div>
                <div style={{ fontSize: '11px', color: '#6b7689' }}>{new Date(e.created_at).toLocaleDateString()} · {e.entry_type}</div>
              </div>
              <span style={{ fontWeight: 700, color: e.entry_type === 'income' ? '#047857' : '#dc2626' }}>
                {e.entry_type === 'income' ? '+' : '−'}${Number(e.amount).toLocaleString()}
              </span>
              <button
                onClick={() => e.id && handleDelete(e.id)}
                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Add Entry Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '28px', borderRadius: '14px', width: '440px', maxWidth: '95%' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '18px' }}>Log Finance Entry</div>
            <form onSubmit={handleAddEntry}>
              <div className="pv-fld">
                <label>Type</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className={`pv-btn ${form.entry_type === 'expense' ? 'pv-btn-pri' : 'pv-btn-sec'}`} onClick={() => setForm(f => ({ ...f, entry_type: 'expense' }))}>Expense</button>
                  <button type="button" className={`pv-btn ${form.entry_type === 'income' ? 'pv-btn-pri' : 'pv-btn-sec'}`} onClick={() => setForm(f => ({ ...f, entry_type: 'income' }))}>Income</button>
                </div>
              </div>
              <div className="pv-fld">
                <label>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="pv-fld">
                <label>Description</label>
                <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Monthly office rent" required />
              </div>
              <div className="pv-fld">
                <label>Amount ($)</label>
                <input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" required />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="pv-btn pv-btn-pri" disabled={saving}>{saving ? 'Saving...' : 'Save Entry'}</button>
                <button type="button" className="pv-btn pv-btn-sec" onClick={() => setShowAdd(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
