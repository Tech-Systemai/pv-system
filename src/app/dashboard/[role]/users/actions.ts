'use server';

import { createClient } from '@supabase/supabase-js';

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

  // Pass metadata so the trigger can populate the profile immediately
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  });

  if (authError) {
    return { error: authError.message };
  }

  if (authData.user) {
    // Upsert (not update) so it works whether the trigger created the row or not
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email,
        name,
        role,
        department: role === 'sales' ? 'Sales' : role === 'cx' ? 'CX' : 'Management',
        salary,
        status: 'Active',
      });

    if (profileError) {
      return { error: profileError.message };
    }
  }

  return { success: true };
}
