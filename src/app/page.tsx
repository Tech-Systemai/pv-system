'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { requestAccess } from './signup-action';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>('login');
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
      setUtcTime(`${hh}:${mm}:${ss}`);
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
      const result = await requestAccess(email, password);
      if (result.error) setMsg({ text: result.error, type: 'error' });
      else setMsg({ text: 'Request submitted. An admin will review your account.', type: 'success' });
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg({ text: error.message, type: 'error' });
      } else if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, status')
          .eq('id', data.user.id)
          .single();
        if (!profile || profile.status === 'Pending') {
          await supabase.auth.signOut();
          setMsg({ text: 'Your access request is pending approval. You will be notified once reviewed.', type: 'error' });
        } else if (profile.status === 'Inactive' || profile.status === 'Suspended') {
          await supabase.auth.signOut();
          setMsg({ text: 'Your account has been deactivated. Contact an administrator.', type: 'error' });
        } else {
          router.push(`/dashboard/${profile.role ?? 'sales'}`);
        }
      }
    }
    setLoading(false);
  };

  const switchTab = (next: 'login' | 'register' | 'forgot') => {
    setTab(next);
    setMsg(null);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://portal.pioneersveneers.com/auth/callback?next=/reset-password',
    });
    if (error) {
      setMsg({ text: error.message, type: 'error' });
    } else {
      setMsg({ text: 'Check your email — a reset link has been sent.', type: 'success' });
    }
    setLoading(false);
  };

  return (
    <div className="pv-login">
      {/* ── Left atmospheric panel ── */}
      <aside className="pv-login-aside">
        <div className="pv-login-brand">
          <div className="pv-sb-icon">PV</div>
          <div>
            <div className="pv-login-brand-name">Pioneers Veneers</div>
            <div className="pv-login-brand-sub">Enterprise Platform · v4.12</div>
          </div>
        </div>

        <div className="pv-login-pitch">
          <h1>
            One operating layer for{' '}
            <em>every team you run.</em>
          </h1>
          <p>
            Sales, finance, HR, support and supervision — connected through a live
            policy engine, with audit-grade trails on every action.
          </p>

          <div className="pv-login-stats">
            <div>
              <div className="v">142</div>
              <div className="l">Employees online</div>
            </div>
            <div>
              <div className="v">99.98%</div>
              <div className="l">Platform uptime</div>
            </div>
            <div>
              <div className="v">$1.42M</div>
              <div className="l">MTD revenue</div>
            </div>
          </div>
        </div>

        <div className="pv-login-status">
          <span className="dot" />
          {utcTime ? `ALL SYSTEMS NOMINAL · ${utcTime} UTC` : 'ALL SYSTEMS NOMINAL'}
        </div>
      </aside>

      {/* ── Right form panel ── */}
      <main className="pv-login-main">
        <div className="pv-login-ticker">
          <span className="pulse" style={{ flexShrink: 0 }} />
          SECURE · TLS 1.3 · SAML/SSO ENABLED
        </div>

        <div className="pv-login-form-wrap">
          <div className="pv-login-eyebrow">
            {tab === 'login' ? 'Welcome back' : tab === 'register' ? 'Request access' : 'Password reset'}
          </div>
          <div className="pv-login-form-head">
            <h2>
              {tab === 'login' ? 'Sign in to your portal' : tab === 'register' ? 'Create your account' : 'Forgot your password?'}
            </h2>
            <p>
              {tab === 'login'
                ? 'Continue where you left off — your shift, queues, and approvals are waiting.'
                : tab === 'register'
                ? 'Submit your details for owner approval. Most are reviewed within a business day.'
                : 'Enter your work email and we will send you a reset link.'}
            </p>
          </div>

          {tab !== 'forgot' && (
            <div className="pv-login-mode-toggle">
              <button
                type="button"
                className={tab === 'login' ? 'active' : ''}
                onClick={() => switchTab('login')}
              >
                Sign in
              </button>
              <button
                type="button"
                className={tab === 'register' ? 'active' : ''}
                onClick={() => switchTab('register')}
              >
                Request access
              </button>
            </div>
          )}

          {msg && (
            <div className={msg.type === 'error' ? 'pv-login-error' : 'pv-login-success'}>
              {msg.type === 'error' ? '⚠ ' : ''}{msg.text}
            </div>
          )}

          {tab === 'forgot' && (
            <form onSubmit={handleForgot}>
              <div className="pv-fld">
                <label>Work email</label>
                <input
                  type="email"
                  placeholder="you@pioneersveneers.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>
              <button type="submit" className="pv-login-btn" disabled={loading}>
                {loading ? (
                  <><span className="spin" style={{ width: 12, height: 12, marginRight: 4 }} /> Sending…</>
                ) : 'Send reset link →'}
              </button>
            </form>
          )}

          {tab !== 'forgot' && (
            <form onSubmit={handleAuth}>
              <div className="pv-fld">
                <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Work email</span>
                </label>
                <input
                  type="email"
                  placeholder="you@pioneersveneers.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="pv-fld">
                <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Password</span>
                  {tab === 'login' && (
                    <a style={{ color: 'var(--accent-ink)', fontSize: '11.5px', fontWeight: 500, cursor: 'pointer' }} onClick={() => switchTab('forgot')}>Forgot?</a>
                  )}
                </label>
                <input
                  type="password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                />
              </div>
              <button type="submit" className="pv-login-btn" disabled={loading}>
                {loading ? (
                  <><span className="spin" style={{ width: 12, height: 12, marginRight: 4 }} /> Authenticating…</>
                ) : tab === 'login' ? (
                  'Sign in to portal →'
                ) : (
                  'Submit request'
                )}
              </button>
            </form>
          )}

          <div className="pv-login-footer">
            {tab === 'forgot' ? (
              <><a role="button" onClick={() => switchTab('login')}>← Back to sign in</a></>
            ) : tab === 'login' ? (
              <>Need an account?{' '}
                <a role="button" onClick={() => switchTab('register')}>Request access</a>
              </>
            ) : (
              <>Already have one?{' '}
                <a role="button" onClick={() => switchTab('login')}>Sign in</a>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
