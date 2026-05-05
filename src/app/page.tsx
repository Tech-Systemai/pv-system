'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  const [loading, setLoading] = useState(false);
  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hh = String(now.getUTCHours()).padStart(2, '0');
      const mm = String(now.getUTCMinutes()).padStart(2, '0');
      const ss = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcTime(`${hh}:${mm}:${ss} UTC`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    if (tab === 'register') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMsg({ text: error.message, type: 'error' });
      else setMsg({ text: 'Request submitted. An admin will review your account.', type: 'success' });
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg({ text: error.message, type: 'error' });
      } else if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();
        router.push(`/dashboard/${profile?.role ?? 'sales'}`);
      }
    }
    setLoading(false);
  };

  const switchTab = (next: 'login' | 'register') => {
    setTab(next);
    setMsg(null);
  };

  return (
    <div className="pv-login">
      {/* ── Left atmospheric panel ── */}
      <aside className="pv-login-aside">
        <div className="pv-login-brand">
          <div className="pv-sb-icon">PV</div>
          <div>
            <div className="pv-login-brand-name">Pioneers Veneers</div>
            <div className="pv-login-brand-sub">Enterprise Platform</div>
          </div>
        </div>

        <div className="pv-login-pitch">
          <h1>
            Run your<br />
            <em>entire operation</em><br />
            from one place.
          </h1>
          <p>
            HR, scheduling, payroll, messaging, and analytics —
            unified in a single workspace built for high-performance teams.
          </p>

          <div className="pv-login-stats">
            <div>
              <div className="v">120+</div>
              <div className="l">Employees</div>
            </div>
            <div>
              <div className="v">6</div>
              <div className="l">Departments</div>
            </div>
            <div>
              <div className="v">99.9%</div>
              <div className="l">Uptime</div>
            </div>
          </div>
        </div>

        <div className="pv-login-status">
          <span className="dot" />
          SYSTEM OPERATIONAL
        </div>
      </aside>

      {/* ── Right form panel ── */}
      <main className="pv-login-main">
        {utcTime && (
          <div className="pv-login-ticker">
            <span className="dot" style={{ background: 'var(--ok)', boxShadow: 'none', animation: 'none' }} />
            {utcTime}
          </div>
        )}

        <div className="pv-login-form-wrap">
          <div className="pv-login-eyebrow">Secure Access</div>
          <div className="pv-login-form-head">
            <h2>
              {tab === 'login' ? 'Sign in to your workspace' : 'Request system access'}
            </h2>
            <p>
              {tab === 'login'
                ? 'Enter your credentials to continue.'
                : 'Submit your details for owner review.'}
            </p>
          </div>

          <div className="pv-login-mode-toggle">
            <button
              type="button"
              className={tab === 'login' ? 'active' : ''}
              onClick={() => switchTab('login')}
            >
              Sign In
            </button>
            <button
              type="button"
              className={tab === 'register' ? 'active' : ''}
              onClick={() => switchTab('register')}
            >
              Request Access
            </button>
          </div>

          {msg && (
            <div className={msg.type === 'error' ? 'pv-login-error' : 'pv-login-success'}>
              {msg.text}
            </div>
          )}

          <form onSubmit={handleAuth}>
            <div className="pv-fld">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="pv-fld">
              <label>Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
            <button type="submit" className="pv-login-btn" disabled={loading}>
              {loading
                ? 'Processing…'
                : tab === 'login'
                ? 'Initialize Session →'
                : 'Submit Request →'}
            </button>
          </form>

          <div className="pv-login-footer">
            {tab === 'login' ? (
              <>No account?{' '}
                <a role="button" onClick={() => switchTab('register')}>Request access</a>
              </>
            ) : (
              <>Already have access?{' '}
                <a role="button" onClick={() => switchTab('login')}>Sign in</a>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
