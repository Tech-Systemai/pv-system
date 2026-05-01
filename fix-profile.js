const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length) process.env[key.trim()] = val.join('=').trim().replace(/"/g, '');
});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixProfile() {
  const { data: { users }, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) { console.error('Error fetching users:', uErr); return; }

  const owner = users.find(u => u.email === 'hamedhasan7210@gmail.com');
  if (!owner) { console.log('Owner user not found in auth.'); return; }

  const { data: existing } = await supabase.from('profiles').select('id').eq('id', owner.id).single();
  
  if (!existing) {
    console.log('Profile missing for owner. Creating now...');
    const { error: insertErr } = await supabase.from('profiles').insert({
      id: owner.id,
      username: 'hamed',
      name: 'Hamed Hasan',
      role: 'owner',
      department: 'Management',
      salary: 0,
      points: 7,
      score: 100,
      status: 'Active',
      location: 'Remote'
    });
    
    if (insertErr) console.error('Error inserting profile:', insertErr);
    else console.log('Profile created successfully for', owner.email);
  } else {
    console.log('Profile already exists, making sure role is owner...');
    await supabase.from('profiles').update({ role: 'owner' }).eq('id', owner.id);
    console.log('Role updated to owner.');
  }
}

fixProfile();
