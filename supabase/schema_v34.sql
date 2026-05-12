-- v34: Notify management when a time-off request is submitted

CREATE OR REPLACE FUNCTION public.fn_notify_timeoff_requested()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE
  v_requester_name TEXT;
BEGIN
  SELECT name INTO v_requester_name FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, title, body, type, link_id, is_read)
  SELECT p.id,
    'New time-off request',
    COALESCE(v_requester_name, 'Someone') || ' requested ' || NEW.type
      || ' · ' || NEW.start_date::text || ' → ' || NEW.end_date::text,
    'timeoff_request',
    NULL,
    false
  FROM public.profiles p
  WHERE p.role IN ('owner', 'admin', 'supervisor')
    AND p.id <> NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_timeoff_requested ON public.time_off_requests;
CREATE TRIGGER trg_timeoff_requested
  AFTER INSERT ON public.time_off_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_timeoff_requested();
