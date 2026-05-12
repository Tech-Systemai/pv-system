'use client';

import { usePathname } from 'next/navigation';

const PAGE_META: Record<string, { title: string; sub: string }> = {
  dashboard:   { title: 'Command Center',      sub: 'Live overview across all teams and operations' },
  monitoring:  { title: 'Live Monitoring',     sub: 'Real-time team & system telemetry' },
  analytics:   { title: 'Analytics',           sub: 'Deep-dive across cohorts and timeframes' },
  inbox:       { title: 'Inbox',               sub: 'Documents, approvals and system notices' },
  chat:        { title: 'Messages',            sub: 'Team channels and direct messages' },
  performance: { title: 'My Performance',      sub: 'Live reliability score · projected payslip · violations' },
  users:       { title: 'Employee Directory',  sub: 'All staff across every team and department' },
  hr:          { title: 'HR Pipeline',         sub: 'Candidates, interviews and onboarding' },
  org:         { title: 'Org Tree',            sub: 'Reporting lines and team structure' },
  attendance:  { title: 'Attendance Log',      sub: 'Clock-ins, absences and late arrivals' },
  timeoff:     { title: 'Time-Off Requests',   sub: 'Pending approvals and leave history' },
  schedule:    { title: 'Schedules',           sub: 'Shift planning across all teams' },
  approvals:   { title: 'Approval Queue',      sub: 'Items waiting on your sign-off' },
  tasks:       { title: 'Task Flow',           sub: 'Assigned tasks across all teams' },
  reports:     { title: 'Reports',             sub: 'Build, schedule and export' },
  contracts:   { title: 'Contracts',           sub: 'Active contracts and pending renewals' },
  tickets:     { title: 'Claims',              sub: 'Open claims and SLA tracking' },
  coaching:    { title: 'Coaching + QA',       sub: 'Call reviews and performance coaching' },
  planning:    { title: 'Planning',            sub: 'Q2 strategic roadmap' },
  notes:       { title: 'Notes',              sub: 'Internal notes and documents' },
  finance:     { title: 'Finance',            sub: 'Revenue, expenses and P&L' },
  payroll:     { title: 'Payroll',            sub: 'Batch payroll processing and sign-off' },
  targets:     { title: 'Targets',            sub: 'Q2 individual and team objectives' },
  wise:        { title: 'WISE',              sub: 'Workforce intelligence and strategy engine' },
  kb:          { title: 'Knowledge Base',    sub: 'Articles, guides and training resources' },
  permissions: { title: 'Permissions',       sub: 'Role-based access control matrix' },
  policy:      { title: 'Policy Engine',     sub: 'Automated rules, violations and enforcement' },
  audit:       { title: 'Audit Log',         sub: 'Tamper-evident action history' },
  design:      { title: 'PDF Templates',     sub: 'Document templates and generators' },
  revenue:     { title: 'Revenue Tracker',   sub: 'Log sales, verify and track payslip impact' },
  paystubs:    { title: 'My Pay Stubs',      sub: 'YTD earnings and pending payslips' },
  mytasks:     { title: 'My Tasks',          sub: 'Tasks assigned to you' },
  myschedule:  { title: 'My Schedule',       sub: 'Your upcoming shifts and time off' },
  mytimeoff:   { title: 'Time-Off Requests', sub: 'Submit and track your leave' },
  mytarget:    { title: 'My Targets',        sub: 'Your personal performance goals' },
  mydash:      { title: 'My Dashboard',      sub: 'Personal overview and quick actions' },
  collections: { title: 'Collections',      sub: 'Active accounts and follow-up queue' },
};

export default function TopBarTitle({ role }: { role: string }) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const segment = segments[segments.length - 1] ?? 'dashboard';
  const isRoleSegment = segment === role;
  const key = isRoleSegment ? 'dashboard' : segment;
  const meta = PAGE_META[key] ?? { title: key.charAt(0).toUpperCase() + key.slice(1), sub: '' };

  return (
    <div className="tb-title-block">
      <div className="tb-title">{meta.title}</div>
      {meta.sub && <div className="tb-sub">{meta.sub}</div>}
    </div>
  );
}
