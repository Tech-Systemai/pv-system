'use server';

import { createClient } from '@supabase/supabase-js';

export async function requestAccess(email: string, password: string): Promise<{ error?: string }> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Create user with email pre-confirmed so no confirmation email is sent.
  // Access is gated by profiles.status ('Pending' → 'Active' after admin approval).
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) return { error: error.message };

  if (data.user) {
    // The trigger creates the profile row; we upsert to ensure the email
    // column is populated (the trigger only stores it in username, not email).
    await admin.from('profiles').upsert({ id: data.user.id, email });
  }

  return {};
}
