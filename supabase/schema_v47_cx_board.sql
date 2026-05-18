-- v47: Direct insert of Cx Care Team MNGMT PLAN board
-- Run this in Supabase SQL Editor after schema_v46.sql

INSERT INTO public.planning_documents (
  id, title, board_desc, area_id, shared, start_date, due_date, content, created_at, updated_at
) VALUES (
  'f0e1d2c3-b4a5-4678-9abc-def012345678',
  'Cx Care Team MNGMT PLAN',
  'Customer experience cycle management and task framework',
  'cx',
  true,
  NULL,
  NULL,
  '{
    "strokes": [],
    "widgets": [
      {"id":"cx-t-01","type":"text","x":200,"y":20,"w":400,"h":65,"content":"Pioneers Cycle","size":"xl"},
      {"id":"cx-n-01","type":"note","x":60,"y":120,"w":270,"h":185,"title":"Patient Makes order","body":"* CX agent needs to give the patient a welcoming text/call to tell them the cycle no more no less."},
      {"id":"cx-n-02","type":"note","x":360,"y":120,"w":270,"h":185,"title":"Ship IMP KIT → Patient","body":"* Agent needs to inform the patient with their tracking number.\n* Book an Appointment with them for the next stage."},
      {"id":"cx-n-03","type":"note","x":660,"y":120,"w":270,"h":225,"title":"Patient receive the IMP KIT","body":"* Agent Needs to remind them about their appointment 24 hours before the appointment through text/call.\n* Agent is required to do the IMP Kit with the patient and to get Dentist approval.\n* Agent requires to follow up with the patient until updating of the Tracking number"},
      {"id":"cx-n-04","type":"note","x":960,"y":120,"w":270,"h":210,"title":"Patient Ship → Dental Lab","body":"* Agent requires to track the shipping and update CX that the dental lab received your kit by looking at the tracking number provided in the previous step.\n**** Make the patient feels excited"},
      {"id":"cx-n-05","type":"note","x":1260,"y":120,"w":270,"h":175,"title":"Patient Smile(veneers) in production","body":"* Agent requires to update the patient at this stage and make them excited about the veneers"},
      {"id":"cx-n-06","type":"note","x":1560,"y":120,"w":270,"h":185,"title":"Ship Veneers → Patient","body":"* Agent is required to follow up with the patient and ask for referrals and reviews at this stage.\n*** Do not leave without a referral or review ****"},
      {"id":"cx-g-01","type":"goal","x":1880,"y":100,"w":290,"h":220,"title":"CX managing targets","description":"the goal of showing pioneers cycle is to provide organized exceptional cx care to all of our patients and","targetDate":"2027-12-17"},
      {"id":"cx-t-02","type":"text","x":60,"y":380,"w":240,"h":52,"content":"CRITICAL:","size":"lg"},
      {"id":"cx-s-01","type":"sticky","x":60,"y":450,"w":210,"h":215,"bg":"#fecdd3","text":"TASK #1: The Full Calendar\n\nCall any Patient who just received their kit and do not hang up until a Zoom appointment is locked into the calendar."},
      {"id":"cx-s-02","type":"sticky","x":290,"y":450,"w":210,"h":215,"bg":"#fecdd3","text":"Task #2: The No-Show Recovery\n\nImmediately call any Patient who missed their Zoom appointment to reschedule them for the same day."},
      {"id":"cx-s-03","type":"sticky","x":520,"y":450,"w":210,"h":215,"bg":"#fecdd3","text":"Task #3: The Photo Audit\n\nGet Dentist approval while conducting the zoom with the patient to see if we will remake the impression or proceed"},
      {"id":"cx-s-04","type":"sticky","x":60,"y":685,"w":210,"h":225,"bg":"#fecdd3","text":"Task #4: The Production Update\n\nSend a \"Your veneers are currently being hand-crafted with our specialized dentist\" update every 3 days while the lab is working."},
      {"id":"cx-s-05","type":"sticky","x":290,"y":685,"w":210,"h":225,"bg":"#fecdd3","text":"Task #4: The Shipping Verification\n\nManually verify that every kit \"Return Label\" has been scanned by the carrier within 48 hours of the Zoom call, and update every 3 days while the lab is working."},
      {"id":"cx-s-06","type":"sticky","x":520,"y":685,"w":210,"h":215,"bg":"#fecdd3","text":"Task #5: The CRM Cleanup\n\nEnsure every customer has a \"Next Step\" date assigned so no one sits in a stage for more than 5 days."},
      {"id":"cx-t-03","type":"text","x":60,"y":940,"w":240,"h":52,"content":"ROUTINE:","size":"lg"},
      {"id":"cx-s-07","type":"sticky","x":60,"y":1010,"w":210,"h":215,"bg":"#fef08a","text":"Task #1: The Welcome Process\n\nSend the personalized \"Welcome\" SMS/Email to every new order within 1 hour of purchase."},
      {"id":"cx-s-08","type":"sticky","x":290,"y":1010,"w":210,"h":215,"bg":"#fef08a","text":"Task #2: The Tracking Update\n\n* Ship the IMP KIT to Patient via emailing the ups store.\n* Input tracking numbers for every outbound kit and veneer box into the CRM."},
      {"id":"cx-s-09","type":"sticky","x":520,"y":1010,"w":210,"h":215,"bg":"#fef08a","text":"Task #3: The KIT Confirmation\n\nNotify the Patient via SMS/calls, the second the lab confirms their physical kit has arrived at the facility."},
      {"id":"cx-s-10","type":"sticky","x":60,"y":1245,"w":210,"h":230,"bg":"#bbf7d0","text":"Task #5: The Refund Saver\n\nHandle \"I want a refund\" emails/texts/calls, by offering a \"Senior Technician Zoom\" to solve their kit/IMP session issues instead of losing the Patient."},
      {"id":"cx-s-11","type":"sticky","x":290,"y":1245,"w":210,"h":230,"bg":"#bbf7d0","text":"Task #6: The Review Extractor\n\nSecure a Google review from a customer the moment they confirm their veneers fit perfectly or after a successful call with them"},
      {"id":"cx-s-12","type":"sticky","x":520,"y":1245,"w":210,"h":215,"bg":"#bbf7d0","text":"Task #6\n\n* Update the Lab Inbounds Kit every day + Inform the lab daily via email."},
      {"id":"cx-s-13","type":"sticky","x":60,"y":1495,"w":210,"h":215,"bg":"#bfdbfe","text":"Task #7: The Referral Pitch\n\nOffer the \"Friends & Family\" $100 off to every customer during the final follow-up call, and a free remake for the patient themself."},
      {"id":"cx-s-14","type":"sticky","x":290,"y":1495,"w":210,"h":215,"bg":"#bfdbfe","text":"Task #8: The Daily Recap\n\nSubmitting the \"3-Line Report\" (Bookings, Zooms, Rescues) to you before logging off."},
      {"id":"cx-s-15","type":"sticky","x":520,"y":1495,"w":210,"h":225,"bg":"#bfdbfe","text":"Task #8: The Inbox Zero\n\n* Ensure all \"Where is my order?\" emails are answered by the end of the shift.\n* Ensure Texts/calendars are ready for next day work"},
      {"id":"cx-s-16","type":"sticky","x":60,"y":1740,"w":210,"h":240,"bg":"#e9d5ff","text":"Task #7: The Read & Sign Audit\n\n* Log into the portal every Monday to review the \"Hall of Fame/Shame\" impression photos.\n* Make sure all your training is completed before the past due"},
      {"id":"cx-s-17","type":"sticky","x":290,"y":1740,"w":220,"h":275,"bg":"#fed7aa","text":"Task #9: ON FRIDAYS\n\n* Audit every customer in the CRM who hasn t had a Next Action or note in the last 4 days\n* Call every customer who had a Lab Rejection this week and align them with the solution. (New imp kit and a senior Lab Technician will help you to remake it)\n* Identify and tag the Top 10 Must FOLLOW-UP customers for Monday morning."}
    ]
  }'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  title      = EXCLUDED.title,
  board_desc = EXCLUDED.board_desc,
  area_id    = EXCLUDED.area_id,
  shared     = EXCLUDED.shared,
  content    = EXCLUDED.content,
  updated_at = NOW();
