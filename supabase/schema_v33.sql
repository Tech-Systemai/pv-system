-- v33: Add description to tasks + notify assignee when a task is created

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Notify the assigned user when a new task is created for them
CREATE OR REPLACE FUNCTION public.fn_notify_task_assigned()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_assigner_name TEXT;
BEGIN
  -- Don't notify if someone assigns a task to themselves
  IF NEW.assigned_to IS NULL OR NEW.assigned_to = NEW.assigned_by THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_assigner_name FROM public.profiles WHERE id = NEW.assigned_by;

  INSERT INTO public.notifications (user_id, title, body, type, link_id, is_read)
  VALUES (
    NEW.assigned_to,
    'New task assigned to you',
    COALESCE(v_assigner_name, 'Someone') || ' assigned: ' || NEW.title,
    'task_assigned',
    NEW.id,
    false
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_assigned ON public.tasks;
CREATE TRIGGER trg_task_assigned
  AFTER INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_task_assigned();
