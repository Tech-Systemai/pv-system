-- ── schema_v52: daily task workflow ─────────────────────────────────────────

-- ── Extend tasks table for group tasks ───────────────────────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_type          TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS second_assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_confirmed    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS group_confirmed_at TIMESTAMPTZ;

-- ── Daily task responses ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_task_responses (
  id         BIGSERIAL PRIMARY KEY,
  agent_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_key   TEXT NOT NULL,
  task_type  TEXT NOT NULL CHECK (task_type IN ('routine', 'incentive')),
  response   TEXT CHECK (response IN ('yes', 'no', 'irrelevant')),
  log_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, task_key, log_date)
);

ALTER TABLE public.daily_task_responses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_task_responses' AND policyname='daily_task_responses_all') THEN
    CREATE POLICY "daily_task_responses_all" ON public.daily_task_responses FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Seed routine task definitions into global_settings ───────────────────────
INSERT INTO public.global_settings (key, value) VALUES
('routine_tasks', '[
  {"key":"rt_1","title":"The Welcome Process","description":"Send the personalized \"Welcome\" SMS/Email/call to every new order within 2 hours of purchase. Confirm the address with them."},
  {"key":"rt_2","title":"The Tracking Update","description":"Ship the IMP KIT to Patient via emailing the UPS store. Input tracking numbers for every outbound kit and veneer box into the CRM (change order stage)."},
  {"key":"rt_3","title":"The KIT Confirmation","description":"Notify the Patient via SMS/calls the second the lab confirms their physical kit has arrived at the facility."},
  {"key":"rt_4","title":"The Refund Saver","description":"Handle \"I want a refund\" emails/texts/calls by offering a \"Senior Technician Zoom\" to solve their kit/IMP session issues instead of losing the Patient."},
  {"key":"rt_5","title":"The Lab Update","description":"Update the Lab Inbounds Kit everyday tracking number and the estimated day + inform the lab daily via email."},
  {"key":"rt_6","title":"The Daily Recap","description":"Submit the \"3-Line Report\" (Bookings, Zooms, Rescues) before logging off: 1. Bookings Secured, 2. Zooms Completed, 3. The Rescue List."},
  {"key":"rt_7","title":"The Inbox Zero","description":"Ensure all \"Where is my order?\" emails are answered by end of shift. Ensure texts/calendars are ready for next day work."},
  {"key":"rt_8","title":"The Friday Audit","description":"(Fridays only) Audit every customer in the CRM with no Next Action in the last 4 days. Call every customer who had a Lab Rejection this week. Identify and tag the Top 10 must-follow-up customers for Monday morning.","days":["Friday"]},
  {"key":"rt_9","title":"The Case Study","description":"Study the patient case before contacting the patient."}
]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ── Seed incentive task definitions into global_settings ─────────────────────
INSERT INTO public.global_settings (key, value) VALUES
('incentive_tasks', '[
  {"key":"inc_1","title":"The Full Calendar Strategy","description":"Call any Patient who just received their kit and do not hang up until a Zoom appointment is locked into the calendar."},
  {"key":"inc_2","title":"The No-Show Recovery","description":"Immediately call/text any Patient who missed their Zoom appointment to reschedule them for the same day."},
  {"key":"inc_3","title":"The Photo Audit","description":"Get Dentist approval while conducting the Zoom with the patient to see if we will remake the impression or proceed."},
  {"key":"inc_4","title":"The Production Update","description":"Send a \"Your veneers are currently being hand-crafted with our specialized dentist\" update every 4 days while the lab is working."},
  {"key":"inc_5","title":"The Shipping Verification","description":"Manually verify that every kit Return Label has been scanned by the carrier within 48 hours of the Zoom call, and update every 3 days while the lab is working."},
  {"key":"inc_6","title":"The Review Extractor","description":"Secure a Google review from a customer the moment they confirm their veneers fit perfectly or after a successful call/text with them."},
  {"key":"inc_7","title":"The CRM Cleanup","description":"Ensure every customer has a Next Step date assigned so no one sits in the same stage for more than 5 days."},
  {"key":"inc_8","title":"The Referral Pitch","description":"Offer the \"Friends & Family\" $100 off to every customer during the final follow-up call, and a free remake for the patient themself."}
]'::jsonb)
ON CONFLICT (key) DO NOTHING;
