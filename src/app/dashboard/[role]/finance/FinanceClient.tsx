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

type FinanceTab = 'overview' | 'revenue' | 'payroll' | 'manual';

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
  const [tab, setTab] = useState<FinanceTab>('overview');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: 'Operations',
    description: '',
    amount: '',
    entry_type: 'expense' as 'income' | 'expense',
  });

  const totalRevenue = revenue.filter(r => r.type === 'Sale').reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalPayroll = payrollExpenses.reduce((s, p) => s + Number(p.net_pay || 0), 0);
  const totalManualExpenses = manualEntries.filter(e => e.entry_type === 'expense').reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalManualIncome = manualEntries.filter(e => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalExpenses = totalPayroll + totalManualExpenses;
  const grossIncome = totalRevenue + totalManualIncome;
  const netProfit = grossIncome - totalExpenses;
  const marginPct = grossIncome > 0 ? Math.round((netProfit / grossIncome) * 100) : 0;

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

  const TABS: { id: FinanceTab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'revenue', label: 'Revenue', count: revenue.filter(r => r.type === 'Sale').length },
    { id: 'payroll', label: 'Payroll', count: payrollExpenses.length },
    { id: 'manual', label: 'Manual Entries', count: manualEntries.length },
  ];

  const maxExpense = Math.max(
    totalPayroll,
    ...EXPENSE_CATEGORIES.map(cat =>
      manualEntries.filter(e => e.entry_type === 'expense' && e.category === cat).reduce((s, e) => s + Number(e.amount), 0)
    )
  );

  return (
    <div className="page-fade">
      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">$</div></div>
          <div className="stat-l">MTD REVENUE</div>
          <div className="stat-v">${grossIncome.toLocaleString()}</div>
          <div className="stat-foot">{revenue.filter(r => r.type === 'Sale').length} sales + {manualEntries.filter(e => e.entry_type === 'income').length} manual</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico er">↓</div></div>
          <div className="stat-l">TOTAL EXPENSES</div>
          <div className="stat-v" style={{ color: 'var(--err)' }}>${totalExpenses.toLocaleString()}</div>
          <div className="stat-foot">Payroll + operations</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h">
            <div className="stat-ico" style={{ background: netProfit >= 0 ? 'oklch(0.93 0.05 145)' : 'oklch(0.97 0.03 25)', color: netProfit >= 0 ? 'var(--ok)' : 'var(--err)' }}>≈</div>
          </div>
          <div className="stat-l">NET PROFIT</div>
          <div className="stat-v" style={{ color: netProfit >= 0 ? 'var(--ok)' : 'var(--err)' }}>${netProfit.toLocaleString()}</div>
          <div className="stat-foot">Margin: {marginPct}%</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">📊</div></div>
          <div className="stat-l">PAYROLL COST</div>
          <div className="stat-v">${totalPayroll.toLocaleString()}</div>
          <div className="stat-foot">{payrollExpenses.length} processed payslips</div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          <div className="tabs" style={{ padding: 0, border: 'none', background: 'none' }}>
            {TABS.map(t => (
              <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}{t.count !== undefined && <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>{t.count}</span>}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sec btn-sm" onClick={exportCSV}>↓ CSV</button>
            <button className="btn btn-acc btn-sm" onClick={() => setShowAdd(true)}>+ Log Entry</button>
          </div>
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div style={{ padding: '0 18px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Revenue sources */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: 'var(--ink)' }}>Revenue Sources</div>
              {[
                { label: 'Sales', amount: totalRevenue, hue: 145 },
                { label: 'Manual Income', amount: totalManualIncome, hue: 200 },
              ].map(row => {
                const pct = grossIncome > 0 ? Math.round((row.amount / grossIncome) * 100) : 0;
                return (
                  <div key={row.label} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                      <span style={{ color: 'var(--ink-3)' }}>{row.label}</span>
                      <span style={{ fontWeight: 700, color: `oklch(0.45 0.15 ${row.hue})` }}>${row.amount.toLocaleString()}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: `oklch(0.55 0.15 ${row.hue})`, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Expense breakdown */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: 'var(--ink)' }}>Expense Breakdown</div>
              {[
                { label: 'Payroll', amount: totalPayroll },
                ...EXPENSE_CATEGORIES.map(cat => ({
                  label: cat,
                  amount: manualEntries.filter(e => e.entry_type === 'expense' && e.category === cat).reduce((s, e) => s + Number(e.amount), 0),
                })).filter(c => c.amount > 0),
              ].map(row => {
                const pct = maxExpense > 0 ? Math.round((row.amount / maxExpense) * 100) : 0;
                return (
                  <div key={row.label} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                      <span style={{ color: 'var(--ink-3)' }}>{row.label}</span>
                      <span style={{ fontWeight: 700, color: 'var(--err)' }}>${row.amount.toLocaleString()}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'oklch(0.55 0.18 25)', borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Revenue tab */}
        {tab === 'revenue' && (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>Description</th><th>Employee</th><th>Date</th><th>Amount</th></tr></thead>
              <tbody>
                {revenue.filter(r => r.type === 'Sale').length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--ink-4)', padding: '30px 0' }}>No sales recorded yet.</td></tr>
                )}
                {revenue.filter(r => r.type === 'Sale').map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>Sale</td>
                    <td style={{ color: 'var(--ink-3)' }}>{r.profiles?.name ?? '—'}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 700, color: 'var(--ok)' }}>${Number(r.amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Payroll tab */}
        {tab === 'payroll' && (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>Employee</th><th>Period</th><th>Base</th><th>Deductions</th><th>Net Pay</th></tr></thead>
              <tbody>
                {payrollExpenses.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-4)', padding: '30px 0' }}>No payroll records yet.</td></tr>
                )}
                {payrollExpenses.map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{p.profiles?.name ?? 'Employee'}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>{p.period}</td>
                    <td>${Number(p.base_salary).toLocaleString()}</td>
                    <td style={{ color: 'var(--err)' }}>−${Number(p.deductions).toLocaleString()}</td>
                    <td style={{ fontWeight: 700, color: 'var(--ok)' }}>${Number(p.net_pay).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Manual entries tab */}
        {tab === 'manual' && (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>Type</th><th>Category</th><th>Description</th><th>Date</th><th>Amount</th><th></th></tr></thead>
              <tbody>
                {manualEntries.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-4)', padding: '30px 0' }}>No manual entries yet.</td></tr>
                )}
                {manualEntries.map(e => (
                  <tr key={e.id}>
                    <td>
                      <span className={e.entry_type === 'income' ? 'bdg bdg-ok' : 'bdg bdg-err'}>
                        {e.entry_type === 'income' ? '+ Income' : '− Expense'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{e.category}</td>
                    <td style={{ color: 'var(--ink-3)', fontSize: 12 }}>{e.description || '—'}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>{new Date(e.created_at).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 700, color: e.entry_type === 'income' ? 'var(--ok)' : 'var(--err)' }}>
                      {e.entry_type === 'income' ? '+' : '−'}${Number(e.amount).toLocaleString()}
                    </td>
                    <td>
                      <button onClick={() => e.id && handleDelete(e.id)} style={{ background: 'none', border: 'none', color: 'var(--err)', cursor: 'pointer', fontSize: 14 }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Entry Modal */}
      {showAdd && (
        <div className="mb">
          <div className="md" style={{ width: 440 }}>
            <div className="md-t">Log Finance Entry</div>
            <form onSubmit={handleAddEntry}>
              <div className="pv-fld">
                <label>Type</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className={`btn btn-sm ${form.entry_type === 'expense' ? 'btn-acc' : 'btn-sec'}`} onClick={() => setForm(f => ({ ...f, entry_type: 'expense' }))}>Expense</button>
                  <button type="button" className={`btn btn-sm ${form.entry_type === 'income' ? 'btn-acc' : 'btn-sec'}`} onClick={() => setForm(f => ({ ...f, entry_type: 'income' }))}>Income</button>
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
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-acc" disabled={saving}>{saving ? 'Saving…' : 'Save Entry'}</button>
                <button type="button" className="btn btn-sec" onClick={() => setShowAdd(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
