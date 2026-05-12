'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [stage, setStage] = useState<'loading' | 'form' | 'done' | 'invalid'>('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Supabase puts the recovery tokens in the URL hash; the client SDK
    // picks them up automatically when the page loads and fires an
    // INITIAL_SESSION / PASSWORD_RECOVERY event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setStage('form');
      }
    });

    // Fallback: if no event fires within 4s the link is invalid/expired
    const timer = setTimeout(() => {
      setStage(s => s === 'loading' ? 'invalid' : s);
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
      setSaving(false);
    } else {
      setStage('done');
      setTimeout(() => router.replace('/'), 2500);
    }
  };

  return (
    <div className="pv-login">
      <aside className="pv-login-aside">
        <div className="pv-login-brand">
          <div className="pv-sb-icon">PV</div>
          <div>
            <div className="pv-login-brand-name">Pioneers Veneers</div>
            <div className="pv-login-brand-sub">Enterprise Platform · v4.12</div>
          </div>
        </div>
        <div className="pv-login-pitch">
          <h1>Reset your <em>password.</em></h1>
          <p>Choose a new password for your account. You will be signed in automatically once it is set.</p>
        </div>
        <div className="pv-login-status">
          <span className="dot" />ALL SYSTEMS NOMINAL
        </div>
      </aside>

      <main className="pv-login-main">
        <div className="pv-login-ticker">
          <span className="pulse" style={{ flexShrink: 0 }} />
          SECURE · TLS 1.3 · SAML/SSO ENABLED
        </div>

        <div className="pv-login-form-wrap">
          {stage === 'loading' && (
            <div style={{ textAlign: 'center', color: 'var(--ink-3)', paddingTop: 40 }}>
              <div className="spin" style={{ width: 28, height: 28, margin: '0 auto 16px' }} />
              Verifying reset link…
            </div>
          )}

          {stage === 'invalid' && (
            <>
              <div className="pv-login-eyebrow">Link expired</div>
              <div className="pv-login-form-head">
                <h2>Reset link is invalid</h2>
                <p>This link has expired or already been used. Request a new one from the login page.</p>
              </div>
              <button className="pv-login-btn" onClick={() => router.replace('/')}>
                Back to sign in
              </button>
            </>
          )}

          {stage === 'form' && (
            <>
              <div className="pv-login-eyebrow">Password reset</div>
              <div className="pv-login-form-head">
                <h2>Choose a new password</h2>
                <p>Enter and confirm your new password below.</p>
              </div>

              {error && (
                <div className="pv-login-error">⚠ {error}</div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="pv-fld">
                  <label>New password</label>
                  <input
                    type="password"
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoFocus
                    autoComplete="new-password"
                  />
                </div>
                <div className="pv-fld">
                  <label>Confirm password</label>
                  <input
                    type="password"
                    placeholder="Repeat your new password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <button type="submit" className="pv-login-btn" disabled={saving}>
                  {saving ? (
                    <><span className="spin" style={{ width: 12, height: 12, marginRight: 4 }} /> Saving…</>
                  ) : 'Set new password →'}
                </button>
              </form>
            </>
          )}

          {stage === 'done' && (
            <>
              <div className="pv-login-eyebrow">All set</div>
              <div className="pv-login-form-head">
                <h2>Password updated</h2>
                <p>Your password has been changed. Redirecting you to the portal…</p>
              </div>
              <div className="pv-login-success">Password saved successfully. Redirecting…</div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
