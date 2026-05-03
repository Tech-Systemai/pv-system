'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';

const CHANNEL_ROLES: Record<string, string[]> = {
  general:       ['owner', 'admin', 'supervisor', 'sales', 'cx', 'accountant'],
  management:    ['owner', 'admin', 'supervisor', 'accountant'],
  'sales-team':  ['owner', 'admin', 'supervisor', 'sales'],
  'cx-team':     ['owner', 'admin', 'supervisor', 'cx'],
  announcements: ['owner', 'admin', 'supervisor', 'sales', 'cx', 'accountant'],
};

// Items that display a live count badge — keyed by sidebar item id
const COUNT_ITEMS = new Set(['chat', 'inbox', 'tickets', 'hr', 'timeoff', 'approvals']);

const PORTALS: any = {
  owner: { label: 'Owner', sections: [
    { head: 'Overview', items: [
      { id: 'dashboard',  label: 'Command Center',   icon: '⊞' },
      { id: 'monitoring', label: 'Live Monitoring',   icon: '◉', badge: 'LIVE', badgeType: 'live' },
      { id: 'analytics',  label: 'Analytics',         icon: '📊' },
      { id: 'inbox',      label: 'Inbox',              icon: '✉' },
      { id: 'chat',       label: 'Messages',           icon: '💬' },
    ]},
    { head: 'People', items: [
      { id: 'users',      label: 'Employee Directory', icon: '👥' },
      { id: 'hr',         label: 'HR Pipeline',        icon: '📋' },
      { id: 'org',        label: 'Org Tree',            icon: '⬢' },
      { id: 'attendance', label: 'Attendance Log',      icon: '📅' },
      { id: 'timeoff',    label: 'Time-Off Requests',   icon: '🏝' },
    ]},
    { head: 'Operations', items: [
      { id: 'schedule',   label: 'Schedules',           icon: '⏱' },
      { id: 'approvals',  label: 'Approval Queue',      icon: '✓' },
      { id: 'tasks',      label: 'Task Flow',            icon: '✓' },
      { id: 'reports',    label: 'Reports',              icon: '📊' },
      { id: 'contracts',  label: 'Contracts',            icon: '📄' },
      { id: 'tickets',    label: 'Tickets',              icon: '🎫', badgeType: 'alert' },
      { id: 'coaching',   label: 'Coaching + QA',        icon: '🎯' },
    ]},
    { head: 'Strategy', items: [
      { id: 'planning',   label: 'Planning',             icon: '📈' },
      { id: 'notes',      label: 'Notes',                icon: '📝' },
      { id: 'finance',    label: 'Finance',              icon: '$' },
      { id: 'payroll',    label: 'Payroll',              icon: '💵' },
      { id: 'targets',    label: 'Targets',              icon: '⊕' },
      { id: 'wise',       label: 'WISE',                 icon: '💡' },
      { id: 'kb',         label: 'Knowledge Base',       icon: '📚' },
    ]},
    { head: 'System', items: [
      { id: 'permissions', label: 'Permissions',         icon: '🔐' },
      { id: 'policy',      label: 'Policy Engine',       icon: '⚙' },
      { id: 'audit',       label: 'Audit Log',           icon: '📜' },
      { id: 'design',      label: 'PDF Templates',       icon: '🎨' },
    ]},
  ]},
  admin: { label: 'Admin', sections: [
    { head: 'Operations', items: [
      { id: 'dashboard',  label: 'Dashboard',           icon: '⊞' },
      { id: 'inbox',      label: 'Inbox',                icon: '✉' },
      { id: 'chat',       label: 'Messages',             icon: '💬' },
      { id: 'schedule',   label: 'Schedules',            icon: '⏱' },
      { id: 'approvals',  label: 'Approvals',            icon: '✓' },
      { id: 'tasks',      label: 'Tasks',                icon: '✓' },
      { id: 'reports',    label: 'Reports',              icon: '📊' },
      { id: 'tickets',    label: 'Tickets',              icon: '🎫' },
      { id: 'coaching',   label: 'Coaching + QA',        icon: '🎯' },
      { id: 'notes',      label: 'Notes',                icon: '📝' },
      { id: 'wise',       label: 'WISE',                 icon: '💡' },
    ]},
    { head: 'People', items: [
      { id: 'users',      label: 'Employees',            icon: '👥' },
      { id: 'hr',         label: 'HR Pipeline',          icon: '📋' },
      { id: 'contracts',  label: 'Contracts',            icon: '📄' },
      { id: 'payroll',    label: 'Payroll',              icon: '💵' },
      { id: 'timeoff',    label: 'Time-Off',             icon: '🏝' },
      { id: 'attendance', label: 'Attendance Log',       icon: '📅' },
      { id: 'kb',         label: 'Knowledge Base',       icon: '📚' },
    ]},
  ]},
  sales: { label: 'Sales', sections: [
    { head: 'Workspace', items: [
      { id: 'dashboard',  label: 'My Dashboard',         icon: '⊞' },
      { id: 'inbox',      label: 'Inbox',                icon: '✉' },
      { id: 'chat',       label: 'Messages',             icon: '💬' },
      { id: 'schedule',   label: 'My Schedule',          icon: '⏱' },
      { id: 'tasks',      label: 'My Tasks',             icon: '✓' },
      { id: 'revenue',    label: 'Revenue Tracker',      icon: '$' },
      { id: 'targets',    label: 'Target Progress',      icon: '⊕' },
      { id: 'timeoff',    label: 'Request Time Off',     icon: '🏝' },
      { id: 'tickets',    label: 'Tickets',              icon: '🎫' },
      { id: 'notes',      label: 'Notes',                icon: '📝' },
      { id: 'kb',         label: 'Knowledge Base',       icon: '📚' },
    ]},
  ]},
  cx: { label: 'CX', sections: [
    { head: 'Workspace', items: [
      { id: 'dashboard',    label: 'My Dashboard',       icon: '⊞' },
      { id: 'inbox',        label: 'Inbox',              icon: '✉' },
      { id: 'chat',         label: 'Messages',           icon: '💬' },
      { id: 'schedule',     label: 'My Schedule',        icon: '⏱' },
      { id: 'tasks',        label: 'My Tasks',           icon: '✓' },
      { id: 'collections',  label: 'Collections',        icon: '$' },
      { id: 'timeoff',      label: 'Request Time Off',   icon: '🏝' },
      { id: 'tickets',      label: 'Tickets',            icon: '🎫' },
      { id: 'notes',        label: 'Notes',              icon: '📝' },
      { id: 'kb',           label: 'Knowledge Base',     icon: '📚' },
    ]},
  ]},
  supervisor: { label: 'Supervisor', sections: [
    { head: 'My Team', items: [
      { id: 'dashboard',  label: 'Dashboard',            icon: '⊞' },
      { id: 'inbox',      label: 'Inbox',                icon: '✉' },
      { id: 'chat',       label: 'Messages',             icon: '💬' },
      { id: 'schedule',   label: 'Schedule',             icon: '⏱' },
      { id: 'tasks',      label: 'Tasks',                icon: '✓' },
      { id: 'reports',    label: 'Reports',              icon: '📊' },
      { id: 'coaching',   label: 'Coaching',             icon: '🎯' },
      { id: 'notes',      label: 'Notes',                icon: '📝' },
      { id: 'kb',         label: 'Knowledge Base',       icon: '📚' },
    ]},
  ]},
  accountant: { label: 'Accountant', sections: [
    { head: 'Finance', items: [
      { id: 'finance',    label: 'Dashboard',            icon: '⊞' },
      { id: 'payroll',    label: 'Payroll',              icon: '💵' },
      { id: 'inbox',      label: 'Inbox',                icon: '✉' },
      { id: 'chat',       label: 'Messages',             icon: '💬' },
      { id: 'kb',         label: 'Knowledge Base',       icon: '📚' },
    ]},
  ]},
};

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clocking, setClocking] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (data) {
          setProfile(data);
          setIsClockedIn(data.clocked_in);
        }
      }
    }
    loadProfile();
  }, []);

  // Fetch counts once profile is ready, then keep chat count live via realtime
  useEffect(() => {
    if (!profile?.id) return;
    fetchCounts(profile.id, profile.role);

    const sub = supabase
      .channel('sidebar-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new as any;
        if (msg.user_id === profile.id) return;
        const accessible = Object.entries(CHANNEL_ROLES)
          .filter(([, roles]) => roles.includes(profile.role))
          .map(([id]) => id);
        const inMyChannel = accessible.includes(msg.channel);
        const isDMToMe = msg.receiver_id === profile.id;
        if (inMyChannel || isDMToMe) {
          setCounts(prev => ({ ...prev, chat: (prev.chat || 0) + 1 }));
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inbox_documents' }, () => {
        setCounts(prev => ({ ...prev, inbox: (prev.inbox || 0) + 1 }));
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [profile?.id]);

  // Clear section badge when user navigates to it
  const currentNav = pathname.split('/').pop();
  useEffect(() => {
    if (!profile?.id || !currentNav) return;
    if (currentNav === 'chat') {
      localStorage.setItem(`notif-last-seen-${profile.id}`, new Date().toISOString());
      setCounts(prev => ({ ...prev, chat: 0 }));
    }
    if (currentNav === 'inbox') {
      localStorage.setItem(`inbox-last-seen-${profile.id}`, new Date().toISOString());
      setCounts(prev => ({ ...prev, inbox: 0 }));
    }
  }, [currentNav, profile?.id]);

  const fetchCounts = async (userId: string, userRole: string) => {
    const next: Record<string, number> = {};

    // Chat: unread messages since last notification clear
    try {
      const lastSeen = localStorage.getItem(`notif-last-seen-${userId}`) || new Date(0).toISOString();
      const accessible = Object.entries(CHANNEL_ROLES)
        .filter(([, roles]) => roles.includes(userRole))
        .map(([id]) => id);
      if (accessible.length > 0) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .neq('user_id', userId)
          .or(`channel.in.(${accessible.join(',')}),receiver_id.eq.${userId}`)
          .gt('created_at', lastSeen);
        if (count) next.chat = count;
      }
    } catch { /* ignore */ }

    // Inbox: documents since last visit
    try {
      const lastSeen = localStorage.getItem(`inbox-last-seen-${userId}`) || new Date(0).toISOString();
      const { count } = await supabase
        .from('inbox_documents')
        .select('*', { count: 'exact', head: true })
        .gt('created_at', lastSeen);
      if (count) next.inbox = count;
    } catch { /* ignore */ }

    // Tickets: open / pending
    try {
      const { count } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'pending', 'new']);
      if (count) next.tickets = count;
    } catch { /* ignore */ }

    // HR: active pipeline (management only)
    try {
      if (['owner', 'admin'].includes(userRole)) {
        const { count } = await supabase
          .from('hr_applicants')
          .select('*', { count: 'exact', head: true })
          .not('status', 'in', '(hired,rejected,withdrawn)');
        if (count) next.hr = count;
      }
    } catch { /* ignore */ }

    // Time-off: pending requests
    try {
      const { count } = await supabase
        .from('time_off_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (count) next.timeoff = count;
    } catch { /* ignore */ }

    // Approvals: pending
    try {
      const { count } = await supabase
        .from('time_off_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (count) next.approvals = count;
    } catch { /* ignore */ }

    setCounts(next);
  };

  const p = PORTALS[role] || PORTALS.sales;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleClockToggle = async () => {
    if (!profile) return;
    setClocking(true);
    const newStatus = !isClockedIn;
    await supabase.from('profiles').update({ clocked_in: newStatus }).eq('id', profile.id);
    if (newStatus) {
      await supabase.from('attendance_logs').insert([{ user_id: profile.id, status: 'present', clock_in_time: new Date().toISOString() }]);
    } else {
      const { data } = await supabase.from('attendance_logs').select('id').eq('user_id', profile.id).eq('date', new Date().toISOString().split('T')[0]).order('created_at', { ascending: false }).limit(1);
      if (data && data.length > 0) {
        await supabase.from('attendance_logs').update({ clock_out_time: new Date().toISOString() }).eq('id', data[0].id);
      }
    }
    setIsClockedIn(newStatus);
    setClocking(false);
  };

  const handlePortalSwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value;
    if (newRole) router.push(`/dashboard/${newRole}`);
  };

  const nameInitial = profile?.name
    ? profile.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toLowerCase()
    : 'u';

  return (
    <aside className="sb">
      <div className="sb-brd">
        <div className="sb-i">PV</div>
        <div>
          <div className="sb-n">Pioneers Veneers</div>
          <div className="sb-p">Portal · {p.label}</div>
        </div>
      </div>

      <div className="sb-sec" style={{ background: isClockedIn ? '#ecfdf5' : '#f5f6f8', padding: '12px', borderRadius: '8px', margin: '0 16px 16px 16px', border: `1px solid ${isClockedIn ? '#10b981' : '#e4e7eb'}` }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: isClockedIn ? '#047857' : '#6b7689', textTransform: 'uppercase', marginBottom: '8px', textAlign: 'center' }}>
          {isClockedIn ? '● Active Shift' : 'Off Clock'}
        </div>
        <button
          onClick={handleClockToggle}
          disabled={clocking}
          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: isClockedIn ? '#ef4444' : '#4f46e5', color: '#fff', fontWeight: 600, fontSize: '13px', transition: 'all 0.2s' }}
        >
          {clocking ? 'Wait...' : isClockedIn ? 'Clock Out' : 'Clock In'}
        </button>
      </div>

      {p.sections.map((sec: any) => (
        <div key={sec.head} className="sb-sec">
          <div className="sb-h">{sec.head}</div>
          {sec.items.map((it: any) => {
            const isActive = currentNav === it.id || (currentNav === role && it.id === 'dashboard');
            const liveCount = COUNT_ITEMS.has(it.id) ? (counts[it.id] || 0) : 0;
            return (
              <Link key={it.id} href={`/dashboard/${role}/${it.id === 'dashboard' ? '' : it.id}`} style={{ textDecoration: 'none' }}>
                <button className={`sb-it ${isActive ? 'active' : ''}`}>
                  <span className="sb-ico">{it.icon}</span>
                  {it.label}
                  {/* Static string badge (e.g. LIVE) */}
                  {it.badge && <span className={`sb-bdg ${it.badgeType || ''}`}>{it.badge}</span>}
                  {/* Dynamic numeric count — only when not active (you're already on that page) */}
                  {!it.badge && liveCount > 0 && !isActive && (
                    <span className={`sb-bdg ${it.badgeType || ''}`}>{liveCount}</span>
                  )}
                </button>
              </Link>
            );
          })}
        </div>
      ))}

      <div className="sb-u" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="sb-av">{nameInitial}</div>
          <div style={{ flex: 1 }}>
            <div className="sb-un">{profile?.name?.toLowerCase() || 'user'}</div>
            <div className="sb-ur">{profile?.role || role}</div>
          </div>
          <div className="sb-out" onClick={handleSignOut} title="Sign out">⏻</div>
        </div>

        <div style={{ borderTop: '1px solid #e4e7eb', paddingTop: '12px' }}>
          <div style={{ fontSize: '10px', color: '#6b7689', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>Switch Portal View</div>
          <select
            onChange={handlePortalSwitch}
            value={role}
            style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd2e0', background: '#fff' }}
          >
            <option value="owner">Owner View</option>
            <option value="admin">Admin View</option>
            <option value="supervisor">Supervisor View</option>
            <option value="accountant">Accountant View</option>
            <option value="sales">Sales View</option>
            <option value="cx">CX View</option>
          </select>
        </div>
      </div>
    </aside>
  );
}
