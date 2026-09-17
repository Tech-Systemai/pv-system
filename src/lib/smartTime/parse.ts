// Brain-dump parser for Smart Time.
//
// Takes whatever you typed or dictated — run-on, unpunctuated, mixed work and
// life — and turns it into scored tasks with a time estimate each. It is a
// deterministic reader, not a model: every guess is traceable to a rule here,
// which is why each draft task carries `reasons` explaining how it was read.
//
// Order of work per dump:
//   1. pull out whole-dump signals (period, energy) and set them aside
//   2. cut the text into one line per thing to do
//   3. per line: strip filler, read any stated duration and deadline, score
//      importance and urgency, estimate a duration when none was stated

import type { Category, DraftTask, Energy, ParseResult, Quadrant } from './types';

// ── Small helpers ─────────────────────────────────────────────────────────────

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5,
};

// ── 1. Whole-dump signals ─────────────────────────────────────────────────────

// Checked before the start patterns, because "my period is over" also contains
// "my period".
const PERIOD_END = [
  /\bperiod\s+(?:is\s+|has\s+)?(?:over|done|ended|finished|gone)\b/i,
  /\b(?:off|done with|finished with)\s+(?:my\s+)?period\b/i,
  /\bno longer\s+(?:on\s+)?(?:my\s+)?period\b/i,
  /\bnot on my period\s+(?:any\s?more|anymore)\b/i,
  /\bcycle\s+(?:is\s+)?(?:over|ended|done)\b/i,
  /\b(?:back to|resuming|can)\s+pray(?:ing)?\s+again\b/i,
];

const PERIOD_START = [
  /\b(?:i'?m|im|i am)\s+(?:on\s+)?(?:my\s+)?period\b/i,
  /\bon my period\b/i,
  /\b(?:got|started|starting)\s+my\s+period\b/i,
  /\bperiod\s+(?:just\s+)?(?:started|began|arrived|come)\b/i,
  /\b(?:i'?m|im|i am)\s+menstruating\b/i,
  /\bmenstruating\b/i,
  /\b(?:hayd|haid|haidh|haiz)\b/i,
  /\btime of the month\b/i,
  /\bnot praying\s+(?:right now|this week|these days|at the moment)\b/i,
  /\bcan'?t pray\s+(?:right now|this week|these days|at the moment)\b/i,
];

const LOW_ENERGY = /\b(exhausted|drained|wiped|knackered|no energy|low energy|zero energy|so tired|really tired|sick|unwell|ill|cramping|cramps|migraine|headache|burnt out|burned out|didn'?t sleep|barely slept|overwhelmed)\b/i;
const HIGH_ENERGY = /\b(energi[sz]ed|full of energy|feeling great|feeling good|motivated|fresh|slept well)\b/i;

// ── 2. Segmentation ───────────────────────────────────────────────────────────

// Verbs that reliably start a new item, used to break up comma- and
// "and"-joined runs like "call the lab, pay the invoice and finish the deck".
const ACTION_VERBS =
  'call|ring|phone|email|e-mail|text|message|whatsapp|reply|respond|send|submit|upload|' +
  'finish|finalis[ez]e|start|write|draft|type|study|revise|memoriz[ez]e|read|learn|' +
  'clean|tidy|wash|fold|vacuum|mop|hoover|cook|bake|prep|meal ?prep|' +
  'buy|get|grab|order|pick|drop|collect|deliver|return|' +
  'pay|transfer|invoice|budget|file|renew|apply|register|book|schedule|reschedule|cancel|' +
  'fix|repair|debug|install|set ?up|configure|update|review|check|proofread|audit|' +
  'plan|prepare|design|edit|record|film|post|publish|print|scan|sign|' +
  'visit|see|meet|attend|join|follow ?up|chase|remind|ask|tell|book|' +
  'pray|recite|memorise|go|take|make|sort|organis[ez]e|charge|water|feed|walk';

// A fragment that opens with one of these is not a new task — it is the tail of
// the previous one ("…, that's a big one", "…, due friday", "…, takes 20 min").
// It gets glued back on so its deadline and duration still count.
const CONTINUATION =
  /^(?:that'?s|thats|which|it'?s|its|so it|because|cause|coz|but|though|although|ideally|hopefully|apparently|probably|preferably|no rush|asap|urgent|due\b|by\b|before\b|after\b|between\b|at\b|around\b|about\b|for\b|with\b|from\b|until\b|till|takes?\b|taking|will take|should take|maybe by|\d+\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b)/i;

// "…, big one, …" is a comment on the task before it, not a task of its own.
const QUALIFIER_ONLY =
  /^(?:a\s+|the\s+)?(?:big|huge|massive|small|tiny|quick|fast|long|short|deep|proper|thorough|easy|hard|annoying|boring|important|urgent)(?:\s+(?:one|job|task|thing|ones))?$/i;

const LEADING_CONNECTOR = /^(?:and|also|plus|then|oh|so)\s+/i;

function segment(raw: string): string[] {
  const verbs = ACTION_VERBS;
  const text = raw
    .replace(/\r/g, '')
    .replace(/[•·▪●]/g, '\n')
    // sentence ends
    .replace(/([.!?])\s+/g, '$1\n')
    .replace(/\s*;\s*/g, '\n')
    // explicit connectors
    .replace(/\s+and then\s+/gi, '\n')
    .replace(/\s+then\s+/gi, '\n')
    .replace(/\s+(?:and\s+)?also\s+/gi, '\n')
    .replace(/\s+plus\s+(?=i\b)/gi, '\n')
    .replace(/\s+oh and\s+/gi, '\n')
    // A dumped list is mostly comma-separated, so every comma is a candidate
    // break; the merge pass below undoes the ones that were not.
    .replace(/\s*,\s*/g, '\n')
    // "… and pay the invoice"
    .replace(new RegExp(`\\s+and\\s+(?=(?:${verbs})\\b)`, 'gi'), '\n');

  const rough = text
    .split('\n')
    .map(l =>
      l
        .replace(/^[\s\-–—*>]+/, '')
        .replace(/^\d+[.)]\s*/, '')
        .replace(/[\s,;]+$/, '')
        .trim(),
    )
    .filter(Boolean);

  const merged: string[] = [];
  for (const frag of rough) {
    const trimmed = frag.replace(LEADING_CONNECTOR, '').trim();
    if (!trimmed) continue;
    if (merged.length > 0 && (CONTINUATION.test(trimmed) || QUALIFIER_ONLY.test(trimmed))) {
      merged[merged.length - 1] += `, ${trimmed}`;
      continue;
    }
    merged.push(trimmed);
  }

  return merged.filter(l => l.length > 2);
}

// ── 3. Duration reading ───────────────────────────────────────────────────────

type Hit = { minutes: number; matched: string };

const WORD_DURATIONS: [RegExp, number][] = [
  [/\ban hour and a half\b/i, 90],
  [/\bhour and a half\b/i, 90],
  [/\bhalf an hour\b/i, 30],
  [/\bhalf hour\b/i, 30],
  [/\bquarter of an hour\b/i, 15],
  [/\ba couple of hours\b/i, 120],
  [/\bcouple of hours\b/i, 120],
  [/\bcouple hours\b/i, 120],
  [/\ba few hours\b/i, 180],
  [/\bfew hours\b/i, 180],
  [/\ball day\b/i, 300],
  [/\ball morning\b/i, 180],
  [/\ball afternoon\b/i, 180],
  [/\ball evening\b/i, 150],
  [/\bfive minutes\b/i, 5],
  [/\bten minutes\b/i, 10],
  [/\bfifteen minutes\b/i, 15],
  [/\btwenty minutes\b/i, 20],
  [/\bthirty minutes\b/i, 30],
  [/\bforty five minutes\b/i, 45],
  [/\ban hour\b/i, 60],
];

/** Reads a stated duration, e.g. "1h30", "45 mins", "two hours", "all day". */
function readDuration(text: string): Hit | null {
  const combined = text.match(/(\d+)\s*(?:h|hr|hrs|hour|hours)\s*(?:and\s*)?(\d{1,2})\s*(?:m|min|mins|minute|minutes)\b/i);
  if (combined) {
    return { minutes: Number(combined[1]) * 60 + Number(combined[2]), matched: combined[0] };
  }

  const hours = text.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i);
  if (hours) {
    return { minutes: Math.round(Number(hours[1].replace(',', '.')) * 60), matched: hours[0] };
  }

  const mins = text.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/i);
  if (mins) return { minutes: Number(mins[1]), matched: mins[0] };

  for (const [re, minutes] of WORD_DURATIONS) {
    const m = text.match(re);
    if (m) return { minutes, matched: m[0] };
  }

  const wordHours = text.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:hour|hours)\b/i,
  );
  if (wordHours) {
    return { minutes: (NUMBER_WORDS[wordHours[1].toLowerCase()] ?? 1) * 60, matched: wordHours[0] };
  }

  return null;
}

// ── 4. Deadline and clock reading ─────────────────────────────────────────────

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

type WhenHit = {
  due: string | null;
  fixedTime: string;
  anchor: string;
  matched: string[];
  /** Words that push urgency up without naming a date ("asap", "tonight"). */
  urgencyBump: number;
  label: string;
};

function to24h(hour: number, minute: number, meridiem: string | undefined): string {
  let h = hour;
  const mer = meridiem?.toLowerCase();
  if (mer === 'pm' && h < 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  // Bare "at 8" for a working day reads as morning; "at 7" in the evening
  // half of the clock reads as evening. Anything 1–6 without am/pm is treated
  // as afternoon, which is the common intent ("at 3" = 15:00).
  if (!mer && h >= 1 && h <= 6) h += 12;
  return `${String(clamp(h, 0, 23)).padStart(2, '0')}:${String(clamp(minute, 0, 59)).padStart(2, '0')}`;
}

function readWhen(text: string, today: Date): WhenHit {
  const out: WhenHit = { due: null, fixedTime: '', anchor: '', matched: [], urgencyBump: 0, label: '' };
  const t = text.toLowerCase();

  const set = (date: Date, matched: string, label: string, bump = 0) => {
    if (!out.due) {
      out.due = ymd(date);
      out.label = label;
    }
    out.matched.push(matched);
    out.urgencyBump = Math.max(out.urgencyBump, bump);
  };

  // Prayer anchors — "after Fajr", "before Maghrib", "between Dhuhr and Asr".
  const anchor = t.match(
    /\b(after|before|between)\s+(fajr|dhuhr|zuhr|duhr|asr|maghrib|isha|ishaa|sunrise|sunset)\b/i,
  );
  if (anchor) {
    const prayer = anchor[2].replace(/^zuhr|duhr$/i, 'dhuhr').replace(/^ishaa$/i, 'isha');
    out.anchor = `${anchor[1].toLowerCase()} ${prayer.charAt(0).toUpperCase()}${prayer.slice(1).toLowerCase()}`;
    out.matched.push(anchor[0]);
  }

  // Explicit clock time. The lookahead keeps "at 20 pages" and "at 30 mins"
  // from being read as 20:00 and 30 past.
  const clock =
    t.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?!\s*(?:m\b|min|hour|hr\b|h\b|page|email|item|word))/i) ??
    t.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i) ??
    t.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (clock) {
    const hour = Number(clock[1]);
    const hasMinutes = /^\d{2}$/.test(clock[2] ?? '');
    const minute = hasMinutes ? Number(clock[2]) : 0;
    const meridiem = hasMinutes ? clock[3] : (clock[2] ?? clock[3]);
    if (hour <= 24) {
      out.fixedTime = to24h(hour, minute, meridiem);
      out.matched.push(clock[0]);
    }
  }

  // Named days.
  const tomorrow = t.match(/\b(tomorrow|tmrw|tmr|2moro)\b/);
  if (/\bday after tomorrow\b/.test(t)) set(addDays(today, 2), 'day after tomorrow', 'day after tomorrow');
  else if (tomorrow) set(addDays(today, 1), tomorrow[0], 'tomorrow', 45);
  if (/\b(today|tonight|this morning|this afternoon|this evening|by eod|end of day|by close of play)\b/.test(t)) {
    const m = t.match(/\b(today|tonight|this morning|this afternoon|this evening|by eod|end of day|by close of play)\b/)!;
    set(today, m[0], 'today', 75);
  }
  if (/\bovernight\b/.test(t)) set(today, 'overnight', 'today', 60);

  const inN = t.match(/\bin\s+(\d+|a|an|two|three|four|five)\s+(day|days|week|weeks|month|months)\b/i);
  if (inN) {
    const n = /^\d+$/.test(inN[1]) ? Number(inN[1]) : (NUMBER_WORDS[inN[1].toLowerCase()] ?? 1);
    const unit = inN[2].startsWith('week') ? 7 : inN[2].startsWith('month') ? 30 : 1;
    set(addDays(today, n * unit), inN[0], inN[0]);
  }

  const weekday = t.match(
    /\b(?:on|by|this|next|before)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  );
  if (weekday) {
    const target = WEEKDAYS.indexOf(weekday[1].toLowerCase());
    let delta = (target - today.getDay() + 7) % 7;
    if (delta === 0) delta = 7;                       // "on Friday" said on a Friday = next one
    if (/\bnext\b/.test(weekday[0])) delta += delta <= 6 ? 7 : 0;
    set(addDays(today, delta), weekday[0].trim(), weekday[1].toLowerCase());
  }

  if (/\bthis week\b/.test(t)) {
    const delta = (5 - today.getDay() + 7) % 7;       // Friday of the current week
    set(addDays(today, delta), 'this week', 'this week');
  }
  if (/\b(the )?weekend\b/.test(t)) {
    const delta = (6 - today.getDay() + 7) % 7;
    set(addDays(today, delta), 'weekend', 'the weekend');
  }
  if (/\bnext week\b/.test(t)) set(addDays(today, 7), 'next week', 'next week');
  if (/\bnext month\b/.test(t)) set(addDays(today, 30), 'next month', 'next month');

  const dayOfMonth = t.match(/\b(?:by|on|before)\s+the\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (dayOfMonth) {
    const dom = Number(dayOfMonth[1]);
    const candidate = new Date(today.getFullYear(), today.getMonth(), dom);
    if (candidate < today) candidate.setMonth(candidate.getMonth() + 1);
    set(candidate, dayOfMonth[0], `the ${dom}${dom === 1 ? 'st' : dom === 2 ? 'nd' : dom === 3 ? 'rd' : 'th'}`);
  }

  return out;
}

// ── 5. Scoring vocabulary ─────────────────────────────────────────────────────

const URGENT_WORDS: [RegExp, number][] = [
  [/\b(asap|a\.s\.a\.p|right now|immediately|urgent|urgently|emergency)\b/i, 45],
  [/\b(overdue|late|missed the|past due|final notice|last chance|expires|expiring|closing soon)\b/i, 40],
  [/\b(deadlines?|due)\b/i, 25],
  [/\b(they'?re waiting|waiting on me|chasing me|blocking|holding up|follow ?up)\b/i, 22],
  [/\b(before they close|before it closes|last day)\b/i, 30],
];

const IMPORTANT_WORDS: [RegExp, number][] = [
  [/\b(clients?|customers?|boss|manager|owner|investors?|contracts?|legal|lawyer|court|visa|passport|embassy)\b/i, 30],
  [/\b(salary|payroll|rent|mortgage|bills?|invoices?|payments?|refunds?|tax|taxes|insurance|deposit|fees?)\b/i, 28],
  [/\b(exams?|tests?|interviews?|thesis|dissertation|assignments?|coursework|uni|university|school)\b/i, 28],
  [/\b(doctors?|dentist|hospital|clinic|medicine|prescriptions?|surgery|scan|blood test|health)\b/i, 30],
  [/\b(mom|mum|mama|dad|baba|mother|father|parents|husband|wife|kids?|son|daughter|family|grandma|grandad)\b/i, 26],
  [/\b(pray|prayers?|salah|salat|quran|qur'?an|hifz|memoris|memoriz|dhikr|tafsir|halaqa|masjid|mosque)\b/i, 32],
  [/\b(flights?|airport|train|visa appointment|check ?in)\b/i, 24],
  [/\b(launch|ship|go live|presentations?|pitch|proposals?|report to)\b/i, 20],
  [/\b(team|suppliers?|vendors?|lab|orders?|deliver(?:y|ies)|complaints?|apolog)\b/i, 12],
  [/\b(groceries|grocery|food|dinner|laundry|appointments?|bookings?)\b/i, 10],
];

const UNIMPORTANT_WORDS: [RegExp, number][] = [
  [/\b(maybe|someday|eventually|sometime|whenever|at some point|no rush|not urgent|if i have time|if there'?s time|would be nice|nice to have|optional)\b/i, 28],
  [/\b(scroll|scrolling|instagram|tiktok|twitter|netflix|youtube|binge|browse|window shop|pinterest)\b/i, 38],
  [/\b(rearrange|redecorate|aesthetic|reorganis|reorganiz)\b/i, 18],
];

// ── 6. Duration estimation ────────────────────────────────────────────────────

type Rule = { re: RegExp; minutes: number; energy: Energy; category: Category };

// First match wins, so the specific rules come before the generic ones.
const RULES: Rule[] = [
  // Deen
  { re: /\b(pray|salah|salat|jama'?ah|jumu'?ah|taraweeh)\b/i, minutes: 15, energy: 'rest', category: 'deen' },
  { re: /\b(quran|qur'?an|recite|recitation|tilawah|surah|juz|hifz|memoris|memoriz)\b/i, minutes: 30, energy: 'rest', category: 'deen' },
  { re: /\b(dhikr|adhkar|istighfar|dua|du'?a|tasbih)\b/i, minutes: 10, energy: 'rest', category: 'deen' },
  { re: /\b(tafsir|halaqa|islamic class|lecture on|khutbah)\b/i, minutes: 45, energy: 'deep', category: 'deen' },

  // Communication
  { re: /\b(reply|respond|answer)\b.*\b(emails?|e-mails?|messages?|dms?|texts?|whatsapp)\b/i, minutes: 15, energy: 'shallow', category: 'work' },
  { re: /\b(emails?|e-mails?|inbox)\b/i, minutes: 20, energy: 'shallow', category: 'work' },
  { re: /\b(texts?|whatsapp|dms?|messages?)\b/i, minutes: 10, energy: 'shallow', category: 'social' },
  { re: /\b(calls?|ring|phone|catch up with|speak to|talk to)\b/i, minutes: 20, energy: 'shallow', category: 'work' },
  { re: /\b(follow ?ups?|chase|check in with|remind)\b/i, minutes: 15, energy: 'shallow', category: 'work' },
  { re: /\b(meetings?|meet with|standup|stand-up|sync|zoom|google meet|interviews?)\b/i, minutes: 45, energy: 'deep', category: 'work' },

  // Deep work
  { re: /\b(write|draft|writing)\b.*\b(reports?|proposals?|essays?|articles?|blogs?|posts?|briefs?|decks?|docs?|documentation|contracts?|policies|policy|sops?)\b/i, minutes: 90, energy: 'deep', category: 'work' },
  { re: /\b(write|draft|writing|type up)\b/i, minutes: 60, energy: 'deep', category: 'work' },
  { re: /\b(presentations?|decks?|slides?|pitch)\b/i, minutes: 90, energy: 'deep', category: 'work' },
  { re: /\b(reports?|proposals?|essays?|theses|thesis|dissertation)\b/i, minutes: 90, energy: 'deep', category: 'work' },
  { re: /\b(review|proofread|go through|audit|check over|quality check|qa)\b/i, minutes: 40, energy: 'deep', category: 'work' },
  { re: /\b(fix|repair|debug|troubleshoot|sort out)\b/i, minutes: 60, energy: 'deep', category: 'work' },
  { re: /\b(install|set ?up|configure|migrate|deploy)\b/i, minutes: 60, energy: 'deep', category: 'work' },
  { re: /\b(design|mockup|wireframe|logo|banner|thumbnail)\b/i, minutes: 75, energy: 'deep', category: 'work' },
  { re: /\b(edit|editing)\b.*\b(videos?|reels?|clips?|podcasts?|photos?)\b/i, minutes: 90, energy: 'deep', category: 'work' },
  { re: /\b(film|record|shoot)\b/i, minutes: 60, energy: 'deep', category: 'work' },
  { re: /\b(plan|planning|roadmap|strategy|brainstorm|outline)\b/i, minutes: 45, energy: 'deep', category: 'work' },
  { re: /\b(spreadsheets?|excel|data entry|reconcile)\b/i, minutes: 60, energy: 'deep', category: 'finance' },

  // Study
  { re: /\b(study|studying|revise|revision|homework|assignment|coursework|flashcards|past papers?)\b/i, minutes: 60, energy: 'deep', category: 'study' },
  { re: /\b(course|lesson|tutorial|training|learn|read up on)\b/i, minutes: 45, energy: 'deep', category: 'study' },
  { re: /\b(read|reading)\b.*\b(book|chapter|pages?)\b/i, minutes: 40, energy: 'deep', category: 'study' },

  // Money and admin
  { re: /\b(pay|paying|transfer|settle)\b/i, minutes: 15, energy: 'shallow', category: 'finance' },
  { re: /\b(invoices?|invoicing)\b/i, minutes: 20, energy: 'shallow', category: 'finance' },
  { re: /\b(expenses|budget|taxes?|payroll|refunds?|bookkeep)\b/i, minutes: 40, energy: 'deep', category: 'finance' },
  { re: /\b(book|reserve|schedule|reschedule|renew|apply for|register|fill (?:in|out)|forms?|applications?|paperwork)\b/i, minutes: 25, energy: 'shallow', category: 'admin' },
  { re: /\b(print|scan|sign|upload|submit|file)\b/i, minutes: 15, energy: 'shallow', category: 'admin' },
  { re: /\b(research|compare|look into|find out|look up)\b/i, minutes: 35, energy: 'deep', category: 'admin' },

  // Home
  { re: /\b(laundry|wash(?:ing)? clothes|fold|ironing|iron)\b/i, minutes: 45, energy: 'shallow', category: 'home' },
  { re: /\b(dishes|washing up)\b/i, minutes: 20, energy: 'shallow', category: 'home' },
  { re: /\b(clean|tidy|hoover|vacuum|mop|dust|declutter|organis|organiz|sort out the)\b/i, minutes: 40, energy: 'shallow', category: 'home' },
  { re: /\b(cook|cooking|bake|meal ?prep|make (?:lunch|dinner|breakfast|food))\b/i, minutes: 50, energy: 'shallow', category: 'home' },
  { re: /\b(bin|bins|rubbish|trash|water the plants|feed the)\b/i, minutes: 10, energy: 'shallow', category: 'home' },

  // Errands
  { re: /\b(grocer|groceries|shopping|shop for|supermarket|market)\b/i, minutes: 60, energy: 'shallow', category: 'errand' },
  { re: /\b(buy|orders?|purchase|pick up|collect|drop off|return|post office|courier|parcels?)\b/i, minutes: 30, energy: 'shallow', category: 'errand' },
  { re: /\b(drive|commute|travel to|airport|petrol|fuel|car wash|mot|service the car)\b/i, minutes: 60, energy: 'shallow', category: 'errand' },

  // Health and self
  { re: /\b(doctors?|dentist|clinic|hospital|appointments?|checkup|check-up|blood test|scan|physio|prescriptions?|pharmacy)\b/i, minutes: 45, energy: 'shallow', category: 'health' },
  { re: /\b(gym|workout|exercise|run|jog|walk|yoga|pilates|stretch|swim|train)\b/i, minutes: 50, energy: 'shallow', category: 'health' },
  { re: /\b(shower|bath|skincare|hair|nails|self ?care|face mask)\b/i, minutes: 30, energy: 'rest', category: 'self' },
  { re: /\b(nap|rest|lie down|sleep|early night)\b/i, minutes: 45, energy: 'rest', category: 'rest' },
  { re: /\b(journal|reflect|muhasabah|gratitude)\b/i, minutes: 20, energy: 'rest', category: 'self' },

  // People
  { re: /\b(visit|see)\b.*\b(mom|mum|mama|dad|baba|family|grandma|grandad|aunt|uncle|cousin)\b/i, minutes: 120, energy: 'rest', category: 'family' },
  { re: /\b(family time|with the kids|play with|bedtime story|school run|pick up the kids)\b/i, minutes: 60, energy: 'rest', category: 'family' },
  { re: /\b(coffee with|lunch with|dinner with|catch up|hang out|wedding|party|invite)\b/i, minutes: 90, energy: 'rest', category: 'social' },
];

const CATEGORY_HINTS: [RegExp, Category][] = [
  [/\b(work|client|customer|team|project|office|boss|lab|supplier)\b/i, 'work'],
  [/\b(exam|uni|university|school|study|class)\b/i, 'study'],
  [/\b(pray|quran|masjid|mosque|dhikr|islamic|deen)\b/i, 'deen'],
  [/\b(house|home|kitchen|room|bathroom|garden)\b/i, 'home'],
  [/\b(mom|mum|dad|family|kids?|husband|wife)\b/i, 'family'],
  [/\b(doctor|health|medicine|gym|dentist)\b/i, 'health'],
  [/\b(money|bank|invoice|bill|salary|tax)\b/i, 'finance'],
  [/\b(form|paperwork|application|passport|visa)\b/i, 'admin'],
  [/\b(shop|store|pick up|drop off|post)\b/i, 'errand'],
  [/\b(friend|coffee|party|wedding)\b/i, 'social'],
];

const MULTIPLIERS: { re: RegExp; factor: number; why: string }[] = [
  { re: /\b(quick|quickly|just|briefly|fast|short|small|tiny|real quick)\b/i, factor: 0.5, why: '"quick" — halved the estimate' },
  { re: /\b(big|huge|deep|thorough|thoroughly|properly|proper|full|whole|entire|long|massive|complete)\b/i, factor: 1.8, why: 'sounds like a big one — stretched the estimate' },
  { re: /\b(finish|finalis|finaliz|wrap up|rest of|last bit|remaining)\b/i, factor: 0.7, why: 'partly done already — trimmed the estimate' },
  { re: /\b(start|begin|kick off|first draft|make a start|look at)\b/i, factor: 0.6, why: 'first sitting only' },
];

const COUNT_NOUNS =
  'emails?|e-mails?|calls?|messages?|invoices?|reports?|videos?|reels?|posts?|chapters?|pages?|' +
  'clients?|customers?|rooms?|loads?|tasks?|items?|forms?|applications?|orders?|tickets?|cvs?|' +
  'slides?|lessons?|papers?|juz|surahs?';

const LEAD_INS = [
  /^(?:i\s+)?(?:really\s+)?(?:need|have|has|gotta|got)\s+to\s+/i,
  /^(?:i\s+)?(?:must|should|want|wanna|would like)\s+to\s+/i,
  /^(?:i\s+)?(?:gotta|wanna|gonna)\s+/i,
  /^i\s+(?:need|have|must|should|want|will|ll)\s+/i,
  /^(?:i'?ll|ill)\s+/i,
  /^(?:don'?t forget to|dont forget to|remember to|make sure (?:to|i)|note to self:?)\s+/i,
  /^(?:todo|to-do|task):?\s*/i,
  /^(?:i'?m|im)\s+(?:supposed|meant)\s+to\s+/i,
  /^(?:then|also|and|plus|oh)\s+/i,
  /^i\s+/i,
];

const FILLER = /\b(like|kinda|sort of|i think|probably|maybe just|you know|um|uh|erm)\b/gi;

// ── 7. Per-line reading ───────────────────────────────────────────────────────

function cleanTitle(line: string, strip: string[]): string {
  // Drop the glued-on tail fragments ("…, that's a big one", "…, due friday") —
  // they were only kept so the deadline and duration could be read off them.
  const parts = line.split(/\s*,\s*/);
  while (
    parts.length > 1 &&
    (CONTINUATION.test(parts[parts.length - 1]) || QUALIFIER_ONLY.test(parts[parts.length - 1]))
  ) parts.pop();

  let t = ` ${parts.join(', ')} `;
  for (const s of strip) {
    if (!s) continue;
    t = t.replace(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ');
  }
  t = t
    .replace(/\b(takes?|will take|should take|needs?|about|around|roughly|approx\.?|maybe|like)\s*$/i, '')
    .replace(/\b(it'?ll take|that'?ll take|takes? (?:me )?(?:about|around|like)?)\b/gi, '')
    .replace(FILLER, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  for (const re of LEAD_INS) {
    const before = t;
    t = t.replace(re, '');
    if (t !== before) break;
  }

  t = t
    .replace(/^\s*to\s+/i, '')
    .replace(/^\s*(?:and|then|also)\s+/i, '')
    // A stripped duration can leave the phrase headless ("half an hour of
    // dhikr" → "of dhikr").
    .replace(/^\s*(?:of|for|on|at|in|with|about)\s+/i, '')
    .replace(/\s+\b(?:asap|urgently|right now|immediately)\b[\s.,!]*$/i, '')
    .replace(/[\s,;:.\-–—]+$/, '')
    .trim();

  // Stripping a duration or a date often leaves a dangling preposition
  // ("study for my exam for" → "study for my exam").
  for (let i = 0; i < 2; i++) {
    t = t.replace(/\s+\b(?:for|at|on|by|in|to|about|with|of|from|until|till|around|takes?)\b[\s.,]*$/i, '').trim();
  }

  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function scoreLine(line: string, matchedWords: string[]): { importance: number; urgency: number } {
  let importance = 45;
  let urgency = 28;

  for (const [re, w] of IMPORTANT_WORDS) {
    const m = line.match(re);
    if (m) { importance += w; matchedWords.push(m[0].toLowerCase()); }
  }
  for (const [re, w] of UNIMPORTANT_WORDS) {
    const m = line.match(re);
    if (m) { importance -= w; matchedWords.push(m[0].toLowerCase()); }
  }
  for (const [re, w] of URGENT_WORDS) {
    const m = line.match(re);
    if (m) { urgency += w; matchedWords.push(m[0].toLowerCase()); }
  }

  return { importance: clamp(importance, 0, 100), urgency: clamp(urgency, 0, 100) };
}

function quadrantOf(importance: number, urgency: number): Quadrant {
  const important = importance >= 55;
  const urgent = urgency >= 55;
  if (important && urgent) return 'q1';
  if (important) return 'q2';
  if (urgent) return 'q3';
  return 'q4';
}

// A line that tells us how you are doing, with nothing to actually do in it,
// is context rather than a task. "I'm on my period" is context; "I'm on my
// period so I'll read Quran instead" still has something to do.
function isSignalOnly(line: string): boolean {
  return !new RegExp(`\\b(?:${ACTION_VERBS})\\b`, 'i').test(line);
}

// ── 8. Entry point ────────────────────────────────────────────────────────────

export function parseDump(raw: string, now: Date = new Date()): ParseResult {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const result: ParseResult = { tasks: [], periodSignal: null, dayEnergy: 'normal', notes: [] };

  if (!raw.trim()) return result;

  // Whole-dump signals first.
  if (PERIOD_END.some(re => re.test(raw))) result.periodSignal = false;
  else if (PERIOD_START.some(re => re.test(raw))) result.periodSignal = true;

  if (LOW_ENERGY.test(raw)) result.dayEnergy = 'low';
  else if (HIGH_ENERGY.test(raw)) result.dayEnergy = 'high';

  const seen = new Set<string>();

  for (const line of segment(raw)) {
    // Lines that only told us how you're doing are context, not tasks.
    const carriesSignal =
      PERIOD_END.some(re => re.test(line)) ||
      PERIOD_START.some(re => re.test(line)) ||
      LOW_ENERGY.test(line) ||
      HIGH_ENERGY.test(line);
    if (carriesSignal && isSignalOnly(line)) {
      result.notes.push(line);
      continue;
    }

    const reasons: string[] = [];
    const strip: string[] = [];
    const matchedWords: string[] = [];

    // Duration
    const stated = readDuration(line);
    let minutes: number;
    let energy: Energy = 'shallow';
    let category: Category = 'other';
    let ruleMatched = false;

    if (stated) {
      minutes = stated.minutes;
      strip.push(stated.matched);
      reasons.push(`you said ${stated.matched.trim()}`);
    } else {
      const rule = RULES.find(r => r.re.test(line));
      if (rule) {
        minutes = rule.minutes;
        energy = rule.energy;
        category = rule.category;
        ruleMatched = true;
      } else {
        const words = line.split(/\s+/).filter(Boolean).length;
        minutes = words <= 4 ? 20 : words <= 9 ? 35 : 50;
      }

      // "3 emails", "two reports" → scale by the count.
      const count = line.match(new RegExp(`\\b(\\d{1,2}|two|three|four|five|six)\\s+(?:${COUNT_NOUNS})\\b`, 'i'));
      if (count) {
        const n = /^\d+$/.test(count[1]) ? Number(count[1]) : (NUMBER_WORDS[count[1].toLowerCase()] ?? 1);
        if (n > 1) {
          minutes *= clamp(n, 1, 8);
          reasons.push(`${n}× the work in one line`);
        }
      }

      // Qualifiers compose: "finish the big report" is both further along than a
      // fresh start and heavier than an average one.
      let factor = 1;
      for (const m of MULTIPLIERS) {
        if (m.re.test(line)) { factor *= m.factor; reasons.push(m.why); }
      }
      minutes *= clamp(factor, 0.4, 2.2);

      reasons.push(ruleMatched ? 'estimated from what the task is' : 'rough estimate — please adjust');
    }

    // Energy and category, even when a duration was stated.
    if (!ruleMatched) {
      const rule = RULES.find(r => r.re.test(line));
      if (rule) { energy = rule.energy; category = rule.category; }
    }
    if (category === 'other') {
      const hint = CATEGORY_HINTS.find(([re]) => re.test(line));
      if (hint) category = hint[1];
    }

    minutes = round5(clamp(minutes, 5, 480));

    // A long stretch of work or study is head work whether or not a rule said
    // so, which is what decides if it gets broken into focus sittings.
    if (energy === 'shallow' && minutes >= 45 && ['work', 'study', 'finance', 'admin'].includes(category)) {
      energy = 'deep';
    }

    // Deadline, clock time, prayer anchor
    const when = readWhen(line, today);
    // "at 3" or "after Maghrib" with no date named means today.
    if (!when.due && (when.fixedTime || when.anchor)) {
      when.due = ymd(today);
      when.label = when.label || 'today';
    }
    strip.push(...when.matched);
    if (when.label) reasons.push(`due ${when.label}`);
    if (when.fixedTime) reasons.push(`fixed at ${when.fixedTime}`);
    if (when.anchor) reasons.push(when.anchor);

    // Scores
    const scored = scoreLine(line, matchedWords);
    let importance = scored.importance;
    let urgency = clamp(scored.urgency + when.urgencyBump, 0, 100);

    // A dated task gets more urgent as the date closes in.
    if (when.due) {
      const days = Math.round((new Date(when.due).getTime() - today.getTime()) / 86_400_000);
      urgency = clamp(Math.max(urgency, days <= 0 ? 85 : days === 1 ? 70 : days <= 3 ? 58 : days <= 7 ? 45 : 35), 0, 100);
    }
    // Prayer and Quran are never "unimportant", whatever else the line says.
    if (category === 'deen') importance = Math.max(importance, 75);
    if (category === 'health') importance = Math.max(importance, 65);

    const delegable = /\b(ask|get|tell)\s+\w+\s+to\b|\bdelegate\b|\bhave (?:someone|him|her|them)\b/i.test(line);
    if (delegable) reasons.push('could be handed to someone else');

    const title = cleanTitle(line, strip);
    if (!title) continue;

    const key = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) continue;
    seen.add(key);

    if (minutes > 180) reasons.push('too big for one sitting — worth splitting');

    // "…pick up mom's prescription and visit her after Maghrib" splits into two
    // items, and the second one loses who "her" is. Inherit the subject's
    // weight and category from the item it was joined to.
    const prev = result.tasks[result.tasks.length - 1];
    if (prev && /^(?:visit|see|call|text|message|remind|ask|tell|thank|drop off|pick up|help)\s+(?:her|him|them|it|there)\b/i.test(title)) {
      importance = Math.max(importance, prev.importance);
      if (category === 'other') category = prev.category;
      reasons.push(`read as part of "${prev.title}"`);
    }

    const confidence =
      stated && (when.due || when.fixedTime) ? 'high'
      : stated || when.due || when.fixedTime || ruleMatched ? 'medium'
      : 'low';

    result.tasks.push({
      title: title.slice(0, 120),
      detail: title.length > 120 ? title.slice(120) : '',
      raw_text: line,
      category,
      quadrant: quadrantOf(importance, urgency),
      importance,
      urgency,
      est_minutes: minutes,
      est_explicit: Boolean(stated),
      energy,
      due_on: when.due,
      fixed_time: when.fixedTime,
      prayer_anchor: when.anchor,
      confidence,
      reasons,
    });
  }

  // Heaviest first, so the review list reads in the order you should work.
  const weight: Record<Quadrant, number> = { q1: 4, q2: 3, q3: 2, q4: 1 };
  result.tasks.sort(
    (a, b) =>
      weight[b.quadrant] - weight[a.quadrant] ||
      b.urgency - a.urgency ||
      b.importance - a.importance,
  );

  return result;
}

/** Estimate for a single hand-typed task, used by the manual add form. */
export function estimateOne(text: string, now: Date = new Date()): DraftTask | null {
  const parsed = parseDump(text, now);
  return parsed.tasks[0] ?? null;
}
