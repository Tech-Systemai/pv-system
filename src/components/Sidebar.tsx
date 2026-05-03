'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';

const PORTALS: any = {
  owner:{label:'Owner',sections:[
    {head:'Overview',items:[
      {id:'dashboard',label:'Command Center',icon:'⊞'},
      {id:'monitoring',label:'Live Monitoring',icon:'◉',badge:'LIVE',badgeType:'live'},
      {id:'analytics',label:'Analytics',icon:'📊'},
      {id:'inbox',label:'Inbox',icon:'✉',badge:3},
      {id:'chat',label:'Messages',icon:'💬',badge:2},
    ]},
    {head:'People',items:[
      {id:'users',label:'Employee Directory',icon:'👥'},
      {id:'hr',label:'HR Pipeline',icon:'📋',badge:3},
      {id:'org',label:'Org Tree',icon:'⬢'},
      {id:'attendance',label:'Attendance Log',icon:'📅'},
      {id:'timeoff',label:'Time-Off Requests',icon:'🏝',badge:1},
    ]},
    {head:'Operations',items:[
      {id:'schedule',label:'Schedules',icon:'⏱',badge:1,badgeType:'alert'},
      {id:'approvals',label:'Approval Queue',icon:'✓'},
      {id:'tasks',label:'Task Flow',icon:'✓'},
      {id:'reports',label:'Reports',icon:'📊'},
      {id:'contracts',label:'Contracts',icon:'📄'},
      {id:'tickets',label:'Tickets',icon:'🎫',badge:2,badgeType:'alert'},
      {id:'coaching',label:'Coaching + QA',icon:'🎯'},
    ]},
    {head:'Strategy',items:[
      {id:'planning',label:'Planning',icon:'📈'},
      {id:'notes',label:'Notes',icon:'📝'},
      {id:'finance',label:'Finance',icon:'$'},
      {id:'payroll',label:'Payroll',icon:'💵'},
      {id:'targets',label:'Targets',icon:'⊕'},
      {id:'wise',label:'WISE',icon:'💡'},
      {id:'kb',label:'Knowledge Base',icon:'📚'},
    ]},
    {head:'System',items:[
      {id:'permissions',label:'Permissions',icon:'🔐'},
      {id:'policy',label:'Policy Engine',icon:'⚙'},
      {id:'audit',label:'Audit Log',icon:'📜'},
      {id:'design',label:'PDF Templates',icon:'🎨'},
    ]},
  ]},
  admin:{label:'Admin',sections:[
    {head:'Operations',items:[
      {id:'dashboard',label:'Dashboard',icon:'⊞'},
      {id:'inbox',label:'Inbox',icon:'✉'},
      {id:'chat',label:'Messages',icon:'💬'},
      {id:'schedule',label:'Schedules',icon:'⏱'},
      {id:'approvals',label:'Approvals',icon:'✓'},
      {id:'tasks',label:'Tasks',icon:'✓'},
      {id:'reports',label:'Reports',icon:'📊'},
      {id:'tickets',label:'Tickets',icon:'🎫'},
      {id:'coaching',label:'Coaching + QA',icon:'🎯'},
      {id:'notes',label:'Notes',icon:'📝'},
      {id:'wise',label:'WISE',icon:'💡'},
    ]},
    {head:'People',items:[
      {id:'users',label:'Employees',icon:'👥'},
      {id:'hr',label:'HR Pipeline',icon:'📋'},
      {id:'contracts',label:'Contracts',icon:'📄'},
      {id:'payroll',label:'Payroll',icon:'💵'},
      {id:'timeoff',label:'Time-Off',icon:'🏝'},
      {id:'attendance',label:'Attendance Log',icon:'📅'},
      {id:'kb',label:'Knowledge Base',icon:'📚'},
    ]},
  ]},
  sales:{label:'Sales',sections:[
    {head:'Workspace',items:[
      {id:'dashboard',label:'My Dashboard',icon:'⊞'},
      {id:'inbox',label:'Inbox',icon:'✉'},
      {id:'chat',label:'Messages',icon:'💬'},
      {id:'schedule',label:'My Schedule',icon:'⏱'},
      {id:'tasks',label:'My Tasks',icon:'✓'},
      {id:'revenue',label:'Revenue Tracker',icon:'$'},
      {id:'targets',label:'Target Progress',icon:'⊕'},
      {id:'timeoff',label:'Request Time Off',icon:'🏝'},
      {id:'tickets',label:'Tickets',icon:'🎫'},
      {id:'notes',label:'Notes',icon:'📝'},
      {id:'kb',label:'Knowledge Base',icon:'📚'},
    ]},
  ]},
  cx:{label:'CX',sections:[
    {head:'Workspace',items:[
      {id:'dashboard',label:'My Dashboard',icon:'⊞'},
      {id:'inbox',label:'Inbox',icon:'✉'},
      {id:'chat',label:'Messages',icon:'💬'},
      {id:'schedule',label:'My Schedule',icon:'⏱'},
      {id:'tasks',label:'My Tasks',icon:'✓'},
      {id:'collections',label:'Collections',icon:'$'},
      {id:'timeoff',label:'Request Time Off',icon:'🏝'},
      {id:'tickets',label:'Tickets',icon:'🎫'},
      {id:'notes',label:'Notes',icon:'📝'},
      {id:'kb',label:'Knowledge Base',icon:'📚'},
    ]},
  ]},
  supervisor:{label:'Supervisor',sections:[
    {head:'My Team',items:[
      {id:'dashboard',label:'Dashboard',icon:'⊞'},
      {id:'inbox',label:'Inbox',icon:'✉'},
      {id:'chat',label:'Messages',icon:'💬'},
      {id:'schedule',label:'Schedule',icon:'⏱'},
      {id:'tasks',label:'Tasks',icon:'✓'},
      {id:'reports',label:'Reports',icon:'📊'},
      {id:'coaching',label:'Coaching',icon:'🎯'},
      {id:'notes',label:'Notes',icon:'📝'},
      {id:'kb',label:'Knowledge Base',icon:'📚'},
    ]},
  ]},
  accountant:{label:'Accountant',sections:[
    {head:'Finance',items:[
      {id:'finance',label:'Dashboard',icon:'⊞'},
      {id:'payroll',label:'Payroll',icon:'💵'},
      {id:'inbox',label:'Inbox',icon:'✉'},
      {id:'chat',label:'Messages',icon:'💬'},
      {id:'kb',label:'Knowledge Base',icon:'📚'},
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

  const p = PORTALS[role] || PORTALS.sales;
  const currentNav = pathname.split('/').pop();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleClockToggle = async () => {
    if (!profile) return;
    setClocking(true);
    const newStatus = !isClockedIn;
    await supabase.from('profiles').update({ clocked_in: newStatus }).eq('id', profile.id);
    
    // Auto-log to attendance_logs
    if (newStatus) {
      await supabase.from('attendance_logs').insert([{ user_id: profile.id, status: 'present', clock_in_time: new Date().toISOString() }]);
    } else {
      // Find today's log and add clock_out_time
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
    if (newRole) {
      router.push(`/dashboard/${newRole}`);
    }
  };

  const nameInitial = profile?.name ? profile.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toLowerCase() : 'u';

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
          style={{ 
            width: '100%', padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            background: isClockedIn ? '#ef4444' : '#4f46e5', color: '#fff', fontWeight: 600, fontSize: '13px',
            transition: 'all 0.2s'
          }}
        >
          {clocking ? 'Wait...' : isClockedIn ? 'Clock Out' : 'Clock In'}
        </button>
      </div>

      {p.sections.map((sec: any) => (
        <div key={sec.head} className="sb-sec">
          <div className="sb-h">{sec.head}</div>
          {sec.items.map((it: any) => {
            const isActive = currentNav === it.id || (currentNav === role && it.id === 'dashboard');
            return (
              <Link key={it.id} href={`/dashboard/${role}/${it.id === 'dashboard' ? '' : it.id}`} style={{ textDecoration: 'none' }}>
                <button className={`sb-it ${isActive ? 'active' : ''}`}>
                  <span className="sb-ico">{it.icon}</span>
                  {it.label}
                  {it.badge && <span className={`sb-bdg ${it.badgeType || ''}`}>{it.badge}</span>}
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
        
        {/* Switch Portal Section */}
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
