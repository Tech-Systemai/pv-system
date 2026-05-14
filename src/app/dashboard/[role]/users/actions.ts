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
  const username = (formData.get('username') as string) || email.split('@')[0];

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
        username,
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

export async function deleteEmployee(userId: string) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Nullify task assignments (tasks.assigned_to/assigned_by have no CASCADE)
  await supabaseAdmin.from('tasks').update({ assigned_to: null }).eq('assigned_to', userId);
  await supabaseAdmin.from('tasks').update({ assigned_by: null }).eq('assigned_by', userId);

  // 2. Delete the profile row — all other FKs pointing here have CASCADE or SET NULL
  //    so this clears sales_logs, time_off_requests, schedules, attendance_logs, etc.
  const { error: profileError } = await supabaseAdmin.from('profiles').delete().eq('id', userId);
  if (profileError) return { error: profileError.message };

  // 3. Now auth.users has no referencing profile row — safe to delete
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authError) return { error: authError.message };

  return { success: true };
}

export async function resetUserPassword(userId: string, newPassword: string) {
  if (newPassword.length < 6) return { error: 'Password must be at least 6 characters.' };
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return { error: error.message };
  return { success: true };
}
