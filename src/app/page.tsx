'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (isRegistering) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) setErrorMsg(error.message);
      else setErrorMsg('Registration successful! Check your email or wait for owner approval.');
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setErrorMsg(error.message);
      } else if (data.user) {
        // Fetch profile to know their role for routing
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
        if (profile) {
          router.push(`/dashboard/${profile.role}`);
        } else {
          // Fallback if profile trigger delayed
          router.push(`/dashboard/sales`);
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="pv-login">
      <div className="pv-login-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <div className="pv-sb-icon">PV</div>
          <div>
            <div style={{ fontSize: '19px', fontWeight: 700, color: '#1a1f2e', letterSpacing: '-0.01em' }}>
              Pioneers Veneers
            </div>
            <div style={{ fontSize: '11px', color: '#6b7689', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: '2px' }}>
              Enterprise Platform
            </div>
          </div>
        </div>

        <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1f2e', marginBottom: '6px' }}>
          {isRegistering ? 'Request Access' : 'System Login'}
        </h2>
        <p style={{ fontSize: '13px', color: '#6b7689', marginBottom: '26px' }}>
          {isRegistering ? 'Submit your details for owner approval.' : 'Authenticate to access your workspace.'}
        </p>

        {errorMsg && (
          <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px', border: '1px solid #fecaca' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleAuth}>
          <div className="pv-fld">
            <label>Email Address</label>
            <input 
              type="email" 
              placeholder="Enter your email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="pv-fld">
            <label>Access Key (Password)</label>
            <input 
              type="password" 
              placeholder="Enter password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="pv-btn pv-btn-pri" style={{ width: '100%', padding: '11px', marginTop: '8px', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Processing...' : (isRegistering ? 'Submit Request' : 'Initialize Session')}
          </button>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid #f0f2f5', textAlign: 'center' }}>
          <button 
            onClick={() => { setIsRegistering(!isRegistering); setErrorMsg(''); }}
            className="pv-btn pv-btn-sec"
          >
            {isRegistering ? 'Back to Login' : 'Register New Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
