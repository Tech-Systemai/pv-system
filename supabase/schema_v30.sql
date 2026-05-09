-- v30: Database triggers for in-app notifications (reliable, server-side)
--      Replaces fragile client-side notify() calls.

-- ── New ticket → notify all mgmt ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_ticket_created()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, type, link_id, is_read)
  SELECT p.id,
    'New ticket opened',
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

DROP TRIGGER IF EXISTS trg_ticket_created ON public.tickets;
CREATE TRIGGER trg_ticket_created
  AFTER INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_ticket_created();

-- ── New reply → notify ticket owner + assigned agent ───────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_ticket_reply()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_ticket public.tickets%ROWTYPE;
BEGIN
  SELECT * INTO v_ticket FROM public.tickets WHERE id = NEW.ticket_id;
  IF v_ticket IS NULL THEN RETURN NEW; END IF;

  -- Notify owner (skip if they're the one replying)
  IF v_ticket.user_id IS NOT NULL AND v_ticket.user_id <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, body, type, link_id, is_read)
    VALUES (
      v_ticket.user_id,
      'New reply on your ticket',
      COALESCE(NEW.sender_name, 'Someone') || ': ' || LEFT(COALESCE(NEW.content, ''), 80),
      'ticket_reply', NEW.ticket_id, false
    );
  END IF;

  -- Notify assigned agent if different from owner and replier
  IF v_ticket.assigned_to IS NOT NULL
    AND v_ticket.assigned_to <> NEW.user_id
    AND v_ticket.assigned_to <> v_ticket.user_id
  THEN
    INSERT INTO public.notifications (user_id, title, body, type, link_id, is_read)
    VALUES (
      v_ticket.assigned_to,
      'New reply on your ticket',
      COALESCE(NEW.sender_name, 'Someone') || ': ' || LEFT(COALESCE(NEW.content, ''), 80),
      'ticket_reply', NEW.ticket_id, false
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_reply ON public.ticket_replies;
CREATE TRIGGER trg_ticket_reply
  AFTER INSERT ON public.ticket_replies
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_ticket_reply();

-- ── Ticket resolved → notify owner ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_ticket_resolved()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'Resolved' AND NEW.status = 'Resolved' THEN
    INSERT INTO public.notifications (user_id, title, body, type, link_id, is_read)
    VALUES (
      NEW.user_id,
      'Ticket resolved',
      'Your ticket "' || COALESCE(NEW.title, 'Untitled') || '" has been resolved.',
      'ticket_resolved', NEW.id, false
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_resolved ON public.tickets;
CREATE TRIGGER trg_ticket_resolved
  AFTER UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_ticket_resolved();
