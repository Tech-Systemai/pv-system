'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function FinanceClient({ revenue, expenses }: { revenue: any[], expenses: any[] }) {
  const revData = [
    { name: 'Sales', value: 124000 },
    { name: 'CX', value: 45000 },
    { name: 'Other', value: 15000 }
  ];

  const expData = [
    { name: 'Payroll', value: 68000 },
    { name: 'Operations', value: 12000 },
    { name: 'Marketing', value: 9000 },
    { name: 'Software', value: 5000 }
  ];

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899'];

  return (
    <>
      <div className="stat-grid" style={{ marginBottom: '16px' }}>
        <div className="stat">
          <div className="stat-h"><div className="s-ico gn">$</div></div>
          <div className="s-l">Total Revenue</div>
          <div className="s-v gn">$184,000</div>
        </div>
        <div className="stat">
          <div className="stat-h"><div className="s-ico rd">↓</div></div>
          <div className="s-l">Total Expenses</div>
          <div className="s-v rd">$94,000</div>
        </div>
        <div className="stat">
          <div className="stat-h"><div className="s-ico am">📈</div></div>
          <div className="s-l">Net Profit</div>
          <div className="s-v">$90,000</div>
        </div>
      </div>

      <div className="two">
        <div className="pn">
          <div className="pn-t" style={{ marginBottom: '16px' }}>Revenue Distribution</div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={revData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {revData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} formatter={(value) => `$${value}`} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="pn">
          <div className="pn-t" style={{ marginBottom: '16px' }}>Expense Breakdown</div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={expData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {expData.map((entry, index) => <Cell key={`cell-${index}`} fill={['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'][index % 4]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} formatter={(value) => `$${value}`} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}
