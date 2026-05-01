'use server';

import { createClient } from '@supabase/supabase-js';

// We must use the service role key to bypass RLS and Auth restrictions
// when an admin is creating another user account.
export async function createEmployeeAccount(formData: FormData) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;
  const role = formData.get('role') as string;
  const salary = Number(formData.get('salary'));

  // 1. Create Auth User
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return { error: authError.message };
  }

  // 2. Update the auto-created profile (from our trigger) with the extra details
  if (authData.user) {
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        name,
        role,
        department: role === 'sales' ? 'Sales' : role === 'cx' ? 'CX' : 'Management',
        salary,
        status: 'Active',
      })
      .eq('id', authData.user.id);

    if (profileError) {
      return { error: profileError.message };
    }
  }

  return { success: true };
}
