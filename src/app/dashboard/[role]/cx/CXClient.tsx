'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { dbOp } from '@/utils/db';
import { createClient } from '@/utils/supabase/client';

/* ── Constants ───────────────────────────────────────────────── */
// The pipeline stage select lists every stage a case moves through, in order —
// the order/impression stages plus the veneer/delivery ones. Labels say plainly
// what the stage is. Kept in sync with the detailed PIPELINE_STAGES checklist.
const DEFAULT_PIPELINE_STAGES = [
  'New order',
  'Impression kit sent',
  'Impression kit delivered',
  'Pre-impression kit appointment',
  'Impression appointment done',
  'Impression kit on the way to the lab',
  'Veneers sent',
  'Veneers delivered',
  'Complete',
];

const PAY_META: Record<string, { bg: string; color: string }> = {
  'Paid':      { bg: 'oklch(0.93 0.05 145)', color: 'oklch(0.36 0.15 145)' },
  'Partial':   { bg: 'oklch(0.94 0.06 75)',  color: 'oklch(0.40 0.18 75)'  },
  'Defaulted': { bg: 'oklch(0.92 0.06 25)',  color: 'oklch(0.40 0.20 25)'  },
};

const PIPELINE_STAGES = [
  { key: 'new_order',                    label: 'New order' },
  { key: 'imp_kit_sent',                 label: 'Impressions kit sent' },
  { key: 'imp_kit_delivered',            label: 'Impressions kit delivered' },
  { key: 'pre_imp_appointment',          label: 'Pre impression kit appointment' },
  { key: 'imp_appointment_done',         label: 'Impression appointment done' },
  { key: 'collect_payment',              label: 'Collect partial / full payment' },
  { key: 'waiting_sendback_tracking',    label: 'Awaiting send-back tracking #' },
  { key: 'imp_kit_on_way_to_lab',        label: 'IMP kit on the way to lab' },
  { key: 'received_imp_kit_at_lab',      label: 'Received IMP kit at lab' },
  { key: 'in_production',               label: 'In production' },
  { key: 'collect_payment_production',  label: 'Collect partial / full payment' },
  { key: 'quality_check',               label: 'Quality check' },
  { key: 'collect_full_payment_veneers', label: 'Collect full payment for veneers' },
  { key: 'shipping_veneers',            label: 'Shipping the Veneers' },
  { key: 'veneers_shipped',             label: 'Veneers shipped' },
  { key: 'veneers_delivered',           label: 'Veneers delivered' },
  { key: 'completed_no_issues',         label: 'Completed' },
];
const STAGE_GROUPS = [
  { label: 'IMPRESSIONS',      keys: ['new_order', 'imp_kit_sent', 'imp_kit_delivered', 'pre_imp_appointment', 'imp_appointment_done'] },
  { label: 'PAYMENT & RETURN', keys: ['collect_payment', 'waiting_sendback_tracking', 'imp_kit_on_way_to_lab', 'received_imp_kit_at_lab'] },
  { label: 'PRODUCTION',       keys: ['in_production', 'collect_payment_production', 'quality_check', 'collect_full_payment_veneers'] },
  { label: 'DELIVERY & AFTER', keys: ['shipping_veneers', 'veneers_shipped', 'veneers_delivered', 'completed_no_issues'] },
];
/* Per-stage agent guide. `summary` is the blue banner blurb; `steps` are the
   checklist items an agent ticks off ("mark yes") as they complete each one.
   Placeholder content — swap in the official step list per stage when provided. */
const STAGE_GUIDE: Record<string, { summary: string; steps: string[] }> = {
  new_order: {
    summary: 'Brand-new order. Confirm the details and welcome the customer.',
    steps: [
      'Claim the case under your name so it appears in your portal under the My Cases tab',
      'Call the customer with a warm welcome and ask them to reply to your SMS with their shipping address to verify it on file',
      'Once the address is confirmed, click the Send Shippo button and select 2 Impression Kits',
      'Open Shippo and verify your current order number and info, then click View Order',
      'Click Create a Return Label, check the return address box, then click Save',
      'Select the cheapest USPS option for normal shipping and click Buy (if Fast shipping, check the Fast Shipping SOP)',
      "Once purchased, locate the tracking number under the customer's card in the portal",
      "Click Print under the tracking log and check the name: if it is the customer's name, identify it as Imp to Customer; if it is Pioneers Veneers, identify it as Imp Return",
      'Update the CRM with the tracking number of the Impression Kit sent to the customer, and hold onto the return label until you finish the appointment',
      'Update both the CRM and the portal status to Impression Kit Sent',
    ],
  },
  imp_kit_sent: {
    summary: 'Impressions kit is on the way. Share the tracking number and let the customer know to watch for it.',
    steps: [
      'Click Track within 24–48 hours of shipment to check the estimated delivery date',
      'Call the customer, inform them of their delivery date, and book their Impression Kit appointment directly in the CRM',
      'Verify the automation informing the customer of their appointment was sent',
    ],
  },
  imp_kit_delivered: {
    summary: 'Kit delivered. Make sure the customer knows how to take their impression.',
    steps: [
      'If you did not get a chance to schedule an appointment with the customer, make sure that you schedule the Impression Kit appointment. This is very crucial now that the kit has been delivered',
      'Review the Impression Kit SOP and make sure you are prepared to do your Impression Kit appointment',
    ],
  },
  pre_imp_appointment: {
    summary: 'Set up and run the virtual impression appointment with the customer.',
    steps: [
      'Use the Create meeting button below to open Sylaps, create a meeting, and send it to the customer for your appointment time',
      'Click Start a meeting',
      'Click Join meeting',
      'Click the + on the bottom right, then click Start recording',
      "Save the recording to your file under the customer's name and put \"Impression Kit taking\" beside it",
      'Hit the X on the recording meeting',
      'On the top right, click the people icon (named Participants)',
      'Click Invite participants, then click Share link and copy the link',
      'Go to the CRM and share the link with the customer',
      'The customer types their name, allows camera and microphone access, and completes the "not a robot" check, then joins the meeting and can communicate',
      'Keep your camera on so you can visualize everything for the customer',
      'Customers can send photos during the meeting: there is a message icon on the top right they click, then attach an image from the clip mark at the bottom right — from there they take the impression, get the photo, and send it to us',
      'Collect the payment right away, in the same meeting, once they finish the Impression Kit appointment. Recommended amount to charge is $199.99 — deliver the best Impression Kit service first, then collect the money that needs to be collected',
      'Once you are done with the appointment, upload the recording in the Recording Upload section below (owners and admins can review every recording under Recording Uploads)',
    ],
  },
  imp_appointment_done: {
    summary: 'Impression appointment complete. Verify the impression looks good before send-back.',
    steps: [
      "Make sure the customer's impression is approved",
      'Confirm that the customer has the return label to send back the impression kit. If any issue occurs with the return label, the customer can go to any postal office and send it to this address: 35614 Buttonweed Trail, Zephyrhills, FL, 33541',
      'Remind the customer to send back the impression within 24 hours',
      'If the second impression kit was not used, it must still be sent back — return all kits, used or unused, to the address',
      'Again, do not forget to collect the required payment — recommended amount is $199.99',
    ],
  },
  collect_payment: {
    summary: 'Collect the partial or full payment before the kit goes to the lab.',
    steps: [
      'Collect the required payment (either partial or full)',
      'Log the payment in the CRM',
      'Log the payment in the portal',
      'Log the payment in the collecting payments section to earn your commission',
    ],
  },
  waiting_sendback_tracking: {
    summary: 'Waiting on the customer to ship the kit back. Get the send-back tracking number.',
    steps: [
      'If the customer is returning it using their own post office, remind them within 24 hours to go to the post office and send us the impression kit',
      'Encourage the customer to send the impression kit no later than 72 hours — ideally before then',
      "Grab the tracking number they are using if they haven't used our return label",
      'Add that tracking number on the portal and the CRM',
    ],
  },
  imp_kit_on_way_to_lab: {
    summary: 'Kit is heading to the lab. Confirm it is in transit and set the ETA below — that surfaces the customer in the Lab tab.',
    steps: ['Confirm that the kit is on its way to the lab'],
  },
  received_imp_kit_at_lab: {
    summary: 'Lab has received the kit. No further steps required.',
    steps: [
      'No further steps required — just update the stage in the CRM once the admin marks it as received at the lab',
    ],
  },
  in_production: {
    summary: 'Veneers are being produced. Keep the customer informed.',
    steps: ['Confirm production has started', 'Give the customer a production timeline', 'Set a mid-production follow-up'],
  },
  collect_payment_production: {
    summary: 'Veneers are in production — let the customer know, update the CRM, and collect another $199.99 payment.',
    steps: [
      'Call the customer and let them know their veneers are now in production',
      'Update the CRM to reflect that the order is in production',
      'Collect another $199.99 payment (partial or full)',
      'Log the payment in the collecting payments section to earn your commission',
    ],
  },
  quality_check: {
    summary: 'Quality check in progress before shipping.',
    steps: ['Confirm QC passed', 'Flag any defects to the lab', 'Prepare the customer for shipping'],
  },
  collect_full_payment_veneers: {
    summary: 'Collect 100% of the veneers payment. The veneers can ship once the balance is at least 90% collected — that earns the “Ready to be shipped” stamp.',
    steps: [
      'Collect 100% of the veneers payment — that is the goal',
      'Log the payment in the collecting payments section to earn your commission',
      'If the customer refuses and the balance is under 90%, you cannot ship the veneers — schedule another day to collect the payment',
      'At 90%+ the case earns the “Ready to be shipped” stamp and the “Create veneers label” button unlocks',
      'Once payment is in, click “Create veneers label” to send the veneers to Shippo',
    ],
  },
  shipping_veneers: {
    summary: 'Buy the veneers label in Shippo and get the tracking number ready.',
    steps: [
      'Create the veneers label — click the “Create veneers label” button below',
      'In Shippo, go to Orders and select “Buy the label”',
      'The label does not need a return address',
      'Choose the cheapest USPS option',
      'The tracking number shows up in the portal — copy it',
    ],
  },
  veneers_shipped: {
    summary: 'Mark the veneers as shipped in the CRM and record the tracking number.',
    steps: [
      'Update the CRM to “Veneers shipped” and update the tracking number for the veneers — pasting the tracking number automatically sends the “veneers shipped” notification to the customer, no manual message needed',
    ],
  },
  veneers_delivered: {
    summary: 'Veneers delivered. Update the CRM and confirm the customer was notified.',
    steps: [
      'Update the CRM to “Veneers delivered”',
      'Verify that the automated message is sent on the CRM',
    ],
  },
  completed_no_issues: {
    summary: 'Final step. Answer whether there are any issues with the veneers, then mark the order 100% complete — the profile moves to Issues or Completed Success based on your answer.',
    steps: ['Confirm the customer received the veneers and is settled'],
  },
};

/* Lab tab. Each button is an independent checkmark (multi-select) stored in
   cx_cases.lab_steps. Three of them drive the customer's pipeline stage — those
   stages are lab-controlled and locked on the CX card; the rest are lab-internal. */
const LAB_BUTTONS = [
  { key: 'received',      label: 'Received',         hue: 145 },
  { key: 'scan',          label: 'Scanned',          hue: 230 },
  { key: 'in_production', label: 'In Production',    hue: 300 },
  { key: 'sent_us',       label: 'Sent to U.S.',     hue: 200 },
  { key: 'received_us',   label: 'Received in U.S.', hue: 170 },
  { key: 'quality_check', label: 'Quality check',    hue: 80  },
];
// lab step key → pipeline stage key it marks done on the customer card.
const LAB_STAGE_MAP: Record<string, string> = {
  received:      'received_imp_kit_at_lab',
  in_production: 'in_production',
  quality_check: 'quality_check',
};
// Pipeline stages driven only by the Lab tab — agents can't tick these by hand.
const LAB_LOCKED_STAGES = new Set(Object.values(LAB_STAGE_MAP));
// Lab takes over from here; the card never regresses below this stage.
const LAB_FLOOR_STAGE = 'imp_kit_on_way_to_lab';

const EXCEPTION_FLAGS = [
  { key: 'needs_new_imp_kit',               label: 'Needs new impression kit',          hue: 45,  chroma: 0.08 },
  { key: 'veneers_on_hold_failed_payment',  label: 'Veneers on hold — failed payment',  hue: 15,  chroma: 0.08 },
  { key: 'remake_issue',                    label: 'Remake / issue',                    hue: 45,  chroma: 0.08 },
  { key: 'disputed',                        label: 'Disputed',                          hue: 15,  chroma: 0.08 },
  { key: 'needs_refund',                    label: 'Needs refund',                      hue: 260, chroma: 0.02 },
  { key: 'veneers_received_failed_payment', label: 'Veneers received — failed payment', hue: 15,  chroma: 0.08 },
  { key: 'unsatisfied_defaulted',           label: 'Unsatisfied / defaulted',           hue: 15,  chroma: 0.08 },
];

// Avatars and accent borders use a single brand color now that case status
// (which used to drive the hue) has been removed.
function sColor(_?: string) {
  return 'oklch(0.50 0.20 200)';
}
function sBg(_?: string, alpha = 0.12) {
  return `oklch(0.50 0.20 200 / ${alpha})`;
}

function todayStr() { return new Date().toISOString().split('T')[0]; }
function daysOpen(iso: string) { return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
/* Format a plain yyyy-mm-dd (date-picker / DATE column) as "Monday, June 29, 2026".
   Parsed as local time so the weekday never slips a day from a UTC midnight. */
function fmtEta(iso: string) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return String(iso);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/* Deep-link to a contact inside GoHighLevel. The location (sub-account) id — and
   an optional white-label base domain — come from public env vars set in Vercel:
   NEXT_PUBLIC_GHL_LOCATION_ID and NEXT_PUBLIC_GHL_BASE_URL. */
const GHL_BASE = process.env.NEXT_PUBLIC_GHL_BASE_URL || 'https://crm.pioneersveneers.com';
const GHL_LOCATION_ID = process.env.NEXT_PUBLIC_GHL_LOCATION_ID || 'fH6o0jS2R6uCTUpJ6e7p';
function ghlContactUrl(contactId: string, locationId?: string) {
  if (!contactId) return '';
  const loc = locationId || GHL_LOCATION_ID;
  return loc
    ? `${GHL_BASE}/v2/location/${loc}/contacts/detail/${contactId}`
    : `${GHL_BASE}/contacts/detail/${contactId}`;
}

/* Shipping/delivery stamp shown on the card + in the modal. Flips Ready (>=90%
   collected) → Shipped (Veneers shipped stage) → Delivered (on/after the ETA). */
function shipStampFor(c: any): 'READY TO BE SHIPPED' | 'VENEERS SHIPPED' | 'DELIVERED' | null {
  const full = Number(c?.full_price) || 0;
  const collected = Number(c?.amount_collected) || 0;
  const pct = full > 0 ? (collected / full) * 100 : 0;
  const done: string[] = Array.isArray(c?.stages_done) ? c.stages_done : [];
  const eta = c?.veneers_eta_date;
  // Setting a delivery ETA means the veneers have shipped; on/after that date the
  // stamp flips to Delivered — driven purely by the date, no extra clicks needed.
  const delivered = done.includes('veneers_delivered') || (!!eta && todayStr() >= eta);
  const shipped = done.includes('veneers_shipped') || !!eta;
  return delivered ? 'DELIVERED' : shipped ? 'VENEERS SHIPPED' : pct >= 90 ? 'READY TO BE SHIPPED' : null;
}
/* Human label for a tracking_log entry. `label_type` (set by hand) wins; otherwise
   we derive from the Shippo tags (kind + is_return); legacy entries fall back to
   the carrier text. */
const TRACK_TYPE_LABEL: Record<string, string> = {
  imp_send:   'Impression kit: send to customer label',
  imp_return: 'Impression kit: return label',
  veneers:    'Veneers label',
};
const TRACK_TYPE_OPTIONS = [
  { key: 'imp_send',   short: 'Imp → customer' },
  { key: 'imp_return', short: 'Imp return' },
  { key: 'veneers',    short: 'Veneers' },
];
function trackingLabel(e: any): string {
  if (e?.label_type && TRACK_TYPE_LABEL[e.label_type]) return TRACK_TYPE_LABEL[e.label_type];
  if (e?.kind === 'veneers') return TRACK_TYPE_LABEL.veneers;
  if (e?.kind === 'imp_kit') return e?.is_return ? TRACK_TYPE_LABEL.imp_return : TRACK_TYPE_LABEL.imp_send;
  return e?.label || 'Shipping label';
}

const STAMP_STYLE: Record<string, { bg: string; color: string; border: string; icon: string }> = {
  'READY TO BE SHIPPED': { bg: 'oklch(0.93 0.06 145)', color: 'oklch(0.34 0.16 145)', border: 'oklch(0.78 0.10 145)', icon: '✓' },
  'VENEERS SHIPPED':     { bg: 'oklch(0.93 0.06 230)', color: 'oklch(0.36 0.16 230)', border: 'oklch(0.78 0.10 230)', icon: '🚚' },
  'DELIVERED':           { bg: 'oklch(0.90 0.11 145)', color: 'oklch(0.30 0.18 145)', border: 'oklch(0.70 0.15 145)', icon: '📦' },
};
function initials(name: string) { return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'; }

/* Shippo parcel presets. Dimensions are inches, weight is ounces. */
const PARCEL_PRESETS = [
  { key: 'imp_kit_1', label: '1 imp. kit',  length: 11, width: 10, height: 3, weight: 0.12 },
  { key: 'imp_kit_2', label: '2 imp. kits', length: 13, width: 10, height: 3, weight: 10 },
  { key: 'veneers',   label: 'Veneer box',  length: 11, width: 13, height: 3, weight: 0.12 },
  { key: 'custom',    label: 'Custom',      length: 0,  width: 0,  height: 0, weight: 0 },
];

/* Best-effort parse of the case's free-text `address` into Shippo's structured
   fields. The agent confirms/corrects the result in the dialog before sending,
   so a rough parse is fine — US-focused (street, city, ST, ZIP). */
function parseUsAddress(raw: string) {
  const out = { street1: '', street2: '', city: '', state: '', zip: '', country: 'US' };
  const txt = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!txt) return out;
  let rest = txt;
  const zipM = rest.match(/(\d{5})(?:-\d{4})?\s*$/);
  if (zipM) { out.zip = zipM[1]; rest = rest.slice(0, zipM.index).trim().replace(/,\s*$/, ''); }
  const stM = rest.match(/[,\s]([A-Za-z]{2})\s*$/);
  if (stM) { out.state = stM[1].toUpperCase(); rest = rest.slice(0, stM.index).trim().replace(/,\s*$/, ''); }
  const parts = rest.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length) out.city = parts.pop() || '';
  if (parts.length) out.street1 = parts.shift() || '';
  if (parts.length) out.street2 = parts.join(', ');
  if (!out.street1 && out.city) { out.street1 = out.city; out.city = ''; }
  return out;
}

const EMPTY_FORM = {
  customer_name: '', phone: '', email: '', address: '', order_number: '',
  veneer_set: '', veneer_shade: '', shipping: '', special_request: '',
  pipeline_stage: 'New order',
  issue: '', action_taken: '', customer_words: '', lab_notes: '',
  full_price: '', amount_collected: '', payment_left: '', pay_status: 'Paid',
  assigned_to: '', on_hold: false, hold_reason: '',
};

/* ── Component ───────────────────────────────────────────────── */
export default function CXClient({
  initialCases, initialUpdates, allProfiles,
  userRole, currentUserId, currentUserName, savedPipelineStages, ghlLocationId = '',
}: {
  initialCases: any[]; initialUpdates: any[]; allProfiles: any[];
  userRole: string; currentUserId: string; currentUserName: string;
  savedPipelineStages: string[] | null;
  ghlLocationId?: string;
}) {
  const [cases,   setCases]   = useState(initialCases);
  const [updates, setUpdates] = useState(initialUpdates);
  const [stages,  setStages]  = useState<string[]>(savedPipelineStages ?? DEFAULT_PIPELINE_STAGES);

  const [viewMode,    setViewMode]    = useState<'overview'|'board'|'table'>('overview');
  const [section,     setSection]     = useState<'new'|'agents'|'admin'|'no_update'|'unreachable'|'my_cases'|'labels'|'lab'|'issues'|'completed_success'>(userRole === 'dentist' ? 'lab' : 'agents');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCase,  setSelectedCase]  = useState<any>(null);
  const [showForm,      setShowForm]      = useState(false);
  const [editingCase,   setEditingCase]   = useState<any>(null);
  const [showEscalate,  setShowEscalate]  = useState(false);
  const [showAddCol,    setShowAddCol]    = useState(false);
  const [showHoldInput, setShowHoldInput] = useState(false);
  const [holdInputText, setHoldInputText] = useState('');
  const [reassigningCaseId, setReassigningCaseId] = useState<number | null>(null);
  const [reassignValue, setReassignValue] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const [showReferralAdd, setShowReferralAdd] = useState(false);
  const [referralDraft, setReferralDraft] = useState({ name: '', phone: '' });
  const [paymentInput, setPaymentInput] = useState('');
  // Labels Ready category filter: all / impression kit / veneers.
  const [labelKind, setLabelKind] = useState<'all' | 'imp_kit' | 'veneers'>('all');
  // Per-case draft text for the Lab tab's "add lab note" inputs.
  const [labNoteDrafts, setLabNoteDrafts] = useState<Record<number, string>>({});

  const [form,      setForm]      = useState({ ...EMPTY_FORM });
  const [updateText, setUpdateText] = useState('');
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [savingCase,   setSavingCase]   = useState(false);
  const updateRef = useRef<HTMLTextAreaElement>(null);

  const isMgmt         = ['owner', 'admin', 'supervisor'].includes(userRole);
  const isOwner        = userRole === 'owner';
  const isAdminOrOwner = isOwner || userRole === 'admin';
  // The Lab tab is limited to owners, admins, and dentists.
  const canViewLab     = ['owner', 'admin', 'dentist'].includes(userRole);
  // Dentists only ever see the Lab section of the live CX board.
  const labOnly        = userRole === 'dentist';
  const today   = todayStr();
  const supabase = createClient();
  // Dentists are locked to the Lab section — bounce any other section back.
  useEffect(() => { if (labOnly && section !== 'lab') setSection('lab'); }, [labOnly, section]);

  const nameMap = Object.fromEntries(allProfiles.map((p: any) => [p.id, p.name]));
  const todayUpdatedIds = new Set(updates.filter((u: any) => u.update_date === today).map((u: any) => u.case_id));

  const escalatedCount   = cases.filter(c => c.escalated).length;
  const noUpdateCount    = cases.filter(c => c.no_update_needed && !c.escalated).length;
  const unreachableCount = cases.filter(c => c.unreachable && !c.escalated).length;
  // A case is "resolved" once it reaches the Completed stage AND an outcome was
  // chosen (issues vs success). Resolved cases leave the active views and live in
  // the Issues / Completed Success tabs instead.
  const isResolved = (c: any) =>
    Array.isArray(c.stages_done) && c.stages_done.includes('completed_no_issues') && !!c.completed_outcome;
  // "New orders" = active, unassigned cases. They move to "Agents" the moment they get an assignee.
  const isActiveCase     = (c: any) => !c.escalated && !c.no_update_needed && !c.unreachable && !isResolved(c);
  const newOrdersCount   = cases.filter(c => isActiveCase(c) && !c.assigned_to).length;
  const agentsCount      = cases.filter(c => isActiveCase(c) && c.assigned_to).length;
  const myCasesCount     = cases.filter(c => c.assigned_to === currentUserId && !isResolved(c)).length;
  const issuesCount      = cases.filter(c => isResolved(c) && c.completed_outcome === 'issues').length;
  const completedSuccessCount = cases.filter(c => isResolved(c) && c.completed_outcome === 'success').length;

  // "Labels ready to print" = every Shippo-bought label (a tracking_log entry that
  // carries a printable label_url). One row per label, newest-unprinted first.
  const labelItems = cases
    .flatMap((c: any) => (Array.isArray(c.tracking_log) ? c.tracking_log : [])
      .filter((e: any) => e?.label_url)
      .map((e: any) => ({ c, entry: e })))
    .sort((a, b) => (Number(!!a.entry.printed) - Number(!!b.entry.printed))
      || String(b.entry.date || '').localeCompare(String(a.entry.date || '')));
  const labelsToPrint  = labelItems.filter(li => !li.entry.printed);
  const labelsReadyCount = labelsToPrint.length;

  // "Lab" tab = every impression kit with a lab ETA set. Kits stay listed through
  // production and beyond so the lab keeps tracking them. Soonest ETA first.
  const labCases = cases
    .filter((c: any) => c.lab_eta_date)
    .sort((a, b) => String(a.lab_eta_date).localeCompare(String(b.lab_eta_date)));
  const labCount = labCases.length;

  const needsUpdate = (c: any) => !c.on_hold && !c.no_update_needed && !c.unreachable && !todayUpdatedIds.has(c.id);

  const matchesSearch = (c: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.customer_name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.issue?.toLowerCase().includes(q);
  };

  const filtered = cases.filter(c => {
    // Issues / Completed Success tabs show only resolved cases of that outcome.
    if (section === 'issues')            return (isResolved(c) && c.completed_outcome === 'issues')  && matchesSearch(c);
    if (section === 'completed_success') return (isResolved(c) && c.completed_outcome === 'success') && matchesSearch(c);
    // Resolved cases have moved out of every other view.
    if (isResolved(c)) return false;
    if (section === 'my_cases'    && c.assigned_to !== currentUserId)                 return false;
    if (section === 'admin'       && !c.escalated)                                    return false;
    if (section === 'new'         && (!isActiveCase(c) || c.assigned_to))             return false;
    if (section === 'agents'      && (!isActiveCase(c) || !c.assigned_to))            return false;
    if (section === 'no_update'   && (!c.no_update_needed || c.escalated))            return false;
    if (section === 'unreachable' && (!c.unreachable || c.escalated))                 return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.customer_name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.issue?.toLowerCase().includes(q);
  });

  const totalOutstanding = cases.reduce((s, c) => s + (Number(c.payment_left) || 0), 0);
  const needActionCount  = cases.filter(c => needsUpdate(c)).length;

  const caseUpdates = (id: number) =>
    updates.filter((u: any) => u.case_id === id)
           .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  /* ── Handlers ──────────────────────────────────────────────── */
  const openAdd = (prefillStage?: string) => {
    setEditingCase(null);
    setForm({ ...EMPTY_FORM, pipeline_stage: prefillStage ?? 'New order' });
    setShowForm(true);
  };

  const openEdit = (c: any) => {
    setEditingCase(c);
    setForm({
      customer_name: c.customer_name ?? '', phone: c.phone ?? '',
      email: c.email ?? '', address: c.address ?? '', order_number: c.order_number ?? '',
      veneer_set: c.veneer_set ?? '', veneer_shade: c.veneer_shade ?? '',
      shipping: c.shipping ?? '', special_request: c.special_request ?? '',
      pipeline_stage: c.pipeline_stage ?? 'New order',
      issue: c.issue ?? '',
      action_taken: c.action_taken ?? '', customer_words: c.customer_words ?? '',
      lab_notes: c.lab_notes ?? '',
      full_price: c.full_price ?? '', amount_collected: c.amount_collected ?? '',
      payment_left: c.payment_left ?? '',
      pay_status: c.pay_status ?? 'Paid', assigned_to: c.assigned_to ?? '',
      on_hold: c.on_hold ?? false, hold_reason: c.hold_reason ?? '',
    });
    setShowForm(true);
  };

  const handleSaveCase = async () => {
    if (!form.customer_name.trim()) return;
    setSavingCase(true);
    const fullPrice  = form.full_price !== '' ? Number(form.full_price) : null;
    const collected  = form.amount_collected !== '' ? Number(form.amount_collected) : 0;
    // When a full price is set, payment_left is derived; otherwise honor the manual field.
    const paymentLeft = fullPrice != null
      ? Math.max(0, fullPrice - collected)
      : (form.payment_left !== '' ? Number(form.payment_left) : null);
    const payStatus = fullPrice != null
      ? (collected >= fullPrice ? 'Paid' : collected > 0 ? 'Partial' : 'Defaulted')
      : (form.pay_status || null);
    const payload: any = {
      customer_name: form.customer_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      order_number: form.order_number.trim() || null,
      veneer_set: form.veneer_set.trim() || null,
      veneer_shade: form.veneer_shade.trim() || null,
      shipping: form.shipping.trim() || null,
      special_request: form.special_request.trim() || null,
      pipeline_stage: form.pipeline_stage,
      issue: form.issue.trim(),
      action_taken: form.action_taken.trim(),
      customer_words: form.customer_words.trim(),
      lab_notes: form.lab_notes.trim(),
      full_price: fullPrice,
      amount_collected: collected,
      payment_left: paymentLeft,
      pay_status: payStatus,
      assigned_to: form.assigned_to || null,
      on_hold: form.on_hold,
      hold_reason: form.on_hold ? form.hold_reason.trim() : null,
      updated_at: new Date().toISOString(),
    };
    if (editingCase) {
      await dbOp('cx_cases', 'update', payload, { id: editingCase.id });
      setCases(prev => prev.map(c => c.id === editingCase.id ? { ...c, ...payload } : c));
      if (selectedCase?.id === editingCase.id) setSelectedCase((p: any) => ({ ...p, ...payload }));
    } else {
      const { data } = await dbOp('cx_cases', 'insert', { ...payload, created_by: currentUserId, source: 'CRM' });
      if (data?.[0]) setCases(prev => [data[0], ...prev]);
    }
    setSavingCase(false);
    setShowForm(false);
  };

  const handleDeleteCase = async (id: number) => {
    if (!confirm('Delete this customer case? All updates will be lost.')) return;
    await dbOp('cx_cases', 'delete', undefined, { id });
    setCases(prev => prev.filter(c => c.id !== id));
    setSelectedCase(null);
  };

  const handleLogUpdate = useCallback(async () => {
    if (!updateText.trim() || !selectedCase) return;
    setSavingUpdate(true);
    const { data } = await dbOp('cx_updates', 'insert', {
      case_id: selectedCase.id, note: updateText.trim(),
      update_date: today, logged_by: currentUserId,
    });
    if (data?.[0]) {
      setUpdates(prev => [data[0], ...prev]);
      setSelectedCase((p: any) => ({ ...p }));
    }
    setUpdateText('');
    setSavingUpdate(false);
  }, [updateText, selectedCase, today, currentUserId]);

  const handleClaimCase = async (c: any) => {
    const payload = { assigned_to: currentUserId, updated_at: new Date().toISOString() };
    await dbOp('cx_cases', 'update', payload, { id: c.id });
    setCases(prev => prev.map(x => x.id === c.id ? { ...x, ...payload } : x));
    if (selectedCase?.id === c.id) setSelectedCase((p: any) => ({ ...p, ...payload }));
  };

  const handleReassignCase = async (c: any, newUserId: string) => {
    const payload = { assigned_to: newUserId || null, updated_at: new Date().toISOString() };
    await dbOp('cx_cases', 'update', payload, { id: c.id });
    setCases(prev => prev.map(x => x.id === c.id ? { ...x, ...payload } : x));
    if (selectedCase?.id === c.id) setSelectedCase((p: any) => ({ ...p, ...payload }));
    setReassigningCaseId(null);
    setReassignValue('');
  };

  const handleToggleNoUpdate = async (c: any) => {
    const newVal = !c.no_update_needed;
    const payload = { no_update_needed: newVal, updated_at: new Date().toISOString() };
    await dbOp('cx_cases', 'update', payload, { id: c.id });
    setCases(prev => prev.map(x => x.id === c.id ? { ...x, ...payload } : x));
    if (selectedCase?.id === c.id) setSelectedCase((p: any) => ({ ...p, ...payload }));
  };

  const handleToggleUnreachable = async (c: any) => {
    const newVal = !c.unreachable;
    const payload = { unreachable: newVal, updated_at: new Date().toISOString() };
    await dbOp('cx_cases', 'update', payload, { id: c.id });
    setCases(prev => prev.map(x => x.id === c.id ? { ...x, ...payload } : x));
    if (selectedCase?.id === c.id) setSelectedCase((p: any) => ({ ...p, ...payload }));
  };

  const handleToggleHold = async (c: any, reason?: string) => {
    const newHold = !c.on_hold;
    const payload = { on_hold: newHold, hold_reason: newHold ? (reason ?? '') : null, updated_at: new Date().toISOString() };
    await dbOp('cx_cases', 'update', payload, { id: c.id });
    setCases(prev => prev.map(x => x.id === c.id ? { ...x, ...payload } : x));
    if (selectedCase?.id === c.id) setSelectedCase((p: any) => ({ ...p, ...payload }));
    setShowHoldInput(false);
    setHoldInputText('');
  };

  const handleEscalate = async (note: string, severity: string) => {
    if (!selectedCase) return;
    const payload = { escalated: true, escalation_note: note, escalation_severity: severity, updated_at: new Date().toISOString() };
    await dbOp('cx_cases', 'update', payload, { id: selectedCase.id });
    setCases(prev => prev.map(c => c.id === selectedCase.id ? { ...c, ...payload } : c));
    setSelectedCase((p: any) => ({ ...p, ...payload }));
    setShowEscalate(false);
  };

  const handleAddStage = async (name: string) => {
    const upper = name.trim().toUpperCase();
    if (!upper || stages.includes(upper)) return;
    const newStages = [...stages, upper];
    setStages(newStages);
    await dbOp('global_settings', 'upsert', { key: 'cx_pipeline_stages', value: newStages });
    setShowAddCol(false);
  };

  const handleToggleStage = async (stageKey: string) => {
    if (!selectedCase) return;
    // Only admins/owners may move stages by hand (jump ahead or step back). CX agents
    // progress strictly by answering every guide step — the case then auto-advances.
    if (!isAdminOrOwner) return;
    // These stages are auto-set from the Lab tab — agents can't toggle them by hand.
    if (LAB_LOCKED_STAGES.has(stageKey)) return;
    const done: string[] = selectedCase.stages_done ?? [];
    const idx = PIPELINE_STAGES.findIndex(s => s.key === stageKey);
    const isDone = done.includes(stageKey);
    let newDone: string[];
    if (isDone) {
      const keep = new Set(PIPELINE_STAGES.slice(0, idx).map(s => s.key));
      newDone = done.filter(k => keep.has(k));
    } else {
      // Completing an agent stage also releases any lab steps already checked that
      // were gated behind it (e.g. Quality check marked while the card was held at
      // the mid-production payment stage), keeping stages_done a contiguous prefix.
      const labSteps: string[] = Array.isArray(selectedCase.lab_steps) ? selectedCase.lab_steps : [];
      const labIdxs = labSteps.filter(s => LAB_STAGE_MAP[s]).map(s => PIPELINE_STAGES.findIndex(x => x.key === LAB_STAGE_MAP[s]));
      const upto = Math.max(idx, ...(labIdxs.length ? labIdxs : [-1]));
      newDone = PIPELINE_STAGES.slice(0, upto + 1).map(s => s.key);
    }
    const payload = { stages_done: newDone, updated_at: new Date().toISOString() };
    await dbOp('cx_cases', 'update', payload, { id: selectedCase.id });
    setCases(prev => prev.map(c => c.id === selectedCase.id ? { ...c, ...payload } : c));
    setSelectedCase((p: any) => ({ ...p, ...payload }));
  };

  const handleToggleException = async (flagKey: string) => {
    if (!selectedCase) return;
    const flags: string[] = selectedCase.exception_flags ?? [];
    const newFlags = flags.includes(flagKey) ? flags.filter(k => k !== flagKey) : [...flags, flagKey];
    const payload = { exception_flags: newFlags, updated_at: new Date().toISOString() };
    await dbOp('cx_cases', 'update', payload, { id: selectedCase.id });
    setCases(prev => prev.map(c => c.id === selectedCase.id ? { ...c, ...payload } : c));
    setSelectedCase((p: any) => ({ ...p, ...payload }));
  };

  /* Generic patch for the open case — writes to DB and syncs local state. */
  const patchCase = async (patch: Record<string, any>) => {
    if (!selectedCase) return;
    const payload = { ...patch, updated_at: new Date().toISOString() };
    await dbOp('cx_cases', 'update', payload, { id: selectedCase.id });
    setCases(prev => prev.map(c => c.id === selectedCase.id ? { ...c, ...payload } : c));
    setSelectedCase((p: any) => ({ ...p, ...payload }));
  };

  const newEntryId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.round(Math.random() * 1e6);

  /* Upload an appointment recording → Supabase storage, then append it to the
     case's recording_uploads array (owners/admins see them in Recording Uploads). */
  const recInputRef = useRef<HTMLInputElement>(null);
  const [recUploading, setRecUploading] = useState(false);
  const handleRecordingSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCase) return;
    setRecUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'mp4';
      const path = `cx-recordings/${selectedCase.id}/${newEntryId()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('employee-docs').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('employee-docs').getPublicUrl(path);
      const list = selectedCase.recording_uploads ?? [];
      await patchCase({ recording_uploads: [{ id: newEntryId(), url: publicUrl, file_name: file.name, by: currentUserId, date: today }, ...list] });
    } catch (err: any) {
      alert('Upload failed: ' + (err?.message ?? 'Unknown error'));
    } finally {
      setRecUploading(false);
      if (recInputRef.current) recInputRef.current.value = '';
    }
  };

  const addLogEntry = (field: string, entry: Record<string, any>) => {
    const list = selectedCase?.[field] ?? [];
    patchCase({ [field]: [{ id: newEntryId(), by: currentUserId, date: today, ...entry }, ...list] });
  };
  const removeLogEntry = (field: string, id: string) => {
    const list = (selectedCase?.[field] ?? []).filter((e: any) => e.id !== id);
    patchCase({ [field]: list });
  };
  // Set/clear a tracking entry's type (send-to-customer / return / veneers).
  const setTrackingType = (id: string, type: string | null) => {
    const list = (selectedCase?.tracking_log ?? []).map((e: any) => e.id === id ? { ...e, label_type: type } : e);
    patchCase({ tracking_log: list });
  };

  /* Patch any case (not just the open one) and keep the list + open modal in sync. */
  const patchAnyCase = async (caseId: number, patch: Record<string, any>) => {
    const payload = { ...patch, updated_at: new Date().toISOString() };
    await dbOp('cx_cases', 'update', payload, { id: caseId });
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, ...payload } : c));
    if (selectedCase?.id === caseId) setSelectedCase((p: any) => ({ ...p, ...payload }));
  };

  /* Add a lab note from the Lab tab. It writes to the same lab_notes_log the
     customer's live card reads, so the note shows up on the CX card too. */
  const addLabNote = (caseId: number, text: string) => {
    const t = text.trim();
    if (!t) return;
    const c = cases.find(x => x.id === caseId);
    const list = Array.isArray(c?.lab_notes_log) ? c.lab_notes_log : [];
    patchAnyCase(caseId, { lab_notes_log: [{ id: newEntryId(), by: currentUserId, date: today, text: t }, ...list] });
    setLabNoteDrafts(p => ({ ...p, [caseId]: '' }));
  };

  /* Toggle one Lab-tab checkmark on/off (multi-select — they're independent).
     The pipeline-driving steps (Received / In Production / Quality check) recompute
     the customer's stage to the furthest one ticked, floored at the lab hand-off
     stage so toggling lab steps never wipes the agent's earlier progress. Scan,
     Sent to U.S. and Received in U.S. are lab-internal and don't touch the card. */
  const toggleLabStep = (c: any, stepKey: string) => {
    const cur: string[] = Array.isArray(c.lab_steps) ? c.lab_steps : [];
    const next = cur.includes(stepKey) ? cur.filter(s => s !== stepKey) : [...cur, stepKey];
    const floorIdx = PIPELINE_STAGES.findIndex(s => s.key === LAB_FLOOR_STAGE);
    const checkedIdxs = next
      .filter(s => LAB_STAGE_MAP[s])
      .map(s => PIPELINE_STAGES.findIndex(x => x.key === LAB_STAGE_MAP[s]));
    const furthest = checkedIdxs.length ? Math.max(...checkedIdxs) : -1;
    let targetIdx = Math.max(floorIdx, furthest);
    // collect_payment_production is an agent-driven payment stage that sits between
    // In production and Quality check. The lab must NOT jump the card past it: until
    // the agent has collected that payment, cap lab progress just before it. The lab
    // checkmarks are still recorded in lab_steps, so completing the payment later
    // releases them (see handleToggleStage, which extends to the lab's furthest step).
    const prevDone: string[] = Array.isArray(c.stages_done) ? c.stages_done : [];
    const payIdx = PIPELINE_STAGES.findIndex(s => s.key === 'collect_payment_production');
    if (payIdx !== -1 && targetIdx >= payIdx && !prevDone.includes('collect_payment_production')) {
      targetIdx = payIdx - 1;
    }
    const newDone = PIPELINE_STAGES.slice(0, targetIdx + 1).map(s => s.key);
    return patchAnyCase(c.id, { lab_steps: next, stages_done: newDone });
  };

  /* Mark one or more tracking_log labels on a case as printed (or un-printed),
     persisting in a single write per case so simultaneous marks don't clobber. */
  const setLabelsPrinted = async (caseId: number, entryIds: string[], printed: boolean) => {
    const c = cases.find(x => x.id === caseId);
    if (!c) return;
    const ids = new Set(entryIds);
    const log = (Array.isArray(c.tracking_log) ? c.tracking_log : []).map((e: any) =>
      ids.has(e.id) ? { ...e, printed, printed_at: printed ? new Date().toISOString() : null } : e);
    const payload = { tracking_log: log, updated_at: new Date().toISOString() };
    await dbOp('cx_cases', 'update', payload, { id: caseId });
    setCases(prev => prev.map(x => x.id === caseId ? { ...x, ...payload } : x));
    if (selectedCase?.id === caseId) setSelectedCase((p: any) => ({ ...p, ...payload }));
  };

  /* Open a single label's PDF and check it off. */
  const printLabel = (li: { c: any; entry: any }) => {
    if (li.entry.label_url) window.open(li.entry.label_url, '_blank', 'noopener,noreferrer');
    setLabelsPrinted(li.c.id, [li.entry.id], true);
  };

  /* Print every unprinted label at once. Browsers' popup blockers allow only the
     FIRST window.open() per click, so looping window.open opened just one label.
     Instead we ask the server to staple all the label PDFs into a single file and
     open that one tab. The tab is opened synchronously (within the click) so it
     counts as user-initiated; we then point it at the merged PDF once it's built. */
  const [printingAll, setPrintingAll] = useState(false);
  const printAllLabels = async (items: typeof labelsToPrint = labelsToPrint) => {
    const urls = items.map(li => li.entry.label_url).filter(Boolean);
    if (urls.length === 0 || printingAll) return;
    const win = window.open('', '_blank'); // sync → not blocked
    setPrintingAll(true);
    try {
      const res = await fetch('/api/shippo/merge-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (win) win.close();
        alert(`Could not build the print file: ${j.error || `HTTP ${res.status}`}`);
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      if (win) {
        win.location.href = url;
      } else {
        // The single tab was blocked too — fall back to a download so the app stays put.
        const a = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.download = 'labels.pdf';
        document.body.appendChild(a); a.click(); a.remove();
      }
      // Check them all off, grouped per case so each case is written once.
      const byCase = new Map<number, string[]>();
      items.forEach(li => byCase.set(li.c.id, [...(byCase.get(li.c.id) ?? []), li.entry.id]));
      byCase.forEach((ids, caseId) => setLabelsPrinted(caseId, ids, true));
    } catch (e: any) {
      if (win) win.close();
      alert(`Print all failed: ${e?.message ?? e}`);
    } finally {
      setPrintingAll(false);
    }
  };

  const handleRecordPayment = async (amount: string) => {
    const add = Number(amount);
    if (!add || add <= 0 || !selectedCase) return;
    const full = Number(selectedCase.full_price) || 0;
    const collected = (Number(selectedCase.amount_collected) || 0) + add;
    const left = full > 0 ? Math.max(0, full - collected) : selectedCase.payment_left;
    const pay_status = full > 0 ? (collected >= full ? 'Paid' : collected > 0 ? 'Partial' : 'Defaulted') : selectedCase.pay_status;
    await patchCase({ amount_collected: collected, payment_left: left, pay_status });
    // Recording a payment here automatically logs a collection for the agent so it
    // counts toward their commission — no manual entry in the Collections section.
    await dbOp('sales_logs', 'insert', {
      user_id:         currentUserId,
      type:            'Collection',
      status:          'Pending',
      customer_name:   selectedCase.customer_name ?? '',
      customer_phone:  selectedCase.phone ?? '',
      customer_email:  selectedCase.email ?? '',
      amount:          add,
      collection_type: 'CRM',
      collection_date: today,
      customer_id:     selectedCase.customer_name ?? '',
    });
  };

  const handleToggleGuideStep = (stageKey: string, idx: number) => {
    if (!selectedCase) return;
    const cl: Record<string, number[]> = selectedCase.stage_checklist ?? {};
    const done = new Set(cl[stageKey] ?? []);
    if (done.has(idx)) done.delete(idx); else done.add(idx);
    const newChecklist = { ...cl, [stageKey]: [...done] };

    // Auto-advance: once every guide step for the CURRENT stage is answered "yes",
    // the case moves to the next stage on its own. This is the only way CX agents
    // progress — they can't jump ahead or skip stages, and can't step back.
    const guide = STAGE_GUIDE[stageKey];
    const stagesDoneArr: string[] = Array.isArray(selectedCase.stages_done) ? selectedCase.stages_done : [];
    const isCurrent = PIPELINE_STAGES[stagesDoneArr.length]?.key === stageKey;
    const allAnswered = !!guide && guide.steps.length > 0 && guide.steps.every((_, i) => done.has(i));

    if (isCurrent && allAnswered && !LAB_LOCKED_STAGES.has(stageKey)) {
      // Advance, extending to any lab steps already checked so stages_done stays a
      // contiguous prefix (mirrors handleToggleStage).
      const stageIdx = PIPELINE_STAGES.findIndex(s => s.key === stageKey);
      const labSteps: string[] = Array.isArray(selectedCase.lab_steps) ? selectedCase.lab_steps : [];
      const labIdxs = labSteps.filter(s => LAB_STAGE_MAP[s]).map(s => PIPELINE_STAGES.findIndex(x => x.key === LAB_STAGE_MAP[s]));
      const upto = Math.max(stageIdx, ...(labIdxs.length ? labIdxs : [-1]));
      const newDone = PIPELINE_STAGES.slice(0, upto + 1).map(s => s.key);
      patchCase({ stage_checklist: newChecklist, stages_done: newDone });
    } else {
      patchCase({ stage_checklist: newChecklist });
    }
  };

  const [showLabelModal, setShowLabelModal] = useState(false);
  const [creatingLabel, setCreatingLabel] = useState(false);
  // Which parcel preset the Shippo modal opens on: 'imp_kit_2' for the impression
  // kit button, 'veneers' for the veneers button.
  const [labelPreset, setLabelPreset] = useState('imp_kit_2');
  const openLabel = (presetKey: string) => { setLabelPreset(presetKey); setShowLabelModal(true); };
  /* Push the confirmed to-address + parcel to Shippo as an ORDER. This does NOT
     buy a label — it makes the order appear in the Shippo "Orders" tab with
     rates and a "Buy" button, where the team purchases it. */
  const handleCreateLabel = async (to: Record<string, any>, parcel: Record<string, number>, kind?: string) => {
    if (!selectedCase) return null;
    setCreatingLabel(true);
    try {
      const res = await fetch('/api/shippo/create-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to, parcel, kind,
          case_id: selectedCase.id,
          order_number: selectedCase.order_number || `CX-${selectedCase.id}`,
          item_title: kind === 'veneers' ? (selectedCase.veneer_set ? `Veneers — ${selectedCase.veneer_set}` : 'Veneers') : 'Impression kit',
        }),
      });
      const json = await res.json();
      if (!res.ok) { alert('Could not send to Shippo: ' + (json.error || 'Unknown error')); return null; }
      return json;
    } finally {
      setCreatingLabel(false);
    }
  };

  const [pushing, setPushing] = useState(false);
  const handlePushToCustomer = async () => {
    if (!selectedCase || pushing) return;
    const sc = selectedCase;
    const phoneKey = (sc.phone || '').replace(/\D/g, '');
    if (phoneKey.length < 7) {
      alert('Add a valid phone number to this case first — customers look up their profile by phone.');
      return;
    }
    setPushing(true);
    const done: string[] = sc.stages_done ?? [];
    const curStage = PIPELINE_STAGES[Math.min(done.length, PIPELINE_STAGES.length - 1)];
    const guide = curStage ? STAGE_GUIDE[curStage.key] : undefined;
    const checked: number[] = (sc.stage_checklist ?? {})[curStage?.key ?? ''] ?? [];
    const full = Number(sc.full_price) || 0;
    const collected = Number(sc.amount_collected) || 0;
    // Snapshot = only what the customer is allowed to see, keyed by case_id (PK → upsert).
    const snapshot = {
      case_id: sc.id,
      phone: phoneKey,
      customer_name: sc.customer_name ?? null,
      order_number: sc.order_number ?? null,
      stage_label: curStage?.label ?? null,
      stage_pct: Math.round((done.length / PIPELINE_STAGES.length) * 100),
      next_step_summary: guide?.summary ?? null,
      next_steps: (guide?.steps ?? []).map((text, idx) => ({ text, done: checked.includes(idx) })),
      tracking: (sc.tracking_log ?? []).map((t: any) => ({ label: t.label, number: t.number })),
      full_price: full || null,
      amount_collected: collected,
      balance: full > 0 ? Math.max(0, full - collected) : null,
      published_at: new Date().toISOString(),
    };
    const { error } = await dbOp('customer_portal', 'upsert', snapshot);
    if (error) {
      alert('Could not push to customer: ' + error);
      setPushing(false);
      return;
    }
    await patchCase({ pushed_to_customer_at: new Date().toISOString() });
    setPushing(false);
  };

  const markCaseRead = (caseId: number) => {
    localStorage.setItem(`cx-last-read-${currentUserId}-${caseId}`, new Date().toISOString());
    setUnreadCounts(prev => { const next = { ...prev }; delete next[caseId]; return next; });
  };

  const exportCSV = () => {
    const rows = [
      ['Name','Phone','Stage','Issue','Payment Left','Pay Status'],
      ...filtered.map(c => [c.customer_name,c.phone,c.pipeline_stage,c.issue,c.payment_left??'',c.pay_status??'']),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = 'cx-cases.csv'; a.click();
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && updateRef.current === document.activeElement) {
        e.preventDefault(); handleLogUpdate();
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [handleLogUpdate]);

  useEffect(() => {
    const counts: Record<number, number> = {};
    cases.forEach(c => {
      const lastRead = localStorage.getItem(`cx-last-read-${currentUserId}-${c.id}`) ?? new Date(0).toISOString();
      const count = updates.filter(u => u.case_id === c.id && u.created_at > lastRead).length;
      if (count > 0) counts[c.id] = count;
    });
    setUnreadCounts(counts);
  }, []);

  // NOTE: the delivery ETA only drives the *stamp* (see shipStampFor) — it does
  // NOT auto-check the "Veneers delivered" stage. Agents read that stage's guide
  // and check it off themselves, and can freely step back to earlier stages.

  /* ── Owner quick-look banner ────────────────────────────────── */
  const banner = (
    <div className="card" style={{ marginBottom: 16, padding: '16px 22px', background: section === 'admin' && escalatedCount > 0 ? 'linear-gradient(135deg, oklch(0.98 0.03 25), oklch(0.97 0.04 15))' : section === 'no_update' ? 'linear-gradient(135deg, oklch(0.98 0.02 145), oklch(0.97 0.03 120))' : section === 'unreachable' ? 'linear-gradient(135deg, oklch(0.98 0.02 290), oklch(0.97 0.03 270))' : section === 'new' ? 'linear-gradient(135deg, oklch(0.98 0.02 200), oklch(0.97 0.03 215))' : 'linear-gradient(135deg, oklch(0.98 0.01 260), oklch(0.97 0.02 200))' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: section === 'admin' && escalatedCount > 0 ? 'oklch(0.45 0.20 25)' : section === 'no_update' ? 'oklch(0.36 0.15 145)' : section === 'unreachable' ? 'oklch(0.40 0.18 290)' : section === 'new' ? 'oklch(0.38 0.18 200)' : 'var(--ink-4)', marginBottom: 6 }}>
        CUSTOMER SERVICE · {section === 'admin' ? 'ADMIN — ESCALATED CASES' : section === 'no_update' ? 'NO UPDATE NEEDED' : section === 'unreachable' ? 'UNREACHABLE CUSTOMERS' : section === 'new' ? 'NEW ORDERS — UNASSIGNED' : section === 'labels' ? 'LABELS READY TO PRINT' : section === 'lab' ? 'VERIFY IMPRESSION KIT → LAB' : section === 'issues' ? 'ISSUES' : section === 'completed_success' ? 'COMPLETED SUCCESS' : 'AGENTS — ASSIGNED CUSTOMERS'}
      </div>
      {section === 'issues' ? (
        <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>
          {issuesCount === 0
            ? 'No completed orders with issues. Cases land here when an order is marked complete with issues flagged.'
            : <><strong style={{ color: 'oklch(0.45 0.18 25)' }}>{issuesCount} completed order{issuesCount !== 1 ? 's' : ''}</strong> with issues flagged. Full history is preserved — click any to review.</>}
        </div>
      ) : section === 'completed_success' ? (
        <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>
          {completedSuccessCount === 0
            ? 'No completed orders yet. Cases land here when an order is marked complete with no issues.'
            : <><strong style={{ color: 'oklch(0.40 0.15 145)' }}>{completedSuccessCount} completed order{completedSuccessCount !== 1 ? 's' : ''}</strong> with no issues. Full history is preserved — click any to review.</>}
        </div>
      ) : section === 'lab' ? (
        <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>
          {labCount === 0
            ? 'No impression kits in transit. A customer lands here once an agent sets the lab ETA on the “IMP kit on the way to lab” stage.'
            : <><strong style={{ color: 'oklch(0.44 0.15 300)' }}>{labCount} kit{labCount !== 1 ? 's' : ''}</strong> in transit to the lab. Mark each one Received, Scan, or In Production — Received and In Production update the customer’s card automatically.</>}
        </div>
      ) : section === 'labels' ? (
        <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>
          {labelsReadyCount === 0
            ? 'No labels waiting to print. Bought labels show up here the moment Shippo confirms them.'
            : <><strong style={{ color: 'oklch(0.42 0.14 170)' }}>{labelsReadyCount} label{labelsReadyCount !== 1 ? 's' : ''}</strong> ready to print. Print them individually or all at once — each gets checked off once printed.</>}
        </div>
      ) : section === 'new' ? (
        <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>
          {newOrdersCount === 0
            ? 'No new orders waiting. Every active customer has been assigned to an agent.'
            : <><strong style={{ color: 'oklch(0.38 0.18 200)' }}>{newOrdersCount} new order{newOrdersCount !== 1 ? 's' : ''}</strong> waiting to be claimed. As soon as one is assigned to an agent it moves to the Agents section.</>}
        </div>
      ) : section === 'agents' ? (
        <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>
          Tracking{' '}
          <strong style={{ color: 'var(--accent)' }}>{cases.length} active customer{cases.length !== 1 ? 's' : ''}</strong>{' '}
          across{' '}
          <strong style={{ color: 'var(--accent)' }}>{stages.length} pipeline stage{stages.length !== 1 ? 's' : ''}</strong>.{' '}
          {needActionCount > 0 && (
            <><strong style={{ color: 'oklch(0.45 0.20 25)' }}>{needActionCount}</strong> need{needActionCount === 1 ? 's' : ''} an update today.{' '}</>
          )}
          {totalOutstanding > 0 && <>Total outstanding: <strong style={{ color: 'oklch(0.38 0.18 145)' }}>${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>.</>}
        </div>
      ) : section === 'no_update' ? (
        <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>
          {noUpdateCount === 0
            ? 'No cases marked as no update needed.'
            : <><strong style={{ color: 'oklch(0.36 0.15 145)' }}>{noUpdateCount} case{noUpdateCount !== 1 ? 's' : ''}</strong> marked as no update needed. These customers do not require daily update logs and are excluded from the update-due counter.</>}
        </div>
      ) : section === 'unreachable' ? (
        <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>
          {unreachableCount === 0
            ? 'No customers marked as unreachable.'
            : <><strong style={{ color: 'oklch(0.40 0.18 290)' }}>{unreachableCount} customer{unreachableCount !== 1 ? 's' : ''}</strong> marked as unreachable. These cases are excluded from the update-due counter until contact is re-established.</>}
        </div>
      ) : (
        <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>
          {escalatedCount === 0
            ? 'No escalated cases. All customers are being handled by agents.'
            : <><strong style={{ color: 'oklch(0.40 0.20 25)' }}>{escalatedCount} case{escalatedCount !== 1 ? 's' : ''}</strong> escalated and waiting for admin review. These have been flagged by agents and require management action.</>}
        </div>
      )}
    </div>
  );

  /* ── Toolbar ────────────────────────────────────────────────── */
  const toolbar = (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Section tabs */}
        <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 3, gap: 2 }}>
          {!labOnly && (<>
          <button onClick={() => setSection('agents')}
            style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: section === 'agents' ? 'white' : 'transparent', color: section === 'agents' ? 'var(--ink)' : 'var(--ink-4)', boxShadow: section === 'agents' ? 'var(--sh-1)' : 'none' }}>
            Agents · {agentsCount}
          </button>
          <button onClick={() => setSection('new')}
            style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: section === 'new' ? 'oklch(0.92 0.06 200)' : 'transparent', color: section === 'new' ? 'oklch(0.36 0.16 200)' : (newOrdersCount > 0 ? 'oklch(0.44 0.16 200)' : 'var(--ink-4)'), boxShadow: section === 'new' ? 'var(--sh-1)' : 'none' }}>
            🆕 New · {newOrdersCount}
          </button>
          <button onClick={() => setSection('admin')}
            style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: section === 'admin' ? (escalatedCount > 0 ? 'oklch(0.92 0.06 25)' : 'white') : 'transparent', color: section === 'admin' ? (escalatedCount > 0 ? 'oklch(0.38 0.20 25)' : 'var(--ink)') : (escalatedCount > 0 ? 'oklch(0.45 0.18 25)' : 'var(--ink-4)'), boxShadow: section === 'admin' ? 'var(--sh-1)' : 'none' }}>
            {escalatedCount > 0 ? '⚠ ' : ''}Admin · {escalatedCount}
          </button>
          <button onClick={() => setSection('no_update')}
            style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: section === 'no_update' ? 'oklch(0.93 0.05 145)' : 'transparent', color: section === 'no_update' ? 'oklch(0.36 0.15 145)' : 'var(--ink-4)', boxShadow: section === 'no_update' ? 'var(--sh-1)' : 'none' }}>
            ✓ No Update Needed · {noUpdateCount}
          </button>
          <button onClick={() => setSection('unreachable')}
            style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: section === 'unreachable' ? 'oklch(0.92 0.06 290)' : 'transparent', color: section === 'unreachable' ? 'oklch(0.38 0.18 290)' : (unreachableCount > 0 ? 'oklch(0.45 0.15 290)' : 'var(--ink-4)'), boxShadow: section === 'unreachable' ? 'var(--sh-1)' : 'none' }}>
            📵 Unreachable · {unreachableCount}
          </button>
          <button onClick={() => setSection('my_cases')} title="Only the cases assigned to you"
            style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: section === 'my_cases' ? 'oklch(0.55 0.16 250)' : 'transparent', color: section === 'my_cases' ? 'white' : 'var(--ink-4)', boxShadow: section === 'my_cases' ? 'var(--sh-1)' : 'none' }}>
            👤 My Cases · {myCasesCount}
          </button>
          <button onClick={() => setSection('labels')} title="Shipping labels bought in Shippo and ready to print"
            style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: section === 'labels' ? 'oklch(0.55 0.15 170)' : 'transparent', color: section === 'labels' ? 'white' : (labelsReadyCount > 0 ? 'oklch(0.42 0.14 170)' : 'var(--ink-4)'), boxShadow: section === 'labels' ? 'var(--sh-1)' : 'none' }}>
            🖨 Labels Ready · {labelsReadyCount}
          </button>
          </>)}
          {canViewLab && (
          <button onClick={() => setSection('lab')} title="Impression kits in transit to the lab — receive, scan, mark in production"
            style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: section === 'lab' ? 'oklch(0.52 0.16 300)' : 'transparent', color: section === 'lab' ? 'white' : (labCount > 0 ? 'oklch(0.44 0.15 300)' : 'var(--ink-4)'), boxShadow: section === 'lab' ? 'var(--sh-1)' : 'none' }}>
            🧪 Lab · {labCount}
          </button>
          )}
          {!labOnly && (<>
          <button onClick={() => setSection('issues')} title="Completed orders the customer flagged issues on"
            style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: section === 'issues' ? 'oklch(0.55 0.18 25)' : 'transparent', color: section === 'issues' ? 'white' : (issuesCount > 0 ? 'oklch(0.45 0.18 25)' : 'var(--ink-4)'), boxShadow: section === 'issues' ? 'var(--sh-1)' : 'none' }}>
            ⚠ Issues · {issuesCount}
          </button>
          <button onClick={() => setSection('completed_success')} title="Completed orders with no issues"
            style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: section === 'completed_success' ? 'oklch(0.50 0.16 145)' : 'transparent', color: section === 'completed_success' ? 'white' : (completedSuccessCount > 0 ? 'oklch(0.40 0.15 145)' : 'var(--ink-4)'), boxShadow: section === 'completed_success' ? 'var(--sh-1)' : 'none' }}>
            ✓ Completed Success · {completedSuccessCount}
          </button>
          </>)}
        </div>
        {!labOnly && (<>
        <div style={{ width: 1, height: 22, background: 'var(--line)', margin: '0 2px' }} />
        {(section === 'agents' || section === 'new') && <button className="btn btn-acc btn-sm" onClick={() => openAdd()}>+ Add customer</button>}
        {isOwner && section === 'agents' && <button className="btn btn-sec btn-sm" onClick={() => setShowAddCol(true)}>+ Add column</button>}
        <button className="btn btn-sec btn-sm" onClick={exportCSV}>Export CSV</button>
        <div style={{ flex: 1 }} />
        <input type="text" placeholder="Search name, phone, issue…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          className="fld-input" style={{ height: 34, width: 220, fontSize: 13 }} />
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 8, padding: 3 }}>
          {(['overview','board','table'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: viewMode === m ? 'white' : 'transparent', color: viewMode === m ? 'var(--ink)' : 'var(--ink-4)', boxShadow: viewMode === m ? 'var(--sh-1)' : 'none', textTransform: 'capitalize' }}>
              {m === 'overview' ? 'Overview' : m === 'board' ? 'Board' : 'Table'}
            </button>
          ))}
        </div>
        </>)}
      </div>
    </div>
  );

  /* ── Overview cards ─────────────────────────────────────────── */
  const overviewView = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 14 }}>
      {filtered.length === 0 && (
        <div className="card" style={{ gridColumn: '1/-1', padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
          {section === 'my_cases' ? 'No cases are assigned to you right now.' : section === 'admin' ? 'No escalated cases. All customers are being handled by agents.' : section === 'no_update' ? 'No cases marked as no update needed.' : section === 'unreachable' ? 'No customers marked as unreachable.' : section === 'new' ? 'No new orders waiting — every active customer is assigned to an agent.' : section === 'issues' ? 'No completed orders with issues.' : section === 'completed_success' ? 'No completed orders yet.' : 'No customer cases found.'}
        </div>
      )}
      {filtered.map(c => {
        const upds = caseUpdates(c.id);
        const latest = upds[0];
        const border = c.on_hold ? 'oklch(0.60 0 0)' : sColor();
        const updateDue = needsUpdate(c);
        const fullPrice = Number(c.full_price) || 0;
        const collectedAmt = Number(c.amount_collected) || 0;
        const collectedPct = fullPrice > 0 ? Math.min(100, Math.round((collectedAmt / fullPrice) * 100)) : null;
        const stamp = shipStampFor(c);
        const stagesDoneCount = Array.isArray(c.stages_done) ? c.stages_done.length : 0;
        const stagePct = Math.round((stagesDoneCount / PIPELINE_STAGES.length) * 100);
        return (
          <div key={c.id} onClick={() => { setSelectedCase(c); markCaseRead(c.id); }}
            style={{ position: 'relative', background: 'white', border: '1px solid var(--line)', borderLeft: `4px solid ${border}`, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow .12s, transform .12s', outline: updateDue ? '1.5px solid oklch(0.80 0.12 80)' : 'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--sh-2)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = ''; (e.currentTarget as HTMLDivElement).style.transform = ''; }}>
            <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              {stamp ? (
                <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.04em', padding: '4px 10px', borderRadius: 8, color: STAMP_STYLE[stamp].color, background: STAMP_STYLE[stamp].bg, border: `2px solid ${STAMP_STYLE[stamp].color}`, transform: 'rotate(4deg)', textTransform: 'uppercase' }}>
                  {STAMP_STYLE[stamp].icon} {stamp}
                </span>
              ) : collectedPct != null && (
                <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20, color: 'oklch(0.38 0.16 145)', background: 'oklch(0.95 0.05 145)', border: '1px solid oklch(0.85 0.07 145)' }}>
                  {collectedPct}% paid
                </span>
              )}
              <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20, color: 'oklch(0.38 0.16 260)', background: 'oklch(0.95 0.05 260)', border: '1px solid oklch(0.85 0.07 260)' }}>
                {stagePct}% stage
              </span>
            </div>
            <div style={{ padding: `14px ${stamp ? 170 : 86}px 10px 16px`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'oklch(0.50 0.20 200)', color: 'white', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {initials(c.customer_name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{c.customer_name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                    background: c.source === 'Shopify' ? 'oklch(0.93 0.08 150)' : 'oklch(0.93 0.04 250)',
                    color: c.source === 'Shopify' ? 'oklch(0.40 0.14 150)' : 'oklch(0.40 0.12 250)' }}>
                    {c.source === 'Shopify' ? '🛒 Shopify' : '🗂 CRM'}
                  </span>
                  {c.order_number && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'oklch(0.93 0.05 80)', color: 'oklch(0.38 0.15 80)' }}>📦 Order #{c.order_number}</span>}
                  {c.escalated && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'oklch(0.92 0.06 25)', color: 'oklch(0.40 0.20 25)' }}>⚠ ESCALATED</span>}
                  {c.on_hold && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'oklch(0.92 0 0)', color: 'oklch(0.45 0 0)' }}>🔒 ON HOLD</span>}
                  {c.no_update_needed && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'oklch(0.92 0.05 145)', color: 'oklch(0.36 0.15 145)' }}>✓ NO UPDATE</span>}
                  {c.unreachable && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'oklch(0.92 0.06 290)', color: 'oklch(0.38 0.18 290)' }}>📵 UNREACHABLE</span>}
                  {updateDue && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'oklch(0.94 0.06 80)', color: 'oklch(0.40 0.18 80)' }}>⚠ UPDATE DUE</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {c.phone && <span>📞 {c.phone}</span>}
                  {c.email && <span>✉ {c.email}</span>}
                  {c.address && <span>📍 {c.address}</span>}
                </div>
                {reassigningCaseId === c.id ? (
                  <div onClick={e => e.stopPropagation()} style={{ marginTop: 6, display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select value={reassignValue} onChange={e => setReassignValue(e.target.value)}
                      style={{ fontSize: 11, height: 26, borderRadius: 6, border: '1px solid var(--line)', padding: '0 6px', color: 'var(--ink)' }}>
                      <option value="">Unassigned</option>
                      {allProfiles.filter((p: any) => ['cx','owner','admin','supervisor'].includes(p.role)).map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button onClick={() => handleReassignCase(c, reassignValue)}
                      style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer' }}>
                      Assign
                    </button>
                    <button onClick={() => { setReassigningCaseId(null); setReassignValue(''); }}
                      style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'none', border: '1px solid var(--line)', cursor: 'pointer', color: 'var(--ink-4)' }}>
                      ✕
                    </button>
                  </div>
                ) : c.assigned_to ? (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-5)' }}>AGENT</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'oklch(0.94 0.05 260)', color: 'oklch(0.38 0.15 260)', border: '1px solid oklch(0.88 0.06 260)' }}>
                      {nameMap[c.assigned_to] ?? 'Unknown'}
                    </span>
                    {daysOpen(c.created_at) < 2 && (
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: 'oklch(0.92 0.08 145)', color: 'oklch(0.32 0.16 145)', letterSpacing: '0.04em' }}>NEW</span>
                    )}
                    {isAdminOrOwner && (
                      <button onClick={e => { e.stopPropagation(); setReassigningCaseId(c.id); setReassignValue(c.assigned_to ?? ''); }}
                        style={{ fontSize: 10, background: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 6px', cursor: 'pointer', color: 'var(--ink-4)' }}>
                        Reassign
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={e => { e.stopPropagation(); handleClaimCase(c); }}
                      style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'oklch(0.96 0.04 260)', color: 'oklch(0.38 0.16 260)', border: '1.5px dashed oklch(0.75 0.10 260)', cursor: 'pointer' }}>
                      + Claim Customer Case
                    </button>
                    {daysOpen(c.created_at) < 2 && (
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: 'oklch(0.92 0.08 145)', color: 'oklch(0.32 0.16 145)', letterSpacing: '0.04em' }}>NEW</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: '0 16px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--ink-4)', border: '1px solid var(--line)' }}>{c.pipeline_stage}</span>
            </div>
            {c.issue && (
              <div style={{ padding: '0 16px 10px', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {c.issue}
              </div>
            )}
            {section === 'admin' && c.escalation_note && (
              <div style={{ margin: '0 16px 10px', padding: '8px 12px', background: 'oklch(0.96 0.04 25)', borderRadius: 8, borderLeft: '3px solid oklch(0.55 0.20 25)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.45 0.20 25)', letterSpacing: '0.06em', marginBottom: 3 }}>⚠ ESCALATION REASON</div>
                <div style={{ fontSize: 12, color: 'oklch(0.30 0.05 25)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.escalation_note}</div>
              </div>
            )}
            {latest && (
              <div style={{ margin: '0 16px 10px', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8, borderLeft: '3px solid var(--line)' }}>
                <div style={{ fontSize: 10, color: 'var(--ink-5)', marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
                  <span>LATEST · {latest.update_date}</span>
                  <span>by {nameMap[latest.logged_by]?.split(' ')[0] ?? '?'}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{latest.note}</div>
              </div>
            )}
            <div style={{ padding: '8px 16px', borderTop: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {c.pay_status && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: (PAY_META[c.pay_status] ?? {}).bg ?? 'var(--surface-2)', color: (PAY_META[c.pay_status] ?? {}).color ?? 'var(--ink-4)' }}>{c.pay_status.toUpperCase()}</span>
              )}
              {c.payment_left != null && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>${Number(c.payment_left).toLocaleString('en-US',{minimumFractionDigits:2})} left</span>}
              {unreadCounts[c.id] > 0 ? (
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, padding: '3px 11px', borderRadius: 999, background: 'oklch(0.91 0.09 145)', color: 'oklch(0.28 0.16 145)', border: '1.5px solid oklch(0.78 0.13 145)' }}>
                  {unreadCounts[c.id] === 1 ? '1 new update' : `${unreadCounts[c.id]} new updates`}
                </span>
              ) : (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-5)' }}>{caseUpdates(c.id).length} update{caseUpdates(c.id).length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ── Board view ─────────────────────────────────────────────── */
  const boardView = (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' }}>
      {stages.map(stage => {
        const cols = filtered.filter(c => c.pipeline_stage === stage);
        return (
          <div key={stage} style={{ minWidth: 240, maxWidth: 260, flex: '0 0 250px' }}>
            <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: '10px 10px 0 0', border: '1px solid var(--line)', borderBottom: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--ink-3)' }}>{stage}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>{cols.length}</div>
              </div>
              <button onClick={() => openAdd(stage)} style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px dashed var(--line)', background: 'transparent', color: 'var(--ink-4)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: '0 0 10px 10px', overflow: 'hidden', background: 'var(--surface)' }}>
              {cols.length === 0 && <div style={{ padding: '18px 14px', textAlign: 'center', color: 'var(--ink-5)', fontSize: 12 }}>—</div>}
              {cols.map((c, i) => (
                <div key={c.id} onClick={() => { setSelectedCase(c); markCaseRead(c.id); }}
                  style={{ padding: '12px 14px', borderBottom: i < cols.length - 1 ? '1px solid var(--line-2)' : 'none', cursor: 'pointer', borderLeft: `3px solid ${c.on_hold ? 'oklch(0.60 0 0)' : sColor()}`, background: 'white', transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'white'}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{c.customer_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-5)', marginBottom: 6 }}>{c.phone}</div>
                  {c.issue && <div style={{ fontSize: 12, color: 'var(--ink-4)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.45 }}>{c.issue}</div>}
                  <div style={{ marginTop: 8, display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    {c.on_hold && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'oklch(0.92 0 0)', color: 'oklch(0.45 0 0)' }}>ON HOLD</span>}
                    {needsUpdate(c) && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'oklch(0.94 0.06 80)', color: 'oklch(0.40 0.18 80)' }}>⚠</span>}
                    {unreadCounts[c.id] > 0 && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: 'oklch(0.91 0.09 145)', color: 'oklch(0.28 0.16 145)', border: '1px solid oklch(0.78 0.13 145)' }}>
                        {unreadCounts[c.id] === 1 ? '1 new update' : `${unreadCounts[c.id]} new updates`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ── Table view ─────────────────────────────────────────────── */
  const tableView = (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
              {['Customer','Phone','Stage','Issue','Payment Left','Pay Status','Latest Update'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--ink-4)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const latest = caseUpdates(c.id)[0];
              const paym = PAY_META[c.pay_status] ?? {};
              return (
                <tr key={c.id} onClick={() => { setSelectedCase(c); markCaseRead(c.id); }}
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--line-2)' : 'none', cursor: 'pointer', borderLeft: `3px solid ${c.on_hold ? 'oklch(0.60 0 0)' : sColor()}` }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                    {c.customer_name}
                    {needsUpdate(c) && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, background: 'oklch(0.94 0.06 80)', color: 'oklch(0.40 0.18 80)' }}>⚠</span>}
                    {unreadCounts[c.id] > 0 && (
                      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: 'oklch(0.91 0.09 145)', color: 'oklch(0.28 0.16 145)', border: '1px solid oklch(0.78 0.13 145)' }}>
                        {unreadCounts[c.id] === 1 ? '1 new update' : `${unreadCounts[c.id]} new updates`}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>{c.phone}</td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-4)' }}>{c.pipeline_stage}</span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--ink-3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.issue}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{c.payment_left != null ? `$${Number(c.payment_left).toLocaleString('en-US',{minimumFractionDigits:2})}` : '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {c.pay_status ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: (paym as any).bg ?? 'var(--surface-2)', color: (paym as any).color ?? 'var(--ink-4)' }}>{c.pay_status}</span> : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--ink-4)', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {latest ? <><span style={{ color: 'var(--ink-5)', marginRight: 4 }}>{latest.update_date}</span>{latest.note}</> : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>No customer cases found.</div>}
      </div>
    </div>
  );

  /* ── Case detail modal ──────────────────────────────────────── */
  const stagesDone: string[]     = selectedCase?.stages_done     ?? [];
  const exceptionFlags: string[] = selectedCase?.exception_flags ?? [];

  // Veneers can ship once ≥90% of the balance is collected — that earns the
  // "Ready to be shipped" stamp and unlocks the "Create veneers label" button.
  const vFull      = Number(selectedCase?.full_price) || 0;
  const vCollected = Number(selectedCase?.amount_collected) || 0;
  const veneersPct = vFull > 0 ? (vCollected / vFull) * 100 : 0;
  const veneersReady = veneersPct >= 90;

  // Shipping → delivery stamp lifecycle (shared with the outer card).
  const shipStamp = shipStampFor(selectedCase);

  const detailModal = selectedCase && (
    <div className="mb" onClick={e => { if (e.target === e.currentTarget) { setSelectedCase(null); setShowHoldInput(false); setReassigningCaseId(null); setReassignValue(''); } }}>
      <div className="md" style={{ width: 820, maxHeight: '95vh', overflowY: 'auto', padding: 0 }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: sColor(), color: 'white', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {initials(selectedCase.customer_name)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>{selectedCase.customer_name}</span>
              {selectedCase.order_number && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13, padding: '4px 12px', borderRadius: 20, background: 'oklch(0.93 0.05 80)', color: 'oklch(0.38 0.15 80)' }}>
                  📦 Order #{selectedCase.order_number}
                </span>
              )}
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
                background: selectedCase.source === 'Shopify' ? 'oklch(0.93 0.08 150)' : 'oklch(0.93 0.04 250)',
                color: selectedCase.source === 'Shopify' ? 'oklch(0.40 0.14 150)' : 'oklch(0.40 0.12 250)' }}>
                {selectedCase.source === 'Shopify' ? '🛒 Source: Shopify' : '🗂 Source: CRM'}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>{selectedCase.pipeline_stage}</span>
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {selectedCase.phone && <span>📞 {selectedCase.phone}</span>}
              {selectedCase.email && <span>✉ {selectedCase.email}</span>}
              {selectedCase.address && <span>📍 {selectedCase.address}</span>}
            </div>
            {/* Referral / Push-to-customer actions */}
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {selectedCase.ghl_contact_id && (
                <a href={ghlContactUrl(selectedCase.ghl_contact_id, ghlLocationId)} target="_blank" rel="noopener noreferrer"
                  className="btn btn-sec btn-sm" title="Open this contact in GoHighLevel"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
                  🔗 Go to CRM
                </a>
              )}
              <button className="btn btn-sec btn-sm" onClick={() => setShowReferralAdd(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                ★ Referral{(selectedCase.referrals?.length ?? 0) > 0 ? ` · ${selectedCase.referrals.length}` : ''}
              </button>
              <button className="btn btn-sec btn-sm" onClick={handlePushToCustomer} disabled={pushing}
                style={selectedCase.pushed_to_customer_at
                  ? { background: 'oklch(0.93 0.05 145)', color: 'oklch(0.34 0.15 145)', border: '1px solid oklch(0.82 0.08 145)', display: 'flex', alignItems: 'center', gap: 5 }
                  : { display: 'flex', alignItems: 'center', gap: 5 }}>
                {pushing ? 'Pushing…' : selectedCase.pushed_to_customer_at ? '✓ Pushed — update customer' : '↗ Push to customer'}
              </button>
              <button className="btn btn-acc btn-sm" onClick={() => openLabel('imp_kit_2')} disabled={creatingLabel}
                title="Send the impression kit to Shippo" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {creatingLabel ? 'Sending…' : '🏷 Impression kit label'}
              </button>
              <button className="btn btn-acc btn-sm" onClick={() => openLabel('veneers')} disabled={creatingLabel || !veneersReady}
                title={veneersReady ? 'Send the veneers to Shippo' : 'Collect at least 90% of the veneers payment first'}
                style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: veneersReady ? 1 : 0.55 }}>
                {creatingLabel ? 'Sending…' : '🦷 Create veneers label'}
              </button>
            </div>
            {showReferralAdd && (
              <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input value={referralDraft.name} onChange={e => setReferralDraft(p => ({ ...p, name: e.target.value }))}
                    placeholder="Referred person's name" className="fld-input" style={{ height: 30, fontSize: 12, flex: 1, minWidth: 140 }} autoFocus />
                  <input value={referralDraft.phone} onChange={e => setReferralDraft(p => ({ ...p, phone: e.target.value }))}
                    placeholder="Phone / email" className="fld-input" style={{ height: 30, fontSize: 12, flex: 1, minWidth: 120 }} />
                  <button className="btn btn-acc btn-sm" disabled={!referralDraft.name.trim()}
                    onClick={() => { addLogEntry('referrals', { name: referralDraft.name.trim(), phone: referralDraft.phone.trim() }); setReferralDraft({ name: '', phone: '' }); setShowReferralAdd(false); }}>
                    Add referral
                  </button>
                </div>
                {(selectedCase.referrals?.length ?? 0) > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {selectedCase.referrals.map((r: any) => (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-3)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{r.name}</span>
                        {r.phone && <span style={{ color: 'var(--ink-4)' }}>{r.phone}</span>}
                        <span style={{ color: 'var(--ink-5)', fontSize: 11 }}>· {r.date}</span>
                        <button onClick={() => removeLogEntry('referrals', r.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 13 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {reassigningCaseId === selectedCase.id ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select value={reassignValue} onChange={e => setReassignValue(e.target.value)}
                    style={{ fontSize: 12, height: 28, borderRadius: 6, border: '1px solid var(--line)', padding: '0 8px', color: 'var(--ink)' }}>
                    <option value="">Unassigned</option>
                    {allProfiles.filter((p: any) => ['cx','owner','admin','supervisor'].includes(p.role)).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button className="btn btn-acc btn-sm" onClick={() => handleReassignCase(selectedCase, reassignValue)}>Assign</button>
                  <button className="btn btn-sec btn-sm" onClick={() => { setReassigningCaseId(null); setReassignValue(''); }}>Cancel</button>
                </div>
              ) : selectedCase.assigned_to ? (
                <>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-5)' }}>Agent:</span>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'oklch(0.94 0.05 260)', color: 'oklch(0.38 0.15 260)', border: '1px solid oklch(0.88 0.06 260)' }}>
                    {nameMap[selectedCase.assigned_to] ?? 'Unknown'}
                  </span>
                  {isAdminOrOwner && (
                    <button className="btn btn-sec btn-sm" onClick={() => { setReassigningCaseId(selectedCase.id); setReassignValue(selectedCase.assigned_to ?? ''); }}>
                      Reassign
                    </button>
                  )}
                </>
              ) : (
                <>
                  <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>Unassigned</span>
                  <button className="btn btn-sm" style={{ background: 'oklch(0.94 0.05 260)', color: 'oklch(0.38 0.15 260)', border: '1px solid oklch(0.88 0.06 260)' }}
                    onClick={() => handleClaimCase(selectedCase)}>
                    Claim Customer Case
                  </button>
                  {isAdminOrOwner && (
                    <button className="btn btn-sec btn-sm" onClick={() => { setReassigningCaseId(selectedCase.id); setReassignValue(''); }}>
                      Assign to agent
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <button onClick={() => { setSelectedCase(null); setShowHoldInput(false); setReassigningCaseId(null); setReassignValue(''); }} style={{ background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid var(--line)' }}>
          {[
            { label: 'PAYMENT', value: selectedCase.pay_status ?? '—', sub: selectedCase.payment_left != null ? `$${Number(selectedCase.payment_left).toFixed(2)} left` : 'No balance', valueColor: (PAY_META[selectedCase.pay_status]??{}).color ?? 'var(--ink)' },
            { label: 'DAYS OPEN', value: String(daysOpen(selectedCase.created_at)), sub: 'Since first update', valueColor: 'var(--ink)' },
            { label: 'UPDATES', value: String(caseUpdates(selectedCase.id).length), sub: 'Logged on file', valueColor: 'var(--ink)' },
          ].map((st, i) => (
            <div key={st.label} style={{ padding: '14px 18px', borderRight: i < 2 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-4)', marginBottom: 4 }}>{st.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: st.valueColor, display: 'flex', alignItems: 'center', gap: 6 }}>
                {st.value}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 2 }}>{st.sub}</div>
            </div>
          ))}
        </div>

        {/* On hold banner */}
        {selectedCase.on_hold && (
          <div style={{ padding: '10px 24px', background: 'oklch(0.96 0.01 0)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13 }}>🔒</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' }}>On hold: {selectedCase.hold_reason || 'No reason specified'}</span>
            <button onClick={() => handleToggleHold(selectedCase)} style={{ marginLeft: 'auto', fontSize: 12, background: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', color: 'var(--ink-4)' }}>Remove hold</button>
          </div>
        )}

        {/* Order details */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, background: 'oklch(0.92 0.05 260)', color: 'oklch(0.40 0.16 260)', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>▣</span>
              Order details
            </div>
            <button className="btn btn-sec btn-sm" onClick={() => { openEdit(selectedCase); setSelectedCase(null); }}>✎ Edit</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'VENEER SET', value: selectedCase.veneer_set },
              { label: 'VENEER SHADE', value: selectedCase.veneer_shade },
              { label: 'SHIPPING', value: selectedCase.shipping },
            ].map(d => (
              <div key={d.label}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-4)', marginBottom: 4 }}>{d.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: d.value ? 'var(--ink)' : 'var(--ink-5)' }}>{d.value || '—'}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-4)', marginBottom: 4 }}>SPECIAL REQUEST NOTES</div>
            <div style={{ fontSize: 13, color: selectedCase.special_request ? 'var(--ink-3)' : 'var(--ink-5)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{selectedCase.special_request || '—'}</div>
          </div>
        </div>

        {/* Next-step guide for the current stage */}
        {(() => {
          const curKey = PIPELINE_STAGES[Math.min(stagesDone.length, PIPELINE_STAGES.length - 1)]?.key;
          const guide = curKey ? STAGE_GUIDE[curKey] : undefined;
          const curLabel = PIPELINE_STAGES.find(s => s.key === curKey)?.label ?? '';
          const checked: number[] = (selectedCase.stage_checklist ?? {})[curKey] ?? [];
          // Lab-controlled stages show no agent guide — they're ticked from the Lab tab.
          if (curKey && LAB_LOCKED_STAGES.has(curKey)) {
            return (
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)', background: 'oklch(0.98 0.02 25)' }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: 'oklch(0.48 0.18 25)', marginBottom: 6 }}>
                  🔒 {curLabel.toUpperCase()} · LAB-CONTROLLED
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                  This stage is updated automatically from the Lab tab — there are no steps to complete here.
                </div>
              </div>
            );
          }
          if (!guide) return null;
          return (
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)', background: 'oklch(0.985 0.012 255)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: 'oklch(0.45 0.16 260)', marginBottom: 6 }}>
                ▶ NEXT STEP GUIDE · {curLabel.toUpperCase()}
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, marginBottom: 12 }}>{guide.summary}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {guide.steps.map((step, idx) => {
                  const isDone = checked.includes(idx);
                  return (
                    <button key={idx} onClick={() => handleToggleGuideStep(curKey, idx)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                        background: isDone ? 'oklch(0.95 0.04 145)' : 'white',
                        border: `1px solid ${isDone ? 'oklch(0.82 0.08 145)' : 'var(--line)'}` }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isDone ? 'oklch(0.55 0.16 145)' : 'transparent',
                        border: isDone ? 'none' : '2px solid oklch(0.80 0.02 260)' }}>
                        {isDone && <span style={{ color: 'white', fontSize: 11, fontWeight: 900 }}>✓</span>}
                      </span>
                      <span style={{ fontSize: 13, color: isDone ? 'oklch(0.34 0.14 145)' : 'var(--ink-3)', fontWeight: isDone ? 600 : 500 }}>{step}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: isDone ? 'oklch(0.40 0.15 145)' : 'var(--ink-5)' }}>
                        {isDone ? 'Yes ✓' : 'Mark yes'}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 8 }}>
                ↑ Answer every step <strong>Yes</strong> and the case moves to the next stage automatically.
              </div>
              {curKey === 'pre_imp_appointment' && (
                <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 8, background: 'white', border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>Virtual appointment — create the meeting and send the link to the customer</div>
                  <a href="https://www.sylaps.com" target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                      textDecoration: 'none', cursor: 'pointer', background: 'oklch(0.50 0.16 260)', color: 'white', border: 'none' }}>
                    🎥 Create meeting
                  </a>
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>Recording Upload — upload the appointment recording when you finish</div>
                    <input ref={recInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleRecordingSelected} />
                    <button onClick={() => recInputRef.current?.click()} disabled={recUploading}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                        cursor: recUploading ? 'default' : 'pointer', background: recUploading ? 'var(--line)' : 'oklch(0.50 0.16 200)', color: 'white', border: 'none' }}>
                      {recUploading ? 'Uploading…' : '⬆ Upload recording'}
                    </button>
                    {(selectedCase.recording_uploads ?? []).length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                        {(selectedCase.recording_uploads ?? []).map((r: any) => (
                          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                            <span>🎬</span>
                            <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: 'oklch(0.45 0.16 200)', fontWeight: 600, textDecoration: 'none' }}>{r.file_name || 'Recording'}</a>
                            <span style={{ color: 'var(--ink-5)' }}>· {nameMap[r.by] || 'Agent'} · {r.date}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {curKey === 'imp_kit_sent' && (
                <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 8, background: 'white', border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>Impression Kit ETA — when will the kit arrive at the customer?</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <input type="date" value={selectedCase.imp_kit_eta_date ?? ''} onChange={e => patchCase({ imp_kit_eta_date: e.target.value || null })}
                      className="fld-input" style={{ height: 34, width: 180, fontSize: 13 }} />
                    {selectedCase.imp_kit_eta_date
                      ? <span style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.44 0.15 200)' }}>📬 {fmtEta(selectedCase.imp_kit_eta_date)}</span>
                      : <span style={{ fontSize: 12, color: 'var(--ink-5)' }}>Enter the estimated delivery date — the day of the week fills in automatically</span>}
                  </div>
                </div>
              )}
              {curKey === 'imp_kit_on_way_to_lab' && (
                <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 8, background: 'white', border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>Lab ETA — when will the kit arrive at the lab?</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <input type="date" value={selectedCase.lab_eta_date ?? ''} onChange={e => patchCase({ lab_eta_date: e.target.value || null })}
                      className="fld-input" style={{ height: 34, width: 180, fontSize: 13 }} />
                    {selectedCase.lab_eta_date
                      ? <span style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.44 0.15 300)' }}>🧪 {fmtEta(selectedCase.lab_eta_date)} · now in the Lab tab</span>
                      : <span style={{ fontSize: 12, color: 'var(--ink-5)' }}>Pick the date the kit will reach the lab — that adds the customer to the Lab tab</span>}
                  </div>
                </div>
              )}
              {curKey === 'shipping_veneers' && (
                <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 8, background: 'white', border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>Create the veneers label</div>
                  <button className="btn btn-acc btn-sm" onClick={() => openLabel('veneers')} disabled={creatingLabel || !veneersReady}
                    title={veneersReady ? 'Send the veneers to Shippo' : 'Collect at least 90% of the veneers payment first'}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: veneersReady ? 1 : 0.55 }}>
                    {creatingLabel ? 'Sending…' : '🦷 Create veneers label'}
                  </button>
                  {!veneersReady && <span style={{ fontSize: 12, color: 'var(--ink-5)', marginLeft: 10 }}>Collect at least 90% of the veneers payment first to unlock this.</span>}
                </div>
              )}
              {(curKey === 'veneers_shipped' || curKey === 'veneers_delivered') && (
                <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 8, background: 'white', border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>Delivery ETA — when will the veneers arrive?</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <input type="date" value={selectedCase.veneers_eta_date ?? ''} onChange={e => patchCase({ veneers_eta_date: e.target.value || null })}
                      className="fld-input" style={{ height: 34, width: 180, fontSize: 13 }} />
                    {selectedCase.veneers_eta_date
                      ? <span style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.40 0.16 145)' }}>📦 {fmtEta(selectedCase.veneers_eta_date)} · stamp flips to Delivered on this date</span>
                      : <span style={{ fontSize: 12, color: 'var(--ink-5)' }}>Pick the expected delivery date — the stamp flips to Delivered when it arrives (you still check the stage off after reading the guide)</span>}
                  </div>
                </div>
              )}
              {curKey === 'completed_no_issues' && (() => {
                const outcome = selectedCase.completed_outcome;
                return (
                  <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 8, background: 'white', border: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>Are there any issues with the veneers?</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => patchCase({ completed_outcome: 'issues' })}
                        style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                          border: `1.5px solid ${outcome === 'issues' ? 'oklch(0.55 0.18 25)' : 'var(--line)'}`,
                          background: outcome === 'issues' ? 'oklch(0.55 0.18 25)' : 'white',
                          color: outcome === 'issues' ? 'white' : 'var(--ink-3)' }}>
                        {outcome === 'issues' ? '✓ ' : ''}Yes — there are issues
                      </button>
                      <button onClick={() => patchCase({ completed_outcome: 'success' })}
                        style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                          border: `1.5px solid ${outcome === 'success' ? 'oklch(0.50 0.16 145)' : 'var(--line)'}`,
                          background: outcome === 'success' ? 'oklch(0.50 0.16 145)' : 'white',
                          color: outcome === 'success' ? 'white' : 'var(--ink-3)' }}>
                        {outcome === 'success' ? '✓ ' : ''}No — all good
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-5)', marginTop: 8 }}>
                      {outcome === 'issues'
                        ? 'On completing the stage below, this profile moves to the Issues tab (full history kept).'
                        : outcome === 'success'
                        ? 'On completing the stage below, this profile moves to the Completed Success tab (full history kept).'
                        : 'Pick an answer, then check the Completed stage below to file the order — the profile moves automatically.'}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* Payment */}
        {(() => {
          const full = Number(selectedCase.full_price) || 0;
          const collected = Number(selectedCase.amount_collected) || 0;
          const left = full > 0 ? Math.max(0, full - collected) : (Number(selectedCase.payment_left) || 0);
          const pct = full > 0 ? Math.min(100, Math.round((collected / full) * 100)) : 0;
          const complete = full > 0 && collected >= full;
          const accent = complete ? 145 : 25;
          return (
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: `oklch(0.45 0.18 ${accent})`, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: `oklch(0.55 0.20 ${accent})` }} />
                    PAYMENT — {complete ? 'PAID IN FULL' : 'COLLECTION INCOMPLETE'}
                  </div>
                  {shipStamp && (
                    <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.04em', padding: '4px 12px', borderRadius: 999, background: STAMP_STYLE[shipStamp].bg, color: STAMP_STYLE[shipStamp].color, border: `1.5px solid ${STAMP_STYLE[shipStamp].border}`, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {shipStamp === 'DELIVERED' ? '📦 ' : shipStamp === 'VENEERS SHIPPED' ? '🚚 ' : '✓ '}{shipStamp}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {full > 0 && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                      <span style={{ fontSize: 26, fontWeight: 900, color: `oklch(0.45 0.18 ${accent})`, lineHeight: 1 }}>{pct}%</span>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)' }}>COLLECTED</span>
                    </div>
                  )}
                  {full > 0 && !complete && (
                    <span style={{ fontSize: 12, fontWeight: 800, padding: '3px 11px', borderRadius: 999, background: 'oklch(0.55 0.20 25)', color: 'white' }}>
                      ${left.toLocaleString('en-US', { minimumFractionDigits: 0 })} still owed
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-4)', marginBottom: 2 }}>FULL PRICE</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)' }}>${full.toLocaleString('en-US', { minimumFractionDigits: 0 })}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-4)', marginBottom: 2 }}>COLLECTED</div>
                  <div style={{ fontSize: 34, fontWeight: 900, color: 'oklch(0.45 0.16 145)', lineHeight: 1 }}>${collected.toLocaleString('en-US', { minimumFractionDigits: 0 })}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-4)', marginBottom: 2 }}>LEFT TO COLLECT</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: left > 0 ? 'oklch(0.50 0.20 25)' : 'var(--ink-5)' }}>${left.toLocaleString('en-US', { minimumFractionDigits: 0 })}</div>
                </div>
              </div>
              {full > 0 && (
                <div style={{ height: 6, borderRadius: 999, background: 'oklch(0.92 0.01 260)', marginBottom: 12, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 999, background: `oklch(0.55 0.18 ${accent})`, width: `${pct}%`, transition: 'width 0.25s ease' }} />
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>{full > 0 ? `${pct}% collected of $${full.toLocaleString('en-US')}` : 'Set a full price on the case to track collection.'}</span>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-4)' }}>$</span>
                  <input type="number" min="0" step="0.01" value={paymentInput} onChange={e => setPaymentInput(e.target.value)}
                    placeholder="0.00" className="fld-input" style={{ height: 34, width: 120, fontSize: 13 }} />
                  <button className="btn btn-acc btn-sm" disabled={!paymentInput || Number(paymentInput) <= 0}
                    onClick={() => { handleRecordPayment(paymentInput); setPaymentInput(''); }}>
                    Record payment
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Pipeline tracker */}
        <div style={{ padding: '18px 24px 16px', borderBottom: '1px solid var(--line)' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)' }}>
              WHERE THEY STAND · {stagesDone.length} OF {PIPELINE_STAGES.length} STAGES DONE
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontSize: 26, fontWeight: 900, color: 'oklch(0.38 0.18 260)', lineHeight: 1 }}>
                {Math.round(stagesDone.length / PIPELINE_STAGES.length * 100)}%
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)' }}>THROUGH PIPELINE</span>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ height: 5, borderRadius: 999, background: 'oklch(0.93 0.01 260)', marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, background: 'oklch(0.50 0.18 260)', width: `${stagesDone.length / PIPELINE_STAGES.length * 100}%`, transition: 'width 0.25s ease' }} />
          </div>
          {/* Stage groups */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 14 }}>
            {STAGE_GROUPS.map(group => {
              const groupDone = group.keys.filter(k => stagesDone.includes(k)).length;
              return (
                <div key={group.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, paddingBottom: 5, borderBottom: '1px solid var(--line)' }}>
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--ink-4)' }}>{group.label}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: groupDone === group.keys.length ? 'oklch(0.36 0.15 145)' : 'var(--ink-5)' }}>{groupDone}/{group.keys.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {group.keys.map(key => {
                      const stage = PIPELINE_STAGES.find(s => s.key === key)!;
                      const isDone = stagesDone.includes(key);
                      const stageIdx = PIPELINE_STAGES.findIndex(s => s.key === key);
                      const isCurrent = !isDone && stageIdx === stagesDone.length;
                      // Lab-controlled stages: set automatically from the Lab tab,
                      // not clickable, shown in red so it's clear they're locked.
                      const locked = LAB_LOCKED_STAGES.has(key);
                      // CX agents can't move stages by hand — they advance by answering
                      // the guide. Only admins/owners can jump ahead or step back.
                      const clickable = isAdminOrOwner && !locked;
                      const ring = locked ? 'oklch(0.55 0.20 25)' : 'oklch(0.50 0.18 260)';
                      return (
                        <div key={key} onClick={clickable ? () => handleToggleStage(key) : undefined}
                          title={locked ? 'Set automatically from the Lab tab' : !isAdminOrOwner ? 'Stages advance automatically as you complete the guide — only admins/owners can move them manually' : undefined}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 7, cursor: clickable ? 'pointer' : 'not-allowed', padding: '3px 5px', borderRadius: 6,
                            background: isCurrent ? (locked ? 'oklch(0.96 0.03 25)' : 'oklch(0.95 0.03 260)') : 'transparent',
                            border: `1px solid ${isCurrent ? (locked ? 'oklch(0.85 0.07 25)' : 'oklch(0.88 0.06 260)') : 'transparent'}` }}>
                          <div style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                            background: isDone ? ring : 'transparent',
                            border: isDone ? 'none' : `2px solid ${isCurrent ? ring : (locked ? 'oklch(0.80 0.10 25)' : 'oklch(0.78 0.02 260)')}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isDone && <span style={{ color: 'white', fontSize: 8, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                            {isCurrent && <div style={{ width: 5, height: 5, borderRadius: '50%', background: ring }} />}
                          </div>
                          <span style={{ fontSize: 11.5, lineHeight: 1.35,
                            color: locked ? 'oklch(0.45 0.18 25)' : isDone ? 'var(--ink)' : isCurrent ? 'oklch(0.35 0.18 260)' : 'var(--ink-4)',
                            fontWeight: isCurrent ? 700 : isDone ? 500 : 400 }}>
                            {stage.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Exceptions */}
          <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 11 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--ink-4)', marginBottom: 8 }}>EXCEPTIONS — TAP TO FLAG THIS CASE</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {EXCEPTION_FLAGS.map(flag => {
                const isActive = exceptionFlags.includes(flag.key);
                return (
                  <button key={flag.key} onClick={() => handleToggleException(flag.key)}
                    style={{ padding: '4px 13px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                      background: isActive ? `oklch(0.93 ${flag.chroma} ${flag.hue})` : 'white',
                      color: isActive ? `oklch(0.35 ${flag.chroma * 2.2} ${flag.hue})` : 'var(--ink-4)',
                      border: `1.5px solid ${isActive ? `oklch(0.80 ${flag.chroma * 1.5} ${flag.hue})` : 'var(--line)'}`,
                      transition: 'all 0.12s' }}>
                    {isActive && <span style={{ marginRight: 4, fontSize: 8 }}>●</span>}
                    {flag.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Body: two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          {/* Left: case logs */}
          <div style={{ padding: '20px 22px', borderRight: '1px solid var(--line)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)', marginBottom: 14 }}>THE CASE</div>
            <LogCard title="Issues" icon="⚑" hue={25} entries={selectedCase.issues_log ?? []} nameMap={nameMap}
              placeholder="Describe the issue…" addLabel="Add"
              onAdd={text => addLogEntry('issues_log', { text })} onRemove={id => removeLogEntry('issues_log', id)} />
            <LogCard title="Customer notes" icon="✉" hue={235} entries={selectedCase.customer_notes_log ?? []} nameMap={nameMap}
              placeholder="What the customer said or wants…" addLabel="Add"
              onAdd={text => addLogEntry('customer_notes_log', { text })} onRemove={id => removeLogEntry('customer_notes_log', id)} />
            <LogCard title="Lab notes" icon="⚙" hue={260} entries={selectedCase.lab_notes_log ?? []} nameMap={nameMap}
              placeholder="Internal lab / production note…" addLabel="Add"
              onAdd={text => addLogEntry('lab_notes_log', { text })} onRemove={id => removeLogEntry('lab_notes_log', id)} />
            <TrackingCard entries={selectedCase.tracking_log ?? []} nameMap={nameMap}
              onAdd={(label, number) => addLogEntry('tracking_log', { label, number })} onRemove={id => removeLogEntry('tracking_log', id)}
              onSetType={setTrackingType} />
            <LogCard title="Remakes" icon="↻" hue={300} entries={selectedCase.remakes_log ?? []} nameMap={nameMap}
              placeholder="Reason for the remake…" addLabel="Log remake"
              onAdd={text => addLogEntry('remakes_log', { text })} onRemove={id => removeLogEntry('remakes_log', id)} />
          </div>

          {/* Right: update log */}
          <div style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)' }}>UPDATE LOG</div>
              <div style={{ fontSize: 11, color: 'var(--ink-5)' }}>{caseUpdates(selectedCase.id).length} entr{caseUpdates(selectedCase.id).length !== 1 ? 'ies' : 'y'}</div>
            </div>

            {/* Log today */}
            <div style={{ padding: '12px 14px', border: '1.5px solid var(--line)', borderRadius: 10, marginBottom: 14, background: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 5 }}>+ LOG UPDATE FOR TODAY</div>
                <div style={{ fontSize: 11, color: 'var(--ink-5)' }}>{today}</div>
              </div>
              <textarea ref={updateRef} value={updateText} onChange={e => setUpdateText(e.target.value)}
                placeholder="e.g. 'No answer. Left voicemail again.' or 'Customer agreed to remake.'"
                rows={3} style={{ width: '100%', resize: 'none', border: 'none', background: 'transparent', fontSize: 13, color: 'var(--ink)', lineHeight: 1.6, outline: 'none', fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-5)' }}>
                  <kbd style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>⌘</kbd>
                  {' + '}
                  <kbd style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>↵</kbd>
                  {' to log'}
                </div>
                <button className="btn btn-acc btn-sm" onClick={handleLogUpdate} disabled={savingUpdate || !updateText.trim()}>
                  {savingUpdate ? 'Saving…' : 'Log update'}
                </button>
              </div>
            </div>

            {/* History */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
              {caseUpdates(selectedCase.id).map((u: any, i: number) => (
                <div key={u.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: `oklch(0.50 0.15 ${(u.logged_by?.charCodeAt(0) ?? 200) % 360})`, color: 'white', fontWeight: 700, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    {initials(nameMap[u.logged_by] ?? '?')}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{u.update_date}</span>
                      {i === 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'oklch(0.94 0.06 200)', color: 'oklch(0.38 0.16 200)' }}>LATEST</span>}
                      <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>{nameMap[u.logged_by]?.split(' ').map((n: string, i: number) => i === 0 ? n : n[0] + '.').join(' ') ?? 'Unknown'}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55 }}>{u.note}</div>
                  </div>
                </div>
              ))}
              {caseUpdates(selectedCase.id).length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--ink-5)', textAlign: 'center', padding: '20px 0' }}>No updates logged yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-sm" style={{ background: 'oklch(0.92 0.06 25)', color: 'oklch(0.38 0.20 25)', border: '1px solid oklch(0.85 0.08 25)' }}
            onClick={() => { setShowEscalate(true); }}>⚠ Escalate to admin</button>
          {!selectedCase.on_hold && !showHoldInput && (
            <button className="btn btn-sec btn-sm" onClick={() => setShowHoldInput(true)}>🔒 Put on hold</button>
          )}
          <button className="btn btn-sec btn-sm"
            style={selectedCase.no_update_needed ? { background: 'oklch(0.92 0.05 145)', color: 'oklch(0.36 0.15 145)', border: '1px solid oklch(0.82 0.08 145)' } : {}}
            onClick={() => handleToggleNoUpdate(selectedCase)}>
            {selectedCase.no_update_needed ? '↩ Reactivate updates' : '✓ No update needed'}
          </button>
          <button className="btn btn-sec btn-sm"
            style={selectedCase.unreachable ? { background: 'oklch(0.92 0.06 290)', color: 'oklch(0.38 0.18 290)', border: '1px solid oklch(0.82 0.10 290)' } : {}}
            onClick={() => handleToggleUnreachable(selectedCase)}>
            {selectedCase.unreachable ? '↩ Mark reachable' : '📵 Unreachable'}
          </button>
          {showHoldInput && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="text" placeholder="Hold reason (e.g. waiting for lab)…" value={holdInputText} onChange={e => setHoldInputText(e.target.value)}
                className="fld-input" style={{ height: 32, fontSize: 12, width: 240 }} autoFocus />
              <button className="btn btn-sm btn-acc" onClick={() => handleToggleHold(selectedCase, holdInputText)}>Confirm</button>
              <button className="btn btn-sm btn-sec" onClick={() => { setShowHoldInput(false); setHoldInputText(''); }}>Cancel</button>
            </div>
          )}
          <button className="btn btn-sec btn-sm" onClick={() => { openEdit(selectedCase); setSelectedCase(null); }}>Edit case</button>
          {isMgmt && <button className="btn btn-sm" style={{ color: 'var(--err)', background: 'var(--surface-2)', border: '1px solid var(--line)' }} onClick={() => handleDeleteCase(selectedCase.id)}>Delete</button>}
          <button className="btn btn-acc btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setSelectedCase(null); setShowHoldInput(false); setReassigningCaseId(null); setReassignValue(''); }}>Done</button>
        </div>
      </div>

      {/* Escalate modal on top */}
      {showEscalate && <EscalateModal customerName={selectedCase.customer_name} onConfirm={handleEscalate} onClose={() => setShowEscalate(false)} />}

      {/* Create-label confirm dialog */}
      {showLabelModal && (
        <CreateLabelModal caseData={selectedCase} creating={creatingLabel} defaultPresetKey={labelPreset}
          onCreate={handleCreateLabel} onClose={() => setShowLabelModal(false)} />
      )}
    </div>
  );

  /* ── Case form modal ────────────────────────────────────────── */
  const formModal = showForm && (
    <div className="mb" onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
      <div className="md" style={{ width: 600, maxHeight: '94vh', overflowY: 'auto' }}>
        <div className="md-t">{editingCase ? 'Edit Customer Case' : 'New Customer Case'}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="pv-fld"><label>Customer Name *</label><input value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))} placeholder="Full name" autoFocus /></div>
          <div className="pv-fld"><label>Order Number</label><input value={form.order_number} onChange={e => setForm(p => ({ ...p, order_number: e.target.value }))} placeholder="Leave blank to auto-assign" /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="pv-fld"><label>Phone</label><input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="000-000-0000" /></div>
          <div className="pv-fld"><label>Email</label><input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="name@email.com" /></div>
        </div>
        <div className="pv-fld"><label>Address</label><input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Full shipping address" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="pv-fld"><label>Veneer Set</label><input value={form.veneer_set} onChange={e => setForm(p => ({ ...p, veneer_set: e.target.value }))} placeholder="e.g. Bottom Only" /></div>
          <div className="pv-fld"><label>Veneer Shade</label><input value={form.veneer_shade} onChange={e => setForm(p => ({ ...p, veneer_shade: e.target.value }))} placeholder="e.g. Super White" /></div>
          <div className="pv-fld"><label>Shipping</label><input value={form.shipping} onChange={e => setForm(p => ({ ...p, shipping: e.target.value }))} placeholder="e.g. Standard" /></div>
        </div>
        <div className="pv-fld"><label>Special Request Notes</label><textarea rows={2} value={form.special_request} onChange={e => setForm(p => ({ ...p, special_request: e.target.value }))} placeholder="Any special requests for this order…" /></div>
        <div className="pv-fld">
          <label>Pipeline Stage</label>
          <select value={form.pipeline_stage} onChange={e => setForm(p => ({ ...p, pipeline_stage: e.target.value }))}>
            {stages.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="pv-fld"><label>Issue</label><textarea rows={2} value={form.issue} onChange={e => setForm(p => ({ ...p, issue: e.target.value }))} placeholder="Brief description of the customer's issue…" /></div>
        <div className="pv-fld"><label>Action Taken</label><textarea rows={2} value={form.action_taken} onChange={e => setForm(p => ({ ...p, action_taken: e.target.value }))} placeholder="What has been done so far…" /></div>
        <div className="pv-fld"><label>Customer's Words</label><textarea rows={2} value={form.customer_words} onChange={e => setForm(p => ({ ...p, customer_words: e.target.value }))} placeholder="Direct quotes from the customer…" /></div>
        <div className="pv-fld"><label>Lab Notes</label><input value={form.lab_notes} onChange={e => setForm(p => ({ ...p, lab_notes: e.target.value }))} placeholder="Internal lab / production notes…" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="pv-fld">
            <label>Full Price ($)</label>
            <input type="number" min="0" step="0.01" value={form.full_price} onChange={e => setForm(p => ({ ...p, full_price: e.target.value }))} placeholder="e.g. 800" />
          </div>
          <div className="pv-fld">
            <label>Amount Collected ($)</label>
            <input type="number" min="0" step="0.01" value={form.amount_collected} onChange={e => setForm(p => ({ ...p, amount_collected: e.target.value }))} placeholder="0.00" />
          </div>
          <div className="pv-fld">
            <label>Assigned To</label>
            <select value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}>
              <option value="">Unassigned</option>
              {allProfiles.filter((p: any) => ['cx','owner','admin','supervisor'].includes(p.role)).map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="pv-fld">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.on_hold} onChange={e => setForm(p => ({ ...p, on_hold: e.target.checked }))} />
            Put on hold
          </label>
          {form.on_hold && (
            <input style={{ marginTop: 8 }} value={form.hold_reason} onChange={e => setForm(p => ({ ...p, hold_reason: e.target.value }))} placeholder="Hold reason (e.g. waiting for production, escalation pending…)" />
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-acc" onClick={handleSaveCase} disabled={savingCase || !form.customer_name.trim()}>
            {savingCase ? 'Saving…' : editingCase ? 'Update Case' : 'Add Case'}
          </button>
          <button className="btn btn-sec" onClick={() => setShowForm(false)}>Cancel</button>
        </div>
      </div>
    </div>
  );

  /* ── Add column modal ───────────────────────────────────────── */
  const addColModal = showAddCol && (
    <div className="mb" onClick={e => { if (e.target === e.currentTarget) setShowAddCol(false); }}>
      <div className="md" style={{ width: 380 }}>
        <div className="md-t">Add Pipeline Stage</div>
        <AddColumnModal onConfirm={handleAddStage} onClose={() => setShowAddCol(false)} />
      </div>
    </div>
  );

  /* ── Main render ────────────────────────────────────────────── */
  /* ── Labels-ready-to-print panel ────────────────────────────── */
  // Split labels by what's being shipped. Untagged (legacy/manual) labels fall
  // under Impression kit so nothing is hidden.
  const labelKindOf = (e: any) => (e?.kind === 'veneers' ? 'veneers' : 'imp_kit');
  const impLabelCount = labelItems.filter(li => labelKindOf(li.entry) === 'imp_kit').length;
  const venLabelCount = labelItems.filter(li => labelKindOf(li.entry) === 'veneers').length;
  const shownLabels = labelItems.filter(li => labelKind === 'all' || labelKindOf(li.entry) === labelKind);
  const shownToPrint = shownLabels.filter(li => !li.entry.printed);
  const printAllLabel = labelKind === 'imp_kit' ? 'Print All Impression Kit' : labelKind === 'veneers' ? 'Print All Veneers' : 'Print All';
  const labelTabs: { key: 'all' | 'imp_kit' | 'veneers'; label: string; count: number }[] = [
    { key: 'all',     label: 'All',                count: labelItems.length },
    { key: 'imp_kit', label: '🦷 Impression kit',  count: impLabelCount },
    { key: 'veneers', label: '😁 Veneers',         count: venLabelCount },
  ];
  const labelsView = (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>🖨 Labels Ready to Print</div>
          <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>
            {labelsReadyCount === 0
              ? 'No labels waiting — every bought label has been printed.'
              : `${labelsReadyCount} label${labelsReadyCount !== 1 ? 's' : ''} ready · hit Print, then it’s checked off.`}
          </div>
        </div>
        {shownToPrint.length > 0 && <button className="btn btn-acc" disabled={printingAll} onClick={() => printAllLabels(shownToPrint)}>{printingAll ? 'Building…' : `🖨 ${printAllLabel} (${shownToPrint.length})`}</button>}
      </div>
      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 18px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
        {labelTabs.map(t => (
          <button key={t.key} onClick={() => setLabelKind(t.key)}
            style={{ padding: '5px 13px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${labelKind === t.key ? 'oklch(0.50 0.15 170)' : 'var(--line)'}`,
              background: labelKind === t.key ? 'oklch(0.50 0.15 170)' : 'white',
              color: labelKind === t.key ? 'white' : 'var(--ink-3)' }}>
            {t.label} · {t.count}
          </button>
        ))}
      </div>
      <div>
        {shownLabels.length === 0 && (
          <div style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            {labelItems.length === 0
              ? 'No shipping labels yet. When a label is bought in Shippo, the customer shows up here ready to print.'
              : `No ${labelKind === 'veneers' ? 'veneers' : labelKind === 'imp_kit' ? 'impression kit' : ''} labels in this category.`}
          </div>
        )}
        {shownLabels.map((li, i) => {
          const printed = !!li.entry.printed;
          return (
            <div key={li.entry.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderBottom: i < shownLabels.length - 1 ? '1px solid var(--line-2)' : 'none', background: printed ? 'oklch(0.98 0.02 145)' : 'white' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: printed ? 'oklch(0.55 0.15 145)' : sColor(), color: 'white', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {printed ? '✓' : initials(li.c.customer_name)}
              </div>
              <div style={{ minWidth: 0, flex: 1, cursor: 'pointer' }} onClick={() => { setSelectedCase(li.c); markCaseRead(li.c.id); }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {li.c.customer_name}
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 20, background: labelKindOf(li.entry) === 'veneers' ? 'oklch(0.93 0.05 80)' : 'oklch(0.93 0.05 200)', color: labelKindOf(li.entry) === 'veneers' ? 'oklch(0.40 0.15 80)' : 'oklch(0.40 0.14 200)' }}>
                    {labelKindOf(li.entry) === 'veneers' ? 'Veneers' : 'Imp. kit'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                  <span>📦 Order #{li.c.order_number || '—'}</span>
                  <span>📞 {li.c.phone || '—'}</span>
                  {li.entry.number && <span style={{ fontFamily: 'monospace' }}>🚚 {li.entry.number}</span>}
                </div>
              </div>
              {printed ? (
                <>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'oklch(0.40 0.15 145)', display: 'flex', alignItems: 'center', gap: 5 }}>✓ Printed</span>
                  <button className="btn btn-sec btn-sm" onClick={() => printLabel(li)}>Reprint</button>
                  <button className="btn btn-sec btn-sm" title="Mark as not printed" onClick={() => setLabelsPrinted(li.c.id, [li.entry.id], false)}>↺</button>
                </>
              ) : (
                <button className="btn btn-acc btn-sm" onClick={() => printLabel(li)}>🖨 Print</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ── Lab intake panel (kits in transit to the lab) ──────────── */
  const labStepBtn = (c: any, key: string, label: string, hue: number) => {
    const active = (Array.isArray(c.lab_steps) ? c.lab_steps : []).includes(key);
    return (
      <button key={key} onClick={(e) => { e.stopPropagation(); toggleLabStep(c, key); }}
        style={{ padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          border: `1px solid ${active ? `oklch(0.52 0.16 ${hue})` : 'var(--line)'}`,
          background: active ? `oklch(0.52 0.16 ${hue})` : 'white',
          color: active ? 'white' : 'var(--ink-3)' }}>
        {active ? '✓ ' : ''}{label}
      </button>
    );
  };
  const labView = (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>🧪 Verify Impression Kit → Lab</div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>
          {labCount === 0
            ? 'No kits in transit. A customer shows up here once an agent sets the Lab ETA on the “IMP kit on the way to lab” stage.'
            : `${labCount} kit${labCount !== 1 ? 's' : ''} tracked · Received, In Production & Quality check sync to the customer’s card; Scanned, Sent to U.S. & Received in U.S. are lab-only.`}
        </div>
      </div>
      <div>
        {labCases.length === 0 && (
          <div style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Nothing in transit to the lab right now.</div>
        )}
        {labCases.map((c, i) => {
          const sentUs = (Array.isArray(c.lab_steps) ? c.lab_steps : []).includes('sent_us');
          return (
          <div key={c.id} style={{ padding: '12px 18px', borderBottom: i < labCases.length - 1 ? '1px solid var(--line-2)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: sColor(), color: 'white', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials(c.customer_name)}</div>
              <div style={{ minWidth: 0, flex: 1, cursor: 'pointer' }} onClick={() => { setSelectedCase(c); markCaseRead(c.id); }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{c.customer_name}</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 2, color: 'var(--ink-4)', fontSize: 12 }}>
                  <span>📦 Order #{c.order_number || '—'}</span>
                  <span>📞 {c.phone || '—'}</span>
                  <span>✉ {c.email || '—'}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
                  <span style={{ fontSize: 12, color: 'oklch(0.44 0.14 300)', fontWeight: 600 }}>🧪 Lab ETA · {fmtEta(c.lab_eta_date)}</span>
                  {c.lab_us_eta_date && <span style={{ fontSize: 12, color: 'oklch(0.44 0.16 200)', fontWeight: 600 }}>🇺🇸 US ETA · {fmtEta(c.lab_us_eta_date)}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 440 }}>
                {LAB_BUTTONS.map(b => labStepBtn(c, b.key, b.label, b.hue))}
              </div>
            </div>
            {sentUs && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingLeft: 48, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.44 0.16 200)' }}>🇺🇸 US ETA — when it will be back in the U.S.:</span>
                <input type="date" value={c.lab_us_eta_date ?? ''} onChange={e => patchAnyCase(c.id, { lab_us_eta_date: e.target.value || null })}
                  className="fld-input" style={{ height: 30, width: 170, fontSize: 12 }} />
                {c.lab_us_eta_date && <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{fmtEta(c.lab_us_eta_date)}</span>}
              </div>
            )}
            {/* Lab notes — written here flow straight onto the customer's live card. */}
            <div style={{ marginTop: 10, paddingLeft: 48 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.42 0.10 260)', marginBottom: 6 }}>⚙ Lab notes — these appear on the customer’s live card</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input value={labNoteDrafts[c.id] ?? ''} onChange={e => setLabNoteDrafts(p => ({ ...p, [c.id]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') addLabNote(c.id, labNoteDrafts[c.id] ?? ''); }}
                  placeholder="Add a lab / production note…" className="fld-input" style={{ height: 32, flex: 1, minWidth: 220, fontSize: 12 }} />
                <button className="btn btn-sec btn-sm" disabled={!(labNoteDrafts[c.id] ?? '').trim()} onClick={() => addLabNote(c.id, labNoteDrafts[c.id] ?? '')}>Add note</button>
              </div>
              {Array.isArray(c.lab_notes_log) && c.lab_notes_log.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                  {c.lab_notes_log.slice(0, 4).map((n: any) => (
                    <div key={n.id} style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      <span style={{ color: 'var(--ink)' }}>{n.text}</span>
                      <span style={{ color: 'var(--ink-5)' }}> · {nameMap[n.by] || 'Lab'}{n.date ? ` · ${n.date}` : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="page-fade">
      {banner}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>
          {section === 'new' ? 'New Orders — Unassigned' : section === 'agents' ? 'Agents — Assigned customers' : section === 'admin' ? 'Admin — Escalated cases' : section === 'unreachable' ? 'Unreachable customers' : section === 'labels' ? 'Labels Ready to Print' : section === 'lab' ? 'Verify Impression Kit → Lab' : section === 'issues' ? 'Issues' : section === 'completed_success' ? 'Completed Success' : section === 'my_cases' ? 'My Cases' : 'No Update Needed'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
          {section === 'new'
            ? 'New orders waiting to be claimed — assign one to an agent and it moves to the Agents section'
            : section === 'agents'
            ? 'Customers assigned to an agent — color-coded by status · click any to log updates'
            : section === 'admin'
            ? 'Cases flagged by agents that require management review or action'
            : section === 'unreachable'
            ? 'Customers that could not be reached — click to manage or reactivate'
            : section === 'labels'
            ? 'Every shipping label bought in Shippo — print each one (or all at once) and it gets checked off'
            : section === 'lab'
            ? 'Impression kits in transit to the lab — mark Received, Scan, or In Production; Received & In Production sync to the customer card'
            : section === 'issues'
            ? 'Completed orders the customer flagged issues on — full history preserved · click any to review'
            : section === 'completed_success'
            ? 'Completed orders with no issues — full history preserved · click any to review'
            : section === 'my_cases'
            ? 'Only the cases assigned to you'
            : 'Customers that do not need a daily update — click to manage or reactivate'}
        </div>
      </div>
      {toolbar}
      {section === 'lab' && canViewLab ? labView : section === 'labels' ? labelsView : (<>
        {viewMode === 'overview' && overviewView}
        {viewMode === 'board'    && boardView}
        {viewMode === 'table'    && tableView}
      </>)}
      {detailModal}
      {formModal}
      {addColModal}
    </div>
  );
}

/* ── Escalate modal ──────────────────────────────────────────── */
function EscalateModal({ customerName, onConfirm, onClose }: { customerName: string; onConfirm: (note: string, severity: string) => void; onClose: () => void }) {
  const [note, setNote] = useState('');
  const [severity, setSeverity] = useState('HIGH');
  const [routeTo, setRouteTo] = useState('Admin team');
  return (
    <div className="mb" style={{ zIndex: 9999 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="md" style={{ width: 520 }}>
        <div className="md-t">Escalate — {customerName}</div>
        <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '0 0 16px' }}>
          This case will be routed to an admin for review. The customer card will be flagged and the admin queue will alert at the top of the page.
        </p>
        <div className="pv-fld">
          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)' }}>WHY DOES THIS NEED AN ADMIN?</label>
          <textarea rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. CX is demanding a refund + threatening chargeback. Needs an executive call." style={{ resize: 'none' }} autoFocus />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="pv-fld">
            <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)' }}>SEVERITY</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {['LOW','MEDIUM','HIGH'].map(s => (
                <button key={s} onClick={() => setSeverity(s)}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: `1.5px solid ${severity === s ? (s === 'HIGH' ? 'oklch(0.50 0.20 25)' : s === 'MEDIUM' ? 'oklch(0.50 0.18 75)' : 'var(--line)') : 'var(--line)'}`, background: severity === s ? (s === 'HIGH' ? 'oklch(0.92 0.06 25)' : s === 'MEDIUM' ? 'oklch(0.94 0.06 75)' : 'var(--surface-2)') : 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer', color: severity === s ? (s === 'HIGH' ? 'oklch(0.40 0.20 25)' : s === 'MEDIUM' ? 'oklch(0.40 0.18 75)' : 'var(--ink-4)') : 'var(--ink-4)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="pv-fld">
            <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)' }}>ROUTE TO</label>
            <select value={routeTo} onChange={e => setRouteTo(e.target.value)} style={{ marginTop: 6 }}>
              <option>Admin team</option><option>Owner</option><option>Supervisor</option>
            </select>
          </div>
        </div>
        <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>PREVIEW →</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: severity === 'HIGH' ? 'oklch(0.92 0.06 25)' : severity === 'MEDIUM' ? 'oklch(0.94 0.06 75)' : 'var(--surface-2)', color: severity === 'HIGH' ? 'oklch(0.40 0.20 25)' : severity === 'MEDIUM' ? 'oklch(0.40 0.18 75)' : 'var(--ink-4)' }}>{severity}</span>
          <span style={{ fontWeight: 600 }}>{customerName} → {routeTo}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sec" onClick={onClose}>Cancel</button>
          <button className="btn btn-sm" style={{ background: 'oklch(0.92 0.06 25)', color: 'oklch(0.38 0.20 25)', border: '1px solid oklch(0.85 0.08 25)', fontWeight: 700, padding: '8px 20px', borderRadius: 8, cursor: 'pointer', flex: 1 }}
            onClick={() => onConfirm(note, severity)}>
            ⚠ Escalate to admin
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Multi-entry log card (Issues / Customer notes / Lab notes / Remakes) ── */
function LogCard({ title, icon, hue, entries, nameMap, placeholder, addLabel, onAdd, onRemove }: {
  title: string; icon: string; hue: number; entries: any[]; nameMap: Record<string, string>;
  placeholder: string; addLabel: string; onAdd: (text: string) => void; onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const accent = `oklch(0.50 0.16 ${hue})`;
  const submit = () => { if (draft.trim()) { onAdd(draft.trim()); setDraft(''); setOpen(false); } };
  return (
    <div style={{ marginBottom: 14, border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderLeft: `3px solid ${accent}` }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ color: accent }}>{icon}</span>{title}
          {entries.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: `oklch(0.94 0.04 ${hue})`, color: accent }}>{entries.length}</span>}
        </div>
        <button onClick={() => setOpen(v => !v)} className="btn btn-sec btn-sm">+ {addLabel}</button>
      </div>
      {open && (
        <div style={{ padding: '0 12px 10px' }}>
          <textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder={placeholder} rows={2} autoFocus
            onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(); }}
            style={{ width: '100%', resize: 'none', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, outline: 'none', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button className="btn btn-acc btn-sm" disabled={!draft.trim()} onClick={submit}>Save</button>
            <button className="btn btn-sec btn-sm" onClick={() => { setOpen(false); setDraft(''); }}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{ padding: entries.length ? '0 12px 10px' : '0 12px 12px' }}>
        {entries.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-5)', fontStyle: 'italic' }}>No {title.toLowerCase()} yet.</div>}
        {entries.map((e: any) => (
          <div key={e.id} style={{ padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8, marginTop: 6 }}>
            <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{e.text}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--ink-5)' }}>{e.date} · {nameMap[e.by]?.split(' ')[0] ?? 'Unknown'}</span>
              <button onClick={() => onRemove(e.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 12 }}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Tracking log card (label + number) ─────────────────────────── */
function TrackingCard({ entries, nameMap, onAdd, onRemove, onCreateLabel, onSetType }: {
  entries: any[]; nameMap: Record<string, string>; onAdd: (label: string, number: string) => void; onRemove: (id: string) => void;
  onCreateLabel?: () => void;
  onSetType?: (id: string, type: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [number, setNumber] = useState('');
  const accent = 'oklch(0.50 0.16 220)';
  const submit = () => { if (number.trim()) { onAdd(label.trim() || 'Tracking', number.trim()); setLabel(''); setNumber(''); setOpen(false); } };
  return (
    <div style={{ marginBottom: 14, border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderLeft: `3px solid ${accent}` }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ color: accent }}>🚚</span>Tracking log
          {entries.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: 'oklch(0.94 0.04 220)', color: accent }}>{entries.length}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {onCreateLabel && <button onClick={onCreateLabel} className="btn btn-acc btn-sm">🏷 Send to Shippo</button>}
          <button onClick={() => setOpen(v => !v)} className="btn btn-sec btn-sm">+ Add tracking</button>
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label (e.g. IMP Kit → Customer)" className="fld-input" style={{ height: 32, fontSize: 12 }} autoFocus />
          <input value={number} onChange={e => setNumber(e.target.value)} placeholder="Tracking number" className="fld-input" style={{ height: 32, fontSize: 12, fontFamily: 'monospace' }}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-acc btn-sm" disabled={!number.trim()} onClick={submit}>Save</button>
            <button className="btn btn-sec btn-sm" onClick={() => { setOpen(false); setLabel(''); setNumber(''); }}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{ padding: entries.length ? '0 12px 10px' : '0 12px 12px' }}>
        {entries.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-5)', fontStyle: 'italic' }}>No tracking numbers yet.</div>}
        {entries.map((e: any) => (
          <div key={e.id} style={{ padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8, marginTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'white', border: '1px solid var(--line)', color: 'var(--ink-3)' }}>{trackingLabel(e)}</span>
              <span style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--ink)' }}>{e.number}</span>
              <button onClick={() => onRemove(e.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 12 }}>✕</button>
            </div>
            {(e.label_url || e.tracking_url) && (
              <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                {e.label_url && <a href={e.label_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.50 0.16 220)' }}>🖨 Print label</a>}
                {e.tracking_url && <a href={e.tracking_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.50 0.16 145)' }}>📦 Track</a>}
              </div>
            )}
            {onSetType && (() => {
              const eff = e.label_type || (e.kind === 'veneers' ? 'veneers' : e.kind === 'imp_kit' ? (e.is_return ? 'imp_return' : 'imp_send') : null);
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, color: 'var(--ink-5)', marginRight: 2 }}>Type:</span>
                  {TRACK_TYPE_OPTIONS.map(opt => {
                    const active = eff === opt.key;
                    return (
                      <button key={opt.key} onClick={() => onSetType(e.id, active ? null : opt.key)} title={TRACK_TYPE_LABEL[opt.key]}
                        style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, cursor: 'pointer',
                          border: `1px solid ${active ? 'oklch(0.50 0.16 220)' : 'var(--line)'}`,
                          background: active ? 'oklch(0.50 0.16 220)' : 'white',
                          color: active ? 'white' : 'var(--ink-4)' }}>
                        {opt.short}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
            <div style={{ fontSize: 10, color: 'var(--ink-5)', marginTop: 4 }}>{e.date} · {nameMap[e.by]?.split(' ')[0] ?? 'Unknown'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Add Column modal ────────────────────────────────────────── */
function AddColumnModal({ onConfirm, onClose }: { onConfirm: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  return (
    <form onSubmit={e => { e.preventDefault(); onConfirm(name); }}>
      <div className="pv-fld"><label>Stage Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. FOLLOW-UP" autoFocus required /></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn-acc">Add Stage</button>
        <button type="button" className="btn btn-sec" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

/* ── Create shipping label modal (Shippo) ───────────────────────── */
function CreateLabelModal({ caseData, creating, onCreate, onClose, defaultPresetKey }: {
  caseData: any; creating: boolean;
  onCreate: (to: Record<string, any>, parcel: Record<string, number>, kind?: string) => Promise<any>;
  onClose: () => void;
  defaultPresetKey?: string;
}) {
  const parsed = parseUsAddress(caseData?.address ?? '');
  const [to, setTo] = useState({
    name: caseData?.customer_name ?? '',
    phone: caseData?.phone ?? '',
    email: caseData?.email ?? '',
    street1: parsed.street1, street2: parsed.street2,
    city: parsed.city, state: parsed.state, zip: parsed.zip, country: 'US',
  });
  const [presetKey, setPresetKey] = useState(
    PARCEL_PRESETS.find(p => p.key === defaultPresetKey)?.key ?? PARCEL_PRESETS[0].key);
  const preset = PARCEL_PRESETS.find(p => p.key === presetKey) ?? PARCEL_PRESETS[0];
  const [parcel, setParcel] = useState({ length: preset.length, width: preset.width, height: preset.height, weight: preset.weight });
  const [done, setDone] = useState<any>(null);

  const choosePreset = (key: string) => {
    setPresetKey(key);
    const p = PARCEL_PRESETS.find(x => x.key === key) ?? PARCEL_PRESETS[0];
    if (key !== 'custom') setParcel({ length: p.length, width: p.width, height: p.height, weight: p.weight });
  };

  const field = (k: keyof typeof to) => (e: any) => setTo(t => ({ ...t, [k]: e.target.value }));
  const numField = (k: keyof typeof parcel) => (e: any) => setParcel(p => ({ ...p, [k]: Number(e.target.value) }));

  const canSubmit = to.street1.trim() && to.city.trim() && to.state.trim() && to.zip.trim()
    && parcel.length > 0 && parcel.width > 0 && parcel.height > 0 && parcel.weight > 0;

  // Tag the label by what's being shipped so the Labels Ready tab can split them.
  const kind = presetKey === 'veneers' ? 'veneers' : presetKey.startsWith('imp_kit') ? 'imp_kit' : undefined;

  const submit = async () => {
    const res = await onCreate(to, parcel, kind);
    if (res) setDone(res);
  };

  const lbl = { fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)' } as const;

  return (
    <div className="mb" style={{ zIndex: 9999 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="md" style={{ width: 560 }}>
        <div className="md-t">🏷 Send shipment to Shippo</div>

        {done ? (
          <div>
            <div style={{ padding: '14px 16px', background: 'oklch(0.96 0.05 145)', border: '1px solid oklch(0.85 0.07 145)', borderRadius: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'oklch(0.38 0.16 145)', marginBottom: 6 }}>
                ✓ Sent to Shippo{done.order_number ? ` — order ${done.order_number}` : ''}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink)' }}>Open Shippo&apos;s <strong>Orders</strong> tab to buy the label and get the tracking number.</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 6 }}>The order is now in your Shippo dashboard with a Buy button.</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <a className="btn btn-acc" href={done.buy_url || 'https://apps.goshippo.com/orders'} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>🛒 Open Shippo Orders</a>
              <button className="btn btn-sec" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '0 0 16px' }}>
              We pre-filled the recipient from the case address. Confirm or fix it, pick the parcel, then send it to Shippo — you&apos;ll buy the label in the Shippo dashboard.
            </p>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', marginBottom: 8 }}>SHIP TO</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div className="pv-fld"><label style={lbl}>NAME</label><input value={to.name} onChange={field('name')} /></div>
              <div className="pv-fld"><label style={lbl}>PHONE</label><input value={to.phone} onChange={field('phone')} /></div>
            </div>
            <div className="pv-fld" style={{ marginBottom: 10 }}><label style={lbl}>EMAIL</label><input value={to.email} onChange={field('email')} placeholder="customer@example.com" /></div>
            <div className="pv-fld" style={{ marginBottom: 10 }}><label style={lbl}>STREET</label><input value={to.street1} onChange={field('street1')} placeholder="123 Main St" autoFocus /></div>
            <div className="pv-fld" style={{ marginBottom: 10 }}><label style={lbl}>STREET 2 (APT / SUITE)</label><input value={to.street2} onChange={field('street2')} placeholder="Apt 4" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div className="pv-fld"><label style={lbl}>CITY</label><input value={to.city} onChange={field('city')} /></div>
              <div className="pv-fld"><label style={lbl}>STATE</label><input value={to.state} onChange={field('state')} maxLength={2} placeholder="TX" /></div>
              <div className="pv-fld"><label style={lbl}>ZIP</label><input value={to.zip} onChange={field('zip')} placeholder="78701" /></div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', marginBottom: 8 }}>PARCEL</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {PARCEL_PRESETS.map(p => (
                <button key={p.key} onClick={() => choosePreset(p.key)}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: `1.5px solid ${presetKey === p.key ? 'var(--accent)' : 'var(--line)'}`, background: presetKey === p.key ? 'oklch(0.95 0.04 250)' : 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer', color: presetKey === p.key ? 'var(--accent)' : 'var(--ink-4)' }}>
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
              <div className="pv-fld"><label style={lbl}>LENGTH (in)</label><input type="number" value={parcel.length || ''} onChange={numField('length')} /></div>
              <div className="pv-fld"><label style={lbl}>WIDTH (in)</label><input type="number" value={parcel.width || ''} onChange={numField('width')} /></div>
              <div className="pv-fld"><label style={lbl}>HEIGHT (in)</label><input type="number" value={parcel.height || ''} onChange={numField('height')} /></div>
              <div className="pv-fld"><label style={lbl}>WEIGHT (oz)</label><input type="number" step="0.01" value={parcel.weight || ''} onChange={numField('weight')} /></div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sec" onClick={onClose} disabled={creating}>Cancel</button>
              <button className="btn btn-acc" style={{ flex: 1 }} onClick={submit} disabled={!canSubmit || creating}>
                {creating ? 'Sending…' : '🏷 Send to Shippo'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
