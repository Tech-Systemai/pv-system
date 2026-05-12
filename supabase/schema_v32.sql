-- v32: Rename "ticket" → "claim" in notification trigger messages

CREATE OR REPLACE FUNCTION public.fn_notify_ticket_created()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, type, link_id, is_read)
  SELECT p.id,
    'New claim opened',
    NEW.title,
    'ticket_new',
    NEW.id,
    false
  FROM public.profiles p
  WHERE p.role IN ('owner', 'admin', 'supervisor')
    AND p.id <> NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_notify_ticket_reply()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_ticket public.tickets%ROWTYPE;
BEGIN
  SELECT * INTO v_ticket FROM public.tickets WHERE id = NEW.ticket_id;
  IF v_ticket IS NULL THEN RETURN NEW; END IF;

  IF v_ticket.user_id IS NOT NULL AND v_ticket.user_id <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, body, type, link_id, is_read)
    VALUES (
      v_ticket.user_id,
      'New reply on your claim',
      COALESCE(NEW.sender_name, 'Someone') || ': ' || LEFT(COALESCE(NEW.content, ''), 80),
      'ticket_reply', NEW.ticket_id, false
    );
  END IF;

  IF v_ticket.assigned_to IS NOT NULL
    AND v_ticket.assigned_to <> NEW.user_id
    AND v_ticket.assigned_to <> v_ticket.user_id
  THEN
    INSERT INTO public.notifications (user_id, title, body, type, link_id, is_read)
    VALUES (
      v_ticket.assigned_to,
      'New reply on your claim',
      COALESCE(NEW.sender_name, 'Someone') || ': ' || LEFT(COALESCE(NEW.content, ''), 80),
      'ticket_reply', NEW.ticket_id, false
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_notify_ticket_resolved()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'Resolved' AND NEW.status = 'Resolved' THEN
    INSERT INTO public.notifications (user_id, title, body, type, link_id, is_read)
    VALUES (
      NEW.user_id,
      'Claim resolved',
      'Your claim "' || COALESCE(NEW.title, 'Untitled') || '" has been resolved.',
      'ticket_resolved', NEW.id, false
    );
  END IF;
  RETURN NEW;
END;
$$;
