-- v42: Fix FK cascade rules to allow clean employee deletion

-- profiles.id → auth.users: add ON DELETE CASCADE
-- (allows auth.admin.deleteUser to cascade into profiles automatically)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- tasks.assigned_to / assigned_by → profiles: add ON DELETE SET NULL
-- (tasks survive employee deletion, just become unassigned)
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_assigned_by_fkey;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_assigned_by_fkey
    FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
