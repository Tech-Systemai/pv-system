-- FIM: Fault Identification Manual
-- Tables: fim_sops, fim_fault_codes

CREATE TABLE IF NOT EXISTS public.fim_sops (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'Impression',
  when_to_use TEXT,
  body        TEXT NOT NULL DEFAULT '',
  created_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fim_fault_codes (
  id                   BIGSERIAL PRIMARY KEY,
  code                 INTEGER NOT NULL UNIQUE,
  category             TEXT NOT NULL,
  condition_text       TEXT NOT NULL,
  agent_action         TEXT NOT NULL,
  agent_steps          JSONB NOT NULL DEFAULT '[]',
  escalation_type      TEXT NOT NULL DEFAULT 'none',
  escalation_condition TEXT,
  linked_sop_id        BIGINT REFERENCES public.fim_sops(id) ON DELETE SET NULL,
  created_by           UUID REFERENCES public.profiles(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.fim_sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fim_fault_codes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fim_sops' AND policyname='fim_sops_read') THEN
    CREATE POLICY "fim_sops_read" ON public.fim_sops FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fim_sops' AND policyname='fim_sops_write') THEN
    CREATE POLICY "fim_sops_write" ON public.fim_sops FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fim_fault_codes' AND policyname='fim_fault_codes_read') THEN
    CREATE POLICY "fim_fault_codes_read" ON public.fim_fault_codes FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fim_fault_codes' AND policyname='fim_fault_codes_write') THEN
    CREATE POLICY "fim_fault_codes_write" ON public.fim_fault_codes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── Seed SOPs ───────────────────────────────────────────────────────────────

INSERT INTO public.fim_sops (name, category, when_to_use, body) VALUES

('Fridge Trick', 'Impression',
 'Putty hardened too fast (Code 101) or impression rushed.',
 'WHEN: Putty hardened too fast (Code 101) or impression rushed.

STEPS:
1. Place unmixed putty cartridge in fridge for 5 min before mixing.
2. Once cool, knead for MAX 8 seconds — start the timer the moment putty leaves the cartridge.
3. Load into tray and insert into CX mouth within 12 seconds of mix start.
4. If CX is slow to settle, mix HALF the putty first to buy time, then top up.

WHY: Cold putty extends working time by ~30%, prevents the "rock" before tray reaches gumline.'),

('Impression Coaching', 'Impression',
 'Impression is shallow or missing gumline (Code 102).',
 'WHEN: Impression is shallow or missing gumline (Code 102).

STEPS:
1. Book immediate Zoom session with CX — use CX''s next available slot.
2. Walk CX through tray positioning: upper lip pulled back, tray seated fully.
3. Confirm gumline is captured on all 6 front teeth.
4. Have CX send photo confirmation before ending session.

WHY: Shallow impressions produce ill-fitting veneers. Coaching removes re-kit cost.'),

('Master Tech Zoom', 'Impression',
 '3rd consecutive lab rejection for same CX (Code 103).',
 'WHEN: 3rd consecutive lab rejection for same CX (Code 103).

STEPS:
1. Schedule a 3-way Zoom: Agent + Senior Tech + CX.
2. Senior Tech leads impression walkthrough using the reference video.
3. Document outcome and upload session notes to CX profile.
4. If 4th failure occurs, escalate to Manager immediately.

WHY: Pattern of rejection suggests a technique issue requiring expert intervention.'),

('Allowed Dental', 'Impression',
 'CX mentions bridges, implants, partials, or crowns (Code 104).',
 'WHEN: CX mentions bridges, implants, partials, or crowns (Code 104).

STEPS:
1. Request 4 angle photos: front smile, left side, right side, upper arch.
2. Compare against Allowed Dental matrix — check for contraindications.
3. If safe to proceed, confirm with CX in writing before shipping kit.
4. If 50/50 on safety, escalate to Manager before confirming.

WHY: Unique dental work can make veneers unsafe or non-functional — must verify.'),

('Rescue Zoom', 'Sentiment',
 'CX threatens refund before impression stage (Code 202).',
 'WHEN: CX threatens refund before impression stage (Code 202).

STEPS:
1. Acknowledge frustration: "I completely understand, let''s make this right."
2. Offer a free Zoom session to address every concern before any return.
3. Frame Zoom as "exclusive concierge service" not standard support.
4. If CX refuses Zoom and threatens Going Viral, escalate to Manager.

WHY: Most refund demands before impression are fear-based — Zoom converts ~70% back.'),

('Adjustment', 'Sentiment',
 'CX unhappy with veneer fit post-delivery (Code 203).',
 'WHEN: CX unhappy with veneer fit post-delivery (Code 203).

STEPS:
1. Request fit photos: front smile, left side, right side (all with veneers in).
2. Assess: gap vs. bulk vs. length issue — use assessment guide.
3. Send findings to lab with remake request if approved.
4. If CX demands full refund or threatens chargeback, escalate to Manager.

WHY: Fit issues are usually solvable with targeted remakes — refunds are last resort.'),

('Chargeback Handling', 'Financial',
 'Stripe notifies chargeback (Code 204).',
 'WHEN: Stripe notifies chargeback (Code 204).

STEPS:
1. Flag case in CRM immediately — move to "Dispute" pipeline stage.
2. Notify Manager within 15 minutes — they handle all Stripe/legal response.
3. Do NOT contact CX directly about the dispute.
4. Compile all shipping + communication evidence and send to Manager.

WHY: Chargeback window is tight — Manager needs to respond within 24–72h.'),

('Outage Comms', 'Operations',
 'Slack, Stripe, or core tool down for >5 min (Code 302).',
 'WHEN: Slack, Stripe, or core tool down for >5 min (Code 302).

STEPS:
1. Post "OUTAGE ALERT" in the #announcements channel immediately.
2. Switch to backup communication method (SMS or WhatsApp group).
3. Notify Manager — they will coordinate with IT/vendor.
4. Log outage start time and affected systems in the incident log.

WHY: Team coordination breaks down fast without immediate comms — speed matters.'),

('Lead Time', 'Operations',
 'Inventory alert — putty/kits running low (Code 303).',
 'WHEN: Inventory alert — putty/kits running low (Code 303).

STEPS:
1. Check current stock levels against the Lead Time chart.
2. If stock < 5 days'' supply, flag for Manager escalation immediately.
3. Add item to Friday weekly report regardless of escalation status.
4. Do not place orders without Manager approval.

WHY: Running out mid-week causes kit delays — early flag prevents crisis.');


-- ─── Seed Fault Codes ────────────────────────────────────────────────────────

INSERT INTO public.fim_fault_codes
  (code, category, condition_text, agent_action, agent_steps, escalation_type, escalation_condition, linked_sop_id)
VALUES

(101, 'Impression / Technical',
 'Putty hardened too fast / over-mixed.',
 'Ship new putty + provide "Fridge Trick" SOP.',
 '["Ship replacement putty within 24h", "Send Fridge Trick SOP link via SMS", "Log fault in CX timeline"]',
 'none', NULL,
 (SELECT id FROM public.fim_sops WHERE name = 'Fridge Trick')),

(102, 'Impression / Technical',
 'Impression is shallow (no gumline).',
 'Re-book immediate Zoom coaching session.',
 '["Book Zoom session with CX at next available slot", "Walk CX through tray positioning on Zoom", "Confirm gumline captured on all 6 front teeth", "Have CX send photo confirmation"]',
 'none', NULL,
 (SELECT id FROM public.fim_sops WHERE name = 'Impression Coaching')),

(103, 'Impression / Technical',
 '3rd consecutive Lab Rejection for the same CX.',
 'Offer "Master Tech" Zoom (Agent + Senior).',
 '["Schedule 3-way Zoom: Agent + Senior Tech + CX", "Senior Tech leads impression walkthrough", "Document outcome and upload session notes to CX profile", "If 4th fail occurs escalate to Manager immediately"]',
 'conditional', 'If a 4th fail occurs.',
 (SELECT id FROM public.fim_sops WHERE name = 'Master Tech Zoom')),

(104, 'Impression / Technical',
 'CX has unique dental work (Bridge / Implant).',
 'Request photos + check "Allowed Dental" SOP.',
 '["Request 4 angle photos", "Compare against Allowed Dental matrix", "Confirm with CX in writing"]',
 'conditional', 'If agent is 50/50 on safety.',
 (SELECT id FROM public.fim_sops WHERE name = 'Allowed Dental')),

(201, 'Customer Sentiment / Financials',
 'CX is "frustrated" due to shipping delay.',
 'Offer free adhesive or 10% off next order.',
 '["Acknowledge delay with empathy", "Offer free adhesive OR 10% off next order", "Log resolution in CX timeline"]',
 'none', NULL, NULL),

(202, 'Customer Sentiment / Financials',
 'CX demands a refund (Pre-Impression).',
 'Pivot to "Rescue Zoom" to solve their fear.',
 '["Acknowledge frustration and offer Rescue Zoom", "Frame Zoom as exclusive concierge service", "Book Zoom at CX''s earliest availability"]',
 'conditional', 'If CX refuses Zoom + "Going Viral" threat.',
 (SELECT id FROM public.fim_sops WHERE name = 'Rescue Zoom')),

(203, 'Customer Sentiment / Financials',
 'CX demands refund (Post-Veneer Fit).',
 'Request fit photos + apply "Adjustment" SOP.',
 '["Request fit photos: front, left, right (veneers in)", "Assess: gap vs. bulk vs. length issue", "Submit remake request to lab if approved"]',
 'conditional', 'To authorize a full remake/refund.',
 (SELECT id FROM public.fim_sops WHERE name = 'Adjustment')),

(204, 'Customer Sentiment / Financials',
 'Chargeback / Dispute filed.',
 'Flag in CRM + Move to "Dispute" stage.',
 '["Flag case in CRM — move to Dispute pipeline stage", "Notify Manager within 15 minutes", "Do NOT contact CX directly about the dispute", "Compile all shipping + communication evidence"]',
 'immediate', NULL,
 (SELECT id FROM public.fim_sops WHERE name = 'Chargeback Handling')),

(301, 'Operational / Internal',
 'CRM/Zoom portal is "glitchy."',
 'Clear cache / try secondary browser.',
 '["Clear browser cache and cookies", "Try a secondary browser (Chrome → Firefox or Edge)", "Log the issue with timestamp if it persists"]',
 'none', NULL, NULL),

(302, 'Operational / Internal',
 'System-wide outage (e.g., Slack/Stripe down).',
 'Post "Outage Alert" to team.',
 '["Post OUTAGE ALERT in #announcements channel", "Switch to backup communication (SMS/WhatsApp)", "Log outage start time and affected systems"]',
 'immediate', NULL,
 (SELECT id FROM public.fim_sops WHERE name = 'Outage Comms')),

(303, 'Operational / Internal',
 'Inventory Alert (Low putty/kits).',
 'Check "Lead Time" + Flag for Friday report.',
 '["Check current stock against Lead Time chart", "Add item to Friday weekly report", "Do not place orders without Manager approval"]',
 'conditional', 'If stock < 5 days.',
 (SELECT id FROM public.fim_sops WHERE name = 'Lead Time'));
