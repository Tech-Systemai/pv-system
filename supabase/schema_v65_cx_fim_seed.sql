-- v65: Seed CX FIM - new SOPs and fault codes from the Pioneers Veneers Operations Manual.
-- F-06/07/08/09 map to existing codes 101/102/103/104 - not duplicated.
-- Safe to re-run: each SOP checks WHERE NOT EXISTS; fault codes use ON CONFLICT DO NOTHING.


-- ─── Seed SOPs ───────────────────────────────────────────────────────────────

INSERT INTO public.fim_sops (name, category, when_to_use, body)
SELECT 'New Customer Onboarding', 'General',
  'First contact with a brand-new customer who just placed their first order.',
  $$WHEN: Customer has placed their first order - no prior history in the system.

STEPS:
1. Greet warmly - use first name, introduce yourself and Pioneers Veneers.
2. Confirm order details (product, address, payment plan) in the system.
3. Walk them through the full journey: kit delivery > impression > production > delivery.
4. Set expectations on timelines - be specific (e.g., kit arrives in 3-5 days).
5. Answer any initial questions about the process, putty, or the fit guarantee.
6. Log first contact in CRM with date and key notes.
7. Send the Post-Call Text Recap immediately after the call.

WHY: A confident, informed new customer is far less likely to dispute, cancel, or ghost - the first impression sets the tone for the entire relationship.$$
WHERE NOT EXISTS (SELECT 1 FROM public.fim_sops WHERE name = 'New Customer Onboarding');

INSERT INTO public.fim_sops (name, category, when_to_use, body)
SELECT 'Existing Case Review', 'General',
  'Before calling any returning or existing customer with prior history.',
  $$WHEN: Any customer with prior history in the system - before making contact.

STEPS:
1. Open CX profile - review all prior notes, lab submissions, and payment history.
2. Note current pipeline stage and the last action taken.
3. Identify the core unresolved issue: impression, fit, payment, or satisfaction.
4. Prepare 2-3 talking points tailored to their specific history.
5. Check if they have open remakes, disputes, or outstanding balance.
6. Set a clear call objective before dialing.

WHY: Walking in informed prevents repeating what was already tried and builds customer trust - customers feel heard when you know their history without asking.$$
WHERE NOT EXISTS (SELECT 1 FROM public.fim_sops WHERE name = 'Existing Case Review');

INSERT INTO public.fim_sops (name, category, when_to_use, body)
SELECT 'Disconnected or Missed Call', 'General',
  'A call was disconnected mid-conversation or the customer did not answer.',
  $$WHEN: Call dropped unexpectedly or went unanswered.

STEPS:
1. Within 2 minutes of the disconnect, send: Hi [Name], this is [Agent] from Pioneers Veneers - looks like we got disconnected. I'll try you again shortly!
2. Wait 10 minutes, then attempt a second call.
3. If no answer on the second attempt: leave a brief voicemail and log both attempts in CRM.
4. Schedule a follow-up attempt for the next business day.
5. If the customer was mid-issue discussion, flag the case as HIGH priority.

WHY: A quick, warm follow-up after a disconnect signals professionalism and prevents frustration from escalating into a dispute.$$
WHERE NOT EXISTS (SELECT 1 FROM public.fim_sops WHERE name = 'Disconnected or Missed Call');

INSERT INTO public.fim_sops (name, category, when_to_use, body)
SELECT 'Stopped Paying Follow-Up', 'General',
  'Customer''s payment plan is active but payments have stopped or failed.',
  $$WHEN: Customer has missed 1 or more payments with no response.

STEPS:
1. Confirm the plan is still active in Stripe before calling.
2. Open with empathy: Hey [Name], just checking in - noticed your plan renewal was pending and wanted to make sure everything is okay on your end.
3. Avoid accusatory language - frame the call as a check-in, not collections.
4. Offer flexibility: a rescheduled date or a direct payment link.
5. If no answer: send an SMS with a payment link and a friendly nudge.
6. If 3+ failed attempts with no response: escalate to Manager.

WHY: Payment issues are often temporary - tone matters more than the ask. An aggressive collection approach reliably causes disputes.$$
WHERE NOT EXISTS (SELECT 1 FROM public.fim_sops WHERE name = 'Stopped Paying Follow-Up');

INSERT INTO public.fim_sops (name, category, when_to_use, body)
SELECT 'Unclosed Sale Recovery', 'General',
  'Prospective customer expressed interest but never completed the purchase.',
  $$WHEN: CRM shows Interested CX or Unclosed Sale status with no payment recorded.

STEPS:
1. Review conversation history - understand what stopped them from buying.
2. Open with low pressure: Hey [Name], just following up - I know you were looking into getting started with us.
3. Address their hesitation directly (price, trust, dental concern, or timing).
4. Offer a limited-time incentive if appropriate (free adhesive, priority slot).
5. If no answer: send SMS with a short value reminder and a direct payment link.
6. Log outcome and set a next follow-up date.

WHY: Most unclosed sales are stalled by doubt, not disinterest - one well-timed, empathetic follow-up converts more than three aggressive ones.$$
WHERE NOT EXISTS (SELECT 1 FROM public.fim_sops WHERE name = 'Unclosed Sale Recovery');

INSERT INTO public.fim_sops (name, category, when_to_use, body)
SELECT 'Post-Call Text Recap', 'General',
  'After every customer call or Zoom session.',
  $$WHEN: Immediately after ending any call, Zoom, or significant SMS exchange.

STEPS:
1. Within 5 minutes of ending the call, send a personalized text recap to the customer covering the key points discussed and the next step.
2. Log the text as an action in CRM.
3. If a next step has a specific date (appointment, shipment), add it to the shared calendar.

WHY: A written recap reinforces trust, reduces disputes, and gives the customer a reference they can revisit.$$
WHERE NOT EXISTS (SELECT 1 FROM public.fim_sops WHERE name = 'Post-Call Text Recap');

INSERT INTO public.fim_sops (name, category, when_to_use, body)
SELECT 'ZOOM Impression Protocol', 'Impression',
  'Any time a customer needs guided assistance taking their impression kit on camera.',
  $$WHEN: Customer needs to take their impression kit and requires real-time coaching via Zoom.

STEPS:
1. Schedule Zoom at customer's earliest availability (same day if possible).
2. Send calendar invite and Zoom link via both SMS and email.
3. Before the session: review customer's dental notes and any prior rejections.
4. On Zoom: confirm good lighting and camera angle, walk through putty mixing together timing it out loud, guide tray placement with upper lip pulled back and tray fully seated at gumline, count down hold time (90 seconds) together, and have customer show impression on camera before ending session.
5. If impression looks good: confirm next steps (ship to lab).
6. If impression is poor: rebook immediately and document the reason.
7. Send Post-Call Text Recap after the session.

WHY: Live Zoom coaching dramatically reduces re-kit waste and builds customer confidence - success rates are significantly higher than phone-only coaching.$$
WHERE NOT EXISTS (SELECT 1 FROM public.fim_sops WHERE name = 'ZOOM Impression Protocol');

INSERT INTO public.fim_sops (name, category, when_to_use, body)
SELECT 'Veneer Fit and Look Assessment', 'Veneers',
  'Customer complains that veneers do not fit correctly or do not look as expected.',
  $$WHEN: Customer contacts us after receiving veneers with a fit or aesthetic complaint.

STEPS:
1. Acknowledge the concern with empathy: I completely understand, let's figure this out.
2. Request photos: front smile, left side, right side - all with veneers inserted.
3. Once photos are received, compare against the original lab submission notes.
4. Classify the issue: GAP means veneers not flush with gums and likely needs a new impression; BULK means too thick and may be correctable with a lab adjustment; LENGTH means too short or long and may need a new impression; COLOR means wrong shade and requires a color correction request to the lab.
5. Based on the classification, advise the customer and submit the appropriate lab request.
6. If customer demands refund: offer a remake first - escalate to Manager only if refused.

WHY: Most fit/look complaints are addressable with targeted lab adjustments - full refunds are avoidable in the majority of cases.$$
WHERE NOT EXISTS (SELECT 1 FROM public.fim_sops WHERE name = 'Veneer Fit and Look Assessment');

INSERT INTO public.fim_sops (name, category, when_to_use, body)
SELECT 'Refund De-escalation', 'Sentiment',
  'Customer is demanding a refund in an emotionally escalated state.',
  $$WHEN: Customer is angry, demanding a refund, raising their voice, or threatening further action.

STEPS:
1. Do NOT become defensive - let them speak first and fully exhaust their concern.
2. Validate: I hear you, and I completely understand your frustration. You deserve a great result.
3. Before any refund discussion, ask: Can you help me understand exactly what the issue is?
4. Offer a concrete next step - something tangible (remake, Zoom session, dental adhesive).
5. If they push back: I want to make sure we fix this the right way for you before we go down any other path.
6. If they still insist on a refund: inform Manager before making any commitment.
7. Log emotion level, exact words used, and outcome in CRM.

WHY: Escalated customers need to feel heard before they can hear solutions - leading with empathy converts the majority of refund demands into remake requests.$$
WHERE NOT EXISTS (SELECT 1 FROM public.fim_sops WHERE name = 'Refund De-escalation');

INSERT INTO public.fim_sops (name, category, when_to_use, body)
SELECT 'Fraud Concern Response', 'Sentiment',
  'Customer accuses the company of being fraudulent or a scam.',
  $$WHEN: Customer says this is a scam or you are fraudsters or makes a similar accusation.

STEPS:
1. Stay completely calm - never argue or become defensive.
2. Respond: I completely understand why that concern would come up, and I really want to address it for you.
3. Walk them through company legitimacy: real lab, verified reviews, before/after testimonials, Google rating.
4. Offer to share a review link or a customer story immediately during the call.
5. If they are willing to continue: book a Zoom to demonstrate face-to-face professionalism.
6. If they have already filed a chargeback: escalate to Manager immediately - do not engage further without approval.
7. Log every accusation verbatim in CRM.

WHY: Fraud accusations usually stem from delivery delays or unmet expectations - a calm, factual response with social proof resolves most of these without escalation.$$
WHERE NOT EXISTS (SELECT 1 FROM public.fim_sops WHERE name = 'Fraud Concern Response');

INSERT INTO public.fim_sops (name, category, when_to_use, body)
SELECT 'DNR Investigation', 'Delivery',
  'Customer reports package not received but tracking shows delivered.',
  $$WHEN: Customer says they never received their package but the carrier tracking shows Delivered.

STEPS:
1. Pull the tracking number and screenshot the delivery confirmation.
2. Ask customer to check: front door, mailbox, back porch, neighbor's porch, apartment office or mail room.
3. Verify the delivery address in the system matches what the customer provided.
4. If address was correct and customer confirms a thorough search: file a carrier investigation via the carrier's official website (USPS, FedEx, or UPS) and record the investigation case number in CRM.
5. Notify Manager - they approve whether to reship.
6. Do NOT promise a reship or refund without Manager approval.

WHY: Most DNR cases resolve with a thorough porch check or a package held at the facility - filing an investigation first prevents unnecessary reship costs.$$
WHERE NOT EXISTS (SELECT 1 FROM public.fim_sops WHERE name = 'DNR Investigation');

INSERT INTO public.fim_sops (name, category, when_to_use, body)
SELECT 'Marking a Case Unreachable', 'Operations',
  'Customer has not responded after 3 or more attempts across multiple days.',
  $$WHEN: Customer has not answered calls, returned texts, or responded to voicemails across at least 3 separate contact attempts on different days.

STEPS:
1. Confirm all attempts are logged: dates, methods (call, voicemail, SMS), and any responses.
2. Minimum requirement before marking: 3 attempts on at least 3 different days.
3. Send a final SMS before marking: Hi [Name], we have tried reaching you a few times! We are still here whenever you are ready. Just reply or call us at your convenience.
4. In the portal: click the Unreachable button on the case.
5. Case moves to the Unreachable section - excluded from the daily update counter.
6. Set a re-engagement reminder for 14 days out.

WHY: Marking unreachable keeps the active queue clean and prevents daily follow-up time being spent on dormant cases.$$
WHERE NOT EXISTS (SELECT 1 FROM public.fim_sops WHERE name = 'Marking a Case Unreachable');

INSERT INTO public.fim_sops (name, category, when_to_use, body)
SELECT 'Condition Approval Process', 'Operations',
  'Customer''s dental situation requires review before proceeding with the order.',
  $$WHEN: Customer mentions dental conditions that may affect veneer safety or fit (e.g., severe gum disease, missing most teeth, recent oral surgery, temporary crowns, or full dentures).

STEPS:
1. Gather full dental history: ask about implants, bridges, dentures, crowns, partials, and recent procedures.
2. Request 4-angle dental photos: front smile, left side, right side, upper arch.
3. Submit photos and detailed notes to Manager for Condition Approval review.
4. Do NOT ship an impression kit or proceed with any production until written approval is received.
5. If approved: proceed normally and note the approval date and approver in CRM.
6. If denied: inform the customer and offer either a full refund or a referral to the dentistry program.

WHY: Proceeding without condition approval risks product failure, customer injury, and legal exposure - this step is non-negotiable.$$
WHERE NOT EXISTS (SELECT 1 FROM public.fim_sops WHERE name = 'Condition Approval Process');


-- ─── Seed Fault Codes ────────────────────────────────────────────────────────

INSERT INTO public.fim_fault_codes
  (code, category, condition_text, agent_action, agent_steps, escalation_type, escalation_condition, linked_sop_id)
VALUES
(105, 'Impression / Technical',
 'Customer needs help taking their impression kit.',
 'Schedule a Zoom coaching session (ZOOM Impression Protocol).',
 '["Review any prior impression notes in CRM before calling","Offer to book a Zoom session at the customer''s earliest availability","Walk customer through kit contents and putty basics via phone if Zoom is unavailable","Confirm appointment time via SMS and send calendar invite","Log appointment in CRM"]',
 'none', NULL,
 (SELECT id FROM public.fim_sops WHERE name = 'ZOOM Impression Protocol' LIMIT 1)),
(106, 'Impression / Technical',
 'Customer is not answering at the impression kit stage.',
 'Apply Disconnected/Missed Call SOP - log all attempts and reattempt.',
 '["Send SMS: Hi [Name] from Pioneers Veneers - just tried calling to check in on your impression kit. Give us a ring when you get a chance!","Attempt a second call the next business day","If no response after 3 attempts consider marking Unreachable","Log all attempts with dates and method in CRM"]',
 'none', NULL,
 (SELECT id FROM public.fim_sops WHERE name = 'Disconnected or Missed Call' LIMIT 1)),
(107, 'Impression / Technical',
 'Customer wants to cancel their order after receiving the impression kit.',
 'De-escalate with empathy and offer alternatives before any cancellation.',
 '["Acknowledge their concern and ask what is worrying them","Identify the real concern: fear of process, shipping delay, financial issue, or doubt","Offer a Zoom coaching session to address fear of the impression process","If financial: offer a payment plan adjustment or pause","Do NOT process any cancellation without Manager approval","Log conversation outcome and next step in CRM"]',
 'conditional', 'Customer insists on cancellation - escalate to Manager before processing.',
 (SELECT id FROM public.fim_sops WHERE name = 'Refund De-escalation' LIMIT 1)),
(108, 'Impression / Technical',
 'Customer doubts the quality or legitimacy of the impression kit.',
 'Reassure with product education and offer a live Zoom demo.',
 '["Acknowledge the doubt and offer to explain how the kit works","Walk them through the putty quality, lab certification, and fit guarantee","Offer to share before/after photos or customer testimonials","Book a Zoom to demonstrate the kit process live if needed","Log outcome in CRM"]',
 'none', NULL,
 (SELECT id FROM public.fim_sops WHERE name = 'Fraud Concern Response' LIMIT 1)),
(109, 'Impression / Technical',
 'Customer needs a new impression kit for a remake.',
 'Confirm remake approval and ship a new kit within 24 hours.',
 '["Verify that the remake is approved in the system (check lab notes and CRM)","Confirm the correct shipping address with the customer","Place new kit order and flag as REMAKE in the order notes","Send tracking update SMS once shipped","Log kit dispatch date and order number in CRM","Book a follow-up Zoom session for impression coaching"]',
 'none', NULL,
 (SELECT id FROM public.fim_sops WHERE name = 'ZOOM Impression Protocol' LIMIT 1))
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.fim_fault_codes
  (code, category, condition_text, agent_action, agent_steps, escalation_type, escalation_condition, linked_sop_id)
VALUES
(401, 'Veneers Fit',
 'Veneers do not fit right - general fit complaint.',
 'Request photos and apply Veneer Fit and Look Assessment SOP.',
 '["Acknowledge the concern empathetically","Request 3 photos: front, left side, right side - all with veneers in","Compare photos against original lab submission","Classify the issue: gap vs. bulk vs. length","Submit appropriate lab request based on classification","Confirm with customer within 24h of photo review"]',
 'conditional', 'Customer threatens dispute or refund.',
 (SELECT id FROM public.fim_sops WHERE name = 'Veneer Fit and Look Assessment' LIMIT 1)),
(402, 'Veneers Fit',
 'Veneers are too big - customer cannot fully close their mouth.',
 'Collect photos, classify as bulk/fit issue, submit lab adjustment request.',
 '["Request 3-angle photos and a short video of the customer attempting to close their mouth","Confirm: is it upper veneers extending too far or overall bulk?","If bulk: submit lab adjustment request for reduced thickness","If new impression is required: follow new kit process (code 109)","Provide ETA to customer and log in CRM"]',
 'conditional', 'Customer refuses remake and demands refund - escalate to Manager.',
 (SELECT id FROM public.fim_sops WHERE name = 'Veneer Fit and Look Assessment' LIMIT 1)),
(403, 'Veneers Fit',
 'Veneers are loose or popping out.',
 'Recommend dental adhesive; if structural, assess for remake.',
 '["Confirm looseness: does veneer pop out while eating, speaking, or both?","If mild: recommend dental adhesive as an immediate solution","If structural or repeated: request photos to assess impression quality","If impression was poor: approve remake and follow code 109 process","Ship dental adhesive if customer does not have it","Log resolution and next steps in CRM"]',
 'none', NULL,
 (SELECT id FROM public.fim_sops WHERE name = 'Veneer Fit and Look Assessment' LIMIT 1)),
(404, 'Veneers Fit',
 'Bottom teeth are hitting top veneers - customer cannot close their mouth.',
 'Request photos/video, assess for bulk reduction or new impression.',
 '["Request 3-angle photos plus a video of bite attempt","Assess: are veneers extending past the natural bite plane?","If yes: submit lab adjustment for height reduction","If new impression would resolve: approve new kit (code 109)","Advise customer not to force-bite - could crack veneers","Log findings and lab request reference in CRM"]',
 'conditional', 'Customer is in physical discomfort or demands refund.',
 (SELECT id FROM public.fim_sops WHERE name = 'Veneer Fit and Look Assessment' LIMIT 1))
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.fim_fault_codes
  (code, category, condition_text, agent_action, agent_steps, escalation_type, escalation_condition, linked_sop_id)
VALUES
(501, 'Veneers Look / Color',
 'Wrong color or shade was delivered.',
 'Request photos in natural light and submit color correction request to lab.',
 '["Acknowledge the concern and ask for 3 photos in natural lighting","Compare against the shade ordered in the CRM and lab notes","Confirm shade discrepancy vs. lighting difference","Submit color correction remake request to lab with original shade spec","Provide customer with a timeline for correction","Log lab request number in CRM"]',
 'conditional', 'Customer wants full refund instead of color correction.',
 (SELECT id FROM public.fim_sops WHERE name = 'Veneer Fit and Look Assessment' LIMIT 1)),
(502, 'Veneers Look / Color',
 'Customer is disappointed with the overall appearance of the veneers.',
 'Request photos and apply Veneer Fit and Look Assessment SOP.',
 '["Ask open-ended question: Can you describe what specifically does not look right?","Request 3 photos in natural daylight (front, left, right)","Identify specific issue: too white, wrong shape, gap, or length","Submit targeted lab correction request based on classification","If issue is subjective taste (not a defect): offer a Zoom consultation with Manager","Log all findings and outcome in CRM"]',
 'conditional', 'Customer insists on full refund citing appearance only - escalate to Manager.',
 (SELECT id FROM public.fim_sops WHERE name = 'Veneer Fit and Look Assessment' LIMIT 1)),
(503, 'Veneers Look / Color',
 'Veneers are too bulky or thick.',
 'Request photos and submit lab request for thickness reduction.',
 '["Request 3-angle photos with veneers in place","Confirm: is it visible thickness from the front or bite-related bulk?","Submit lab request specifying reduce thickness and maintain original shade","Follow up with customer once lab confirms feasibility","If new impression is needed: initiate code 109 process","Log lab request and expected turnaround in CRM"]',
 'none', NULL,
 (SELECT id FROM public.fim_sops WHERE name = 'Veneer Fit and Look Assessment' LIMIT 1)),
(504, 'Veneers Look / Color',
 'Follow-up color correction is still unsatisfactory after a prior attempt.',
 'Escalate to Manager for secondary lab review and resolution path.',
 '["Review full case history: what shade was ordered, delivered, and corrected","Request new photos in natural lighting for current state","Do NOT submit another lab request without Manager approval","Present all findings and photos to Manager","Manager decides: third correction attempt, refund credit, or alternative resolution","Communicate Manager decision to customer within 24h","Log all actions in CRM"]',
 'immediate', NULL,
 (SELECT id FROM public.fim_sops WHERE name = 'Refund De-escalation' LIMIT 1))
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.fim_fault_codes
  (code, category, condition_text, agent_action, agent_steps, escalation_type, escalation_condition, linked_sop_id)
VALUES
(601, 'Remakes',
 'Customer is approved for a remake.',
 'Initiate remake process: confirm details and submit lab order.',
 '["Confirm remake approval is documented in CRM by Manager or lab","Confirm with customer: will they send back current veneers? (required for most remakes)","Verify current shipping address for reshipping","Submit remake order to lab with all updated specs (shade, notes)","Provide customer with estimated production timeline","Set a follow-up reminder for midway through production","Log remake order number and specs in CRM"]',
 'none', NULL, NULL),
(602, 'Remakes',
 'Second remake was delivered and the customer is still unhappy.',
 'Escalate to Manager - do not attempt a third remake without approval.',
 '["Acknowledge the customer ongoing frustration with genuine empathy","Request updated photos: front, left, right - in natural light","Do NOT promise another remake or refund without Manager involvement","Compile full case file: all remake notes, lab submissions, photos","Present to Manager for a formal resolution decision","Communicate outcome to the customer within 24h of Manager decision","Log all details in CRM"]',
 'immediate', NULL,
 (SELECT id FROM public.fim_sops WHERE name = 'Refund De-escalation' LIMIT 1)),
(603, 'Remakes',
 'Customer paid for a remake but has not sent impression photos.',
 'Follow up for photos - no production begins without them.',
 '["Send a polite reminder SMS: Hi [Name] we have your remake order ready to go - we just need photos of your current veneers to get started. Can you send front, left, and right side shots?","Wait 48h and send a second reminder if no response","If no response after 3 attempts: consider marking Unreachable","Do NOT contact the lab or start production without receiving photos","Log all follow-up attempts in CRM"]',
 'none', NULL, NULL),
(604, 'Remakes',
 'Customer''s veneer is cracked or broken.',
 'Confirm warranty coverage and initiate replacement process.',
 '["Ask customer how the crack occurred: normal wear, accidental drop, or biting hard food","Request a photo of the cracked veneer","Check warranty status in customer CRM file","If under warranty or remake coverage: approve replacement and initiate code 601 process","If outside warranty: offer a paid remake at a discounted rate","Advise customer to stop wearing the cracked veneer to avoid mouth injury","Log crack cause, photo, and resolution in CRM"]',
 'conditional', 'Customer disputes warranty terms or demands a free replacement outside coverage.',
 (SELECT id FROM public.fim_sops WHERE name = 'Veneer Fit and Look Assessment' LIMIT 1))
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.fim_fault_codes
  (code, category, condition_text, agent_action, agent_steps, escalation_type, escalation_condition, linked_sop_id)
VALUES
(701, 'Refunds / Disputes',
 'Customer is requesting a refund.',
 'Apply Refund De-escalation SOP - identify stage and escalate if needed.',
 '["Identify the stage: pre-impression, post-kit delivery, or post-veneer delivery","Apply Refund De-escalation SOP","Offer a concrete alternative: remake, Zoom session, free adhesive","If customer is post-delivery: request photos before any refund decision","Do NOT issue or promise any refund without Manager approval","Log full conversation and outcome in CRM"]',
 'conditional', 'Any refund commitment requires Manager approval before confirming.',
 (SELECT id FROM public.fim_sops WHERE name = 'Refund De-escalation' LIMIT 1)),
(702, 'Refunds / Disputes',
 'Chargeback resolved in company favor - customer is still interested.',
 'Re-engage professionally; rebuild trust and continue the order.',
 '["Review the chargeback outcome and all prior communication in CRM","Reach out with a friendly opener - do not mention the dispute","Focus on their original goal: getting veneers they love","Offer to pick up exactly where they left off","If payment plan adjustment is needed: involve Manager","Log re-engagement date and customer response in CRM"]',
 'none', NULL, NULL),
(703, 'Refunds / Disputes',
 'Chargeback is filed and still unresolved.',
 'Flag immediately and hand off to Manager - do not contact customer directly.',
 '["Flag case in CRM as DISPUTE","Notify Manager within 15 minutes of becoming aware","Compile all evidence: tracking confirmation, communication history, payment receipts","Send evidence packet to Manager - they handle the Stripe/bank response","Do NOT contact the customer directly about the dispute until Manager clears it","Log flag time, Manager notified, and evidence submitted in CRM"]',
 'immediate', NULL,
 (SELECT id FROM public.fim_sops WHERE name = 'Chargeback Handling' LIMIT 1))
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.fim_fault_codes
  (code, category, condition_text, agent_action, agent_steps, escalation_type, escalation_condition, linked_sop_id)
VALUES
(801, 'Delivery',
 'Customer says item was not delivered but tracking shows delivered.',
 'Apply DNR Investigation SOP - investigate before any reship decision.',
 '["Pull tracking and screenshot the Delivered confirmation","Ask customer to check all delivery points (mailbox, porch, neighbor, building office)","Verify the delivery address on file matches the customer address","If confirmed: file a carrier investigation (USPS/FedEx/UPS)","Report investigation case number to Manager","Await Manager approval before reshipping","Log all steps and carrier case number in CRM"]',
 'conditional', 'Reship requires Manager approval.',
 (SELECT id FROM public.fim_sops WHERE name = 'DNR Investigation' LIMIT 1)),
(802, 'Delivery',
 'Package was stolen after confirmed delivery.',
 'Document the theft claim, file carrier investigation, escalate for reship decision.',
 '["Sympathize and let the customer know you will investigate this for them","Confirm tracking shows Delivered and customer received a delivery notification","Advise customer to file a local police report if package had significant value","File a carrier theft/loss investigation on the carrier portal","Report to Manager with tracking evidence and police report reference if available","Await Manager decision on reship or partial resolution","Log all actions and case references in CRM"]',
 'conditional', 'Reship approval requires Manager sign-off.',
 (SELECT id FROM public.fim_sops WHERE name = 'DNR Investigation' LIMIT 1)),
(803, 'Delivery',
 'Wrong item or wrong address - delivery error.',
 'Identify who made the error and resolve accordingly.',
 '["Confirm: did the address error originate from the customer or the company system?","If company error: expedite a replacement and escalate to Manager","If customer error: explain the situation and offer a discounted reship","If item was wrong: confirm the correct product and process replacement order","Log error source, corrective action, and responsible party in CRM","Flag for Manager review to prevent future occurrences"]',
 'conditional', 'Company-caused address or item errors require Manager approval for resolution.',
 NULL),
(804, 'Delivery',
 'Customer received an impression kit instead of the veneers they were expecting.',
 'Investigate fulfillment error and expedite the correct shipment.',
 '["Pull the order record - confirm what was shipped vs. what was ordered","Confirm whether the impression photos were received and approved for production","If veneers were not yet produced: explain the process timeline to the customer","If this was a fulfillment error (veneers were ready): flag immediately to Manager","Expedite the correct shipment with Manager approval","Apologize and provide a shipment tracking number promptly","Log error type and resolution in CRM"]',
 'immediate', NULL, NULL),
(805, 'Delivery',
 'Customer believes the company is a fraud or scam after a delivery issue.',
 'Apply Fraud Concern Response SOP - stay calm and present proof.',
 '["Do not react defensively - acknowledge the concern fully","Apply Fraud Concern Response SOP","Share company legitimacy: verified reviews, real lab, money-back framing","Offer a Zoom to speak face-to-face and address every concern","If chargeback is already filed: escalate to Manager immediately","Log every statement and outcome verbatim in CRM"]',
 'conditional', 'If a chargeback has been filed - escalate to Manager immediately.',
 (SELECT id FROM public.fim_sops WHERE name = 'Fraud Concern Response' LIMIT 1))
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.fim_fault_codes
  (code, category, condition_text, agent_action, agent_steps, escalation_type, escalation_condition, linked_sop_id)
VALUES
(901, 'Follow-Ups',
 'Standard follow-up required on an active case.',
 'Review case history and make contact per established protocol.',
 '["Review CX case history using Existing Case Review SOP before calling","Call with a purpose-driven opener tied to their specific status","Confirm their current situation: satisfied, still waiting, or has a concern","Address any outstanding issue or confirm next milestone","Send Post-Call Text Recap after the call","Log outcome and next follow-up date in CRM"]',
 'none', NULL,
 (SELECT id FROM public.fim_sops WHERE name = 'Existing Case Review' LIMIT 1)),
(902, 'Follow-Ups',
 'No follow-up was done on an active case.',
 'Initiate immediate outreach - treat as high priority.',
 '["Review when the last contact was made and what the last open action was","Call immediately - prioritize this case in today queue","Acknowledge to the customer that you are checking in without highlighting the gap","Resolve any outstanding concern or set next steps","Log reason for delayed follow-up internally and take corrective action","Flag in CRM if there is a pattern of missed follow-ups on this case"]',
 'none', NULL, NULL),
(903, 'Follow-Ups',
 'Multiple outreach attempts made - customer is still not answering.',
 'Apply Marking a Case Unreachable SOP after minimum attempts threshold is met.',
 '["Confirm at least 3 logged outreach attempts on different days","Send one final warm SMS before marking","Apply Marking a Case Unreachable SOP - click Unreachable in the portal","Case moves to Unreachable queue and is removed from daily update counter","Set a 14-day re-engagement reminder","Log exact number of attempts, dates, and methods in CRM"]',
 'none', NULL,
 (SELECT id FROM public.fim_sops WHERE name = 'Marking a Case Unreachable' LIMIT 1)),
(904, 'Follow-Ups',
 'Customer has stopped paying but their plan is still active.',
 'Apply Stopped Paying Follow-Up SOP - focus on re-engaging, not threatening.',
 '["Check Stripe for exact payment failure date and amount","Apply Stopped Paying Follow-Up SOP","Offer flexibility: payment link, rescheduled date, or partial payment","If production is in progress: inform Manager whether to pause","Log payment status and customer stated reason in CRM","If 3 or more failed attempts: escalate to Manager"]',
 'conditional', '3 or more contact attempts fail - escalate to Manager.',
 (SELECT id FROM public.fim_sops WHERE name = 'Stopped Paying Follow-Up' LIMIT 1)),
(905, 'Follow-Ups',
 'Order was placed for a family member - main contact is not the patient.',
 'Confirm the patient details and adjust the CRM record accordingly.',
 '["Confirm who the ordering contact is vs. who the veneers are for","Update CRM with patient name, relationship, and relevant dental notes","Clarify communication preference: contact the buyer or the patient directly?","Ensure impression kit is addressed to the patient location","Note any dental condition specifics for the actual patient","Log all updates in CRM"]',
 'none', NULL, NULL)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.fim_fault_codes
  (code, category, condition_text, agent_action, agent_steps, escalation_type, escalation_condition, linked_sop_id)
VALUES
(1001, 'Dentistry Special',
 'Customer is a candidate for the dentures program (no remaining natural teeth).',
 'Qualify and refer to the Dentures Program - notify Manager.',
 '["Confirm the customer has no top or bottom teeth remaining (full edentulous)","Explain the Dentures Program briefly: a tailored solution for customers without natural teeth","Do NOT proceed with a standard veneers kit order for this customer","Notify Manager - they handle all Dentures Program enrollment","Log the referral in CRM with notes on the customer dental situation","Advise customer that a Manager will reach out within 1 business day"]',
 'immediate', NULL, NULL),
(1002, 'Dentistry Special',
 'Customer has no top teeth and needs dental adhesive guidance.',
 'Ship dental adhesive and provide usage instructions.',
 '["Confirm customer has no top teeth (fully edentulous top arch)","Advise that dental adhesive is needed to secure the veneer without natural tooth support","Ship complimentary dental adhesive if not already sent","Walk customer through adhesive application process","If customer expresses interest in the Dentures Program: apply code 1001 process","Log adhesive shipment and customer dental status in CRM"]',
 'none', NULL, NULL)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.fim_fault_codes
  (code, category, condition_text, agent_action, agent_steps, escalation_type, escalation_condition, linked_sop_id)
VALUES
(1101, 'New / Returning',
 'Significant communication delay occurred on the company side.',
 'Acknowledge the delay, apologize, and re-engage with urgency.',
 '["Review the communication gap: when was the last contact and why was there a delay?","Open the call with a direct apology: I want to apologize for the delay - that is not the experience you should have","Offer a gesture of goodwill if appropriate (free adhesive, priority handling)","Address their current status and concern immediately","Log reason for delay and corrective action in CRM","Flag internally if the delay was a systemic or team issue"]',
 'conditional', 'Customer has become hostile or filed a dispute due to the delay.',
 (SELECT id FROM public.fim_sops WHERE name = 'Disconnected or Missed Call' LIMIT 1)),
(1102, 'New / Returning',
 'New customer placing their very first order.',
 'Apply New Customer Onboarding SOP - set a strong first impression.',
 '["Apply New Customer Onboarding SOP for full onboarding steps","Confirm order details, shipping address, and payment plan","Set expectations: kit timeline, impression process, production timeline","Answer all initial questions confidently and warmly","Send Post-Call Text Recap after the call","Log first contact date and conversation notes in CRM"]',
 'none', NULL,
 (SELECT id FROM public.fim_sops WHERE name = 'New Customer Onboarding' LIMIT 1)),
(1103, 'New / Returning',
 'Returning customer placing a new order.',
 'Welcome them back, review history, and confirm new order details.',
 '["Pull up their prior case history using Existing Case Review SOP","Welcome them back warmly","Confirm: same shade as before or something different?","Verify shipping address and payment method","Confirm if prior impressions can be reused or if a new kit is needed","Log new order details and any preference changes in CRM"]',
 'none', NULL,
 (SELECT id FROM public.fim_sops WHERE name = 'Existing Case Review' LIMIT 1)),
(1104, 'New / Returning',
 'Returning customer and their impressions are already on file.',
 'Confirm impression reuse eligibility and proceed to production.',
 '["Locate the customer prior impressions in the lab records","Confirm with lab: are the impressions still viable? (generally valid for 6 months)","Confirm with customer: same specs or any changes to shade or size?","If impressions are viable: submit production order referencing existing impression ID","If impressions are expired: follow code 109 process for a new kit","Log production order reference and impression status in CRM"]',
 'none', NULL,
 (SELECT id FROM public.fim_sops WHERE name = 'Existing Case Review' LIMIT 1)),
(1105, 'New / Returning',
 'Unclosed sale - customer was interested but did not complete the purchase.',
 'Apply Unclosed Sale Recovery SOP to re-engage and close.',
 '["Apply Unclosed Sale Recovery SOP for full protocol","Review what the customer originally expressed interest in","Identify the sticking point: price, trust, dental concern, or timing","Address the sticking point directly and offer a relevant incentive if appropriate","Close with a clear next step: payment link, booking, or follow-up date","Log conversation outcome and next action in CRM"]',
 'none', NULL,
 (SELECT id FROM public.fim_sops WHERE name = 'Unclosed Sale Recovery' LIMIT 1))
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.fim_fault_codes
  (code, category, condition_text, agent_action, agent_steps, escalation_type, escalation_condition, linked_sop_id)
VALUES
(1201, 'Happy Customers',
 'Customer is happy with their veneers and has no issues.',
 'Celebrate their experience and request a review and referral.',
 '["Congratulate the customer on their new smile","Ask if they would be open to leaving us a review","Send a Google Review or Trustpilot link via SMS","Ask if they know anyone who might also be interested in Pioneers Veneers","Log happiness status, review request sent, and any referral leads in CRM"]',
 'none', NULL, NULL),
(1202, 'Happy Customers',
 'Customer is happy but veneers are slightly loose.',
 'Send dental adhesive and confirm satisfaction after a trial period.',
 '["Acknowledge the slight looseness: that is a normal adjustment for some customers","Ship dental adhesive immediately if they do not already have it","Walk customer through correct adhesive application","Schedule a 2-week follow-up to confirm fit improvement","If looseness persists after adhesive trial: assess for a remake (code 403)","Log adhesive shipment and follow-up date in CRM"]',
 'none', NULL,
 (SELECT id FROM public.fim_sops WHERE name = 'Veneer Fit and Look Assessment' LIMIT 1)),
(1203, 'Happy Customers',
 'Order is completed - customer has stopped making payments on the plan.',
 'Apply Stopped Paying Follow-Up SOP to recover remaining balance.',
 '["Check Stripe: confirm remaining balance and payment plan status","Apply Stopped Paying Follow-Up SOP","Remind customer warmly: your veneers are fully delivered - we just want to wrap up the remaining balance together","Offer a final payment option: one lump sum or a rescheduled plan","If no response after 3 attempts: escalate to Manager for collections consideration","Log balance amount, payment status, and all contact attempts in CRM"]',
 'conditional', '3 or more contact attempts fail - escalate to Manager for collections.',
 (SELECT id FROM public.fim_sops WHERE name = 'Stopped Paying Follow-Up' LIMIT 1))
ON CONFLICT (code) DO NOTHING;
