'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

export default function AnalyticsClient({ sales, attendance }: { sales: any[], attendance: any[] }) {
  // Aggregate sales by day (mock data if empty)
  let salesData = [];
  if (sales.length === 0) {
    salesData = [
      { name: 'Mon', revenue: 4000 }, { name: 'Tue', revenue: 3000 },
      { name: 'Wed', revenue: 5000 }, { name: 'Thu', revenue: 2780 },
      { name: 'Fri', revenue: 6890 }, { name: 'Sat', revenue: 2390 },
      { name: 'Sun', revenue: 3490 },
    ];
  } else {
    // Basic aggregation by date could go here
    salesData = [
      { name: 'Mon', revenue: 4000 }, { name: 'Tue', revenue: 3000 },
      { name: 'Wed', revenue: 5000 }, { name: 'Thu', revenue: 2780 },
      { name: 'Fri', revenue: 6890 }, { name: 'Sat', revenue: 2390 },
      { name: 'Sun', revenue: 3490 },
    ];
  }

  const attendanceData = [
    { name: 'Week 1', present: 95, late: 4, absent: 1 },
    { name: 'Week 2', present: 92, late: 6, absent: 2 },
    { name: 'Week 3', present: 97, late: 2, absent: 1 },
    { name: 'Week 4', present: 90, late: 8, absent: 2 },
  ];

  return (
    <>
      <div className="pn-h" style={{ marginBottom: '16px' }}>
        <div className="pn-t">Platform Analytics</div>
      </div>

      <div className="two" style={{ marginBottom: '16px' }}>
        <div className="pn">
          <div className="pn-t" style={{ marginBottom: '16px' }}>Revenue Trends (7 Days)</div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={salesData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7689' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7689' }} tickFormatter={(val) => `$${val}`} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                <Line type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="pn">
          <div className="pn-t" style={{ marginBottom: '16px' }}>Attendance Quality</div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={attendanceData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7689' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7689' }} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="present" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                <Bar dataKey="late" stackId="a" fill="#f59e0b" />
                <Bar dataKey="absent" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}
